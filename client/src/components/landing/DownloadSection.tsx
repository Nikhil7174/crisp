// src/components/landing/DownloadSection.tsx
import React from 'react';
import { Typography, Space, Row, Col, Card, Button } from 'antd';
import { DownloadOutlined, WindowsOutlined, AppleOutlined, LinuxOutlined, DownOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { usePostHog } from '@posthog/react';
import { colors, spacing, borderRadius, typography } from '../../styles';

const { Title, Paragraph } = Typography;

const downloadOptions = [
  {
    platform: 'Windows',
    icon: <WindowsOutlined />,
    downloads: [
      { name: 'Windows', format: 'exe', url: 'https://github.com/Nikhil7174/Shakra-Builds/releases/download/v2.0.0/shakra-ai-interview-1.0.0-setup.exe' },
    ],
  },
  {
    platform: 'macOS',
    icon: <AppleOutlined />,
    downloads: [
      { name: 'macOS', format: 'dmg', url: 'https://github.com/Nikhil7174/Shakra-Builds/releases/download/v2.0.0/shakra-ai-interview-1.0.0.dmg' },
    ],
  },
  {
    platform: 'Linux',
    icon: <LinuxOutlined />,
    downloads: [
      { name: 'AppImage', format: 'AppImage', url: 'https://github.com/Nikhil7174/Shakra-Builds/releases/download/v2.0.0/shakra-ai-interview-1.0.0.AppImage' },
      { name: 'Debian', format: 'deb', url: 'https://github.com/Nikhil7174/Shakra-Builds/releases/download/v2.0.0/shakra-ai-interview_1.0.0_amd64.deb' },
      { name: 'Snap', format: 'snap', url: 'https://github.com/Nikhil7174/Shakra-Builds/releases/download/v2.0.0/shakra-ai-interview_1.0.0_amd64.snap' },
    ],
  },
];

export const DownloadSection: React.FC = () => {
  const [showLinuxOptions, setShowLinuxOptions] = React.useState(false);
  const posthog = usePostHog();

  const handleDownload = (url: string, platform: string, format: string) => {
    posthog?.capture('download_app_clicked', { platform, format });
    window.open(url, '_blank');
  };

  return (
    <>
      <style>{`
        @media (min-width: 800px) {
          .download-option-col {
            height: 320px;
          }
        }
      `}</style>
      <div
        id="download-section"
        style={{
          padding: `${spacing.xxxl * 1.5}px ${spacing.lg}px ${spacing.xxl}px ${spacing.lg}px`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Header */}
              <div style={{ textAlign: 'center', marginBottom: spacing.xxl }}>

                <Title
                  level={2}
                  style={{
                    marginBottom: spacing.md,
                    color: colors.neutral[900],
                    fontSize: typography.fontSize['4xl'],
                    fontWeight: typography.fontWeight.bold,
                    fontFamily: '"Varela Round", sans-serif',
                  }}
                >
                  Give your first interview with Shakra.
                </Title>
                <Paragraph
                  style={{
                    fontSize: typography.fontSize.lg,
                    color: colors.neutral[600],
                    maxWidth: 600,
                    margin: '0 auto',
                    lineHeight: typography.lineHeight.relaxed,
                  }}
                >
                  Join interviews with our secure desktop application for the best experience
                </Paragraph>
              </div>

              {/* Download Options */}
              <Row gutter={[spacing.lg, spacing.lg]}>
                {downloadOptions.map((option, index) => (
                  <Col xs={24} md={8} key={option.platform} className="download-option-col">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1, duration: 0.4 }}
                    >
                      <Card
                        style={{
                          borderRadius: borderRadius.xl,
                          border: '1px solid #E5E7EB',
                          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                          background: colors.background.primary,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          maxWidth: 340,
                          margin: '0 auto',
                        }}
                        bodyStyle={{
                          padding: spacing.lg,
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                        }}
                      >
                        <Space
                          direction="vertical"
                          size="middle"
                          style={{ width: '100%', flex: 1 }}
                        >
                          {/* Platform Header */}
                          <div style={{ textAlign: 'center' }}>
                            <div
                              style={{
                                fontSize: 36,
                                color: colors.neutral[900],
                                marginBottom: spacing.md,
                              }}
                            >
                              {option.icon}
                            </div>
                            <Title
                              level={4}
                              style={{
                                margin: 0,
                                color: colors.neutral[900],
                                fontSize: 16,
                                fontWeight: typography.fontWeight.medium,
                              }}
                            >
                              {option.platform}
                            </Title>
                          </div>

                          {/* Download Buttons */}

                          <Space
                            direction="vertical"
                            size="small"
                            style={{ width: '100%', marginTop: 'auto', alignItems: 'center' }}
                          >
                            {option.platform === 'Linux' ? (
                              <>
                                <div style={{ position: 'relative', width: 180, display: 'flex', justifyContent: 'center' }}>
                                  <Button
                                    type="default"
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => handleDownload(option.downloads[0].url, option.platform, option.downloads[0].format)}
                                    style={{
                                      height: 36,
                                      fontSize: typography.fontSize.sm,
                                      fontWeight: typography.fontWeight.medium,
                                      borderRadius: borderRadius.md,
                                      width: 180,
                                      background: colors.background.primary,
                                      border: `1px solid ${colors.primary.main}`,
                                      color: colors.primary.main,
                                      boxShadow: '0 0 0 1px rgba(9, 88, 217, 0.06), 0 4px 10px rgba(9, 88, 217, 0.16)',
                                    }}
                                  >
                                    {option.downloads[0].name}
                                  </Button>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DownOutlined />}
                                    onClick={() => setShowLinuxOptions(!showLinuxOptions)}
                                    style={{
                                      position: 'absolute',
                                      right: -40,
                                      height: 36,
                                      width: 36,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: colors.neutral[600],
                                    }}
                                  />
                                </div>
                                {showLinuxOptions && (
                                  <Space
                                    direction="vertical"
                                    size="small"
                                    style={{ width: 180 }}
                                  >
                                    {option.downloads.slice(1).map((download, downloadIndex) => (
                                      <Button
                                        key={downloadIndex}
                                        type="primary"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        onClick={() => handleDownload(download.url, option.platform, download.format)}
                                        style={{
                                          height: 36,
                                          fontSize: typography.fontSize.sm,
                                          fontWeight: typography.fontWeight.medium,
                                          borderRadius: borderRadius.md,
                                          width: 180,
                                          background: colors.background.primary,
                                          border: `1px solid ${colors.neutral[300]}`,
                                          color: colors.neutral[700],
                                          boxShadow: 'none',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = colors.neutral[50];
                                          e.currentTarget.style.borderColor = colors.primary.main;
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = colors.background.primary;
                                          e.currentTarget.style.borderColor = colors.neutral[300];
                                        }}
                                      >
                                        {download.name}
                                      </Button>
                                    ))}
                                  </Space>
                                )}
                              </>
                            ) : (
                              <Button
                                type="default"
                                size="small"
                                icon={<DownloadOutlined />}
                                onClick={() =>
                                  handleDownload(
                                    option.downloads[0].url,
                                    option.platform,
                                    option.downloads[0].format
                                  )
                                }
                                style={{
                                  height: 36,
                                  fontSize: typography.fontSize.sm,
                                  fontWeight: typography.fontWeight.medium,
                                  borderRadius: borderRadius.md,
                                  width: 180,
                                  background: colors.background.primary,
                                  border: `1px solid ${colors.primary.main}`,
                                  color: colors.primary.main,
                                  boxShadow: '0 0 0 1px rgba(9, 88, 217, 0.06), 0 4px 10px rgba(9, 88, 217, 0.16)',
                                }}
                              >
                                {option.downloads[0].name}
                              </Button>
                            )}

                          </Space>
                        </Space>
                      </Card>
                    </motion.div>
                  </Col>
                ))}
              </Row>
            </Space>
          </motion.div>
        </div>
      </div>
    </>
  );
};

