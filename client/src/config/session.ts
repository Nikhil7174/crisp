// src/config/session.ts
export const SESSION_CONFIG = {
  // Storage keys
  STORAGE_KEY: 'interview-session',
  INTERVIEW_ACTIVE_KEY: 'interview-active',
  
  // Timing constants
  SESSION_EXPIRY: 60 * 60 * 1000, // 1 hour in milliseconds
  CACHE_DURATION: 1000, // 1 second cache
  NEW_SESSION_THRESHOLD: 5000, // 5 seconds to distinguish new vs interrupted sessions
  
  // Interview settings
  DEFAULT_QUESTION_COUNT: 6,
  MIN_ANSWERS_FOR_INTERRUPTED: 1, // At least 1 answered question indicates interruption
  
  // Error messages
  ERRORS: {
    SAVE_FAILED: 'Failed to save session data',
    LOAD_FAILED: 'Failed to load session data',
    CLEAR_FAILED: 'Failed to clear session data',
    INVALID_SESSION: 'Session data is invalid or corrupted'
  }
} as const;

export type SessionConfig = typeof SESSION_CONFIG;
