// src/services/SessionManager.ts
// Refactored SessionManager with separated concerns and better error handling
import { SessionStorage } from './SessionStorage';
import { SessionValidator } from './SessionValidator';
import { SESSION_CONFIG } from '../config/session';
import type { StoredSession, InterviewSession, ResumeData, DetailedResumeData, ChatMessage } from '../types';

export class SessionManager {
  // Simple cache to reduce localStorage reads
  private static cachedSession: StoredSession | null = null;
  private static cacheTimestamp: number = 0;

  /**
   * Save a complete session to localStorage
   */
  static saveSession(sessionData: {
    sessionId: string;
    resumeData?: ResumeData;
    detailedResumeData?: DetailedResumeData;
    currentSession: InterviewSession;
    chatMessages?: ChatMessage[];
    sessionType?: 'new' | 'interrupted' | 'completed';
  }): void {
    try {
      // Convert old structure to new flattened structure
      const flattenedSession: StoredSession = {
        // Session metadata
        sessionId: sessionData.sessionId,
        timestamp: Date.now(),
        lastActivity: Date.now(),
        sessionType: sessionData.sessionType || 'new',
        
        // Resume data
        resumeData: sessionData.resumeData,
        detailedResumeData: sessionData.detailedResumeData,
        
        // Interview data (flattened from currentSession)
        status: sessionData.currentSession.status,
        questions: sessionData.currentSession.questions || [],
        answers: sessionData.currentSession.answers || [],
        startTime: sessionData.currentSession.startTime,
        endTime: sessionData.currentSession.endTime,
        duration: sessionData.currentSession.duration,
        score: sessionData.currentSession.score,
        summary: sessionData.currentSession.summary,
        
        // Chat messages
        chatMessages: sessionData.chatMessages || [],
        
        // Additional metadata
        candidateId: sessionData.currentSession.candidateId,
        success: sessionData.currentSession.success,
        message: sessionData.currentSession.message
      };

      SessionStorage.save(flattenedSession);
      SessionStorage.setInterviewActive(true);
      
      // Update cache
      this.cachedSession = flattenedSession;
      this.cacheTimestamp = Date.now();
      
      console.log('Session saved successfully:', sessionData.sessionId);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  /**
   * Get the last session from localStorage with caching
   */
  static getLastSession(): StoredSession | null {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedSession && (now - this.cacheTimestamp) < SESSION_CONFIG.CACHE_DURATION) {
        const isValid = SessionValidator.isValid(this.cachedSession);
        return isValid ? this.cachedSession : null;
      }

      // Cache miss or expired - read from localStorage
      const session = SessionStorage.load();
      if (!session) {
        this.cachedSession = null;
        return null;
      }

      // Update cache
      this.cachedSession = session;
      this.cacheTimestamp = now;

      const isValid = SessionValidator.isValid(session);
      return isValid ? session : null;
    } catch (error) {
      console.error('Failed to get last session:', error);
      this.cachedSession = null;
      return null;
    }
  }

  /**
   * Check if session is valid
   */
  static isSessionValid(session: StoredSession | null): boolean {
    return SessionValidator.isValid(session);
  }

  /**
   * Check if interview is active
   */
  static isInterviewActive(): boolean {
    return SessionStorage.isInterviewActive();
  }

  /**
   * Set interview active state
   */
  static setInterviewActive(isActive: boolean): void {
    SessionStorage.setInterviewActive(isActive);
  }

  /**
   * Update activity timestamp
   */
  static updateActivity(): void {
    try {
      const session = this.getLastSession();
      if (session) {
        this.updateSession({ lastActivity: Date.now() });
      }
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }

  /**
   * Check if session should show welcome back modal
   */
  static shouldShowWelcomeBack(session: StoredSession | null): boolean {
    return SessionValidator.shouldShowWelcomeBack(session);
  }

  /**
   * Get session summary for welcome back modal
   */
  static getSessionSummary(session: StoredSession): any {
    return SessionValidator.getSessionSummary(session);
  }

  /**
   * Update session with new data
   */
  static updateSession(updates: Partial<StoredSession>): void {
    try {
      const currentSession = this.getLastSession();
      if (!currentSession) {
        throw new Error('No session to update');
      }

      const updatedSession: StoredSession = {
        ...currentSession,
        ...updates,
        lastActivity: Date.now()
      };

      SessionStorage.save(updatedSession);
      
      // Update cache
      this.cachedSession = updatedSession;
      this.cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Failed to update session:', error);
      throw error;
    }
  }

  /**
   * Add chat message to session
   */
  static addChatMessage(message: ChatMessage): void {
    try {
      const session = this.getLastSession();
      if (!session) {
        throw new Error('No session to add message to');
      }

      const updatedSession: StoredSession = {
        ...session,
        chatMessages: [...session.chatMessages, message],
        lastActivity: Date.now()
      };

      SessionStorage.save(updatedSession);
      
      // Update cache
      this.cachedSession = updatedSession;
      this.cacheTimestamp = Date.now();
    } catch (error) {
      console.error('Failed to add chat message:', error);
      throw error;
    }
  }

  /**
   * Clear all session data
   */
  static clearAllSessions(): void {
    try {
      SessionStorage.clear();
      this.cachedSession = null;
      this.cacheTimestamp = 0;
      console.log('All sessions cleared successfully');
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      throw error;
    }
  }

  /**
   * Clear cache (for testing or manual cache invalidation)
   */
  static clearCache(): void {
    this.cachedSession = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Convert flattened session back to old structure for backward compatibility
   */
  static toLegacyFormat(session: StoredSession): any {
    return {
      resumeData: session.resumeData,
      detailedResumeData: session.detailedResumeData,
      currentSession: {
        sessionId: session.sessionId,
        candidateId: session.candidateId,
        status: session.status,
        questions: session.questions,
        answers: session.answers,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        score: session.score,
        summary: session.summary,
        success: session.success,
        message: session.message
      },
      chatMessages: session.chatMessages,
      timestamp: session.timestamp,
      lastActivity: session.lastActivity
    };
  }
}

export default SessionManager;