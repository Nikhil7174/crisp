import React, { useState } from 'react';
import { Card, Button, Typography, Space, Divider, Alert } from 'antd';
import { ArrowRightOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../styles';
import { DownloadModal } from '../components/DownloadModal';

const { Title, Text } = Typography;

export const JoinInterview: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const handleJoinInterview = async () => {
    setShowDownloadModal(true);
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
          <Alert
            message="Desktop App Required"
            description="The interview experience is now available through our desktop application. Download it to get started with secure, high-quality interviews."
            type="info"
            showIcon
          />

          <Button
            type="primary"
            size="large"
            icon={<ArrowRightOutlined />}
            onClick={handleJoinInterview}
            style={{
              width: '100%',
              height: 48,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
              border: 'none',
            }}
          >
            Start Interview
          </Button>

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
      
      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </div>
  );
};


