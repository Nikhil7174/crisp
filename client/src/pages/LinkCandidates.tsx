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
  message,
  Spin,
  Tooltip,
  Input,
} from 'antd';
import {
  TrophyOutlined,
  IdcardOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../styles';
import './LinkCandidates.css';
import { BackButton } from '../components/ui/BackButton';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchCandidates, type Candidate } from '../store/slices/candidatesSlice';

const { Title, Text } = Typography;

export const LinkCandidates: React.FC = () => {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const dispatch = useAppDispatch();

  // Redux state
  const linkData = useAppSelector((state) =>
    linkId ? state.candidates.byLinkId[linkId] : undefined
  );

  const candidates = linkData?.candidates || [];
  const linkInfo = linkData?.linkInfo || null;
  const loading = linkData?.loading ?? true;
  const statistics = linkData?.statistics || {
    totalCandidates: 0,
    averageScore: 0,
    completedInterviews: 0,
  };

  // Search state
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    if (linkId && token) {
      dispatch(fetchCandidates({ linkId, token }));
    }
  }, [linkId, token, dispatch]);


  const handleViewDetails = (candidate: Candidate) => {
    console.log('Navigating to interview details for candidate:', candidate);
    console.log('Link ID:', linkId);
    console.log('Interview ID:', candidate.id);
    console.log('Navigation URL:', `/interviewer/link/${linkId}/candidates/candidate/${candidate.id}`);
    // Navigate to interview details page (nested under the link's candidates)
    navigate(`/interviewer/link/${linkId}/candidates/candidate/${candidate.id}`);
  };

  // Filter candidates based on search text
  const filteredCandidates = React.useMemo(() => {
    let result = candidates || [];
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(c =>
        c.candidate_name.toLowerCase().includes(lower) ||
        c.candidate_email.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [candidates, searchText]);

  const columns = [
    {
      title: (
        <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {searchVisible ? (
            <Input
              placeholder="Search candidate..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onBlur={() => {
                if (!searchText) setSearchVisible(false);
              }}
              autoFocus
              prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', fontSize: 13 }}
            />
          ) : (
            <div
              onClick={() => setSearchVisible(true)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: '100%'
              }}
            >
              Candidate <SearchOutlined style={{ fontSize: 12, color: '#9CA3AF' }} />
            </div>
          )}
        </div>
      ),
      key: 'candidate',
      width: 300,
      onHeaderCell: () => ({ style: { textAlign: 'center' as const } }),
      render: (_: any, record: Candidate) => (
        <div>
          <Text style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: '#111827', display: 'block' }}>
            {record.candidate_name}
          </Text>
          <Text style={{ fontSize: 12, lineHeight: 1.5, color: '#6B7280' }}>
            {record.candidate_email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      align: 'center' as const,
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
      align: 'center' as const,
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
      align: 'center' as const,
      render: (_: any, record: Candidate) => {
        // Calculate duration from start_time and end_time (most reliable)
        if (record.start_time && record.end_time) {
          const start = new Date(record.start_time).getTime();
          const end = new Date(record.end_time).getTime();
          const durationMs = end - start;
          const durationMinutes = Math.round(durationMs / 1000 / 60);
          return (
            <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
              {durationMinutes} min
            </Text>
          );
        }
        return (
          <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
            -
          </Text>
        );
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
      align: 'center' as const,
      render: (date: string) => (
        <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
          {dayjs(date).format('MMM D, YYYY HH:mm')}
        </Text>
      ),
      sorter: (a: Candidate, b: Candidate) => {
        const dateA = new Date(a.start_time).getTime();
        const dateB = new Date(b.start_time).getTime();
        return dateA - dateB;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: Candidate) => (
        <Space>
          <Tooltip title="View Interview Details">
            <Button
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
              size="small"
              type="default"
              className="view-details-btn"
              style={{
                color: colors.primary.main,
                borderColor: colors.primary.main,
                background: 'transparent',
                fontWeight: 500,
                fontSize: 13,
                height: 28,
                padding: '0 10px',
                ['--primary-color' as any]: colors.primary.main
              }}
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
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '80px 0 32px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 20, left: 24 }}>
        <BackButton
          label="Back"
          onClick={() => navigate('/interviewer/dashboard')}
        />
      </div>
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
                {linkInfo?.title || 'Interview Link Candidates'}
              </Title>
              {linkInfo?.description && (
                <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>
                  {linkInfo.description}
                </Text>
              )}
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
                background: '#E0F2FE',
                border: '1px solid #BAE6FD',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IdcardOutlined style={{ color: '#0284C7', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Total Candidates:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {statistics.totalCandidates}
                </Text>
              </Text>
            </div>

            <Text style={{ color: '#9CA3AF' }}>|</Text>

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
                <CheckCircleOutlined style={{ color: '#10B981', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Completed:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {statistics.completedInterviews}
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
                <TrophyOutlined style={{ color: '#F59E0B', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Average Score:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {statistics.averageScore}%
                </Text>
              </Text>
            </div>
          </div>
        </Card>

        {/* Candidates Table */}
        <Card
          title={
            <Title level={4} style={{ margin: 0, fontWeight: 600, fontSize: 18, lineHeight: 1.5 }}>
              Candidates
            </Title>
          }
          style={{ borderRadius: 8, boxShadow: 'none', border: '1px solid #E5E7EB', background: '#FFFFFF' }}
          bodyStyle={{ padding: 24 }}
        >
          <Table
            columns={columns}
            dataSource={filteredCandidates}
            rowKey="id"
            loading={loading}
            className="premium-table"
            pagination={{ pageSize: 10 }}
            locale={{
              emptyText: 'No candidates have taken this interview yet'
            }}
          />
        </Card>
      </div>
    </div>
  );
};
