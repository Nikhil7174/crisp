// src/components/interview/InterviewSession.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Typography, Space, Button, notification } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import { ChatContainer } from './chat';
import SessionManager from '../../services/SessionManager';
import type { InterviewSession as InterviewSessionType, ChatMessage } from '../../types';

const { Title, Paragraph } = Typography;

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
  // Remove all the useEffect logic and just use simple state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Memoize current question to avoid recalculation
  const currentQuestion = useMemo(() => {
    const question = currentSession?.questions?.[currentQuestionIndex];
    console.log('Current question index:', currentQuestionIndex);
    console.log('Current question:', question?.id);
    console.log('Total questions:', currentSession?.questions?.length);
    return question;
  }, [currentSession?.questions, currentQuestionIndex]);

  // Start interview when component mounts - BUT ONLY IF NO SESSION EXISTS
  useEffect(() => {
    // Check if there's a stored session first
    const storedSession = SessionManager.getLastSession();
    const hasStoredSession = storedSession && storedSession.currentSession;

    // Only start new interview if NO currentSession exists AND no stored session AND no chatMessages
    if (!currentSession && !hasStoredSession && !chatMessages.length && onStartInterview && !sessionStarted) {
      setSessionStarted(true);

      // Start new interview
      const candidateData = {
        id: `candidate-${Date.now()}`,
        timestamp: Date.now()
      };

      onStartInterview(candidateData).catch(error => {
        notification.error({
          message: 'Failed to start interview',
          description: error.message || 'Please try again'
        });
        setSessionStarted(false);
      });
    }
  }, [currentSession, chatMessages.length, onStartInterview, sessionStarted]);

  const handleAnswerSubmit = useCallback(async (selectedOptionId: string) => {
    if (!currentQuestion || !onSubmitAnswer || !currentSession) {
      return;
    }

    console.log('Submitting answer for question:', currentQuestion.id);
    console.log('Current question index before submit:', currentQuestionIndex);

    setIsSubmitting(true);
    const startTime = Date.now();

    try {
      const result = await onSubmitAnswer(
        currentSession.sessionId,
        currentQuestion.id,
        selectedOptionId,
        Date.now() - startTime
      );

      if (result?.success) {
        console.log('Answer submitted successfully');
        console.log('Is complete:', result.isComplete);
        
        // Move to next question or complete interview immediately
        if (result.isComplete) {
          notification.success({
            message: 'Interview completed!',
            description: 'Great job! You\'ve finished all questions.'
          });
        } else {
          console.log('Moving to next question. Current index:', currentQuestionIndex);
          setCurrentQuestionIndex(prev => {
            console.log('Previous index:', prev, 'New index:', prev + 1);
            return prev + 1;
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to submit answer:', error);
      notification.error({
        message: 'Failed to submit answer',
        description: error.message || 'Please try again'
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentQuestion, onSubmitAnswer, currentSession, currentQuestionIndex]);

  const handleTimerExpire = useCallback(() => {
    if (currentQuestion && !isSubmitting) {
      notification.warning({
        message: 'Time\'s up!',
        description: 'Moving to next question...'
      });
      handleAnswerSubmit('timeout'); // Submit timeout answer when timer expires
    }
  }, [currentQuestion, isSubmitting, handleAnswerSubmit]);

  const renderInterviewContent = useCallback(() => {
    if (!currentSession) {
      return (
        <div style={{ textAlign: 'center', padding: spacing.xl }}>
          <RobotOutlined style={{ fontSize: 64, color: colors.primary.main, marginBottom: spacing.md }} />
          <Title level={3}>Starting Your Interview</Title>
          <Paragraph>
            Preparing your personalized interview questions based on your resume...
          </Paragraph>
        </div>
      );
    }

    return (
      <ChatContainer
        currentQuestion={currentQuestion}
        questionIndex={currentQuestionIndex}
        totalQuestions={currentSession.questions.length}
        onSubmitAnswer={handleAnswerSubmit}
        onTimerExpire={handleTimerExpire}
        loading={isSubmitting}
        disabled={isSubmitting}
        currentSession={currentSession}
      />
    );
  }, [currentSession, currentQuestion, currentQuestionIndex, handleAnswerSubmit, handleTimerExpire, isSubmitting]);

  return (
    <Card style={{ maxWidth: 900, margin: '0 auto' }}>
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

        {/* Chat Interface */}
        {renderInterviewContent()}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: spacing.md, justifyContent: 'center' }}>
          <Button
            type="primary"
            size="large"
            onClick={onStartNew}
            style={{ minWidth: 200 }}
          >
            Start New Interview
          </Button>
        </div>
      </Space>
    </Card>
  );
};

export default InterviewSession;
