// src/components/interview/WelcomeBackModal.tsx
import React from 'react';
import { Modal, Typography, Space, Button, Card, Divider } from 'antd';
import { ClockCircleOutlined, QuestionCircleOutlined, UserOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';

const { Title, Text, Paragraph } = Typography;

interface SessionSummary {
  timeAway: string;
  questionsAnswered: number;
  totalQuestions: number;
  startTime: Date;
  lastActivity: Date;
}

interface WelcomeBackModalProps {
  visible: boolean;
  sessionSummary: SessionSummary;
  onContinue: () => void;
  onStartNew: () => void;
  onClose: () => void;
}

export const WelcomeBackModal: React.FC<WelcomeBackModalProps> = ({
  visible,
  sessionSummary,
  onContinue,
  onStartNew,
  onClose
}) => {
  const { timeAway, questionsAnswered, totalQuestions, startTime } = sessionSummary;
  
  const progressPercentage = totalQuestions > 0 ? (questionsAnswered / totalQuestions) * 100 : 0;

  return (
    <Modal
      title={
        <Space>
          <UserOutlined style={{ color: colors.primary.main }} />
          <span>Welcome Back!</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="new" onClick={onStartNew}>
          Start New Interview
        </Button>,
        <Button key="continue" type="primary" onClick={onContinue}>
          Continue Interview
        </Button>
      ]}
      width={500}
      centered
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={4} style={{ margin: 0 }}>
            You were last active <Text strong style={{ color: colors.primary.main }}>{timeAway}</Text>
          </Title>
          <Paragraph type="secondary">
            We've saved your progress and are ready to continue where you left off.
          </Paragraph>
        </div>

        <Card size="small" style={{ backgroundColor: colors.neutral[50] }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <QuestionCircleOutlined style={{ color: colors.primary.main }} />
                <Text strong>Interview Progress</Text>
              </Space>
              <Text>{questionsAnswered}/{totalQuestions} questions</Text>
            </div>
            
            <div style={{ 
              width: '100%', 
              height: 8, 
              backgroundColor: colors.neutral[200], 
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${progressPercentage}%`,
                height: '100%',
                backgroundColor: colors.primary.main,
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <Text type="secondary" style={{ fontSize: 12 }}>
              {progressPercentage.toFixed(0)}% complete
            </Text>
          </Space>
        </Card>

        <Divider style={{ margin: '8px 0' }} />

        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <ClockCircleOutlined style={{ color: colors.neutral[500] }} />
              <Text type="secondary">Started</Text>
            </Space>
            <Text>{startTime.toLocaleString()}</Text>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <ClockCircleOutlined style={{ color: colors.neutral[500] }} />
              <Text type="secondary">Last Active</Text>
            </Space>
            <Text>{sessionSummary.lastActivity.toLocaleString()}</Text>
          </div>
        </Space>

        <div style={{ 
          padding: spacing.md, 
          backgroundColor: colors.info.light + '20', 
          borderRadius: 8,
          border: `1px solid ${colors.info.light}`
        }}>
          <Text style={{ fontSize: 13, color: colors.info.dark }}>
             <Text strong>Tip:</Text> Your chat history and resume data have been preserved. 
            You can continue from exactly where you left off.
          </Text>
        </div>
      </Space>
    </Modal>
  );
};

export default WelcomeBackModal;
