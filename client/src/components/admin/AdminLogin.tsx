import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';

const { Title, Text } = Typography;

interface AdminLoginProps {
    onLogin: (token: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
    const [loading, setLoading] = useState(false);
    const API_BASE_URL = 'http://localhost:3001/api';

    const handleSubmit = async (values: { username: string; password: string }) => {
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
                onLogin(data.token);
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
                        Admin Dashboard
                    </Title>
                    <Text type="secondary">
                        Sign in to view interview results
                    </Text>
                </div>

                <Form
                    name="admin-login"
                    onFinish={handleSubmit}
                    layout="vertical"
                    size="large"
                >
                    <Form.Item
                        name="username"
                        rules={[{ required: true, message: 'Please enter your username!' }]}
                    >
                        <Input
                            prefix={<UserOutlined />}
                            placeholder="Username"
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

                <div style={{ textAlign: 'center', marginTop: spacing.lg }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Default credentials: admin / admin123
                    </Text>
                </div>
            </Card>
        </div>
    );
};
