import React from 'react';
import { Modal, Button, Typography, Space } from 'antd';
import { DownloadOutlined, DesktopOutlined, CheckCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { colors, spacing, borderRadius } from '../styles';

const { Title, Text } = Typography;

interface DownloadModalProps {
  visible: boolean;
  onClose: () => void;
}

export const DownloadModal: React.FC<DownloadModalProps> = ({ visible, onClose }) => {
  const handleDownload = () => {
    // TODO: Replace with actual download URL
    window.open('https://shakra.com/download', '_blank');
  };

  const features = [
    'Enhanced security and monitoring',
    'Better performance and reliability',
    'Background process monitoring',
    'Advanced interview features',
  ];

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={520}
      centered
      closeIcon={<CloseOutlined style={{ color: colors.neutral[500] }} />}
      styles={{
        body: { padding: 0 },
        content: { borderRadius: borderRadius.xl, overflow: 'hidden' },
      }}
    >
      <div style={{ padding: spacing.lg }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: spacing.lg,
            boxShadow: `0 8px 24px rgba(9, 88, 217, 0.25)`,
          }}>
            <DesktopOutlined style={{ fontSize: 36, color: 'white' }} />
          </div>
          
          <Title level={3} style={{ marginBottom: spacing.sm, color: colors.neutral[900], fontWeight: 600 }}>
            Download Desktop App
          </Title>
          
          <Text type="secondary" style={{ fontSize: 15, lineHeight: 1.6 }}>
            Join interviews with our secure desktop application for the best experience
          </Text>
        </div>

        {/* Features */}
        <div style={{ 
          marginBottom: spacing.xxl,
          background: colors.neutral[50],
          borderRadius: borderRadius.md,
          padding: spacing.lg,
        }}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {features.map((feature, index) => (
              <div 
                key={index}
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: spacing.md,
                }}
              >
                <CheckCircleOutlined 
                  style={{ 
                    color: colors.success.main, 
                    fontSize: 18,
                    marginTop: 2,
                    flexShrink: 0,
                  }} 
                />
                <Text style={{ fontSize: 14, color: colors.neutral[700], lineHeight: 1.6 }}>
                  {feature}
                </Text>
              </div>
            ))}
          </Space>
        </div>

        {/* Action Buttons */}
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            block
            style={{
              height: 52,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: borderRadius.md,
              background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
              border: 'none',
              boxShadow: `0 4px 12px rgba(9, 88, 217, 0.3)`,
            }}
          >
            Download Now
          </Button>
          
          <Button
            type="text"
            size="large"
            onClick={onClose}
            block
            style={{
              height: 44,
              fontSize: 15,
              color: colors.neutral[600],
              fontWeight: 500,
            }}
          >
            Maybe Later
          </Button>
        </Space>

        {/* Footer Info */}
        <div style={{ textAlign: 'center', marginTop: spacing.lg }}>
          <Text type="secondary" style={{ fontSize: 12, color: colors.neutral[500] }}>
            Available for Windows, macOS & Linux
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;
