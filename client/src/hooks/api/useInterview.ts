// src/hooks/api/useInterview.ts
import { useState, useCallback } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../../store';
import { 
  setCurrentSession, 
  updateSession, 
  addChatMessage, 
  setChatMessages,
  setStartingInterview, 
  setSubmittingAnswer, 
  setError,
  resetSession 
} from '../../store/slices/interviewSlice';
import { sessionManager } from '../../services/SessionManager';
import type { InterviewSession, ChatMessage } from '../../types';

interface StartInterviewResponse {
  success: boolean;
  sessionId: string;
  questions: any[];
  message: string;
  error?: string;
}

interface SubmitAnswerResponse {
  success: boolean;
  evaluation: {
    score: number;
    feedback: string;
  };
  isComplete: boolean;
  nextQuestion: any;
  message: string;
  error?: string;
}

// Axios instance with interceptors
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for loading states
apiClient.interceptors.request.use(
  (config) => {
    // Add loading indicator if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorMessage = error.response?.data?.error || error.message || 'An error occurred';
    message.error(errorMessage);
    return Promise.reject(error);
  }
);

export const useInterview = () => {
  const dispatch = useAppDispatch();
  const { 
    currentSession, 
    sessionHistory, 
    chatMessages,
    isStartingInterview,
    isSubmittingAnswer,
    error 
  } = useAppSelector(state => state.interview);

  const startInterview = useCallback(async (candidateData: any): Promise<StartInterviewResponse | null> => {
    dispatch(setStartingInterview(true));
    dispatch(setError(null));
    
    try {
      const response = await apiClient.post('/interview/start', {
        candidateData
      });
      
      const result: StartInterviewResponse = response.data;
      
      if (result.success) {
        // Create interview session object
        const session: InterviewSession = {
          id: result.sessionId,
          candidateId: candidateData.id || 'temp-id',
          status: 'in_progress',
          questions: result.questions,
          answers: [],
          startTime: new Date(),
        };
        
        // Store session in Redux
        dispatch(setCurrentSession(session));
        
        // Save to session manager for persistence
        const currentStoredSession = sessionManager.getLastSession();
        if (currentStoredSession) {
          sessionManager.saveSession({
            ...currentStoredSession,
            sessionId: result.sessionId,
            interviewSession: session,
            chatMessages: []
          });
        }
        
        // Add system message to chat
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          sessionId: result.sessionId,
          type: 'system',
          content: 'Interview session started. The AI will now ask you questions based on your resume.',
          timestamp: new Date(),
        };
        
        dispatch(addChatMessage(systemMessage));
        sessionManager.addChatMessage(systemMessage);
        
        message.success('Interview started successfully!');
      } else {
        dispatch(setError(result.error || 'Failed to start interview'));
        message.error(result.error || 'Failed to start interview');
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Failed to start interview';
      dispatch(setError(errorMessage));
      return null;
    } finally {
      dispatch(setStartingInterview(false));
    }
  }, [dispatch]);

  const submitAnswer = useCallback(async (sessionId: string, questionId: string, answer: string, timeTaken: number): Promise<SubmitAnswerResponse | null> => {
    dispatch(setSubmittingAnswer(true));
    dispatch(setError(null));
    
    try {
      const response = await apiClient.post('/interview/answer', {
        sessionId,
        questionId,
        answer,
        timeTaken
      });
      
      const result: SubmitAnswerResponse = response.data;
      
      if (result.success) {
        // Update current session with new answer
        if (currentSession) {
          const updatedSession = {
            ...currentSession,
            answers: [
              ...currentSession.answers,
              {
                questionId,
                answer,
                answeredAt: new Date(),
                timeTaken,
                score: result.evaluation.score,
                feedback: result.evaluation.feedback,
              }
            ]
          };
          
          // Update session status if complete
          if (result.isComplete) {
            updatedSession.status = 'completed';
            updatedSession.endTime = new Date();
            updatedSession.duration = updatedSession.endTime.getTime() - updatedSession.startTime.getTime();
            
            // Mark session as completed in session manager
            sessionManager.completeSession();
          }
          
          dispatch(updateSession(updatedSession));
          
          // Update session manager
          sessionManager.updateInterviewSession(updatedSession);
        }
        
        // Add user message to chat
        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          sessionId,
          type: 'user',
          content: answer,
          timestamp: new Date(),
        };
        dispatch(addChatMessage(userMessage));
        sessionManager.addChatMessage(userMessage);
        
        // Add AI feedback message to chat
        const aiMessage: ChatMessage = {
          id: `msg-${Date.now() + 1}`,
          sessionId,
          type: 'assistant',
          content: `Score: ${result.evaluation.score}/10\n\nFeedback: ${result.evaluation.feedback}`,
          timestamp: new Date(),
        };
        dispatch(addChatMessage(aiMessage));
        sessionManager.addChatMessage(aiMessage);
        
        message.success('Answer submitted successfully!');
      } else {
        dispatch(setError(result.error || 'Failed to submit answer'));
        message.error(result.error || 'Failed to submit answer');
      }
      
      return result;
    } catch (error) {
      const errorMessage = 'Failed to submit answer';
      dispatch(setError(errorMessage));
      return null;
    } finally {
      dispatch(setSubmittingAnswer(false));
    }
  }, [dispatch, currentSession]);

  // Get current session from Redux
  const getCurrentSession = useCallback((): InterviewSession | null => {
    return currentSession;
  }, [currentSession]);

  // Get session history from Redux
  const getSessionHistory = useCallback((): InterviewSession[] => {
    return sessionHistory;
  }, [sessionHistory]);

  // Get chat messages for current session
  const getChatMessages = useCallback((): ChatMessage[] => {
    return chatMessages;
  }, [chatMessages]);

  // Reset current session
  const resetCurrentSession = useCallback(() => {
    dispatch(resetSession());
    sessionManager.clearSession();
  }, [dispatch]);

  // Restore session from localStorage
  const restoreSession = useCallback(() => {
    const session = sessionManager.getLastSession();
    if (session && sessionManager.isSessionValid(session)) {
      dispatch(setCurrentSession(session.interviewSession));
      dispatch(setChatMessages(session.chatMessages));
      return session;
    }
    return null;
  }, [dispatch]);

  // Add chat message (for manual chat interactions)
  const addChatMessage = useCallback((message: ChatMessage) => {
    dispatch(addChatMessage(message));
    sessionManager.addChatMessage(message);
  }, [dispatch]);

  return {
    startInterview,
    submitAnswer,
    loading: isStartingInterview || isSubmittingAnswer,
    error,
    currentSession: getCurrentSession(),
    sessionHistory: getSessionHistory(),
    chatMessages: getChatMessages(),
    resetCurrentSession,
    restoreSession,
    addChatMessage,
  };
};
