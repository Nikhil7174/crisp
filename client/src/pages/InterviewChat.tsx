// src/pages/InterviewChat.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { spacing, colors } from '../styles';
import { ResumeUpload, InfoCollection, InterviewSession } from '../components/interview';
import { WelcomeBackModal } from '../components/interview/WelcomeBackModal';
import { useResumeUpload, useInterview } from '../hooks/api';
import { sessionManager } from '../services/SessionManager';

type InterviewStep = 'upload' | 'info' | 'interview';

export const InterviewChat: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<InterviewStep>('upload');
  const [resumeData, setResumeData] = useState<any>(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<any>(null);
  
  const { 
    uploadResume, 
    collectMissingInfo, 
    uploading, 
    loading, 
    restoreSession: restoreResumeSession 
  } = useResumeUpload();
  
  const { 
    startInterview, 
    submitAnswer, 
    currentSession, 
    chatMessages,
    restoreSession: restoreInterviewSession 
  } = useInterview();

  // Check for existing session on component mount
  const checkExistingSession = useCallback(() => {
    const session = sessionManager.getLastSession();
    
    if (session && sessionManager.isSessionValid(session)) {
      // Restore resume data
      const restoredResumeSession = restoreResumeSession();
      if (restoredResumeSession) {
        setResumeData(restoredResumeSession.resumeData);
        
        // Restore interview session
        const restoredInterviewSession = restoreInterviewSession();
        if (restoredInterviewSession) {
          setCurrentStep('interview');
        } else {
          // Resume data exists but no interview session
          setCurrentStep('info');
        }
        
        // Show welcome back modal
        const summary = sessionManager.getSessionSummary();
        if (summary) {
          setSessionSummary(summary);
          setShowWelcomeBack(true);
        }
      }
    }
  }, [restoreResumeSession, restoreInterviewSession]);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const handleFileUpload = useCallback(async (file: File) => {
    const result = await uploadResume(file);
    
    if (result?.success) {
      setResumeData(result.data);
      if (result.missingFields.length > 0) {
        setCurrentStep('info');
      } else {
        setCurrentStep('interview');
      }
    }
  }, [uploadResume]);

  const handleCollectInfo = useCallback(async (values: any) => {
    const result = await collectMissingInfo(values, resumeData);
    
    if (result?.success) {
      setResumeData(result.data);
      setCurrentStep('interview');
    }
  }, [collectMissingInfo, resumeData]);

  const handleStartNew = useCallback(() => {
    setCurrentStep('upload');
    setResumeData(null);
    setShowWelcomeBack(false);
    sessionManager.clearSession();
  }, []);

  const handleContinueSession = useCallback(() => {
    setShowWelcomeBack(false);
    // Session is already restored, just continue
  }, []);

  const handleWelcomeBackClose = useCallback(() => {
    setShowWelcomeBack(false);
  }, []);

  // Auto-save session activity on user interaction
  const handleUserActivity = useCallback(() => {
    sessionManager.updateActivity();
  }, []);

  useEffect(() => {
    // Add event listeners for user activity
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('keypress', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);

    return () => {
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('keypress', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
    };
  }, [handleUserActivity]);

  // Save session before page unload
  const handleBeforeUnload = useCallback(() => {
    sessionManager.updateActivity();
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);

  const renderCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 'upload':
        return (
          <ResumeUpload 
            onFileUpload={handleFileUpload}
            uploading={uploading}
          />
        );
      
      case 'info':
        return (
          <InfoCollection
            resumeData={resumeData}
            onCollectInfo={handleCollectInfo}
            loading={loading}
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
  }, [currentStep, handleFileUpload, uploading, resumeData, handleCollectInfo, loading, handleStartNew, currentSession, chatMessages, startInterview, submitAnswer]);

  return (
    <div style={{ 
      padding: spacing.lg, 
      minHeight: '100vh', 
      background: colors.background.primary 
    }}>
      {renderCurrentStep()}
      
      {/* Welcome Back Modal */}
      {showWelcomeBack && sessionSummary && (
        <WelcomeBackModal
          visible={showWelcomeBack}
          sessionSummary={sessionSummary}
          onContinue={handleContinueSession}
          onStartNew={handleStartNew}
          onClose={handleWelcomeBackClose}
        />
      )}
    </div>
  );
};

export default InterviewChat;
