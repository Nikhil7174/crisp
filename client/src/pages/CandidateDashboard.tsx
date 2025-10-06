import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  Empty,
  Progress,
  Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  FileTextOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants/api';
import { colors, spacing } from '../styles';

const { Title, Text } = Typography;

interface InterviewAttempt {
  id: number;
  sessionId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  score?: number;
  startTime: string;
  endTime?: string;
  duration?: number;
  totalQuestions: number;
  answeredQuestions: number;
}

export const CandidateDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAttempts();
  }, []);

  const fetchAttempts = async () => {
    try {
      setLoading(true);
      // This endpoint would need to be implemented on the backend
      // For now, we'll use mock data
      setAttempts([]);
    } catch (error) {
      console.error('Failed to fetch attempts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleJoinInterview = () => {
    navigate('/join');
  };

  const handleResumeInterview = (sessionId: string) => {
    navigate(`/interview/${sessionId}`);
  };

  const columns = [
    {
      title: 'Interview',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <strong>{title}</strong>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusConfig = {
          pending: { color: 'default', text: 'Pending' },
          in_progress: { color: 'processing', text: 'In Progress' },
          completed: { color: 'success', text: 'Completed' },
          cancelled: { color: 'error', text: 'Cancelled' },
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      render: (_: any, record: InterviewAttempt) => {
        const percentage = (record.answeredQuestions / record.totalQuestions) * 100;
        return (
          <div style={{ width: 120 }}>
            <Progress
              percent={Math.round(percentage)}
              size="small"
              status={record.status === 'completed' ? 'success' : 'active'}
            />
          </div>
        );
      },
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      render: (score?: number) =>
        score !== undefined ? (
          <Tag color={score >= 70 ? 'success' : score >= 50 ? 'warning' : 'error'}>
            {score}%
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Date',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (date: string) => dayjs(date).format('MMM D, YYYY h:mm A'),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration?: number) =>
        duration ? `${Math.round(duration / 60)} min` : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: InterviewAttempt) => {
        if (record.status === 'in_progress') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleResumeInterview(record.sessionId)}
            >
              Resume
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const completedAttempts = attempts.filter((a) => a.status === 'completed');
  const averageScore =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length
        )
      : 0;
  const inProgressCount = attempts.filter((a) => a.status === 'in_progress').length;

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: spacing.xl }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            borderRadius: 16,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            color: 'white',
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ color: 'white', margin: 0 }}>
                Welcome, {user?.fullName}!
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
                Track your interview progress and practice for success
              </Text>
            </Col>
            <Col>
              <Space>
                <Button
                  type="default"
                  icon={<PlayCircleOutlined />}
                  onClick={handleJoinInterview}
                  size="large"
                  style={{
                    background: 'white',
                    color: colors.primary.main,
                    border: 'none',
                    fontWeight: 600,
                  }}
                >
                  Join Interview
                </Button>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  size="large"
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: 'none',
                  }}
                >
                  Logout
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Statistics */}
        <Row gutter={16} style={{ marginBottom: spacing.xl }}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Interviews"
                value={attempts.length}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: colors.primary.main }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="In Progress"
                value={inProgressCount}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: colors.warning.main }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Average Score"
                value={averageScore}
                suffix="%"
                prefix={<TrophyOutlined />}
                valueStyle={{
                  color:
                    averageScore >= 70
                      ? colors.success.main
                      : averageScore >= 50
                      ? colors.warning.main
                      : colors.error.main,
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Interview History */}
        <Card
          title={<Title level={4} style={{ margin: 0 }}>Interview History</Title>}
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
          extra={
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleJoinInterview}
              style={{
                background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                border: 'none',
              }}
            >
              Start New Interview
            </Button>
          }
        >
          {attempts.length > 0 ? (
            <Table
              columns={columns}
              dataSource={attempts}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
                    You haven't taken any interviews yet
                  </Text>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleJoinInterview}
                    size="large"
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                      border: 'none',
                    }}
                  >
                    Join Your First Interview
                  </Button>
                </div>
              }
            />
          )}
        </Card>
      </div>
    </div>
  );
};


