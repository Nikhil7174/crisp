// src/types/index.ts
export type UserType = 'interviewee' | 'interviewer';

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
  // Resume data
  resumeData: ResumeData | null;
  detailedResumeData: DetailedResumeData | null;

  // Loading states
  uploading: boolean;
  loading: boolean;
  startingInterview: boolean;
  submittingAnswer: boolean;

  // Interview session
  currentSession: InterviewSession | null;
  chatMessages: ChatMessage[];

  // Error handling
  error: string | null;
}

export interface StoredSession {
  resumeData?: ResumeData;
  detailedResumeData?: DetailedResumeData;
  currentSession?: InterviewSession;
  chatMessages?: ChatMessage[];
  timestamp: number;
  lastActivity?: number;
}

export interface SessionSummary {
  timeAway: number; // minutes
  questionsAnswered: number;
  totalQuestions: number;
  sessionDuration: number; // minutes
  startTime: number;
}

export interface InterviewSession {
  id?: string; // Optional for backward compatibility
  sessionId: string; // Added to match server response
  candidateId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  questions: Question[];
  answers: Answer[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  score?: number;
  summary?: string;
  // Additional fields from server response
  success?: boolean;
  message?: string;
  timestamp?: number;
  lastActivity?: number;
  chatMessages?: ChatMessage[];
}

// Add new interfaces for multiple choice
export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface Question {
  id: string;
  question: string;
  type: 'behavioral' | 'technical' | 'situational' | 'coding';
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; // seconds
  askedAt?: Date;
  // Multiple choice fields (for MCQ questions)
  options?: MultipleChoiceOption[];
  correctAnswerId?: string;
  // Coding fields (for coding questions)
  language?: 'javascript' | 'typescript' | 'python' | 'java' | 'cpp';
  initialCode?: string;
  expectedOutput?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
  instructions?: string;
}

export interface Answer {
  questionId: string;
  answer: string; // For MCQ: selected option text, For coding: code description
  selectedOptionId?: string; // For MCQ questions
  code?: string; // For coding questions
  answeredAt: Date;
  timeTaken: number; // seconds
  score?: number;
  feedback?: string;
  isCorrect?: boolean;
  testResults?: Array<{
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
  }>;
}

export interface Evaluation {
  score: number;
  feedback: string;
}

export interface AnswerResult {
  success: boolean;
  isCorrect?: boolean;
  correctAnswerId?: string;
  evaluation?: Evaluation;
  isComplete: boolean;
  nextQuestion?: Question;
  message: string;
}

export interface FinalResults {
  sessionId: string;
  finalScore: number;
  summary: string;
  answers: Array<{
    question: string;
    answer: string;
    score: number;
    timeTaken: number;
  }>;
  duration: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string | Date; // Support both ISO string and Date object
  metadata?: any;
}
