export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  user_type: 'candidate' | 'interviewer';
  phone?: string;
  company?: string;
  created_at: Date;
  last_login?: Date;
  is_active: boolean;
}

export interface InterviewLink {
  id: number;
  created_by: number;
  link_token: string;
  title: string;
  description?: string;
  expiry_date?: Date;
  max_attempts: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  creator_name?: string;
  creator_email?: string;
  total_attempts?: number;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  resumeText: string;
  createdAt: Date;
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
  summary?: string;
  finalResults?: FinalInterviewResults;
}

export interface FinalInterviewResults {
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  timeSpent: number;
  averageTimePerQuestion: number;
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;
  detailedAnswers: Array<{
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    timeTaken: number;
  }>;
  completedAt: string;
  candidateInfo: {
    name: string;
    email: string;
  };
}

export interface MultipleChoiceOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface InterviewQuestion {
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
  starterCodes?: Record<string, string>; // Multi-language starter codes: { javascript: "...", python: "...", java: "...", cpp: "..." }
  expectedOutput?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
  instructions?: string;
}

export interface InterviewAnswer {
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

export interface ResumeData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  text: string;
  fileName: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: any;
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

// Final Evaluation Types (from crispDesktop app)
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata: {
    type: 'question' | 'answer' | 'hint' | 'clarification' | 'followup' | 'feedback' | 'code_submission' | 'code_analysis';
    questionId?: string;
    evaluation?: {
      score?: number;
      keyPointsCovered?: string[];
      needsFollowUp?: boolean;
    };
    hintLevel?: 1 | 2;
    section?: 'theoretical' | 'coding';
    codingProblemId?: string;
  };
}

export interface Evaluation {
  score: number;
  keyPointsCovered: string[];
  needsFollowUp: boolean;
  feedback?: string;
}

export interface Question {
  id: string;
  question: string;
  type: 'theoretical' | 'coding';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface CodingProblem {
  id: string;
  problem: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
  }>;
}

export interface CodeAnalysis {
  timestamp: number;
  code: string;
  analysis: string;
  score?: number;
  feedback?: string;
}

export interface TheoreticalConversation {
  questionId: string;
  question: string;
  conversation: ConversationMessage[];
  evaluations: Evaluation[];
  totalScore: number;
}

export interface CodingConversation {
  problemId: string;
  problem: CodingProblem;
  conversation: ConversationMessage[];
  finalCode?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  codeAnalysisHistory: CodeAnalysis[];
  submittedAt?: string;
  evaluation?: {
    score: number;
    feedback: string;
    testResults?: Array<{
      passed: boolean;
      input: string;
      expectedOutput: string;
      actualOutput: string;
    }>;
  };
}

export interface FinalEvaluationPayload {
  // Session metadata
  sessionId: string;
  candidateId: string;
  interviewLinkId?: number;
  startTime: string; // ISO string
  endTime: string; // ISO string
  duration: number; // milliseconds

  // Full chronological conversation (all sections)
  fullConversationHistory: ConversationMessage[];

  // Structured breakdowns for easy analysis
  theoreticalSection: {
    questions: Question[];
    conversations: TheoreticalConversation[];
    overallScore: number;
    totalQuestions: number;
  };

  codingSection: {
    problems: CodingProblem[];
    conversations: CodingConversation[];
    overallScore: number;
    totalProblems: number;
  };

  // Summary metrics
  totalScore: number;
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;

  // Additional metadata
  hintRequestCount: number;
  clarificationRequestCount: number;
  followUpCount: number;
  averageTimePerQuestion: number;
  averageTimePerCodingProblem: number;
}
