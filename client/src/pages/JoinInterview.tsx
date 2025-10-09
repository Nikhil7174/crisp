import React, { useState, useEffect, useCallback } from 'react';
import { Card, Input, Button, Typography, message, Space, Divider, Alert } from 'antd';
import { LinkOutlined, ArrowRightOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useInterview } from '../hooks/api/useInterview';
import { API_BASE_URL } from '../constants/api';
import { colors, spacing } from '../styles';

const { Title, Text, Paragraph } = Typography;

export const JoinInterview: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token: tokenFromPath } = useParams<{ token: string }>();
  const { user, isAuthenticated } = useAuth();
  const { startInterview } = useInterview();
  const [interviewLink, setInterviewLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkInfo, setLinkInfo] = useState<any>(null);

  const validateLink = useCallback(async (token: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/interview/link/${token}`);
      if (response.data.success) {
        // Server returns 'link' not 'linkInfo'
        setLinkInfo({ ...response.data.link, token });
      } else {
        message.error(response.data.message || 'Invalid interview link');
        setLinkInfo(null);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to validate link');
      setLinkInfo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check if there's a token in the URL path or query params
    const tokenFromQuery = searchParams.get('token');
    const token = tokenFromPath || tokenFromQuery;
    
    if (token) {
      setInterviewLink(token);
      validateLink(token);
    }
  }, [searchParams, tokenFromPath, validateLink]);

  const handleValidateLink = () => {
    if (!interviewLink.trim()) {
      message.warning('Please enter an interview link or token');
      return;
    }

    // Extract token from full URL if provided
    let token = interviewLink.trim();
    try {
      const url = new URL(interviewLink);
      // Try to get token from query params
      const tokenParam = url.searchParams.get('token');
      if (tokenParam) {
        token = tokenParam;
      } else {
        // If no token in query params, use the input as-is (could be just the token)
        token = interviewLink.trim();
      }
    } catch {
      // Not a full URL, use as-is (could be just the token)
      token = interviewLink.trim();
    }

    validateLink(token);
  };

  const handleJoinInterview = async () => {
    if (!linkInfo) {
      message.error('Please validate the link first');
      return;
    }

    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate('/login', { state: { from: `/join?token=${linkInfo.token}` } });
      return;
    }

    try {
      setLoading(true);
      // Start the interview session using the useInterview hook
      const candidateData = {
        id: user?.id,
        email: user?.email,
        name: user?.fullName,
        phone: user?.phone,
      };

      const response = await startInterview(candidateData, linkInfo.token);

      if (response?.success) {
        message.success('Interview started successfully!');
        navigate(`/interview/${response.sessionId}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to start interview');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    if (isAuthenticated && user) {
      navigate(user.userType === 'interviewer' ? '/interviewer/dashboard' : '/candidate/dashboard');
    } else {
      navigate('/');
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
          maxWidth: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          borderRadius: 16,
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <Title level={2} style={{ color: colors.primary.main, marginBottom: spacing.sm }}>
            Join Interview
          </Title>
          <Text type="secondary">
            Enter your interview link or token to get started
          </Text>
        </div>

        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Link Input */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
              Interview Link or Token
            </Text>
            <Input
              size="large"
              placeholder="Paste your interview link or token here"
              prefix={<LinkOutlined />}
              value={interviewLink}
              onChange={(e) => setInterviewLink(e.target.value)}
              onPressEnter={handleValidateLink}
              disabled={loading}
              style={{ borderRadius: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: spacing.xs, display: 'block' }}>
              Example: https://crisp.com/join?token=abc123 or just "abc123"
            </Text>
          </div>

          {/* Validate Button */}
          {!linkInfo && (
            <Button
              type="primary"
              size="large"
              onClick={handleValidateLink}
              loading={loading}
              disabled={!interviewLink.trim()}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                border: 'none',
              }}
            >
              Validate Link
            </Button>
          )}

          {/* Link Info */}
          {linkInfo && (
            <>
              <Alert
                message="Valid Interview Link"
                description={
                  <div>
                    <Paragraph style={{ marginBottom: spacing.sm }}>
                      <strong>Title:</strong> {linkInfo.title}
                    </Paragraph>
                    {linkInfo.description && (
                      <Paragraph style={{ marginBottom: spacing.sm }}>
                        <strong>Description:</strong> {linkInfo.description}
                      </Paragraph>
                    )}
                    {linkInfo.expiryDate && (
                      <Paragraph style={{ marginBottom: 0 }}>
                        <strong>Valid until:</strong>{' '}
                        {new Date(linkInfo.expiryDate).toLocaleDateString()}
                      </Paragraph>
                    )}
                  </div>
                }
                type="success"
                showIcon
              />

              {!isAuthenticated && (
                <Alert
                  message="Login Required"
                  description="Please login to start the interview. You'll be redirected to the login page."
                  type="info"
                  showIcon
                />
              )}

              <Button
                type="primary"
                size="large"
                icon={<ArrowRightOutlined />}
                onClick={handleJoinInterview}
                loading={loading}
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${colors.success.main} 0%, ${colors.primary.main} 100%)`,
                  border: 'none',
                }}
              >
                {isAuthenticated ? 'Start Interview' : 'Login & Start Interview'}
              </Button>
            </>
          )}

          <Divider />

          {/* Back to Dashboard */}
          <Button
            icon={<HomeOutlined />}
            onClick={handleBackToDashboard}
            style={{ width: '100%' }}
          >
            {isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}
          </Button>
        </Space>
      </Card>
    </div>
  );
};


