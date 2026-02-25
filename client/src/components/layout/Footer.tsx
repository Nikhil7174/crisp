// src/components/layout/Footer.tsx
import React from 'react';
import { Layout as AntLayout, Row, Col, Typography, Space } from 'antd';
import { Link } from 'react-router-dom';
import { colors, spacing, typography } from '../../styles';

const { Footer: AntFooter } = AntLayout;
const { Text, Title } = Typography;

export const Footer: React.FC = () => {
  return (
    <AntFooter style={{
      background: colors.neutral[0],
      padding: `${spacing.xxxl * 2}px ${spacing.lg}px ${spacing.lg}px`,
      borderTop: `1px solid ${colors.divider}`,
    }}>
      <style>{`
        @media (max-width: 768px) {
          .ant-layout-footer {
            padding-top: ${spacing.xl}px !important;
            padding-left: ${spacing.md}px !important;
            padding-right: ${spacing.md}px !important;
          }
          .footer-container {
            padding: 0 !important;
          }
          .footer-row {
            margin-left: 0 !important;
            margin-right: 0 !important;
            row-gap: ${spacing.lg}px !important;
            text-align: center !important;
          }
          .footer-row .ant-space {
            align-items: center !important;
          }
          .footer-row .ant-col {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-bottom: ${spacing.lg}px;
          }
          .footer-row .ant-col:last-child {
            margin-bottom: 0;
          }
          .footer-copyright {
            margin-top: ${spacing.xl}px !important;
            padding-top: ${spacing.lg}px !important;
          }
        }
        @media (max-width: 576px) {
          .ant-layout-footer {
            padding-top: ${spacing.lg}px !important;
            padding-left: ${spacing.md}px !important;
            padding-right: ${spacing.md}px !important;
            padding-bottom: ${spacing.md}px !important;
          }
          .footer-container {
            padding: 0 !important;
          }
          .footer-row {
            row-gap: ${spacing.md}px !important;
          }
          /* Brand Column takes full width */
          .footer-row > .ant-col:first-child {
            width: 100% !important;
            max-width: 100% !important;
            flex: 0 0 100% !important;
            margin-bottom: ${spacing.lg}px;
          }
          /* Other columns take 50% width */
          .footer-row > .ant-col:not(:first-child) {
            width: 50% !important;
            max-width: 50% !important;
            flex: 0 0 50% !important;
            margin-bottom: ${spacing.md}px;
            padding-right: ${spacing.sm}px !important;
            padding-left: ${spacing.sm}px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }} className="footer-container">
        <Row
          gutter={[spacing.xxxl, spacing.xl]}
          className="footer-row"
          style={{
            marginLeft: 0,
            marginRight: 0,
          }}
        >
          {/* Brand Column */}
          <Col xs={24} sm={24} md={6}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <Title level={4} style={{
                  margin: 0,
                  marginBottom: spacing.md,
                  color: colors.neutral[900],
                  fontSize: typography.fontSize.xl,
                  fontWeight: typography.fontWeight.bold,
                }}>
                  Shakra
                </Title>
                <Text style={{
                  color: colors.neutral[600],
                  fontSize: typography.fontSize.sm,
                  lineHeight: 1.6,
                }}>
                  AI-powered interview platform that helps you hire faster and smarter.
                </Text>
              </div>
            </Space>
          </Col>

          {/* Product Column */}
          <Col xs={24} sm={12} md={4}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{
                margin: 0,
                marginBottom: spacing.sm,
                color: colors.neutral[900],
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
              }}>
                Product
              </Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Features
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Pricing
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Enterprise
                </Link>
                <Link
                  to="/login"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Login
                </Link>
              </Space>
            </Space>
          </Col>

          {/* Resources Column */}
          <Col xs={24} sm={12} md={4}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{
                margin: 0,
                marginBottom: spacing.sm,
                color: colors.neutral[900],
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
              }}>
                Resources
              </Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Documentation
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Blog
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Help Center
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  API Reference
                </Link>
              </Space>
            </Space>
          </Col>

          {/* Company Column */}
          <Col xs={24} sm={12} md={4}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{
                margin: 0,
                marginBottom: spacing.sm,
                color: colors.neutral[900],
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
              }}>
                Company
              </Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  About Us
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Careers
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Contact
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Partners
                </Link>
              </Space>
            </Space>
          </Col>

          {/* Legal Column */}
          <Col xs={24} sm={24} md={6}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5} style={{
                margin: 0,
                marginBottom: spacing.sm,
                color: colors.neutral[900],
                fontSize: typography.fontSize.base,
                fontWeight: typography.fontWeight.bold,
              }}>
                Legal
              </Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Link
                  to="/privacy-policy"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Privacy Policy
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Terms of Service
                </Link>
                <Link
                  to="/"
                  style={{
                    color: colors.neutral[600],
                    fontSize: typography.fontSize.sm,
                    textDecoration: 'none',
                    transition: 'color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = colors.primary.main}
                  onMouseLeave={(e) => e.currentTarget.style.color = colors.neutral[600]}
                >
                  Security
                </Link>
              </Space>
            </Space>
          </Col>
        </Row>

        {/* Copyright Row */}
        <Row className="footer-copyright" style={{ marginTop: spacing.xxxl, paddingTop: spacing.xl, borderTop: `1px solid ${colors.divider}` }}>
          <Col xs={24}>
            <div style={{ textAlign: 'center' }}>
              <Text style={{
                color: colors.neutral[500],
                fontSize: typography.fontSize.sm,
              }}>
                © 2025 Shakra AI Interview. All rights reserved.
              </Text>
            </div>
          </Col>
        </Row>
      </div>
    </AntFooter>
  );
};




