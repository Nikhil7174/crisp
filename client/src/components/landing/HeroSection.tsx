import React from 'react';
import { Typography, Space, Grid, Button, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { colors, typography, spacing } from '../../styles';
import { INTERVIEW_ROLES } from '../../constants/interview';

const { Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

export const HeroSection: React.FC = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const posthog = usePostHog();

  const titleFontSize = screens.lg ? typography.fontSize['5xl'] : '48px';
  const paragraphFontSize = screens.lg ? typography.fontSize.lg : '16px';
  const paddingBottom = screens.lg ? `${spacing.xl}px` : '0';

  // Truncate list logic: Active (FE, BE, AI) + Full Stack + DevOps + "More..."
  const visibleRolesList = [
    'Frontend Developer',
    'Backend Developer',
    'AI Engineer',
    'Full Stack Developer'
  ];

  const visibleItems = visibleRolesList
    .map(roleName => INTERVIEW_ROLES.find(r => r.value === roleName))
    .filter((r): r is typeof INTERVIEW_ROLES[0] => Boolean(r));

  const remainingCount = INTERVIEW_ROLES.length - visibleItems.length;

  const tryInterviewItems: MenuProps['items'] = visibleItems.map((role) => {
    let key = role.value;
    let disabled = true;

    // Map specific roles to active demo keys
    if (role.value === 'Frontend Developer') {
      key = 'fe';
      disabled = false;
    } else if (role.value === 'Backend Developer') {
      key = 'be';
      disabled = false;
    } else if (role.value === 'AI Engineer') {
      key = 'ai';
      disabled = false;
    }

    return {
      key,
      label: disabled ? (
        <Tooltip title="Book a demo to try this interview" placement="right">
          <span style={{ color: colors.neutral[400], cursor: 'default', display: 'flex', alignItems: 'center', height: '90%', fontFamily: '"Varela Round", sans-serif', fontSize: typography.fontSize.sm }}>{role.label}</span>
        </Tooltip>
      ) : (
        <span style={{ fontFamily: '"Varela Round", sans-serif', fontSize: typography.fontSize.sm, display: 'flex', alignItems: 'center', height: '90%', width: '100%' }}>{role.label}</span>
      ),
      disabled: false,
      className: disabled ? 'menu-item-disabled-simulated' : '',
      style: { height: 36, display: 'flex', alignItems: 'center' },
    };
  });

  if (remainingCount > 0) {
    tryInterviewItems.push({
      key: 'more',
      label: (
        <Tooltip title="Book a demo to try more interviews" placement="right">
          <span style={{ color: colors.neutral[400], fontStyle: 'italic', fontFamily: '"Varela Round", sans-serif', fontSize: typography.fontSize.sm, display: 'flex', alignItems: 'center', height: '90%', cursor: 'default' }}>and {remainingCount} more...</span>
        </Tooltip>
      ),
      disabled: false,
      style: { height: 36, display: 'flex', alignItems: 'center' },
    });
  }

  const handleTryInterview: MenuProps['onClick'] = ({ key }) => {
    if (['fe', 'be', 'ai'].includes(key as string)) {
      posthog?.capture('try_interview_clicked', { role: key });
      navigate(`/try-interview/${key}`);
    }
  };

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
            maxWidth: 800,
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
              onClick={() => posthog?.capture('book_demo_clicked', { source: 'hero' })}
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

            {/* Try Interview - Public Demo */}
            <Dropdown
              menu={{
                items: tryInterviewItems,
                onClick: handleTryInterview,
                // Removed scroll/max-height as list is now short
              }}
              placement="bottom"
            >
              <Button
                size="large"
                style={{
                  height: 40,
                  padding: '0 28px',
                  maxWidth: 160,
                  fontSize: 16,
                  fontWeight: 600,
                  borderRadius: 12,
                  gap: 4,
                  borderColor: colors.primary.main,
                  color: colors.primary.main,
                }}
              >
                <span> Try Interview </span> <span> ▾</span>
              </Button>
            </Dropdown>
          </Space>
        </Space>
      </motion.div>
    </div >
  );
};