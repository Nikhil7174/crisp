// src/pages/InterviewChat.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Space } from 'antd';
import { colors, spacing } from '../styles';
import { ResumeUpload } from '../components/interview/ResumeUpload';
import { InfoCollection } from '../components/interview/InfoCollection';
import { InterviewSession } from '../components/interview/InterviewSession';
import { WelcomeBackModal } from '../components/interview/WelcomeBackModal';
import { useResumeUpload } from '../hooks/api/useResumeUpload';
import { useInterview } from '../hooks/api/useInterview';
import SessionManager from '../services/SessionManager';

type Step = 'upload' | 'info' | 'interview';

export const InterviewChat: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [processingResume, setProcessingResume] = useState(false);
  const [collectingInfo, setCollectingInfo] = useState(false);

  // Hooks
  const {
    resumeData,
    detailedResumeData,
    uploading,
    loading,
    error,
    uploadResume,
    collectMissingInfo,
    restoreSession: restoreResumeSession
  } = useResumeUpload();

  const {
    currentSession,
    chatMessages,
    startInterview,
    submitAnswer,
    restoreSession: restoreInterviewSession
  } = useInterview();

  // Check for existing session on mount
  useEffect(() => {
    const lastSession = SessionManager.getLastSession();

    if (lastSession && SessionManager.isSessionValid(lastSession)) {
      setShowWelcomeBack(true);
      // If we have resume data, go directly to interview
      if (lastSession.resumeData) {
        setCurrentStep('interview');
      }
    }
  }, []); // Empty dependency array - only run on mount

  // Auto-save session activity
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession) {
        SessionManager.updateActivity();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentSession]);

  // Effect to transition from upload to info step after resumeData is available
  useEffect(() => {
    if (resumeData && !uploading && !loading && currentStep === 'upload' && processingResume) {
      // Delay transition to allow success message to be visible
      const timer = setTimeout(() => {
        setCurrentStep('info');
        setProcessingResume(false); // Reset processing state
      }, 1500); // 1.5 seconds delay
      return () => clearTimeout(timer);
    }
  }, [resumeData, uploading, loading, currentStep, processingResume, collectingInfo]);

  const handleFileUpload = useCallback(async (file: File) => {
    setProcessingResume(true); // Start processing state
    try {
      await uploadResume(file);
      // Don't change step here - let useEffect handle it when resumeData is available
    } catch (error) {
      console.error(' InterviewChat: Upload failed:', error);
      setProcessingResume(false); // Reset processing state on error
    }
  }, [uploadResume]);

  const handleCollectInfo = useCallback(async (info: { name: string; email: string; phone: string }) => {
    setCollectingInfo(true);
    try {
      await collectMissingInfo(info);
      setCurrentStep('interview');
    } catch (error) {
      console.error(' InterviewChat: Info collection failed:', error);
    } finally {
      setCollectingInfo(false);
    }
  }, [collectMissingInfo]);

  const handleStartNew = useCallback(() => {
    SessionManager.clearSession(); // Clear session on new start
    setCurrentStep('upload');
    setShowWelcomeBack(false);
    setProcessingResume(false); // Ensure processing state is reset
  }, []);

  const handleContinueSession = useCallback(() => {
    setCurrentStep('interview');
    setShowWelcomeBack(false);

    // Restore session data
    const session = SessionManager.getLastSession();
    if (session) {
      // Restore resume data
      restoreResumeSession();

      // Restore interview session
      if (session.currentSession) {
        restoreInterviewSession(session.currentSession);
      }
    }
  }, [restoreResumeSession, restoreInterviewSession]);

  const handleWelcomeBackClose = useCallback(() => {
    setShowWelcomeBack(false);
  }, []);


  const renderCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 'upload':
        return (
          <ResumeUpload
            onUpload={handleFileUpload}
            loading={uploading || processingResume} // Use processingResume for overall loading
            error={error}
            onRemoveFile={() => {
              setProcessingResume(false);
              SessionManager.clearSession(); // Clear session if file is removed
            }}
            isProcessing={processingResume} // Pass processing state
            resumeData={resumeData} // Pass resumeData to show file details
          />
        );

      case 'info':
        return (
          <InfoCollection
            resumeData={resumeData}
            detailedResumeData={detailedResumeData}
            onSubmit={handleCollectInfo}
            loading={collectingInfo}
            error={error}
          />
        );

      case 'interview':
        return (
          <InterviewSession
            onStartNew={handleStartNew}
            currentSession={currentSession}
            chatMessages={chatMessages}
            onStartInterview={startInterview}
            onSubmitAnswer={submitAnswer}
          />
        );

      default:
        return null;
    }
  }, [currentStep, handleFileUpload, handleCollectInfo, handleStartNew, uploading, loading, error, resumeData, detailedResumeData, currentSession, chatMessages, startInterview, submitAnswer, processingResume, collectingInfo]);


  return (
    <div style={{ padding: spacing.xl, minHeight: '100vh', backgroundColor: colors.background.secondary }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        {/* Main Content */}
        {renderCurrentStep()}
      </Space>

      {/* Welcome Back Modal */}
      <WelcomeBackModal
        visible={showWelcomeBack}
        onContinue={handleContinueSession}
        onStartNew={handleStartNew}
        onClose={handleWelcomeBackClose}
      />
    </div>
  );
};

export default InterviewChat;

