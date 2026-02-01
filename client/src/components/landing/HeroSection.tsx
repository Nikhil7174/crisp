// src/components/landing/HeroSection.tsx
import React from 'react';
import { Typography, Space, Grid } from 'antd';
import { motion } from 'framer-motion';
import { colors, typography, spacing } from '../../styles';

const { Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export const HeroSection: React.FC = () => {
  const screens = useBreakpoint();
  
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
            marginBottom: 0, // Remove default bottom margin
          }}>
            Create your own custom technical interview and select candidates within hours.
          </Paragraph>
        </Space>
      </motion.div>
    </div>
  );
};