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
  DownOutlined,
  RightOutlined,
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
  const { getFreshToken } = useAuth();
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
  const [theoreticalOpen, setTheoreticalOpen] = useState(false);
  const [machineCodingOpen, setMachineCodingOpen] = useState(false);

  useEffect(() => {
    const loadCandidates = async () => {
      if (linkId) {
        try {
          const freshToken = await getFreshToken();
          if (freshToken) {
            dispatch(fetchCandidates({ linkId, token: freshToken }));
          }
        } catch (error) {
          console.error('Error fetching fresh token:', error);
        }
      }
    };

    if (linkId) {
      loadCandidates();
    }
  }, [linkId, dispatch, getFreshToken]);


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
          <Row gutter={[24, 24]}>
            <Col span={24}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={2} style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 700, color: '#111827' }}>
                    {linkInfo?.title || 'Interview Link Candidates'}
                  </Title>
                  <Space size={16} style={{ color: '#6B7280', fontSize: 14 }}>
                    {linkInfo?.jobId && (
                      <Space size={4}>
                        <Text strong style={{ color: '#374151' }}>Job ID:</Text>
                        <Tag style={{ margin: 0 }}>{linkInfo.jobId}</Tag>
                      </Space>
                    )}
                    {linkInfo?.role && (
                      <Space size={4}>
                        <Text strong style={{ color: '#374151' }}>Role:</Text>
                        <Text>{linkInfo.role}</Text>
                      </Space>
                    )}
                    {(linkInfo?.yearsOfExperience !== undefined && linkInfo?.yearsOfExperience !== null) && (
                      <Space size={4}>
                        <Text strong style={{ color: '#374151' }}>Experience:</Text>
                        <Text>{linkInfo.yearsOfExperience} years</Text>
                      </Space>
                    )}
                  </Space>
                </div>
              </div>
            </Col>

            {/* Topics and Machine Coding Section */}
            {(linkInfo?.topics || linkInfo?.machineQuestions) && (
              <Col span={24}>
                <Row gutter={[24, 24]}>
                  {/* Theoretical Topics Box */}
                  {linkInfo?.topics && linkInfo.topics.length > 0 && (
                    <Col xs={24} md={12}>
                      <div
                        style={{
                          borderRadius: 8,
                          padding: 8,
                          height: 'fit-content',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          marginBottom: 0,
                          transition: 'all 0.2s',
                        }}
                        onClick={() => setTheoreticalOpen(!theoreticalOpen)}
                        className="topic-box-hover"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Space align="center">
                            <div
                              style={{
                                width: 4,
                                height: 16,
                                background: '#3B82F6', // Blue accent
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              strong
                              style={{
                                color: '#374151',
                                fontSize: 14,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              Theoretical Topics
                            </Text>
                          </Space>
                          {theoreticalOpen ? <DownOutlined style={{ fontSize: 12, color: '#6B7280' }} /> : <RightOutlined style={{ fontSize: 12, color: '#6B7280' }} />}
                        </div>

                        {theoreticalOpen && (
                          <div style={{ marginTop: 16, animation: 'fadeIn 0.2s ease-in-out' }}>
                            <Space size={[8, 12]} wrap>
                              {linkInfo.topics.map((t: any, i: number) => (
                                <Tag
                                  key={i}
                                  color="blue"
                                  style={{
                                    margin: 0,
                                    padding: '4px 10px',
                                    fontSize: 13,
                                    borderRadius: 4,
                                    border: '1px solid #BFDBFE',
                                    background: '#EFF6FF',
                                    color: '#1E40AF',
                                  }}
                                >
                                  {t.name} <span style={{ opacity: 0.7, marginLeft: 4 }}>({t.questionCount})</span>
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        )}
                      </div>
                    </Col>
                  )}

                  {/* Machine Coding Box */}
                  {linkInfo?.machineQuestions && linkInfo.machineQuestions.length > 0 && (
                    <Col xs={24} md={12}>
                      <div
                        style={{
                          borderRadius: 8,
                          padding: 8,
                          height: 'fit-content',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          marginBottom: 0,
                          transition: 'all 0.2s',
                        }}
                        onClick={() => setMachineCodingOpen(!machineCodingOpen)}
                        className="topic-box-hover"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Space align="center">
                            <div
                              style={{
                                width: 4,
                                height: 16,
                                background: '#8B5CF6', // Purple accent
                                borderRadius: 2,
                              }}
                            />
                            <Text
                              strong
                              style={{
                                color: '#374151',
                                fontSize: 14,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              Coding Topics
                            </Text>
                          </Space>
                          {machineCodingOpen ? <DownOutlined style={{ fontSize: 12, color: '#6B7280' }} /> : <RightOutlined style={{ fontSize: 12, color: '#6B7280' }} />}
                        </div>

                        {machineCodingOpen && (
                          <div style={{ marginTop: 16, animation: 'fadeIn 0.2s ease-in-out' }}>
                            <Space size={[8, 12]} wrap>
                              {linkInfo.machineQuestions.map((q: any, i: number) => (
                                <Tag
                                  key={i}
                                  color="purple"
                                  style={{
                                    margin: 0,
                                    padding: '4px 10px',
                                    fontSize: 13,
                                    borderRadius: 4,
                                    border: '1px solid #DDD6FE',
                                    background: '#F5F3FF',
                                    color: '#5B21B6',
                                  }}
                                >
                                  {q.topic}
                                </Tag>
                              ))}
                            </Space>
                          </div>
                        )}
                      </div>
                    </Col>
                  )}
                </Row>
              </Col>
            )}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
