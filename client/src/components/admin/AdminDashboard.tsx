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
    SearchOutlined
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
    strengths: string[];
    areasForImprovement: string[];
    overall_feedback: string;
    detailed_answers: any[];
    question_analysis: any[];
    created_at: string;
}

interface DashboardData {
    interviews: Interview[];
    statistics: {
        totalInterviews: number;
        totalCandidates: number;
        averageScore: number;
        completedInterviews: number;
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
            dataIndex: 'score',
            key: 'score',
            render: (score: number) => (
                <Tag color={score >= 70 ? 'green' : score >= 50 ? 'orange' : 'red'}>
                    {score}%
                </Tag>
            ),
            sorter: (a: Interview, b: Interview) => a.score - b.score,
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
            dataIndex: 'duration',
            key: 'duration',
            render: (duration: number) => (
                <Text>{Math.round(duration / 1000 / 60)} min</Text>
            ),
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
        <div style={{ padding: spacing.xl, background: '#f5f5f5', minHeight: '100vh' }}>
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
