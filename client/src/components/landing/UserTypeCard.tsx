// src/components/landing/UserTypeCard.tsx
import React, { memo } from 'react';
import { Card, Typography, Button, Row, Col } from 'antd';
import { motion } from 'framer-motion';
import type { UserType } from '../../types';
import { colors, spacing, borderRadius } from '../../styles';

const { Title, Paragraph, Text } = Typography;

interface UserTypeCardProps {
  type: UserType;
  title: string;
  subtitle: string;
  features: string[];
  ctaText: string;
  isActive: boolean;
  onSelect: () => void;
  onCtaClick?: () => void;
  icon: React.ReactNode;
}

export const UserTypeCard: React.FC<UserTypeCardProps> = memo(({
  type,
  title,
  subtitle,
  features,
  ctaText,
  isActive,
  onSelect,
  onCtaClick,
  icon,
}) => {
  const handleCtaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCtaClick?.();
  };

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card
        hoverable
        style={{
          height: 340,
          borderRadius: borderRadius.xl,
          border: isActive 
            ? `2px solid ${colors.primary.main}` 
            : `1px solid ${colors.neutral[200]}`,
          boxShadow: isActive 
            ? colors.shadows.primary 
            : colors.shadows.sm,
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          background: isActive 
            ? colors.primary.light + '10' // 10% opacity
            : colors.background.primary,
        }}
        bodyStyle={{ padding: spacing.lg, height: '100%' }}
        onClick={onSelect}
      >
        {isActive && (
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: colors.primary.main,
            borderRadius: 20,
            padding: '4px 12px',
            zIndex: 10,
          }}>
            <Text style={{ color: colors.neutral[0], fontSize: 12, fontWeight: 600 }}>
              SELECTED
            </Text>
          </div>
        )}
        
        <Row gutter={16} style={{ height: '100%' }}>
          {/* Left Column - Content */}
          <Col span={12} style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
            <div>
              <Title level={3} style={{ 
                marginBottom: spacing.md,
                color: colors.neutral[900],
                fontSize: '1.25rem',
                lineHeight: 1.3,
              }}>
                {title}
              </Title>
              <Paragraph style={{ 
                color: colors.neutral[600], 
                marginBottom: spacing.lg,
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}>
                {subtitle}
              </Paragraph>
              
              {/* CTA Button with proper spacing */}
              <Button 
                type={isActive ? "primary" : "default"}
                size="large"
                style={{ 
                  height: 48,
                  fontSize: 16,
                  fontWeight: 500,
                  borderRadius: borderRadius.md,
                  width: '80%',
                }}
                onClick={handleCtaClick}
              >
                {ctaText}
              </Button>
            </div>
          </Col>
          
          {/* Right Column - Demo/Image Area */}
          <Col span={12}>
            <div style={{ 
              background: colors.background.secondary, 
              borderRadius: borderRadius.lg,
              padding: spacing.md,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${colors.neutral[100]}`,
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: `linear-gradient(135deg, ${colors.neutral[50]} 0%, ${colors.background.secondary} 100%)`,
                borderRadius: borderRadius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.neutral[500],
                border: `1px dashed ${colors.neutral[300]}`,
                fontSize: '0.85rem',
              }}>
                Demo Animation
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </motion.div>
  );
});

UserTypeCard.displayName = 'UserTypeCard';
