// src/components/interview/InterviewSession.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Space, Button, Input, message } from 'antd';
import { RobotOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import type { InterviewSession as InterviewSessionType, ChatMessage } from '../../types';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

interface InterviewSessionProps {
  onStartNew: () => void;
  currentSession?: InterviewSessionType | null;
  chatMessages?: ChatMessage[];
  onStartInterview?: (candidateData: any) => Promise<any>;
  onSubmitAnswer?: (sessionId: string, questionId: string, answer: string, timeTaken: number) => Promise<any>;
}

export const InterviewSession: React.FC<InterviewSessionProps> = ({
  onStartNew,
  currentSession,
  chatMessages = [],
  onStartInterview,
  onSubmitAnswer
}) => {
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Get current question
  const currentQuestion = currentSession?.questions?.[currentQuestionIndex];

  // Start interview when component mounts
  useEffect(() => {
    if (!currentSession && onStartInterview) {
      // Start new interview
      const candidateData = {
        id: `candidate-${Date.now()}`,
        timestamp: Date.now()
      };

      onStartInterview(candidateData).catch(error => {
        console.error('Failed to start interview:', error);
        message.error('Failed to start interview');
      });
    }
  }, [currentSession, onStartInterview]);

  const handleAnswerSubmit = useCallback(async () => {
    if (!currentAnswer.trim() || !currentQuestion || !onSubmitAnswer || !currentSession) {
      return;
    }

    setIsSubmitting(true);
    const startTime = Date.now();

    try {
      const result = await onSubmitAnswer(
        currentSession.id,
        currentQuestion.id,
        currentAnswer.trim(),
        Date.now() - startTime
      );

      if (result?.success) {
        setCurrentAnswer('');

        // Move to next question or complete interview
        if (result.isComplete) {
          message.success('Interview completed! Great job!');
        } else {
          setCurrentQuestionIndex(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      message.error('Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  }, [currentAnswer, currentQuestion, onSubmitAnswer, currentSession]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnswerSubmit();
    }
  }, [handleAnswerSubmit]);

  const renderChatMessages = useCallback(() => {
    if (chatMessages.length === 0) {
      return (
        <div style={{
          textAlign: 'center',
          color: colors.neutral[500],
          padding: spacing.lg
        }}>
          <RobotOutlined style={{ fontSize: 48, marginBottom: spacing.md }} />
          <div>No messages yet. The interview will begin shortly...</div>
        </div>
      );
    }

    return chatMessages.map((msg) => (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
          marginBottom: spacing.md
        }}
      >
        <div
          style={{
            maxWidth: '70%',
            padding: spacing.md,
            borderRadius: 12,
            backgroundColor: msg.type === 'user'
              ? colors.primary.main
              : colors.neutral[100],
            color: msg.type === 'user'
              ? 'white'
              : colors.neutral[800]
          }}
        >
          <div style={{ marginBottom: spacing.xs }}>
            {msg.type === 'user' ? (
              <UserOutlined style={{ marginRight: spacing.xs }} />
            ) : (
              <RobotOutlined style={{ marginRight: spacing.xs }} />
            )}
            <Text strong style={{
              color: msg.type === 'user' ? 'white' : colors.neutral[600],
              fontSize: 12
            }}>
              {msg.type === 'user' ? 'You' : msg.type === 'assistant' ? 'AI Interviewer' : 'System'}
            </Text>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          <div style={{
            fontSize: 10,
            opacity: 0.7,
            marginTop: spacing.xs
          }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    ));
  }, [chatMessages]);

  const renderCurrentQuestion = useCallback(() => {
    if (!currentQuestion) {
      return (
        <div style={{ textAlign: 'center', padding: spacing.lg }}>
          <Text type="secondary">Waiting for questions...</Text>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: spacing.lg }}>
        <div style={{
          padding: spacing.md,
          backgroundColor: colors.primary.light,
          borderRadius: 8,
          marginBottom: spacing.md
        }}>
          <Text strong style={{ color: colors.primary.dark }}>
            Question {currentQuestionIndex + 1} of {currentSession?.questions?.length || 0}
          </Text>
        </div>

        <div style={{
          padding: spacing.md,
          backgroundColor: colors.neutral[50],
          borderRadius: 8,
          marginBottom: spacing.md
        }}>
          <Text>{currentQuestion.question}</Text>
        </div>

        <TextArea
          value={currentAnswer}
          onChange={(e) => setCurrentAnswer(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your answer here..."
          rows={4}
          disabled={isSubmitting}
          style={{ marginBottom: spacing.md }}
        />

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleAnswerSubmit}
          loading={isSubmitting}
          disabled={!currentAnswer.trim()}
          style={{ width: '100%' }}
        >
          Submit Answer
        </Button>
      </div>
    );
  }, [currentQuestion, currentQuestionIndex, currentSession, currentAnswer, handleKeyPress, handleAnswerSubmit, isSubmitting]);

  return (
    <Card style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>AI Interview Session</Title>
          <Paragraph>
            {currentSession ?
              'Answer the questions below based on your resume and experience.' :
              'Starting your AI interview session...'
            }
          </Paragraph>
        </div>

        {/* Chat Messages */}
        <div style={{
          height: 400,
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: 8,
          padding: spacing.md,
          overflowY: 'auto',
          backgroundColor: colors.background.secondary
        }}>
          {renderChatMessages()}
        </div>

        {/* Current Question */}
        {currentSession && renderCurrentQuestion()}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: spacing.md }}>
          <Button
            type="primary"
            size="large"
            onClick={onStartNew}
            style={{ flex: 1 }}
          >
            Start New Interview
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default InterviewSession;
