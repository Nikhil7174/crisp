import React from 'react';
import { Modal, Button, Typography, Space, Divider, Alert } from 'antd';
import { DownloadOutlined, DesktopOutlined, CheckCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '../styles';

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

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={600}
      centered
      styles={{
        body: { padding: 0 }
      }}
    >
      <div style={{ padding: spacing.xl }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            marginBottom: spacing.lg
          }}>
            <DesktopOutlined style={{ fontSize: 32, color: 'white' }} />
          </div>
          
          <Title level={2} style={{ marginBottom: spacing.sm, color: colors.neutral[900] }}>
            Download Shakra Desktop App
          </Title>
          
          <Text type="secondary" style={{ fontSize: 16 }}>
            Get the full interview experience with our desktop application
          </Text>
        </div>

        {/* Features */}
        <div style={{ marginBottom: spacing.xl }}>
          <Title level={4} style={{ marginBottom: spacing.md }}>
            Why download the desktop app?
          </Title>
          
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircleOutlined style={{ color: colors.success.main }} />
              <Text>Enhanced security and monitoring</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircleOutlined style={{ color: colors.success.main }} />
              <Text>Better performance and reliability</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircleOutlined style={{ color: colors.success.main }} />
              <Text>Offline capabilities</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
              <CheckCircleOutlined style={{ color: colors.success.main }} />
              <Text>Advanced interview features</Text>
            </div>
          </Space>
        </div>

        {/* Info Alert */}
        <Alert
          message="Desktop App Required"
          description="To participate in interviews, you need to download and install the Shakra desktop application. This ensures a secure and optimal interview experience."
          type="info"
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: spacing.xl }}
        />

        {/* Action Buttons */}
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            style={{
              height: 48,
              paddingLeft: spacing.xl,
              paddingRight: spacing.xl,
              fontSize: 16,
              fontWeight: 600,
              borderRadius: 8,
              background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
              border: 'none',
            }}
          >
            Download Desktop App
          </Button>
          
          <Button
            size="large"
            onClick={onClose}
            style={{
              height: 48,
              paddingLeft: spacing.xl,
              paddingRight: spacing.xl,
              fontSize: 16,
              borderRadius: 8,
            }}
          >
            Maybe Later
          </Button>
        </Space>

        <Divider />

        {/* Footer Info */}
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Available for Windows
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadModal;
