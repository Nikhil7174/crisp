import React from 'react';
import { Typography, Space, Grid, Button } from 'antd';
import { motion } from 'framer-motion';
import { colors, typography, spacing } from '../../styles';

const { Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export const HeroSection: React.FC = () => {
  const screens = useBreakpoint();

  const titleFontSize = screens.lg ? typography.fontSize['5xl'] : '48px';
  const paragraphFontSize = screens.lg ? typography.fontSize.lg : '16px';
  const paddingBottom = screens.lg ? `${spacing.xl}px` : '0';

  return (
    <div style={{
      textAlign: 'center',
      padding: `${spacing.xxxl}px ${spacing.lg}px ${paddingBottom}`,
      background: 'transparent',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Space direction="vertical" size="small" style={{ maxWidth: 1000, margin: '0 auto' }}>
          {/* Headline: Focuses on Scale (Strategy Point: Capacity Bottleneck)  */}
          <Title level={1} style={{
            fontSize: titleFontSize,
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[900],
            letterSpacing: typography.letterSpacing.tight,
            lineHeight: typography.lineHeight.tight,
            marginBottom: spacing.sm,
            fontFamily: '"Varela Round", sans-serif',
          }}>
            Technical Interviews on
            <span style={{ color: colors.primary.main }}> Autopilot </span>
          </Title>

          {/* Subhead: Addresses Speed, Cheating, and Quality [cite: 17, 39, 43] */}
          <Paragraph style={{
            fontSize: paragraphFontSize,
            color: colors.neutral[600],
            lineHeight: typography.lineHeight.relaxed,
            fontWeight: typography.fontWeight.normal,
            marginBottom: spacing.xl,
            maxWidth: 800, // Added constraint for better readability of longer text
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            Screen 100s of candidates simultaneously with AI-driven technical rounds that ensure every result is verified. Delivering a trusted top 1% shortlist.
          </Paragraph>

          <Space size="middle" wrap style={{ justifyContent: 'center' }}>
            {/* CTA: Changed to "Book a Demo" to match Sales Motion  */}
            <Button
              type="primary"
              size="large"
              href="https://cal.com/nikhil-singh/shakra-ai-interview-demo"
              target="_blank"
              style={{
                height: 40,
                padding: '0 28px',
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 12,
                background: colors.neutral[900],
                borderColor: colors.neutral[900],
              }}
            >
              Book a Demo
            </Button>
          </Space>
        </Space>
      </motion.div>
    </div>
  );
};