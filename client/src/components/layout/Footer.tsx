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
        @media (max-width: 820px) {
          .footer-row .ant-col {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Row gutter={[spacing.xxxl, spacing.xl]} className="footer-row">
          {/* Brand Column */}
          <Col xs={24} sm={12} md={6}>
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
          <Col xs={24} sm={12} md={6}>
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
        <Row style={{ marginTop: spacing.xxxl, paddingTop: spacing.xl, borderTop: `1px solid ${colors.divider}` }}>
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

