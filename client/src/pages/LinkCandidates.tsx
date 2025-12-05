import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Typography,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined,
  TrophyOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../constants/api';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../styles';

const { Title, Text } = Typography;

interface Candidate {
  id: number;
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  start_time: string;
  end_time: string;
  duration: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  time_spent: number;
  strengths: string[];
  areasForImprovement: string[];
  overall_feedback: string;
  detailed_answers: any[];
  question_analysis: any[];
  created_at: string;
  finalEvaluation?: {
    totalScore: number;
    duration: number;
    llmEvaluation?: {
      overall: {
        score: number;
      };
    } | null;
  } | null;
}

interface LinkInfo {
  title: string;
  description?: string;
}

export const LinkCandidates: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    totalCandidates: 0,
    averageScore: 0,
    completedInterviews: 0,
  });

  useEffect(() => {
    if (linkId) {
      fetchLinkCandidates();
    }
  }, [linkId]);

  const fetchLinkCandidates = async () => {
    try {
      setLoading(true);
      console.log('Fetching candidates for link ID:', linkId);
      console.log('API URL:', `${API_BASE_URL}/interviewer/links/${linkId}/candidates`);
      console.log('Token exists:', token ? 'Yes' : 'No');
      
      const response = await fetch(`${API_BASE_URL}/interviewer/links/${linkId}/candidates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      console.log('API Response:', data);

      if (data.success) {
        const candidateList = Array.isArray(data.candidates) ? data.candidates : [];
        setLinkInfo(data.link);
        setCandidates(candidateList);

        // Calculate statistics
        const completedInterviews = candidateList.filter((c: Candidate) => c.end_time).length;
        
        // Calculate average score using the same priority as admin dashboard
        // Priority: LLM evaluation overall score > finalEvaluation totalScore > legacy score
        const scores: number[] = [];
        candidateList.forEach((c: Candidate) => {
          if (!c.end_time) return; // Skip incomplete interviews
          
          let score: number | null = null;
          
          // Check LLM evaluation first (most accurate)
          if (c.finalEvaluation?.llmEvaluation?.overall?.score !== null && 
              c.finalEvaluation?.llmEvaluation?.overall?.score !== undefined) {
            score = c.finalEvaluation.llmEvaluation.overall.score;
          }
          // Check finalEvaluation totalScore
          else if (c.finalEvaluation?.totalScore !== null && 
                   c.finalEvaluation?.totalScore !== undefined) {
            score = c.finalEvaluation.totalScore;
          }
          // Check interview.score
          else if (c.score !== null && c.score !== undefined) {
            score = c.score;
          }
          
          // Only add if we found a valid score (including 0 as valid)
          if (score !== null && score !== undefined) {
            scores.push(score);
            console.log(`[LinkCandidates] Candidate ${c.id}: score=${score} (from ${c.finalEvaluation?.llmEvaluation ? 'llmEvaluation' : c.finalEvaluation ? 'finalEvaluation.totalScore' : 'interview.score'})`);
          }
        });
        
        const averageScore = scores.length > 0
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : 0;
        
        console.log(`[LinkCandidates] Total candidates: ${candidateList.length}, Completed: ${completedInterviews}, With scores: ${scores.length}, Average: ${averageScore}`);

        setStatistics({
          totalCandidates: candidateList.length,
          averageScore,
          completedInterviews,
        });
      } else {
        message.error(data.message || 'Failed to fetch candidates');
      }
    } catch (error) {
      console.error('Error fetching link candidates:', error);
      message.error('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (candidate: Candidate) => {
    console.log('Navigating to interview details for candidate:', candidate);
    console.log('Link ID:', linkId);
    console.log('Interview ID:', candidate.id);
    console.log('Navigation URL:', `/interviewer/link/${linkId}/candidates/candidate/${candidate.id}`);
    // Navigate to interview details page (nested under the link's candidates)
    navigate(`/interviewer/link/${linkId}/candidates/candidate/${candidate.id}`);
  };

  const columns = [
    {
      title: 'Candidate',
      key: 'candidate',
      render: (_: any, record: Candidate) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.candidate_name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.candidate_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: Candidate) => (
        <Tag
          icon={record.end_time ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          color={record.end_time ? 'success' : 'processing'}
        >
          {record.end_time ? 'Completed' : 'In Progress'}
        </Tag>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      render: (_: any, record: Candidate) => {
        // Priority: LLM evaluation overall score > finalEvaluation totalScore > legacy score
        const overallScore = record.finalEvaluation?.llmEvaluation?.overall?.score 
          ?? record.finalEvaluation?.totalScore 
          ?? record.score 
          ?? 0;
        return (
          <Tag
            icon={<TrophyOutlined />}
            color={overallScore >= 70 ? 'green' : overallScore >= 50 ? 'orange' : 'red'}
          >
            {Math.round(overallScore)}%
          </Tag>
        );
      },
      sorter: (a: Candidate, b: Candidate) => {
        const scoreA = a.finalEvaluation?.llmEvaluation?.overall?.score 
          ?? a.finalEvaluation?.totalScore 
          ?? a.score 
          ?? 0;
        const scoreB = b.finalEvaluation?.llmEvaluation?.overall?.score 
          ?? b.finalEvaluation?.totalScore 
          ?? b.score 
          ?? 0;
        return scoreA - scoreB;
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: any, record: Candidate) => {
        // Calculate duration from start_time and end_time (most reliable)
        if (record.start_time && record.end_time) {
          const start = new Date(record.start_time).getTime();
          const end = new Date(record.end_time).getTime();
          const durationMs = end - start;
          const durationMinutes = Math.round(durationMs / 1000 / 60);
          return `${durationMinutes} min`;
        }
        return '-';
      },
      sorter: (a: Candidate, b: Candidate) => {
        const getDuration = (record: Candidate): number => {
          if (record.start_time && record.end_time) {
            const start = new Date(record.start_time).getTime();
            const end = new Date(record.end_time).getTime();
            return end - start;
          }
          return 0;
        };
        return getDuration(a) - getDuration(b);
      },
    },
    {
      title: 'Started',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (date: string) => dayjs(date).format('MMM D, YYYY HH:mm'),
      sorter: (a: Candidate, b: Candidate) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return dateA - dateB;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Candidate) => (
        <Space>
          <Tooltip title="View Interview Details">
            <Button
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              size="small"
              type="primary"
            >
              View Details
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: spacing.xl, background: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/interviewer/dashboard')}
          style={{ marginBottom: spacing.md }}
        >
          Back to Dashboard
        </Button>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: spacing.md
        }}>
          <div>
            <Title level={2} style={{ margin: 0 }}>
              {linkInfo?.title || 'Interview Link Candidates'}
            </Title>
            {linkInfo?.description && (
              <Text type="secondary">{linkInfo.description}</Text>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: spacing.xl }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Candidates"
              value={statistics.totalCandidates}
              prefix={<UserOutlined />}
              valueStyle={{ color: colors.primary.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed Interviews"
              value={statistics.completedInterviews}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Average Score"
              value={statistics.averageScore}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: colors.info.main }}
            />
          </Card>
        </Col>
      </Row>

      {/* Candidates Table */}
      <Card
        title="Candidates"
        style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Table
          columns={columns}
          dataSource={candidates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{
            emptyText: 'No candidates have taken this interview yet'
          }}
        />
      </Card>
    </div>
  );
};
