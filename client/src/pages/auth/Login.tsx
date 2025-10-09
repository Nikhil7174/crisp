import React, { useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Divider } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { colors, spacing } from '../../styles';
import { useAuth } from '../../hooks/useAuth';

const { Title, Text } = Typography;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, isAuthenticated, user } = useAuth();
  const [form] = Form.useForm();

  // Get user type context from navigation state
  const userTypeContext = (location.state as any)?.userType;
  const returnTo = (location.state as any)?.returnTo;

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const from = returnTo || (location.state as any)?.from || 
        (user.userType === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location, returnTo]);

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      message.success('Login successful!');
      // Navigation will be handled by the useEffect above
    } catch (error: any) {
      message.error(error.message || 'Login failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
        padding: spacing.lg,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 450,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <Title level={2} style={{ color: colors.primary.main, marginBottom: spacing.sm }}>
            {userTypeContext === 'candidate' ? 'Candidate Login' : 
             userTypeContext === 'interviewer' ? 'Interviewer Login' : 
             'Welcome Back'}
          </Title>
          <Text type="secondary">
            {userTypeContext === 'candidate' ? 'Sign in to practice interviews and track your progress' :
             userTypeContext === 'interviewer' ? 'Sign in to create and manage interview links' :
             'Sign in to continue to Crisp'}
          </Text>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          autoComplete="off"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
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
                border: 'none',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Don't have an account?{' '}
            <Link
              to="/register"
              style={{
                color: colors.primary.main,
                fontWeight: 500,
              }}
            >
              Sign up
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

