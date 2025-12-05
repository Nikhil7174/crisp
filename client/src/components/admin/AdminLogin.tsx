import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Divider } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { colors, spacing } from '../../styles';
import { API_BASE_URL } from '../../constants/api';

const { Title, Text } = Typography;

interface AdminLoginProps {
    onLogin: (token: string, userData?: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('adminToken', data.token);
                message.success('Login successful!');
                onLogin(data.token, data.user);
            } else {
                message.error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            message.error('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            padding: spacing.lg
        }}>
            <Card
                style={{
                    width: '100%',
                    maxWidth: 400,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    borderRadius: 16
                }}
            >
                <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
                    <Title level={2} style={{ color: colors.primary.main, marginBottom: spacing.sm }}>
                        Interviewer Dashboard
                    </Title>
                    <Text type="secondary">
                        Sign in to view your interview results
                    </Text>
                </div>

                <Form
                    name="admin-login"
                    onFinish={handleSubmit}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Please enter your email!' },
                            { type: 'email', message: 'Please enter a valid email!' }
                        ]}
                    >
                        <Input
                            prefix={<MailOutlined />}
                            placeholder="Email"
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please enter your password!' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined />}
                            placeholder="Password"
                            style={{ borderRadius: 8 }}
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            style={{
                                width: '100%',
                                height: 48,
                                borderRadius: 8,
                                background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                                border: 'none'
                            }}
                        >
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>

                <Divider />

                <div style={{ textAlign: 'center' }}>
                    <Text type="secondary">
                        Want to conduct interviews?{' '}
                        <Link
                            to="/register"
                            state={{ defaultUserType: 'interviewer' }}
                            style={{
                                color: colors.primary.main,
                                fontWeight: 500,
                            }}
                        >
                            Sign up as Interviewer
                        </Link>
                    </Text>
                </div>

                <div style={{ textAlign: 'center', marginTop: spacing.md }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Only registered interviewers can access this dashboard
                    </Text>
                </div>
            </Card>
        </div>
    );
};
