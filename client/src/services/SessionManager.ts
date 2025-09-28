// src/services/SessionManager.ts
import type { ResumeData, DetailedResumeData, InterviewSession, ChatMessage } from '../types';

interface StoredSession {
  sessionId: string;
  resumeData: ResumeData;
  detailedResumeData: DetailedResumeData;
  interviewSession: InterviewSession;
  chatMessages: ChatMessage[];
  lastActivity: number;
  createdAt: number;
  status: 'active' | 'completed' | 'expired';
}

class SessionManager {
  private readonly STORAGE_KEY = 'last-interview-session';
  private readonly SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour

  /**
   * Save session to localStorage with error handling
   */
  saveSession(sessionData: Omit<StoredSession, 'lastActivity' | 'createdAt' | 'status'>): void {
    try {
      const session: StoredSession = {
        ...sessionData,
        lastActivity: Date.now(),
        createdAt: sessionData.createdAt || Date.now(),
        status: 'active'
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session:', error);
      // Graceful degradation - continue without persistence
    }
  }

  /**
   * Get last session with validation
   */
  getLastSession(): StoredSession | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const session: StoredSession = JSON.parse(stored);
      
      // Validate session structure
      if (!this.isValidSession(session)) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to retrieve session:', error);
      this.clearSession();
      return null;
    }
  }

  /**
   * Check if session is still valid (not expired)
   */
  isSessionValid(session?: StoredSession): boolean {
    const targetSession = session || this.getLastSession();
    if (!targetSession) return false;

    const isExpired = (Date.now() - targetSession.lastActivity) > this.SESSION_EXPIRY;
    return !isExpired;
  }

  /**
   * Update session activity timestamp
   */
  updateActivity(): void {
    const session = this.getLastSession();
    if (session && this.isSessionValid(session)) {
      session.lastActivity = Date.now();
      this.saveSession(session);
    }
  }

  /**
   * Add chat message and auto-save
   */
  addChatMessage(message: ChatMessage): void {
    const session = this.getLastSession();
    if (!session) return;

    const updatedSession = {
      ...session,
      chatMessages: [...session.chatMessages, message],
      lastActivity: Date.now()
    };

    this.saveSession(updatedSession);
  }

  /**
   * Update interview session data
   */
  updateInterviewSession(interviewSession: Partial<InterviewSession>): void {
    const session = this.getLastSession();
    if (!session) return;

    const updatedSession = {
      ...session,
      interviewSession: { ...session.interviewSession, ...interviewSession },
      lastActivity: Date.now()
    };

    this.saveSession(updatedSession);
  }

  /**
   * Mark session as completed
   */
  completeSession(): void {
    const session = this.getLastSession();
    if (!session) return;

    const completedSession = {
      ...session,
      status: 'completed' as const,
      lastActivity: Date.now()
    };

    this.saveSession(completedSession);
  }

  /**
   * Clear session from storage
   */
  clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  /**
   * Get session summary for welcome back modal
   */
  getSessionSummary(): {
    timeAway: string;
    questionsAnswered: number;
    totalQuestions: number;
    startTime: Date;
    lastActivity: Date;
  } | null {
    const session = this.getLastSession();
    if (!session || !this.isSessionValid(session)) return null;

    const timeAway = this.formatTimeAway(session.lastActivity);
    const questionsAnswered = session.interviewSession.answers?.length || 0;
    const totalQuestions = session.interviewSession.questions?.length || 0;

    return {
      timeAway,
      questionsAnswered,
      totalQuestions,
      startTime: new Date(session.createdAt),
      lastActivity: new Date(session.lastActivity)
    };
  }

  /**
   * Validate session structure
   */
  private isValidSession(session: any): session is StoredSession {
    return (
      session &&
      typeof session.sessionId === 'string' &&
      session.resumeData &&
      session.detailedResumeData &&
      session.interviewSession &&
      Array.isArray(session.chatMessages) &&
      typeof session.lastActivity === 'number' &&
      typeof session.createdAt === 'number'
    );
  }

  /**
   * Format time away in human-readable format
   */
  private formatTimeAway(lastActivity: number): string {
    const now = Date.now();
    const diffMs = now - lastActivity;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default sessionManager;
