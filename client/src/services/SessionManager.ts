// src/services/SessionManager.ts
import type { StoredSession, SessionSummary } from '../types';

class SessionManager {
  private static readonly STORAGE_KEY = 'last-interview-session';
  private static readonly INTERVIEW_ACTIVE_KEY = 'interview-active';
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
        const isValid = this.isSessionValid(this.cachedSession);
        console.log('Returning cached session:', isValid ? 'valid' : 'invalid');
        return isValid ? this.cachedSession : null;
      }

      // Cache miss or expired - read from localStorage
      const sessionData = localStorage.getItem(this.STORAGE_KEY);
      if (!sessionData) {
        console.log('No session data found in localStorage');
        this.cachedSession = null;
        return null;
      }

      const session = JSON.parse(sessionData) as StoredSession;
      console.log('Retrieved session from localStorage:', session);

      // Update cache
      this.cachedSession = session;
      this.cacheTimestamp = now;

      const isValid = this.isSessionValid(session);
      console.log('Session validity check:', isValid);

      return isValid ? session : null;
    } catch (error) {
      console.error(' SessionManager: Failed to get session:', error);
      this.cachedSession = null;
      return null;
    }
  }

  static isSessionValid(session: StoredSession): boolean {
    if (!session || !session.timestamp) {
      console.log('Session validation failed: no session or timestamp');
      return false;
    }

    const now = Date.now();
    const sessionAge = now - session.timestamp;
    const isValid = sessionAge < this.SESSION_EXPIRY;

    console.log('Session validation:', {
      sessionId: session.currentSession?.sessionId,
      timestamp: new Date(session.timestamp).toISOString(),
      age: Math.floor(sessionAge / (1000 * 60)), // age in minutes
      expiry: Math.floor(this.SESSION_EXPIRY / (1000 * 60)), // expiry in minutes
      isValid
    });

    return isValid;
  }

  static clearSession(_sessionId?: string): void {
    try {
      console.log('Clearing session from localStorage');
      localStorage.removeItem(this.STORAGE_KEY);

      // Clear cache
      this.cachedSession = null;
      this.cacheTimestamp = 0;
      console.log('Session cleared successfully');
    } catch (error) {
      console.error(' SessionManager: Failed to clear session:', error);
    }
  }

  static clearAllSessions(): void {
    try {
      console.log('Clearing all sessions from localStorage');
      // Clear all interview-related localStorage items
      const keys = Object.keys(localStorage);
      console.log('Found localStorage keys:', keys);

      keys.forEach(key => {
        if (key.includes('interview') || key.includes('session')) {
          console.log('Removing key:', key);
          localStorage.removeItem(key);
        }
      });

      // Also clear the interview active flag
      localStorage.removeItem(this.INTERVIEW_ACTIVE_KEY);

      // Clear cache
      this.cachedSession = null;
      this.cacheTimestamp = 0;
      console.log('All sessions cleared successfully');
    } catch (error) {
      console.error(' SessionManager: Failed to clear all sessions:', error);
    }
  }

  // Interview Active State Management
  static setInterviewActive(isActive: boolean): void {
    try {
      if (isActive) {
        localStorage.setItem(this.INTERVIEW_ACTIVE_KEY, 'true');
        console.log('Interview marked as active');
      } else {
        localStorage.removeItem(this.INTERVIEW_ACTIVE_KEY);
        console.log('Interview marked as inactive');
      }
    } catch (error) {
      console.error('SessionManager: Failed to set interview active state:', error);
    }
  }

  static isInterviewActive(): boolean {
    try {
      const isActive = localStorage.getItem(this.INTERVIEW_ACTIVE_KEY) === 'true';
      console.log('Interview active status:', isActive);
      return isActive;
    } catch (error) {
      console.error('SessionManager: Failed to check interview active state:', error);
      return false;
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
      // Use lastActivity if available, otherwise use timestamp
      const lastActivityTime = session.lastActivity || session.timestamp;
      const timeAway = Math.floor((now - lastActivityTime) / (1000 * 60));

      // Get values from currentSession if available
      const questionsAnswered = session.currentSession?.answers?.length || 0;
      const totalQuestions = session.currentSession?.questions?.length || 6;
      const sessionDuration = Math.floor((now - session.timestamp) / (1000 * 60));
      const startTime = session.timestamp;

      console.log('Session summary calculation:', {
        now: new Date(now).toISOString(),
        lastActivity: new Date(lastActivityTime).toISOString(),
        timeAway,
        questionsAnswered,
        totalQuestions
      });

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
