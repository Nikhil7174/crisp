// src/types/index.ts
export type UserType = 'interviewee' | 'interviewer';

export interface User {
  id: number;
  email: string;
  fullName: string;
  userType: 'candidate' | 'interviewer';
  phone?: string;
  company?: string;
  jobRole?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface InterviewLink {
  id: number;
  token: string;
  title: string;
  description?: string;
  expiryDate?: string;
  maxAttempts: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalAttempts?: number;
  completedInterviews?: number;
  questionsApproved?: boolean;
  url: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// Interview-related types removed - functionality moved to desktop app
