// src/components/interview/WelcomeBackModal.tsx
import React, { useMemo } from 'react';
import { Modal, Card, Typography, Space, Button, Progress } from 'antd';
import { ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import SessionManager from '../../services/SessionManager';

const { Title, Paragraph, Text } = Typography;

interface WelcomeBackModalProps {
  visible: boolean;
  onContinue: () => void;
  onStartNew: () => void;
  onClose: () => void;
}

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hr ${remainingMinutes} min`;
};

export const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  visible,
  onContinue,
  onStartNew,
  onClose
}) => {
  // Memoize session data to avoid multiple calls
  const sessionData = useMemo(() => {
    const session = SessionManager.getLastSession();
    const sessionSummary = session ? SessionManager.getSessionSummary(session) : null;
    return { session, sessionSummary };
  }, [visible]); // Only recalculate when modal visibility changes

  const { session, sessionSummary } = sessionData;

  // Memoize modal title
  const modalTitle = useMemo(() => (
    <Title level={3} style={{ textAlign: 'center', marginBottom: 0 }}>Welcome Back!</Title>
  ), []);

  // Memoize modal styles
  const modalStyles = useMemo(() => ({
    content: {
      backgroundColor: colors.background.primary,
      borderRadius: 8,
      padding: spacing.lg
    }
  }), []);

  // Memoize session info display
  const sessionInfoDisplay = useMemo(() => {
    if (!sessionSummary) {
      return (
        <div style={{
          backgroundColor: colors.info.light + '20',
          padding: spacing.md,
          borderRadius: 8,
          textAlign: 'center'
        }}>
          <Text type="secondary">
            We found some resume data from your last session. You can continue from there or start fresh.
          </Text>
        </div>
      );
    }

    return (
      <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: spacing.md,
          backgroundColor: colors.info.light + '20',
          padding: spacing.md,
          borderRadius: 8
        }}>
          <div style={{ textAlign: 'left' }}>
            <Text type="secondary">Time Away</Text>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              <ClockCircleOutlined style={{ marginRight: spacing.xs }} />
              {formatDuration(sessionSummary.timeAway)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text type="secondary">Questions Answered</Text>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              <FileTextOutlined style={{ marginRight: spacing.xs }} />
              {sessionSummary.questionsAnswered} / {sessionSummary.totalQuestions}
            </div>
          </div>
        </div>

        <Progress
          percent={(sessionSummary.questionsAnswered / sessionSummary.totalQuestions) * 100}
          status="active"
          strokeColor={colors.primary.main}
          trailColor={colors.neutral[200]}
          showInfo={false}
        />

        <Paragraph>
          You left off at question {sessionSummary.questionsAnswered + 1} of {sessionSummary.totalQuestions}.
        </Paragraph>
      </>
    );
  }, [sessionSummary]);

  // Memoize action buttons
  const actionButtons = useMemo(() => (
    <Space size="middle" style={{ marginTop: spacing.lg }}>
      <Button size="large" onClick={onStartNew}>
        Start New Interview
      </Button>
      <Button type="primary" size="large" onClick={onContinue}>
        Continue Interview
      </Button>
    </Space>
  ), [onStartNew, onContinue]);

  return (
    <Modal
      title={modalTitle}
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      maskClosable={false}
      width={600}
      styles={modalStyles}
    >
      <Card style={{ backgroundColor: colors.neutral[50], border: 'none' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <Paragraph type="secondary">
            It looks like you have an ongoing interview session.
          </Paragraph>

          {sessionInfoDisplay}
          {actionButtons}
        </Space>
      </Card>
    </Modal>
  );
};
