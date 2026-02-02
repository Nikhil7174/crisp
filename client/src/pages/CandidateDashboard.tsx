import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Row,
  Col,
  Empty,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
  BuildOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { colors } from '../styles';
import { API_BASE_URL } from '../constants/api';
import './CandidateDashboard.css';

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
  company?: string;
  companyId?: number;
  companyLogo?: string;
}

export const CandidateDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // State management
  const [attempts, setAttempts] = useState<InterviewAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  // Memoized fetch function - React will handle when to call this
  const fetchAttempts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/auth/interviews`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAttempts(data.interviews || []);
          setLastFetched(new Date());
        } else {
          throw new Error(data.error || 'Failed to fetch interviews');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch interviews';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array - this function doesn't depend on any props/state

  // Manual refetch function
  const refetch = useCallback(() => {
    return fetchAttempts();
  }, [fetchAttempts]);

  // Initial fetch
  useEffect(() => {
    fetchAttempts();
  }, [fetchAttempts]);


  // Optional: Refetch on window focus (if data is very stale - 5 minutes)
  useEffect(() => {
    const handleFocus = () => {
      if (lastFetched && Date.now() - lastFetched.getTime() > 600000) {
        fetchAttempts();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchAttempts, lastFetched]);

  // Memoized computed values
  const completedAttempts = useMemo(() =>
    attempts.filter((a) => a.status === 'completed'),
    [attempts]
  );

  const interviewsThisMonth = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    const startOfMonth = dayjs().startOf('month');
    const endOfMonth = dayjs().endOf('month');
    return completedAttempts.filter((attempt) => {
      if (!attempt.startTime) return false;
      const interviewDate = dayjs(attempt.startTime);
      return interviewDate.isAfter(startOfMonth) && interviewDate.isBefore(endOfMonth);
    }).length;
  }, [completedAttempts]);

  const companiesCount = useMemo(() => {
    // Unique companies based on companyId (preferred) or company name
    const companyIds = new Set(
      attempts
        .filter(a => a.companyId)
        .map(a => a.companyId)
    );

    // Fallback to names if IDs aren't available for some logic
    const companyNames = new Set(
      attempts
        .filter(a => !a.companyId && a.company)
        .map(a => a.company!.trim())
    );

    return companyIds.size + companyNames.size;
  }, [attempts]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  const handleJoinInterview = useCallback(() => {
    navigate('/download');
  }, [navigate]);

  // Memoized table columns
  const columns = useMemo(() => [
    {
      title: 'Company',
      dataIndex: 'company',
      key: 'company',
      width: '30%',
      render: (company: string, record: InterviewAttempt) => (
        <Space>
          {record.companyLogo && (
            <img
              src={record.companyLogo}
              alt={company}
              style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain' }}
            />
          )}
          <Text style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
            {company || 'Unknown Company'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Interview Name',
      dataIndex: 'title',
      key: 'title',
      width: '50%',
      render: (title: string) => (
        <Text style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: '#111827' }}>
          {title}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'startTime',
      key: 'startTime',
      width: '20%',
      render: (date: string) => (
        <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
          {dayjs(date).format('MMM D, YYYY')}
        </Text>
      ),
    },
  ], []);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '32px 0' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
        {/* Header */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '24px 32px',
            marginBottom: 32,
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0, marginBottom: 4, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                Your Interviews
              </Title>
              <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>
                Welcome back, {user?.fullName}
              </Text>
            </Col>
            <Col>
              <Space size={12}>
                <Tooltip title="Refresh interview data">
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={refetch}
                    loading={loading}
                    size="large"
                    type="text"
                    style={{
                      color: '#6B7280',
                      border: 'none',
                      height: 36,
                      fontSize: 16,
                      padding: '0 12px',
                    }}
                  >
                  </Button>
                </Tooltip>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={handleJoinInterview}
                  size="large"
                  type="primary"
                  className="primary-cta-btn"
                  style={{
                    border: 'none',
                    background: colors.primary.main,
                    fontWeight: 500,
                    boxShadow: 'none',
                    height: 36,
                    fontSize: 16,
                    padding: '0 12px',
                  }}
                >
                  {attempts.length === 0 ? 'Start Your First Interview' : 'Take Another Interview'}
                </Button>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  size="large"
                  type="text"
                  className="ghost-logout-btn"
                  style={{
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    background: '#F3F4F6',
                    borderRadius: 6,
                    height: 36,
                    fontSize: 16,
                    padding: '0 12px',
                  }}
                >
                  Logout
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Summary Bar */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: 'none',
            borderRadius: 8,
            marginBottom: 32,
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#D1FAE5',
                border: '1px solid #A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <FileTextOutlined style={{ color: '#10B981', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Completed:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : completedAttempts.length}
                </Text>
              </Text>
            </div>

            <Text style={{ color: '#9CA3AF' }}>|</Text>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CalendarOutlined style={{ color: '#F59E0B', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>This Month:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : interviewsThisMonth}
                </Text>
              </Text>
            </div>

            <Text style={{ color: '#9CA3AF' }}>|</Text>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#E0F2FE',
                border: '1px solid #BAE6FD',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <BuildOutlined style={{ color: '#0284C7', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Companies:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : companiesCount}
                </Text>
              </Text>
            </div>
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card
            style={{
              marginBottom: 32,
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              boxShadow: 'none',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <ExclamationCircleOutlined style={{ color: colors.error.main, fontSize: 20 }} />
              <div>
                <Text strong style={{ color: '#DC2626', lineHeight: 1.6 }}>Failed to load interview data</Text>
                <br />
                <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>{error}</Text>
                <br />
                <Button
                  type="link"
                  onClick={refetch}
                  loading={loading}
                  style={{ padding: 0, marginTop: 4, height: 'auto' }}
                >
                  Try again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Interview History */}
        <Card
          title={<Title level={4} style={{ margin: 0, fontWeight: 600, fontSize: 18, lineHeight: 1.5 }}>Interview History</Title>}
          style={{ borderRadius: 8, boxShadow: 'none', border: '1px solid #E5E7EB', background: '#FFFFFF' }}
          bodyStyle={{ padding: 24 }}
        >
          {attempts.length > 0 ? (
            completedAttempts.length > 0 ? (
              <Table
                columns={columns}
                dataSource={completedAttempts}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                className="premium-table"
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text style={{ display: 'block', marginBottom: 16, color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>
                      You have interviews in progress. Complete them to see your scores!
                    </Text>
                    <Button
                      icon={<PlayCircleOutlined />}
                      onClick={handleJoinInterview}
                      size="large"
                      style={{
                        color: colors.primary.main,
                        borderColor: colors.primary.main,
                        background: 'transparent',
                        fontWeight: 500,
                      }}
                    >
                      Continue Interview
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <Text style={{ display: 'block', marginBottom: 16, color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>
                    You haven't taken any interviews yet
                  </Text>
                  <Button
                    icon={<PlayCircleOutlined />}
                    onClick={handleJoinInterview}
                    size="large"
                    style={{
                      color: colors.primary.main,
                      borderColor: colors.primary.main,
                      background: 'transparent',
                      fontWeight: 500,
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


