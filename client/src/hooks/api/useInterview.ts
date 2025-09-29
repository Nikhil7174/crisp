// src/hooks/api/useInterview.ts
import { useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setCurrentSession,
  updateSession,
  addChatMessage,
  setChatMessages,
  setStartingInterview,
  setSubmittingAnswer,
  setError
} from '../../store/slices/interviewSlice';
import SessionManager from '../../services/SessionManager';
import type { DetailedResumeData, ChatMessage } from '../../types';

const API_BASE_URL = 'http://localhost:3001/api';

export const useInterview = () => {
  const dispatch = useAppDispatch();
  const { currentSession, chatMessages, isStartingInterview, isSubmittingAnswer, error } = useAppSelector(state => state.interview);

  // Memoize the stored session to avoid multiple calls
  const storedSession = useMemo(() => {
    return SessionManager.getLastSession();
  }, [currentSession?.sessionId]); // Only recalculate when session ID changes

  const startInterview = useCallback(async (candidateData: DetailedResumeData) => {
    try {
      dispatch(setStartingInterview(true));
      dispatch(setError(null));

      const response = await axios.post(`${API_BASE_URL}/interview/start`, {
        candidateData
      });

      if (response.data.success) {
        const session = response.data;

        // FIXED: Clear Redux chat messages when starting new interview
        dispatch(setChatMessages([]));

        dispatch(setCurrentSession(session));

        // Save session to localStorage
        SessionManager.saveSession(session);

        // Check the actual stored session (use memoized value)
        const storedChatMessages = storedSession?.chatMessages || [];
        const hasStoredAssistantMessages = storedChatMessages.some(msg => msg.type === 'assistant');


        // Only add first question if no stored chat messages exist AND no stored assistant messages exist
        if (session.questions && session.questions.length > 0 && storedChatMessages.length === 0 && !hasStoredAssistantMessages) {
          const firstQuestion = session.questions[0];

          const questionMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            sessionId: session.sessionId,
            type: 'assistant',
            content: firstQuestion.question,
            timestamp: new Date().toISOString()
          };

          dispatch(addChatMessage(questionMessage));
          SessionManager.addChatMessage(questionMessage);
        }

        return session;
      }
    } catch (error: any) {
      console.error(' useInterview: Start interview error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to start interview';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    } finally {
      dispatch(setStartingInterview(false));
    }
  }, [dispatch, storedSession]); // Add storedSession to dependencies

  const submitAnswer = useCallback(async (
    sessionId: string,
    questionId: string,
    selectedOptionId: string,
    timeTaken: number
  ) => {
    try {
      dispatch(setSubmittingAnswer(true));
      dispatch(setError(null));

      const response = await axios.post(`${API_BASE_URL}/interview/answer`, {
        sessionId,
        questionId,
        selectedOptionId,
        timeTaken
      });

      if (response.data.success) {
        // Update the current session with the new answer
        if (currentSession) {
          // FIXED: Create the answer object with the correct structure
          const newAnswer = {
            questionId,
            answer: selectedOptionId === 'timeout' ? 'No answer selected (timeout)' : `Selected: ${selectedOptionId}`,
            selectedOptionId: selectedOptionId === 'timeout' ? 'timeout' : selectedOptionId, // This was the issue!
            answeredAt: new Date(),
            timeTaken: timeTaken || 0,
            isCorrect: response.data.isCorrect
          };

          // Update session locally
          const updatedSession = {
            ...currentSession,
            answers: [...(currentSession.answers || []), newAnswer]
          };

          dispatch(updateSession(updatedSession));
          SessionManager.saveSession(updatedSession);

          // Check if all questions are answered using the updated session
          const allQuestionsAnswered = updatedSession.questions.length === updatedSession.answers.length;

          // Only add next question message if not all questions are answered
          if (!allQuestionsAnswered) {
            const nextQuestion = response.data.nextQuestion;
            if (nextQuestion) {
              const questionMessage: ChatMessage = {
                id: `msg-${Date.now() + 1}`,
                sessionId,
                type: 'assistant',
                content: nextQuestion.question,
                timestamp: new Date().toISOString()
              };

              dispatch(addChatMessage(questionMessage));
              SessionManager.addChatMessage(questionMessage);
            }
          }
        }

        return response.data;
      }
    } catch (error: any) {
      console.error(' useInterview: Submit answer error:', error);
      const errorMessage = error.response?.data?.message || 'Failed to submit answer';
      dispatch(setError(errorMessage));
      throw new Error(errorMessage);
    } finally {
      dispatch(setSubmittingAnswer(false));
    }
  }, [dispatch, currentSession]);

  const getCurrentSession = useCallback(() => {
    return currentSession;
  }, [currentSession]);

  const restoreSession = useCallback((session: any) => {
    dispatch(setCurrentSession(session));

    // Restore chat messages
    const messages = SessionManager.getLastSession()?.chatMessages || [];
    dispatch(setChatMessages(messages));
  }, [dispatch]);

  return {
    currentSession,
    chatMessages,
    startingInterview: isStartingInterview,
    submittingAnswer: isSubmittingAnswer,
    error,
    startInterview,
    submitAnswer,
    getCurrentSession,
    restoreSession
  };
};
