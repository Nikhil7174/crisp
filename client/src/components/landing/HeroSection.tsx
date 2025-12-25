// src/components/landing/HeroSection.tsx
import React from 'react';
import { Typography, Space } from 'antd';
import { motion } from 'framer-motion';
import { colors, typography, spacing } from '../../styles';

const { Title, Paragraph } = Typography;

export const HeroSection: React.FC = () => {
  return (
    <div style={{ 
      textAlign: 'center', 
      padding: `${spacing.xxxl}px ${spacing.lg}px ${spacing.xl}px`, // Reduced from xxxl * 1.5 and xxxl
      background: 'transparent',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Space direction="vertical" size="large" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Title level={1} style={{ 
            fontSize: typography.fontSize['6xl'], 
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
            fontSize: typography.fontSize.xl, 
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