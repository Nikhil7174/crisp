import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Spin,
  Descriptions,
  Divider,
  Table,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  TrophyOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../constants/api';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../styles';

const { Title, Text, Paragraph } = Typography;

interface InterviewDetails {
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
  question_analysis: any;
  created_at: string;
}

export const InterviewDetails: React.FC = () => {
  const { linkId, id } = useParams<{ linkId: string; id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [interview, setInterview] = useState<InterviewDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchInterviewDetails();
    }
  }, [id]);

  const fetchInterviewDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/interviewer/interview/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success && data.data) {
        setInterview(data.data);
      } else {
        message.error(data.message || 'Failed to fetch interview details');
        // Navigate back to candidates list for this link
        if (linkId) {
          navigate(`/interviewer/link/${linkId}/candidates`);
        } else {
          navigate('/interviewer/dashboard');
        }
      }
    } catch (error) {
      console.error('Error fetching interview details:', error);
      message.error('Failed to fetch interview details');
      // Navigate back to candidates list for this link
      if (linkId) {
        navigate(`/interviewer/link/${linkId}/candidates`);
      } else {
        navigate('/interviewer/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div style={{ padding: spacing.xl }}>
        <Empty description="Interview not found" />
      </div>
    );
  }

  const answerColumns = [
    {
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      render: (text: string) => <Text>{text}</Text>,
    },
    {
      title: 'User Answer',
      dataIndex: 'userAnswer',
      key: 'userAnswer',
      render: (text: string) => (
        <Text style={{ maxWidth: 400, wordBreak: 'break-word' }}>{text}</Text>
      ),
    },
    {
      title: 'Correct',
      dataIndex: 'isCorrect',
      key: 'isCorrect',
      render: (isCorrect: boolean) => (
        <Tag color={isCorrect ? 'green' : 'red'}>
          {isCorrect ? 'Correct' : 'Incorrect'}
        </Tag>
      ),
    },
    {
      title: 'Time Taken',
      dataIndex: 'timeTaken',
      key: 'timeTaken',
      render: (time: number) => `${Math.round(time / 1000)}s`,
    },
  ];

  return (
    <div style={{ padding: spacing.xl, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            // Navigate back to candidates list for this link
            if (linkId) {
              navigate(`/interviewer/link/${linkId}/candidates`);
            } else {
              navigate(-1);
            }
          }}
          style={{ marginBottom: spacing.md }}
        >
          Back to Candidates
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Interview Details
        </Title>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: spacing.xl }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Score"
              value={interview.score || 0}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: (interview.score || 0) >= 70 ? colors.success.main : colors.error.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Correct Answers"
              value={interview.correct_answers || 0}
              suffix={`/ ${interview.total_questions || 0}`}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.primary.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Duration"
              value={interview.duration ? Math.round(interview.duration / 60000) : 0}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: colors.info.main }}
            />
          </Card>
        </Col>
      </Row>

      {/* Candidate Information */}
      <Card title="Candidate Information" style={{ marginBottom: spacing.xl }}>
        <Descriptions column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Name">{interview.candidate_name}</Descriptions.Item>
          <Descriptions.Item label="Email">{interview.candidate_email}</Descriptions.Item>
          <Descriptions.Item label="Phone">{interview.candidate_phone || 'N/A'}</Descriptions.Item>
          <Descriptions.Item label="Session ID">
            <Text code>{interview.session_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Start Time">
            {dayjs(interview.start_time).format('MMM D, YYYY HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="End Time">
            {interview.end_time ? dayjs(interview.end_time).format('MMM D, YYYY HH:mm:ss') : 'N/A'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Overall Feedback */}
      {interview.overall_feedback && (
        <Card title="Overall Feedback" style={{ marginBottom: spacing.xl }}>
          <Paragraph>{interview.overall_feedback}</Paragraph>
        </Card>
      )}

      {/* Strengths and Areas for Improvement */}
      <Row gutter={16} style={{ marginBottom: spacing.xl }}>
        <Col xs={24} sm={12}>
          <Card title="Strengths">
            {interview.strengths && interview.strengths.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {interview.strengths.map((strength, index) => (
                  <li key={index}>
                    <Text>{strength}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text type="secondary">No strengths recorded</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card title="Areas for Improvement">
            {interview.areasForImprovement && interview.areasForImprovement.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {interview.areasForImprovement.map((area, index) => (
                  <li key={index}>
                    <Text>{area}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              <Text type="secondary">No areas for improvement recorded</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Detailed Answers */}
      <Card title="Detailed Answers">
        {interview.detailed_answers && interview.detailed_answers.length > 0 ? (
          <Table
            columns={answerColumns}
            dataSource={interview.detailed_answers.map((answer, index) => ({
              ...answer,
              key: index,
            }))}
            pagination={false}
          />
        ) : (
          <Empty description="No detailed answers available" />
        )}
      </Card>
    </div>
  );
};

