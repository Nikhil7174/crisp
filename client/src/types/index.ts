// src/types/index.ts
export type UserType = 'interviewee' | 'interviewer';

export interface UserPreferences {
  jobRole?: string;
  experience?: string;
  industry?: string;
  companySize?: string;
  hiringNeeds?: string[];
}

export interface UIState {
  activeUserType: UserType | null;
  isLoading: boolean;
  selectedColumn: 'left' | 'right' | null;
}

export interface UserState {
  userType: UserType | null;
  preferences: UserPreferences;
  onboardingStep: number;
  isFirstTimeUser: boolean;
}

export interface SessionState {
  visitTimestamp: number;
  userJourney: string[];
  selectedFeatures: string[];
}

export interface RootState {
  ui: UIState;
  user: UserState;
  session: SessionState;
  interview: InterviewState;
}

// New interfaces for interview chat
export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface InterviewSession {
  id: string;
  candidateId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  score?: number;
  feedback?: string;
}

export interface InterviewQuestion {
  id: string;
  question: string;
  type: 'behavioral' | 'technical' | 'situational';
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  askedAt?: Date;
}

export interface InterviewAnswer {
  questionId: string;
  answer: string;
  answeredAt: Date;
  timeTaken: number;
  score?: number;
  feedback?: string;
}

export interface ResumeData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  text: string;
  fileName: string;
}

export interface DetailedResumeData {
  // Personal Information
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  
  // Education
  college?: string | null;
  batch?: string | null;
  branch?: string | null;
  degree?: string | null;
  cgpa?: string | null;
  
  // Experience
  internships?: Array<{
    company: string;
    role: string;
    duration: string;
    description?: string;
  }>;
  
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
    duration?: string;
  }>;
  
  // Skills
  technicalSkills?: string[];
  programmingLanguages?: string[];
  frameworks?: string[];
  tools?: string[];
  
  // Achievements
  awards?: string[];
  certifications?: string[];
  
  // Additional
  summary?: string;
  linkedin?: string | null;
  github?: string | null;
}

export interface InterviewState {
  resumeData: ResumeData | null;
  detailedResumeData: DetailedResumeData | null;
  resumeUploadTimestamp: number | null;
  currentSession: InterviewSession | null;
  sessionHistory: InterviewSession[];
  chatMessages: ChatMessage[];
  isLoading: boolean;
  isUploading: boolean;
  isStartingInterview: boolean;
  isSubmittingAnswer: boolean;
  error: string | null;
  lastDataFetch: number | null;
  cacheExpiry: number;
}
