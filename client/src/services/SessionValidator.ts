// src/services/SessionValidator.ts
// Session validation logic - separated from storage
import { SESSION_CONFIG } from '../config/session';
import type { StoredSession, SessionSummary } from '../types';

export class SessionValidator {
  static isValid(session: StoredSession | null): boolean {
    if (!session || !session.timestamp) {
      return false;
    }

    const now = Date.now();
    const sessionAge = now - session.timestamp;
    const isValid = sessionAge < SESSION_CONFIG.SESSION_EXPIRY;

    console.log('Session validation:', {
      sessionId: session.sessionId,
      timestamp: new Date(session.timestamp).toISOString(),
      age: Math.floor(sessionAge / (1000 * 60)), // age in minutes
      expiry: Math.floor(SESSION_CONFIG.SESSION_EXPIRY / (1000 * 60)), // expiry in minutes
      isValid
    });

    return isValid;
  }

  static isNewlyStarted(session: StoredSession): boolean {
    const sessionAge = Date.now() - session.timestamp;
    return sessionAge < SESSION_CONFIG.NEW_SESSION_THRESHOLD;
  }

  static isInterrupted(session: StoredSession): boolean {
    if (!session || !session.answers) {
      return false;
    }
    return session.answers.length > SESSION_CONFIG.MIN_ANSWERS_FOR_INTERRUPTED;
  }

  static shouldShowWelcomeBack(session: StoredSession | null): boolean {
    if (!session) {
      return false;
    }
    
    const isNewlyStarted = this.isNewlyStarted(session);
    const isInterrupted = this.isInterrupted(session);
    
    console.log('shouldShowWelcomeBack logic:', {
      sessionId: session.sessionId,
      isNewlyStarted,
      isInterrupted,
      answersCount: session.answers?.length || 0,
      sessionType: session.sessionType
    });
    
    // Show welcome back if:
    // 1. Session has answers (truly interrupted), OR
    // 2. Session is marked as 'interrupted' type
    // This covers both cases: user answered questions OR session was explicitly marked as interrupted
    return isInterrupted || session.sessionType === 'interrupted';
  }

  static getSessionSummary(session: StoredSession): SessionSummary {
    const now = Date.now();
    const timeAway = Math.floor((now - session.lastActivity) / (1000 * 60)); // minutes
    const sessionDuration = Math.floor((now - session.timestamp) / (1000 * 60)); // minutes

    return {
      timeAway,
      questionsAnswered: session.answers?.length || 0,
      totalQuestions: session.questions?.length || 0,
      sessionDuration,
      startTime: session.timestamp
    };
  }
}
