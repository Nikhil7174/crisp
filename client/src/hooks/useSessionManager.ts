// src/hooks/useSessionManager.ts
// Unified session management hook - eliminates dual state management
import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentSession, updateSession, setChatMessages, setError } from '../store/slices/interviewSlice';
import { setResumeData, setDetailedResumeData } from '../store/slices/interviewSlice';
import SessionManager from '../services/SessionManager';
import type { StoredSession, InterviewSession, ResumeData, DetailedResumeData, ChatMessage } from '../types';

export const useSessionManager = () => {
  const dispatch = useAppDispatch();
  const { currentSession, chatMessages } = useAppSelector(state => state.interview);
  const { resumeData, detailedResumeData } = useAppSelector(state => state.interview);

  // Get stored session from localStorage
  const storedSession = useMemo(() => {
    return SessionManager.getLastSession();
  }, [currentSession?.sessionId]);

  // Check if there's an interrupted session that should show welcome back modal
  const shouldShowWelcomeBack = useMemo(() => {
    if (!storedSession || !SessionManager.isInterviewActive()) {
      return false;
    }
    return SessionManager.shouldShowWelcomeBack(storedSession);
  }, [storedSession]);

  // Get session summary for welcome back modal
  const sessionSummary = useMemo(() => {
    if (!storedSession) return null;
    return SessionManager.getSessionSummary(storedSession);
  }, [storedSession]);

  /**
   * Save session data (unified method for both Redux and localStorage)
   */
  const saveSession = useCallback((sessionData: {
    sessionId: string;
    resumeData?: ResumeData;
    detailedResumeData?: DetailedResumeData;
    currentSession: InterviewSession;
    chatMessages?: ChatMessage[];
    sessionType?: 'new' | 'interrupted' | 'completed';
  }) => {
    try {
      // Save to localStorage
      SessionManager.saveSession(sessionData);
      
      // Update Redux state
      dispatch(setCurrentSession(sessionData.currentSession));
      
      if (sessionData.resumeData) {
        dispatch(setResumeData(sessionData.resumeData));
      }
      
      if (sessionData.detailedResumeData) {
        dispatch(setDetailedResumeData(sessionData.detailedResumeData));
      }
      
      if (sessionData.chatMessages) {
        dispatch(setChatMessages(sessionData.chatMessages));
      }
      
      console.log('Session saved successfully to both Redux and localStorage');
    } catch (error) {
      console.error('Failed to save session:', error);
      dispatch(setError('Failed to save session data'));
      throw error;
    }
  }, [dispatch]);

  /**
   * Restore session from localStorage to Redux
   */
  const restoreSession = useCallback(() => {
    try {
      const session = SessionManager.getLastSession();
      if (!session) {
        throw new Error('No session to restore');
      }

      // Restore to Redux
      const legacySession = SessionManager.toLegacyFormat(session);
      
      if (legacySession.currentSession) {
        dispatch(setCurrentSession(legacySession.currentSession));
      }
      
      if (legacySession.resumeData) {
        dispatch(setResumeData(legacySession.resumeData));
      }
      
      if (legacySession.detailedResumeData) {
        dispatch(setDetailedResumeData(legacySession.detailedResumeData));
      }
      
      if (legacySession.chatMessages) {
        dispatch(setChatMessages(legacySession.chatMessages));
      }
      
      console.log('Session restored successfully from localStorage to Redux');
      return session;
    } catch (error) {
      console.error('Failed to restore session:', error);
      dispatch(setError('Failed to restore session data'));
      throw error;
    }
  }, [dispatch]);

  /**
   * Update session data (both Redux and localStorage)
   */
  const updateSessionData = useCallback((updates: Partial<StoredSession>) => {
    try {
      // Update localStorage
      SessionManager.updateSession(updates);
      
      // Update Redux if it's session-related data
      if (updates.answers || updates.status || updates.endTime || updates.duration || updates.score) {
        const currentStored = SessionManager.getLastSession();
        if (currentStored) {
          const legacySession = SessionManager.toLegacyFormat(currentStored);
          if (legacySession.currentSession) {
            dispatch(updateSession(legacySession.currentSession));
          }
        }
      }
      
      console.log('Session updated successfully');
    } catch (error) {
      console.error('Failed to update session:', error);
      dispatch(setError('Failed to update session data'));
      throw error;
    }
  }, [dispatch]);

  /**
   * Add chat message (both Redux and localStorage)
   */
  const addChatMessage = useCallback((message: ChatMessage) => {
    try {
      // Add to localStorage
      SessionManager.addChatMessage(message);
      
      // Add to Redux
      dispatch(setChatMessages([...chatMessages, message]));
      
      console.log('Chat message added successfully');
    } catch (error) {
      console.error('Failed to add chat message:', error);
      dispatch(setError('Failed to add chat message'));
      throw error;
    }
  }, [dispatch, chatMessages]);

  /**
   * Clear all session data (both Redux and localStorage)
   */
  const clearAllSessions = useCallback(() => {
    try {
      // Clear localStorage
      SessionManager.clearAllSessions();
      
      // Clear Redux (this would need to be implemented in the slice)
      // dispatch(resetInterview()); // Uncomment when resetInterview is available
      
      console.log('All sessions cleared successfully');
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      dispatch(setError('Failed to clear session data'));
      throw error;
    }
  }, [dispatch]);

  /**
   * Check if session is valid
   */
  const isSessionValid = useCallback((session: StoredSession | null) => {
    return SessionManager.isSessionValid(session);
  }, []);

  /**
   * Check if interview is active
   */
  const isInterviewActive = useCallback(() => {
    return SessionManager.isInterviewActive();
  }, []);

  return {
    // State
    currentSession,
    storedSession,
    chatMessages,
    resumeData,
    detailedResumeData,
    
    // Computed values
    shouldShowWelcomeBack,
    sessionSummary,
    
    // Actions
    saveSession,
    restoreSession,
    updateSessionData,
    addChatMessage,
    clearAllSessions,
    isSessionValid,
    isInterviewActive
  };
};
