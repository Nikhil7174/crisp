// src/services/SessionStorage.ts
// Pure localStorage operations - no business logic
import { SESSION_CONFIG } from '../config/session';
import type { StoredSession } from '../types';

export class SessionStorage {
  private static readonly STORAGE_KEY = SESSION_CONFIG.STORAGE_KEY;
  private static readonly INTERVIEW_ACTIVE_KEY = SESSION_CONFIG.INTERVIEW_ACTIVE_KEY;

  static save(session: StoredSession): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error(SESSION_CONFIG.ERRORS.SAVE_FAILED, error);
      throw new Error(SESSION_CONFIG.ERRORS.SAVE_FAILED);
    }
  }

  static load(): StoredSession | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;
      
      const session = JSON.parse(data) as StoredSession;
      return session;
    } catch (error) {
      console.error(SESSION_CONFIG.ERRORS.LOAD_FAILED, error);
      throw new Error(SESSION_CONFIG.ERRORS.LOAD_FAILED);
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.INTERVIEW_ACTIVE_KEY);
    } catch (error) {
      console.error(SESSION_CONFIG.ERRORS.CLEAR_FAILED, error);
      throw new Error(SESSION_CONFIG.ERRORS.CLEAR_FAILED);
    }
  }

  static setInterviewActive(isActive: boolean): void {
    try {
      if (isActive) {
        localStorage.setItem(this.INTERVIEW_ACTIVE_KEY, 'true');
      } else {
        localStorage.removeItem(this.INTERVIEW_ACTIVE_KEY);
      }
    } catch (error) {
      console.error('Failed to set interview active state:', error);
      throw new Error('Failed to set interview active state');
    }
  }

  static isInterviewActive(): boolean {
    try {
      return localStorage.getItem(this.INTERVIEW_ACTIVE_KEY) === 'true';
    } catch (error) {
      console.error('Failed to check interview active state:', error);
      return false;
    }
  }
}
