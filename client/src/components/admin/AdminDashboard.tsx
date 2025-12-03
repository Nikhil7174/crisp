import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    Input
} from 'antd';
import {
    EyeOutlined,
    UserOutlined,
    TrophyOutlined,
    CheckCircleOutlined,
    SearchOutlined,
    WarningOutlined,
    SafetyCertificateOutlined,
    SafetyOutlined
} from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import { API_BASE_URL } from '../../constants/api';

const { Title, Text } = Typography;

interface SecurityEvent {
    id: number;
    event_type: string;
    source: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
    metadata?: any;
    created_at: string;
}

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
    strengths: string[];
    areasForImprovement: string[];
    overall_feedback: string;
    detailed_answers: any[];
    question_analysis: any[];
    cheating_detected: boolean;
    cheating_incidents: any[];
    security_agent_connected: boolean;
    security_events?: SecurityEvent[];
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

interface DashboardData {
    interviews: Interview[];
    statistics: {
        totalInterviews: number;
        totalCandidates: number;
        averageScore: number;
        completedInterviews: number;
        cheatingDetectedCount: number;
        securityAgentConnectedCount: number;
    };
}

export const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [filteredInterviews, setFilteredInterviews] = useState<Interview[]>([]);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    useEffect(() => {
        if (data?.interviews) {
            if (searchText.trim() === '') {
                setFilteredInterviews(data.interviews);
            } else {
                const filtered = data.interviews.filter(interview =>
                    interview.candidate_name.toLowerCase().includes(searchText.toLowerCase()) ||
                    interview.candidate_email.toLowerCase().includes(searchText.toLowerCase()) ||
                    interview.candidate_phone.includes(searchText) ||
                    interview.session_id.toLowerCase().includes(searchText.toLowerCase())
                );
                setFilteredInterviews(filtered);
            }
        }
    }, [data, searchText]);

    const fetchDashboardData = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const result = await response.json();
            if (result.success) {
                setData(result.data);
            } else {
                message.error('Failed to fetch dashboard data');
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            message.error('Error fetching dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        window.location.reload();
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
            render: (record: Interview) => (
                <Text>{record.correct_answers}/{record.total_questions}</Text>
            ),
        },
        {
            title: 'Duration',
            key: 'duration',
            render: (record: Interview) => {
                // Use duration from finalEvaluation if available, otherwise calculate from start/end time, fallback to duration field
                let durationMs = 0;
                if (record.finalEvaluation?.duration) {
                    durationMs = record.finalEvaluation.duration;
                } else if (record.start_time && record.end_time) {
                    const start = new Date(record.start_time).getTime();
                    const end = new Date(record.end_time).getTime();
                    durationMs = end - start;
                } else if (record.duration) {
                    durationMs = record.duration;
                }
                
                const durationMinutes = Math.round(durationMs / 1000 / 60);
                return <Text>{durationMinutes > 0 ? `${durationMinutes} min` : '-'}</Text>;
            },
        },
        {
            title: 'Date',
            dataIndex: 'created_at',
            key: 'date',
            render: (date: string) => (
                <Text>{new Date(date).toLocaleDateString()}</Text>
            ),
        },
        {
            title: 'Security',
            key: 'security',
            render: (record: Interview) => {
                const securityEventCount = record.security_events?.length || 0;
                const visionEvents = record.security_events?.filter(e => e.source === 'vision_security') || [];
                const desktopEvents = record.security_events?.filter(e => e.source === 'desktop_security_agent') || [];
                const highSeverityEvents = record.security_events?.filter(e => e.severity === 'high') || [];
                
                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {record.cheating_detected || highSeverityEvents.length > 0 ? (
                            <Tag color="red" icon={<WarningOutlined />}>
                                {record.cheating_detected ? 'Cheating Detected' : 'Security Alert'}
                            </Tag>
                        ) : (
                            <Tag color="green" icon={<CheckCircleOutlined />}>
                                Clean
                            </Tag>
                        )}
                        {record.security_agent_connected ? (
                            <Tag color="blue" icon={<SafetyCertificateOutlined />} style={{ fontSize: 10 }}>
                                Agent Connected
                            </Tag>
                        ) : (
                            <Tag color="orange" icon={<WarningOutlined />} style={{ fontSize: 10 }}>
                                No Agent
                            </Tag>
                        )}
                        {securityEventCount > 0 && (
                            <Tag color={highSeverityEvents.length > 0 ? 'red' : 'orange'} style={{ fontSize: 10 }}>
                                {securityEventCount} Event{securityEventCount !== 1 ? 's' : ''}
                                {visionEvents.length > 0 && ` (${visionEvents.length} vision)`}
                                {desktopEvents.length > 0 && ` (${desktopEvents.length} desktop)`}
                            </Tag>
                        )}
                    </div>
                );
            },
        },
        {
            title: 'Actions',
            key: 'actions',
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
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <Spin size="large" />
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ padding: spacing.xl, textAlign: 'center' }}>
                <Title level={3}>Failed to load dashboard data</Title>
                <Button onClick={fetchDashboardData}>Retry</Button>
            </div>
        );
    }

    return (
        <div style={{ padding: spacing.xl, background: '#fafafa', minHeight: '100vh' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.xl
            }}>
                <Title level={2} style={{ margin: 0 }}>
                    Interview Dashboard
                </Title>
                <Button onClick={handleLogout}>
                    Logout
                </Button>
            </div>

            {/* Statistics Cards */}
            <Row gutter={[16, 16]} style={{ marginBottom: spacing.xl }}>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Total Interviews"
                            value={data.statistics.totalInterviews}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: colors.primary.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Unique Candidates"
                            value={data.statistics.totalCandidates}
                            prefix={<UserOutlined />}
                            valueStyle={{ color: colors.info.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Average Score"
                            value={data.statistics.averageScore}
                            suffix="%"
                            prefix={<TrophyOutlined />}
                            valueStyle={{ color: colors.success.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Completed"
                            value={data.statistics.completedInterviews}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: colors.success.main }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Security Statistics */}
            <Row gutter={[16, 16]} style={{ marginBottom: spacing.xl }}>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Cheating Detected"
                            value={data.statistics.cheatingDetectedCount || 0}
                            prefix={<WarningOutlined />}
                            valueStyle={{ color: colors.error.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Security Agent Connected"
                            value={data.statistics.securityAgentConnectedCount || 0}
                            prefix={<SafetyCertificateOutlined />}
                            valueStyle={{ color: colors.success.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Security Coverage"
                            value={data.statistics.totalInterviews > 0 ? 
                                Math.round(((data.statistics.securityAgentConnectedCount || 0) / data.statistics.totalInterviews) * 100) : 0}
                            suffix="%"
                            prefix={<SafetyOutlined />}
                            valueStyle={{ color: colors.info.main }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={12} md={6}>
                    <Card>
                        <Statistic
                            title="Clean Interviews"
                            value={(data.statistics.totalInterviews || 0) - (data.statistics.cheatingDetectedCount || 0)}
                            prefix={<CheckCircleOutlined />}
                            valueStyle={{ color: colors.success.main }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* Interviews Table */}
            <Card>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.lg
                }}>
                    <div>
                        <Title level={3} style={{ margin: 0 }}>
                            Interview Results
                        </Title>
                        {searchText && (
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                {filteredInterviews.length} result{filteredInterviews.length !== 1 ? 's' : ''} found for "{searchText}"
                            </Text>
                        )}
                    </div>
                    <Input
                        placeholder="Search candidates by name, email, phone, or session ID..."
                        prefix={<SearchOutlined />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        style={{ width: 400 }}
                        allowClear
                    />
                </div>
                <Table
                    columns={columns}
                    dataSource={filteredInterviews}
                    rowKey="id"
                    pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} interviews`,
                    }}
                />
            </Card>

        </div>
    );
};
