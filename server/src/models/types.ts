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
