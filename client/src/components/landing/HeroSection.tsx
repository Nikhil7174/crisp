import React from 'react';
import { Typography, Space, Grid, Button } from 'antd';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { colors, typography, spacing } from '../../styles';

const { Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export const HeroSection: React.FC = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();

  const titleFontSize = screens.lg ? typography.fontSize['6xl'] : '48px';
  const paragraphFontSize = screens.lg ? typography.fontSize.xl : '16px';
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
        <Space direction="vertical" size="large" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Title level={1} style={{
            fontSize: titleFontSize,
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[900],
            letterSpacing: typography.letterSpacing.tight,
            lineHeight: typography.lineHeight.tight,
            marginBottom: spacing.sm,
            fontFamily: '"Varela Round", sans-serif',
          }}>
            Technical interviews on
            <span style={{ color: colors.primary.main }}> Autopilot </span>
          </Title>

          <Paragraph style={{
            fontSize: paragraphFontSize,
            color: colors.neutral[600],
            lineHeight: typography.lineHeight.relaxed,
            fontWeight: typography.fontWeight.normal,
            marginBottom: spacing.xl,
          }}>
            Create your own custom technical interview and select candidates within hours.
          </Paragraph>

          <Space size="middle" wrap style={{ justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/sign-up?role=candidate')}
              style={{
                height: 40,
                padding: '0 28px',
                fontSize: 18,
                fontWeight: 600,
                borderRadius: 12,
                background: colors.neutral[900],
                borderColor: colors.neutral[900],
              }}
            >
              For Candidates
            </Button>
            <Button
              size="large"
              onClick={() => navigate('/sign-up?role=interviewer')}
              style={{
                height: 40,
                padding: '0 28px',
                fontSize: 18,
                fontWeight: 600,
                borderRadius: 12,
                color: colors.neutral[900],
                borderColor: colors.neutral[900],
                borderWidth: 2,
              }}
            >
              For Companies
            </Button>
          </Space>
        </Space>
      </motion.div>
    </div>
  );
};