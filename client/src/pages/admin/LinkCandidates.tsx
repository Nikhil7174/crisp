import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
  Spin,
  Breadcrumb,
} from 'antd';
import {
  EyeOutlined,
  UserOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import { API_BASE_URL } from '../../constants/api';

const { Title, Text } = Typography;

interface Interview {
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
  id: number;
  title: string;
  description?: string;
  totalAttempts: number;
}

export const LinkCandidates: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
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
      const token = localStorage.getItem('adminToken');
      
      // Fetch link info
      const linkResponse = await fetch(`${API_BASE_URL}/interviewer/links/${linkId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const linkData = await linkResponse.json();
      
      if (linkData.success) {
        setLinkInfo(linkData.link);
      }

      // Fetch all interviews and filter by link
      const interviewsResponse = await fetch(`${API_BASE_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const interviewsData = await interviewsResponse.json();

      if (interviewsData.success) {
        // For now, show all interviews (server will filter by interviewer)
        // TODO: Server should filter by specific link ID
        const allInterviews = interviewsData.data.interviews;
        setInterviews(allInterviews);

        // Calculate statistics
        const completedInterviews = allInterviews.filter((i: Interview) => i.end_time).length;
        const averageScore =
          allInterviews.length > 0
            ? Math.round(
                allInterviews.reduce((sum: number, i: Interview) => sum + (i.score || 0), 0) /
                  allInterviews.length
              )
            : 0;

        setStatistics({
          totalCandidates: allInterviews.length,
          averageScore,
          completedInterviews,
        });
      }
    } catch (error) {
      console.error('Error fetching link candidates:', error);
      message.error('Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (interviewId: number) => {
    navigate(`/admin/interview/${interviewId}`);
  };

  const columns = [
    {
      title: 'Candidate',
      key: 'candidate',
      render: (record: Interview) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.candidate_name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.candidate_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      width: 100,
      render: (record: Interview) => {
        // Priority: LLM evaluation overall score > finalEvaluation totalScore > legacy score
        const overallScore = record.finalEvaluation?.llmEvaluation?.overall?.score 
          ?? record.finalEvaluation?.totalScore 
          ?? record.score 
          ?? 0;
        return (
          <Tag color={overallScore >= 70 ? 'green' : overallScore >= 50 ? 'orange' : 'red'}>
            {Math.round(overallScore)}%
          </Tag>
        );
      },
      sorter: (a: Interview, b: Interview) => {
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
      title: 'Questions',
      key: 'questions',
      width: 120,
      render: (record: Interview) => (
        <Text>
          {record.correct_answers}/{record.total_questions}
        </Text>
      ),
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 100,
      render: (record: Interview) => {
        // Calculate duration from start_time and end_time (most reliable)
        if (record.start_time && record.end_time) {
          const start = new Date(record.start_time).getTime();
          const end = new Date(record.end_time).getTime();
          const durationMs = end - start;
          const durationMinutes = Math.round(durationMs / 1000 / 60);
          return <Text>{durationMinutes > 0 ? `${durationMinutes} min` : '-'}</Text>;
        }
        return <Text>-</Text>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'created_at',
      key: 'date',
      width: 130,
      render: (date: string) => <Text>{new Date(date).toLocaleDateString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (record: Interview) => (
        <Button
          type="primary"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record.id)}
          size="small"
        >
          View Details
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb
        style={{ marginBottom: spacing.lg }}
        items={[
          {
            title: (
              <span onClick={() => navigate('/admin/dashboard')} style={{ cursor: 'pointer' }}>
                <HomeOutlined /> Interview Results
              </span>
            ),
          },
          {
            title: linkInfo?.title || 'Link Results',
          },
        ]}
      />

      {/* Link Info Header */}
      <Card
        style={{
          marginBottom: spacing.xl,
          background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ color: 'white', margin: 0, marginBottom: spacing.sm }}>
              {linkInfo?.title}
            </Title>
            {linkInfo?.description && (
              <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{linkInfo.description}</Text>
            )}
          </div>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/dashboard')}
            size="large"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'white',
            }}
          >
            Back to Links
          </Button>
        </div>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.xl }}>
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
              title="Average Score"
              value={statistics.averageScore}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: colors.success.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Completed"
              value={statistics.completedInterviews}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success.main }}
            />
          </Card>
        </Col>
      </Row>

      {/* Candidates Table */}
      <Card
        title={
          <Title level={4} style={{ margin: 0 }}>
            Candidate Results
          </Title>
        }
        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Table
          columns={columns}
          dataSource={interviews}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} candidates`,
          }}
        />
      </Card>
    </div>
  );
};








