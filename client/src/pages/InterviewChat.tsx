// src/pages/InterviewChat.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { colors, spacing } from '../styles';
import { ResumeUpload } from '../components/interview/ResumeUpload';
import { InfoCollection } from '../components/interview/InfoCollection';
import { InterviewSession } from '../components/interview/InterviewSession';
import { WelcomeBackModal } from '../components/interview/WelcomeBackModal';
import { useResumeUpload } from '../hooks/api/useResumeUpload';
import { useInterview } from '../hooks/api/useInterview';
import { resetInterview } from '../store/slices/interviewSlice';
import SessionManager from '../services/SessionManager';

type Step = 'upload' | 'info' | 'interview';

export const InterviewChat: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [processingResume, setProcessingResume] = useState(false);
  const [collectingInfo, setCollectingInfo] = useState(false);
  // FIXED: Add state for question progress and time away
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(6);
  const [timeAway, setTimeAway] = useState(0);

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
    restoreSession: restoreInterviewSession,
    saveResults
  } = useInterview();

  // Check for existing session on mount
  useEffect(() => {
    const lastSession = SessionManager.getLastSession();
    const isInterviewActive = SessionManager.isInterviewActive();

    console.log('=== SESSION CHECK ON MOUNT ===');
    console.log('Last session:', lastSession);
    console.log('Interview active:', isInterviewActive);
    console.log('Session valid:', lastSession ? SessionManager.isSessionValid(lastSession) : false);
    console.log('Current Redux session:', currentSession);
    console.log('=== END SESSION CHECK ===');

    if (lastSession && SessionManager.isSessionValid(lastSession) && isInterviewActive) {
      // Extract question numbers and time away
      const answered = lastSession.currentSession?.answers?.length || 0;
      const total = lastSession.currentSession?.questions?.length || 6;

      // Calculate time away using SessionManager
      const sessionSummary = SessionManager.getSessionSummary(lastSession);
      const timeAwayMinutes = sessionSummary?.timeAway || 0;

      console.log('Valid active session found:', { answered, total, timeAwayMinutes });

      setQuestionsAnswered(answered);
      setTotalQuestions(total);
      setTimeAway(timeAwayMinutes);

      // Show welcome back modal if there's a valid ongoing session
      setShowWelcomeBack(true);

      // If we have resume data, go directly to interview
      if (lastSession.resumeData) {
        setCurrentStep('interview');
      }
    } else {
      console.log('No valid active session found - starting fresh');
    }
  }, []); // Empty dependency array - only run on mount

  // Real-time tracking of interview progress
  useEffect(() => {
    if (currentSession) {
      const answered = currentSession.answers?.length || 0;
      const total = currentSession.questions?.length || 6;

      console.log('Real-time progress update:', { answered, total });

      setQuestionsAnswered(answered);
      setTotalQuestions(total);
    }
  }, [currentSession?.answers?.length, currentSession?.questions?.length]);

  // Update time away periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const lastSession = SessionManager.getLastSession();
      if (lastSession && SessionManager.isSessionValid(lastSession)) {
        const sessionSummary = SessionManager.getSessionSummary(lastSession);
        const timeAwayMinutes = sessionSummary?.timeAway || 0;
        setTimeAway(timeAwayMinutes);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

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
    console.log('=== STARTING NEW INTERVIEW ===');
    console.log('Before clearing - last session:', SessionManager.getLastSession());

    // Clear localStorage session data completely
    SessionManager.clearAllSessions();

    // Clear Redux state
    dispatch(resetInterview());

    // Reset local component state
    setCurrentStep('upload');
    setShowWelcomeBack(false); // Hide modal
    setProcessingResume(false);
    setCollectingInfo(false);
    setQuestionsAnswered(0);
    setTotalQuestions(6);
    setTimeAway(0);

    console.log('After clearing - last session:', SessionManager.getLastSession());
    console.log('=== NEW INTERVIEW SETUP COMPLETE ===');
  }, [dispatch]);

  const handleInterviewComplete = useCallback(() => {
    console.log('Interview completed - clearing all data and redirecting');

    // Clear all session data from localStorage
    SessionManager.clearAllSessions();

    // Clear Redux state
    dispatch(resetInterview());

    // Redirect to home page
    navigate('/');
  }, [navigate, dispatch]);

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
            onSaveResults={saveResults}
            onComplete={handleInterviewComplete}
          />
        );

      default:
        return null;
    }
  }, [currentStep, handleFileUpload, handleCollectInfo, handleStartNew, handleInterviewComplete, uploading, loading, error, resumeData, detailedResumeData, currentSession, chatMessages, startInterview, submitAnswer, processingResume, collectingInfo]);


  return (
    <div style={{ padding: spacing.xl, minHeight: '100vh', backgroundColor: colors.background.secondary }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        {/* Main Content */}
        {renderCurrentStep()}
      </Space>

      {/* Welcome Back Modal */}
      <WelcomeBackModal
        visible={showWelcomeBack}
        questionsAnswered={questionsAnswered}
        totalQuestions={totalQuestions}
        timeAway={timeAway}
        onContinue={handleContinueSession}
        onStartNew={handleStartNew}
        onClose={handleWelcomeBackClose}
      />
    </div>
  );
};

export default InterviewChat;

