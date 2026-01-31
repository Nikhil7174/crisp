import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, Divider, Tabs, Alert, App } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { colors, spacing } from '../../styles';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch } from '../../store';
import { setError } from '../../store/slices/authSlice';

const { Title, Text } = Typography;

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { register, loading, isAuthenticated, user, error } = useAuth();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  
  // Get user type context from navigation state
  const userTypeContext = (location.state as any)?.userType;
  const returnTo = (location.state as any)?.returnTo;
  
  // Set default user type based on context
  const defaultUserType = userTypeContext || 'candidate';
  const [userType, setUserType] = useState<'candidate' | 'interviewer'>(defaultUserType);

  // Clear any existing errors when component mounts
  useEffect(() => {
    dispatch(setError(null));
  }, [dispatch]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectTo = returnTo || (user.userType === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard');
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, user, navigate, returnTo]);

  const handleSubmit = async (values: any) => {
    try {
      await register({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        userType: values.userType,
        phone: values.phone,
        company: values.company,
      });
      message.success('Registration successful!');
      // Navigation will be handled by the useEffect above
    } catch (error: any) {
      // Error is already handled by useAuth hook and displayed via Redux state
      console.error('Registration error:', error);
    }
  };

  // Clear error when user starts typing
  const handleInputChange = () => {
    if (error) {
      dispatch(setError(null));
    }
  };

  return (
    <>
      <style>
        {`
          .login-signup-button:hover {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
          }
          .login-signup-button:focus {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
          }
          .user-type-tabs .ant-tabs-nav {
            margin-bottom: 0 !important;
            border-bottom: none !important;
          }
          .user-type-tabs .ant-tabs-nav::before {
            display: none !important;
          }
          .user-type-tabs .ant-tabs-tab {
            flex: 1;
            text-align: center;
            padding: 8px 12px !important;
            margin: 0 !important;
            border-radius: 6px !important;
            transition: all 0.3s;
          }
          .user-type-tabs.ant-tabs-small .ant-tabs-tab {
            padding: 10px 10px !important;
          }
          .user-type-tabs.ant-tabs-small .ant-tabs-tab-btn {
            font-size: 14px !important;
          }
          .user-type-tabs .ant-tabs-tab-active {
            background: ${colors.primary.main} !important;
          }
          .user-type-tabs .ant-tabs-tab-active .ant-tabs-tab-btn {
            color: white !important;
            font-weight: 600 !important;
          }
          .user-type-tabs .ant-tabs-tab:not(.ant-tabs-tab-active) .ant-tabs-tab-btn {
            color: ${colors.neutral[900]} !important;
            font-weight: 600 !important;
          }
          .user-type-tabs .ant-tabs-ink-bar {
            display: none !important;
          }
          .user-type-tabs .ant-tabs-nav-list {
            width: 100%;
            display: flex;
          }
        `}
      </style>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F3F4F6',
          padding: spacing.lg,
        }}
      >
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          border: '1px solid #E5E7EB',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          borderRadius: 16,
          background: '#FFFFFF',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <Title level={2} style={{ color: '#111827', marginBottom: spacing.sm }}>
            Create Account
          </Title>
          <Text type="secondary">Join Shakra to get started</Text>
        </div>

        <Form
          form={form}
          name="register"
          onFinish={handleSubmit}
          layout="vertical"
          size="large"
          autoComplete="off"
          initialValues={{ userType: defaultUserType }}
        >
          {error && (
            <Alert
              message="Registration Failed"
              description={error}
              type="error"
              showIcon
              style={{ marginBottom: spacing.lg }}
            />
          )}
          
          <Form.Item
            name="userType"
            rules={[{ required: true }]}
            style={{ marginBottom: spacing.lg }}
          >
            <div>
              <Tabs
                activeKey={userType}
                onChange={(key) => {
                  setUserType(key as 'candidate' | 'interviewer');
                  form.setFieldsValue({ userType: key });
                }}
                items={[
                  {
                    key: 'candidate',
                    label: 'Candidate',
                  },
                  {
                    key: 'interviewer',
                    label: 'Interviewer',
                  },
                ]}
                className="user-type-tabs"
                style={{
                  width: '100%',
                }}
                tabBarStyle={{
                  marginBottom: 0,
                  background: colors.neutral[50],
                  borderRadius: 8,
                  padding: 2,
                }}
                size="small"
              />
            </div>
          </Form.Item>

          <Form.Item
            name="fullName"
            rules={[{ required: true, message: 'Please enter your full name!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Full Name"
              style={{ borderRadius: 8 }}
              onChange={handleInputChange}
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Please enter your email!' },
              { type: 'email', message: 'Please enter a valid email!' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Email"
              style={{ borderRadius: 8 }}
              onChange={handleInputChange}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Please enter a password!' },
              { min: 8, message: 'Password must be at least 8 characters!' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: 'Password must contain uppercase, lowercase, and number!',
              },
            ]}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              style={{ borderRadius: 8 }}
              onChange={handleInputChange}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirm Password"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          <Form.Item name="phone">
            <Input
              prefix={<PhoneOutlined />}
              placeholder="Phone (Optional)"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>

          {userType === 'interviewer' && (
            <Form.Item name="company">
              <Input
                prefix={<BankOutlined />}
                placeholder="Company (Optional)"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 8,
                background: colors.primary.main,
                border: `1px solid ${colors.primary.main}`,
                boxShadow: 'none',
              }}
              className="login-signup-button"
            >
              Sign Up
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">
            Already have an account?{' '}
            <Link
              to="/login"
              style={{
                color: '#111827',
                fontWeight: 500,
              }}
            >
              Sign in
            </Link>
          </Text>
        </div>
      </Card>
    </div>
    </>
  );
};

