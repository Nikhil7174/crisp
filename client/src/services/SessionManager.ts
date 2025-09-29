// src/services/SessionManager.ts
import type { StoredSession, SessionSummary } from '../types';

class SessionManager {
  private static readonly STORAGE_KEY = 'last-interview-session';
  private static readonly SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour

  // Add caching to reduce localStorage reads
  private static cachedSession: StoredSession | null = null;
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 1000; // 1 second cache

  static saveSession(sessionData: any): void {
    try {
      const session: StoredSession = {
        ...sessionData,
        timestamp: Date.now(),
        lastActivity: Date.now()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

      // Update cache
      this.cachedSession = session;
      this.cacheTimestamp = Date.now();
    } catch (error) {
      console.error(' SessionManager: Failed to save session:', error);
    }
  }

  static getLastSession(): StoredSession | null {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedSession && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        return this.isSessionValid(this.cachedSession) ? this.cachedSession : null;
      }

      // Cache miss or expired - read from localStorage
      const sessionData = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionData) {
        this.cachedSession = null;
        return null;
      }

      const session = JSON.parse(sessionData) as StoredSession;

      // Update cache
      this.cachedSession = session;
      this.cacheTimestamp = now;

      const isValid = this.isSessionValid(session);

      return isValid ? session : null;
    } catch (error) {
      console.error(' SessionManager: Failed to get session:', error);
      this.cachedSession = null;
      return null;
    }
  }

  static isSessionValid(session: StoredSession): boolean {
    if (!session || !session.timestamp) return false;

    const now = Date.now();
    const sessionAge = now - session.timestamp;

    return sessionAge < this.SESSION_EXPIRY;
  }

  static clearSession(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);

      // Clear cache
      this.cachedSession = null;
      this.cacheTimestamp = 0;
    } catch (error) {
      console.error(' SessionManager: Failed to clear session:', error);
    }
  }

  static updateActivity(): void {
    try {
      const session = this.getLastSession();
      if (session) {
        session.lastActivity = Date.now();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

        // Update cache
        this.cachedSession = session;
        this.cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error(' SessionManager: Failed to update activity:', error);
    }
  }

  static addChatMessage(message: any): void {
    try {
      const session = this.getLastSession();
      if (session) {
        if (!session.chatMessages) {
          session.chatMessages = [];
        }
        session.chatMessages.push(message);

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));

        // Update cache
        this.cachedSession = session;
        this.cacheTimestamp = Date.now();
      }
    } catch (error) {
      console.error(' SessionManager: Failed to add chat message:', error);
    }
  }

  static getSessionSummary(session: StoredSession): SessionSummary | null {
    if (!session) return null;

    try {
      const now = Date.now();
      const timeAway = Math.floor((now - (session.lastActivity || session.timestamp)) / (1000 * 60));

      // Get values from currentSession if available
      const questionsAnswered = session.currentSession?.answers?.length || 0;
      const totalQuestions = session.currentSession?.questions?.length || 6;
      const sessionDuration = Math.floor((now - session.timestamp) / (1000 * 60));
      const startTime = session.timestamp;

      return {
        timeAway,
        questionsAnswered,
        totalQuestions,
        sessionDuration,
        startTime
      };
    } catch (error) {
      console.error(' SessionManager: Failed to get session summary:', error);
      return null;
    }
  }

  // Add method to clear cache (useful for testing or manual cache invalidation)
  static clearCache(): void {
    this.cachedSession = null;
    this.cacheTimestamp = 0;
  }
}

export default SessionManager;
