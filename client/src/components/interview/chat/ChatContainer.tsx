// src/components/interview/chat/ChatContainer.tsx
import React, { useEffect, useRef, useMemo } from 'react';
import { colors, spacing } from '../../../styles';
import { QuestionTimer } from './QuestionTimer';
import { InterviewProgress } from './InterviewProgress';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { ChatMessage } from './ChatMessage';
import type { Question, ChatMessage as ChatMessageType } from '../../../types';

interface ChatContainerProps {
  currentQuestion?: Question | null;
  questionIndex: number;
  totalQuestions: number;
  onSubmitAnswer: (selectedOptionId: string) => void;
  onTimerExpire: () => void;
  loading?: boolean;
  disabled?: boolean;
  currentSession?: any; // Add currentSession to access questions and answers
  chatMessages?: ChatMessageType[];
  isSummaryView?: boolean;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  currentQuestion,
  questionIndex,
  totalQuestions,
  onSubmitAnswer,
  onTimerExpire,
  loading = false,
  disabled = false,
  currentSession,
  chatMessages = [],
  isSummaryView = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Remove internal showResult state - now managed by parent


  // Auto-scroll to bottom when new questions arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questionIndex]);

  // Remove chat messages logic since we're showing questions directly

  // Memoize timer component with question ID as key to ensure reset
  const timerComponent = useMemo(() => {
    if (!currentQuestion) return null;

    return (
      <QuestionTimer
        key={currentQuestion.id} // Add key to force remount when question changes
        timeLimit={currentQuestion.timeLimit}
        onExpire={onTimerExpire}
        disabled={disabled}
      />
    );
  }, [currentQuestion?.id, currentQuestion?.timeLimit, onTimerExpire, disabled]);

  // Memoize progress component
  const progressComponent = useMemo(() => (
    <InterviewProgress
      currentQuestion={questionIndex + 1}
      totalQuestions={totalQuestions}
      currentQuestionData={currentQuestion}
    />
  ), [questionIndex, totalQuestions, currentQuestion]);

  // Memoize current question component
  const currentQuestionComponent = useMemo(() => {
    if (!currentQuestion) return null;

    return (
      <MultipleChoiceQuestion
        question={currentQuestion}
        onSubmitAnswer={(selectedOptionId) => {
          onSubmitAnswer(selectedOptionId);
          // Don't set showResult here - let parent manage this
        }}
        loading={loading}
        disabled={disabled}
        showResult={false}
        correctAnswerId={currentQuestion?.correctAnswerId}
      />
    );
  }, [currentQuestion, onSubmitAnswer, loading, disabled]);

  // Render chat messages in summary view
  if (isSummaryView) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '400px',
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: 8,
        backgroundColor: colors.background.primary
      }}>
        <div style={{
          padding: spacing.md,
          borderBottom: `1px solid ${colors.neutral[200]}`,
          backgroundColor: colors.background.secondary
        }}>
          <h4 style={{ margin: 0, color: colors.neutral[900] }}>Interview Chat History</h4>
        </div>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing.sm
        }}>
          {chatMessages.length > 0 ? (
            chatMessages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
              />
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: colors.neutral[500],
              padding: spacing.xl
            }}>
              No chat messages available
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '600px',
      border: `1px solid ${colors.neutral[200]}`,
      borderRadius: 8,
      backgroundColor: colors.background.primary
    }}>
      {/* Progress Bar */}
      {progressComponent}

      {/* Timer */}
      {timerComponent}

      {/* Scrollable Questions Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.md
      }}>
        {/* Previous Questions */}
        {currentSession?.questions && currentSession.questions.slice(0, questionIndex).map((question: any) => {
          const answer = currentSession.answers?.find((a: any) => a.questionId === question.id);

          // DEBUG: Add more console logging
          console.log('All answers in session:', currentSession.answers);
          console.log('Looking for questionId:', question.id);
          console.log('Question:', question.id, 'Answer:', answer);
          console.log('selectedOptionId:', answer?.selectedOptionId);
          console.log('correctAnswerId:', question.correctAnswerId);

          return (
            <div key={question.id} style={{ marginBottom: spacing.lg }}>
              <MultipleChoiceQuestion
                question={question}
                onSubmitAnswer={() => { }} // Disabled for previous questions
                loading={false}
                disabled={true} // Disabled for previous questions
                showResult={true} // Show results for previous questions
                selectedOptionId={answer?.selectedOptionId}
                correctAnswerId={question.correctAnswerId}
              />
            </div>
          );
        })}

        {/* Current Question */}
        {currentQuestion && (
          <div style={{ marginBottom: spacing.lg }}>
            {currentQuestionComponent}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};
