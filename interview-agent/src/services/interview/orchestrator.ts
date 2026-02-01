import { EventEmitter } from 'events';
import { InterviewState, StateProvider } from './state-provider.js';

export interface Question {
  id: string;
  question: string;
  description?: string;
  difficulty?: string;
  category?: string;
}

export interface CodingProblem {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  examples?: any[];
  constraints?: string[];
  testCases?: any[];
}

export interface InterviewConfig {
  interviewId: string;
  sessionId?: string;
  candidateId: string;
  questions: Question[];
  codingProblems: CodingProblem[];
  maxTheoreticalQuestions?: number;
  serverUrl: string;
}

export interface Evaluation {
  questionId: string;
  candidateAnswer: string;
  score: number;
  keyPointsCovered: string[];
  needsFollowUp: boolean;
  followUpQuestion?: string;
  feedback: string;
}

/**
 * Server-side Interview Orchestrator
 * Manages interview flow and state - communication is handled by LiveKit agent
 */
export class Orchestrator extends EventEmitter {
  private interviewId: string;
  private stateProvider: StateProvider;
  private questions: Question[] = [];
  private codingProblems: CodingProblem[] = [];

  constructor(interviewId: string, stateProvider: StateProvider) {
    super();
    this.interviewId = interviewId;
    this.stateProvider = stateProvider;
    console.log(`[Orchestrator ${this.interviewId}] Created`);
  }

  /**
   * Store questions and coding problems for this interview
   */
  setQuestions(questions: Question[], codingProblems: CodingProblem[]): void {
    this.questions = questions;
    this.codingProblems = codingProblems;
    console.log(`[Orchestrator ${this.interviewId}] Stored ${questions.length} questions and ${codingProblems.length} coding problems`);
  }

  getInterviewId(): string {
    return this.interviewId;
  }

  /**
   * Get question by ID
   */
  getQuestionById(questionId: string): Question | null {
    return this.questions.find(q => q.id === questionId) || null;
  }

  /**
   * Get current question from state
   */
  getCurrentQuestion(): Question | null {
    const state = this.stateProvider.getState(this.interviewId);
    if (!state || !state.currentQuestionId) {
      return null;
    }
    return this.getQuestionById(state.currentQuestionId);
  }

  /**
   * Get coding problem by ID
   */
  getProblemById(problemId: string): CodingProblem | null {
    return this.codingProblems.find(p => p.id === problemId) || null;
  }

  /**
   * Get index of question by ID
   */
  getIndexOfQuestion(questionId: string): number {
    return this.questions.findIndex(q => q.id === questionId);
  }

  /**
   * Get index of problem by ID
   */
  getIndexOfProblem(problemId: string): number {
    return this.codingProblems.findIndex(p => p.id === problemId);
  }

  /**
   * Get current coding problem from state
   */
  getCurrentProblem(): CodingProblem | null {
    const state = this.stateProvider.getState(this.interviewId);
    if (!state || !state.currentProblemId) {
      return null;
    }
    return this.getProblemById(state.currentProblemId);
  }

  /**
   * Initialize interview state
   */
  initializeState(params: {
    candidateId: string;
    totalQuestions: number;
    totalProblems: number;
    maxTheoreticalQuestions?: number;
  }): void {
    this.stateProvider.initializeState({
      interviewId: this.interviewId,
      candidateId: params.candidateId,
      totalQuestions: params.totalQuestions,
      totalProblems: params.totalProblems,
      maxTheoreticalQuestions: params.maxTheoreticalQuestions,
    });
  }

  /**
   * Start the interview (updates state only - LiveKit agent handles speaking)
   */
  startInterview(): void {
    console.log(`[Orchestrator ${this.interviewId}] Starting interview...`);
    this.stateProvider.setFlowState(this.interviewId, 'intro');
    this.emit('interviewStarted', { interviewId: this.interviewId });
  }

  /**
   * Start theoretical questions phase
   */
  startTheoreticalQuestions(): void {
    console.log(`[Orchestrator ${this.interviewId}] Starting theoretical questions`);
    this.stateProvider.setFlowState(this.interviewId, 'theoretical');
  }

  /**
   * Ask next theoretical question (updates state only)
   * Returns the question data for the LiveKit agent to speak
   */
  askNextQuestion(): { question: Question | null; shouldMoveToCoding: boolean } {
    const state = this.stateProvider.getState(this.interviewId);
    if (!state) {
      return { question: null, shouldMoveToCoding: false };
    }

    if (state.currentQuestionIndex >= this.questions.length) {
      // No more questions, move to coding
      return { question: null, shouldMoveToCoding: true };
    }

    const question = this.questions[state.currentQuestionIndex];
    console.log(`[Orchestrator ${this.interviewId}] Moving to question ${state.currentQuestionIndex + 1}: ${question.id}`);

    // Update state
    this.stateProvider.moveToNextQuestion(this.interviewId, question.id);

    // Add to conversation history
    this.stateProvider.addConversationMessage(this.interviewId, {
      role: 'assistant',
      content: question.question,
      metadata: { type: 'question', questionId: question.id },
    });

    return { question, shouldMoveToCoding: false };
  }

  /**
   * Start coding phase
   */
  startCodingPhase(): void {
    console.log(`[Orchestrator ${this.interviewId}] Starting coding phase`);
    this.stateProvider.setFlowState(this.interviewId, 'coding');
  }

  /**
   * Present next coding problem (updates state only)
   * Returns the problem data for the LiveKit agent to speak
   */
  presentNextProblem(): { problem: CodingProblem | null; shouldWrapUp: boolean } {
    const state = this.stateProvider.getState(this.interviewId);
    if (!state) {
      return { problem: null, shouldWrapUp: false };
    }

    if (state.currentProblemIndex >= this.codingProblems.length) {
      // No more problems, wrap up
      return { problem: null, shouldWrapUp: true };
    }

    const problem = this.codingProblems[state.currentProblemIndex];
    console.log(`[Orchestrator ${this.interviewId}] Moving to problem ${state.currentProblemIndex + 1}: ${problem.id}`);

    // Update state
    this.stateProvider.moveToNextProblem(this.interviewId, problem.id);

    // Add to conversation history
    const problemText = `Here's your coding problem: ${problem.title}. ${problem.description}`;
    this.stateProvider.addConversationMessage(this.interviewId, {
      role: 'assistant',
      content: problemText,
      metadata: { type: 'coding_problem', problemId: problem.id },
    });

    return { problem, shouldWrapUp: false };
  }

  /**
   * Wrap up interview (updates state only)
   */
  wrapUpInterview(): void {
    console.log(`[Orchestrator ${this.interviewId}] Wrapping up interview`);
    this.stateProvider.setFlowState(this.interviewId, 'wrap_up');
  }

  /**
   * Complete interview
   */
  completeInterview(): void {
    console.log(`[Orchestrator ${this.interviewId}] Completing interview`);
    this.stateProvider.completeInterview(this.interviewId);
    this.emit('interviewCompleted', { interviewId: this.interviewId });
  }

  /**
   * Handle user speech from agent
   */
  async handleUserSpeech(text: string): Promise<void> {
    console.log(`[Orchestrator ${this.interviewId}] User speech: ${text.substring(0, 50)}...`);

    // Add to conversation history
    this.stateProvider.addConversationMessage(this.interviewId, {
      role: 'user',
      content: text,
      metadata: { timestamp: new Date() },
    });

    const state = this.stateProvider.getState(this.interviewId);
    if (!state) return;

    // Handle based on current flow state
    switch (state.currentState) {
      case 'theoretical':
        await this.handleTheoreticalResponse(text);
        break;
      case 'coding':
        await this.handleCodingResponse(text);
        break;
      default:
        console.log(`[Orchestrator ${this.interviewId}] Ignoring speech in state: ${state.currentState}`);
    }
  }

  /**
   * Handle theoretical question response
   */
  private async handleTheoreticalResponse(text: string): Promise<void> {
    // This will be handled by OpenAI tools
    // The agent will automatically call the appropriate tool (evaluate_answer, provide_hint, etc.)
    console.log(`[Orchestrator ${this.interviewId}] Theoretical response will be handled by OpenAI tools`);
  }

  /**
   * Handle coding response
   */
  private async handleCodingResponse(text: string): Promise<void> {
    // This will be handled by OpenAI tools
    // The agent will automatically call the appropriate tool (analyze_code, submit_solution, etc.)
    console.log(`[Orchestrator ${this.interviewId}] Coding response will be handled by OpenAI tools`);
  }

  /**
   * Get context for LLM instructions based on current state
   */
  getContextForInstructions(): string {
    const state = this.stateProvider.getState(this.interviewId);
    if (!state) {
      return 'You are conducting a technical interview.';
    }

    let instructions = 'You are conducting a technical interview. ';

    if (state.currentState === 'theoretical' && state.currentQuestionId) {
      const question = this.questions.find(q => q.id === state.currentQuestionId);
      if (question) {
        instructions += `Current question: "${question.question}". `;
        instructions += `Listen to the candidate's answer and evaluate it. `;
        instructions += `If they ask for a hint, provide one. If they ask for clarification, clarify the question. `;
      }
    } else if (state.currentState === 'coding' && state.currentProblemId) {
      const problem = this.codingProblems.find(p => p.id === state.currentProblemId);
      if (problem) {
        instructions += `Current coding problem: "${problem.title}". `;
        instructions += `Help the candidate work through the problem. Provide hints if needed. `;
      }
    }

    instructions += `Hints provided so far: ${state.hintsProvided}. `;
    instructions += `Clarifications given: ${state.clarificationsGiven}.`;

    return instructions;
  }

  /**
   * Get current state
   */
  getState(): InterviewState | null {
    return this.stateProvider.getState(this.interviewId);
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    console.log(`[Orchestrator ${this.interviewId}] Cleaning up...`);

    // Remove state
    this.stateProvider.removeState(this.interviewId);

    // Remove all listeners
    this.removeAllListeners();

    console.log(`[Orchestrator ${this.interviewId}] Cleaned up`);
  }
}

// Note: Orchestrator registry removed - orchestrators are now created per-interview
// in the LiveKit agent entry function and don't need global registry
