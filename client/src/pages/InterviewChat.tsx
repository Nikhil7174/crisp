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
import { useResumeData } from '../hooks/useResumeData';
import { useSessionManager } from '../hooks/useSessionManager';
import { resetInterview } from '../store/slices/interviewSlice';
import { SESSION_CONFIG } from '../config/session';

type Step = 'upload' | 'info' | 'interview';

export const InterviewChat: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [processingResume, setProcessingResume] = useState(false);
  const [collectingInfo, setCollectingInfo] = useState(false);
  const [userHasChosen, setUserHasChosen] = useState(false); // Track if user made a choice about session

  // Hooks
  const {
    resumeData,
    detailedResumeData,
    uploading,
    loading,
    error,
    uploadResume,
    collectMissingInfo
  } = useResumeUpload();

  const {
    currentSession,
    chatMessages,
    submitAnswer,
    saveResults
  } = useInterview();

  const {
    resumeData: existingResumeData,
    hasResume
  } = useResumeData();

  // New unified session management
  const {
    storedSession,
    shouldShowWelcomeBack,
    sessionSummary,
    restoreSession,
    clearAllSessions
  } = useSessionManager();

  // Effect 1: Handle welcome back modal display
  useEffect(() => {
    console.log('=== WELCOME BACK MODAL CHECK ===');
    console.log('Should show welcome back:', shouldShowWelcomeBack);
    console.log('User has chosen:', userHasChosen);
    console.log('Stored session exists:', !!storedSession);
    console.log('Session summary exists:', !!sessionSummary);

    // Don't show modal if user has already made a choice
    if (userHasChosen) {
      console.log('User has already made a choice, skipping modal check');
      return;
    }

    // Show welcome back modal for interrupted interviews
    if (shouldShowWelcomeBack && storedSession && sessionSummary) {
      console.log('Valid interrupted session found:', {
        answered: sessionSummary.questionsAnswered,
        total: sessionSummary.totalQuestions,
        timeAway: sessionSummary.timeAway
      });
      setShowWelcomeBack(true);
    } else {
      console.log('No interrupted session found - not showing modal');
      setShowWelcomeBack(false);
    }
  }, [shouldShowWelcomeBack, storedSession, sessionSummary, userHasChosen]);

  // Effect 2: Handle initial step determination (separate from modal logic)
  useEffect(() => {
    console.log('=== INITIAL STEP DETERMINATION ===');
    console.log('Current step:', currentStep);
    console.log('Has existing resume:', hasResume);
    console.log('Stored session resume data:', !!storedSession?.resumeData);

    // Only set initial step if we're still on upload (initial state)
    if (currentStep !== 'upload') {
      console.log('Already on step:', currentStep, '- not changing');
      return;
    }

    // If we have a stored session with resume data, go to interview
    if (storedSession?.resumeData) {
      console.log('Stored session has resume data, going to interview step');
      setCurrentStep('interview');
    }
    // If user has existing resume data, go to info collection
    else if (hasResume && existingResumeData) {
      console.log('User has existing resume data, going to info collection step');
      setCurrentStep('info');
    }
    // Otherwise, stay on upload step
    else {
      console.log('No resume data found, staying on upload step');
      setCurrentStep('upload');
    }
  }, [hasResume, existingResumeData, storedSession?.resumeData, currentStep]);

  // Real-time tracking is now handled by useSessionManager hook

  // Auto-save session activity is now handled by useSessionManager

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

    try {
      // Clear all session data using unified method
      clearAllSessions();

      // Clear Redux state
      dispatch(resetInterview());

      // Reset local component state
      setCurrentStep('upload');
      setShowWelcomeBack(false); // Hide modal
      setProcessingResume(false);
      setCollectingInfo(false);
      setUserHasChosen(true); // Mark that user has made a choice

      console.log('=== NEW INTERVIEW SETUP COMPLETE ===');
    } catch (error) {
      console.error('Failed to start new interview:', error);
    }
  }, [dispatch, clearAllSessions]);

  const handleInterviewComplete = useCallback(() => {
    console.log('Interview completed - clearing all data and redirecting');

    try {
      // Clear all session data using unified method
      clearAllSessions();

      // Clear Redux state
      dispatch(resetInterview());

      // Redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Failed to complete interview:', error);
    }
  }, [navigate, dispatch, clearAllSessions]);

  const handleContinueSession = useCallback(() => {
    console.log('User chose to continue session');
    setUserHasChosen(true); // Mark that user has made a choice
    setCurrentStep('interview');
    setShowWelcomeBack(false);

    try {
      // Restore session data using unified method
      restoreSession();
    } catch (error) {
      console.error('Failed to continue session:', error);
    }
  }, [restoreSession]);

  const handleWelcomeBackClose = useCallback(() => {
    console.log('User closed welcome back modal');
    setUserHasChosen(true); // Mark that user has made a choice (by closing)
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
              clearAllSessions(); // Clear session if file is removed
            }}
            isProcessing={processingResume} // Pass processing state
            resumeData={resumeData} // Pass resumeData to show file details
            existingResumeData={existingResumeData} // Pass existing resume data
            onUseExistingResume={() => {
              // Use existing resume data and move to next step
              if (existingResumeData) {
                // Set the resume data in the hook state
                // This will trigger the next step
                setCurrentStep('info');
              }
            }}
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
            onSubmitAnswer={submitAnswer}
            onSaveResults={saveResults}
            onComplete={handleInterviewComplete}
          />
        );

      default:
        return null;
    }
  }, [currentStep, handleFileUpload, handleCollectInfo, handleStartNew, handleInterviewComplete, uploading, loading, error, resumeData, detailedResumeData, currentSession, chatMessages, submitAnswer, processingResume, collectingInfo]);


  return (
    <div style={{ padding: spacing.xl, minHeight: '100vh', backgroundColor: colors.background.secondary }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        {/* Main Content */}
        {renderCurrentStep()}
      </Space>

      {/* Welcome Back Modal */}
      <WelcomeBackModal
        visible={showWelcomeBack}
        questionsAnswered={sessionSummary?.questionsAnswered || 0}
        totalQuestions={sessionSummary?.totalQuestions || SESSION_CONFIG.DEFAULT_QUESTION_COUNT}
        timeAway={sessionSummary?.timeAway || 0}
        onContinue={handleContinueSession}
        onStartNew={handleStartNew}
        onClose={handleWelcomeBackClose}
      />
    </div>
  );
};

export default InterviewChat;

