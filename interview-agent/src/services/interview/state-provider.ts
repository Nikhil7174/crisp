import { EventEmitter } from 'events';

export interface InterviewState {
  interviewId: string;
  sessionId?: string;
  candidateId: string;

  // Question tracking
  currentQuestionIndex: number;
  currentQuestionId: string | null;
  totalQuestions: number;
  questionsAsked: number;

  // Follow-up tracking (max 2 follow-ups per original question)
  followUpTracker: Map<string, { followUpDepth: number; maxDepth: number }>;
  currentQuestionIsFollowUp: boolean;
  parentQuestionId: string | null;

  // Coding problem tracking
  currentProblemId: string | null;
  currentProblemIndex: number;
  totalProblems: number;

  // Hints and clarifications tracking (max 2 per question, similar to follow-ups)
  hintTracker: Map<string, { hintDepth: number; maxDepth: number }>;
  clarificationTracker: Map<string, { clarificationDepth: number; maxDepth: number }>;
  genericTracker: Map<string, { genericDepth: number; maxDepth: number }>;

  // Legacy: Global counters (kept for backward compatibility)
  hintsProvided: number;
  clarificationsGiven: number;
  followUpsGiven: number;

  // Progress tracking
  evaluations: Array<{
    questionId: string;
    score: number;
    feedback: string;
    timestamp: Date;
  }>;

  // Code analysis
  codeAnalysisResults: Array<{
    problemId: string;
    progress: number;
    approach: string;
    issues: string[];
    timestamp: Date;
  }>;

  // Interview flow
  currentState: 'idle' | 'intro' | 'theoretical' | 'coding' | 'coding_intro' | 'coding_problem' | 'wrap_up' | 'completed';
  codingSubState: 'approach' | 'complexity' | 'coding' | 'optimization' | null;
  startTime: Date;
  endTime?: Date;

  // Conversation history
  conversationHistory: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    metadata?: any;
  }>;

  // Code snapshot
  currentCode: string | null;

  // Agent status
  agentSpeaking: boolean;
  userSpeaking: boolean;

  // Configuration
  maxTheoreticalQuestions: number;
  maxCodingProblems: number;
}

export class StateProvider extends EventEmitter {
  private states: Map<string, InterviewState> = new Map();
  private persistenceIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Initialize state for a new interview
   */
  initializeState(config: {
    interviewId: string;
    sessionId?: string;
    candidateId: string;
    totalQuestions: number;
    totalProblems: number;
    maxTheoreticalQuestions?: number;
    maxCodingProblems?: number;
  }): InterviewState {
    const state: InterviewState = {
      interviewId: config.interviewId,
      sessionId: config.sessionId,
      candidateId: config.candidateId,

      currentQuestionIndex: 0,
      currentQuestionId: null,
      totalQuestions: config.totalQuestions,
      questionsAsked: 0,

      followUpTracker: new Map(), // Tracks follow-up depth per question (max 2)
      currentQuestionIsFollowUp: false,
      parentQuestionId: null,

      currentProblemId: null,
      currentProblemIndex: 0,
      totalProblems: config.totalProblems,

      hintTracker: new Map(), // Tracks hint depth per question (max 2)
      clarificationTracker: new Map(), // Tracks clarification depth per question (max 2)
      genericTracker: new Map(), // Tracks generic/off-topic depth per question (max 2)

      hintsProvided: 0, // Legacy: Global counter
      clarificationsGiven: 0, // Legacy: Global counter
      followUpsGiven: 0, // Global counter for follow-up questions

      evaluations: [],
      codeAnalysisResults: [],

      currentState: 'idle',
      codingSubState: null,
      startTime: new Date(),

      conversationHistory: [],

      currentCode: null,

      agentSpeaking: false,
      userSpeaking: false,

      maxTheoreticalQuestions: config.maxTheoreticalQuestions || config.totalQuestions,
      maxCodingProblems: config.maxCodingProblems || config.totalProblems,
    };

    this.states.set(config.interviewId, state);
    this.emit('stateInitialized', { interviewId: config.interviewId, state });

    // Start periodic state persistence (every 30 seconds)
    this.startStatePersistence(config.interviewId);

    console.log(`[StateProvider] Initialized state for interview ${config.interviewId}`);

    return state;
  }

  /**
   * Start periodic state persistence to database
   */
  private startStatePersistence(interviewId: string): void {
    // Clear existing interval if any
    const existingInterval = this.persistenceIntervals.get(interviewId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Persist state every 30 seconds
    const interval = setInterval(() => {
      this.persistState(interviewId);
    }, 30000);

    this.persistenceIntervals.set(interviewId, interval);

    console.log(`[StateProvider] Started state persistence for interview ${interviewId}`);
  }

  /**
   * Persist state to database
   */
  private async persistState(interviewId: string): Promise<void> {
    const state = this.states.get(interviewId);
    if (!state) return;

    try {
      // This is a placeholder - actual implementation would save to Prisma DB
      console.log(`[StateProvider] Persisting state for interview ${interviewId}`);

      // Example: await prisma.interviewState.upsert({
      //   where: { interviewId },
      //   update: { state: JSON.stringify(state) },
      //   create: { interviewId, state: JSON.stringify(state) }
      // });

      this.emit('statePersisted', { interviewId, timestamp: new Date() });
    } catch (error) {
      console.error(`[StateProvider] Failed to persist state for interview ${interviewId}:`, error);
      this.emit('persistenceError', { interviewId, error });
    }
  }

  /**
   * Force immediate state persistence
   */
  async forceStatePersistence(interviewId: string): Promise<void> {
    await this.persistState(interviewId);
  }

  /**
   * Get state for an interview
   */
  getState(interviewId: string): InterviewState | null {
    return this.states.get(interviewId) || null;
  }

  /**
   * Update state
   */
  updateState(interviewId: string, updates: Partial<InterviewState>): InterviewState | null {
    const state = this.states.get(interviewId);
    if (!state) {
      console.warn(`[StateProvider] Cannot update: state not found for interview ${interviewId}`);
      return null;
    }

    Object.assign(state, updates);
    this.emit('stateUpdated', { interviewId, state, updates });

    return state;
  }

  /**
   * Add evaluation
   */
  addEvaluation(interviewId: string, evaluation: {
    questionId: string;
    score: number;
    feedback: string;
  }): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.evaluations.push({
      ...evaluation,
      timestamp: new Date(),
    });

    this.emit('evaluationAdded', { interviewId, evaluation });
  }

  /**
   * Add code analysis result
   */
  addCodeAnalysis(interviewId: string, analysis: {
    problemId: string;
    progress: number;
    approach: string;
    issues: string[];
  }): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.codeAnalysisResults.push({
      ...analysis,
      timestamp: new Date(),
    });

    this.emit('codeAnalysisAdded', { interviewId, analysis });
  }

  /**
   * Add conversation message
   */
  addConversationMessage(interviewId: string, message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: any;
  }): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.conversationHistory.push({
      ...message,
      timestamp: new Date(),
    });

    this.emit('conversationMessageAdded', { interviewId, message });
  }

  /**
   * Increment hints provided
   */
  incrementHints(interviewId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    state.hintsProvided++;
    this.emit('hintProvided', { interviewId, totalHints: state.hintsProvided });

    return state.hintsProvided;
  }

  /**
   * Increment clarifications given
   */
  incrementClarifications(interviewId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    state.clarificationsGiven++;
    this.emit('clarificationGiven', { interviewId, totalClarifications: state.clarificationsGiven });

    return state.clarificationsGiven;
  }

  /**
   * Increment follow-ups given
   */
  incrementFollowUps(interviewId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    state.followUpsGiven++;
    this.emit('followUpGiven', { interviewId, totalFollowUps: state.followUpsGiven });

    return state.followUpsGiven;
  }

  /**
   * Move to next question
   */
  moveToNextQuestion(interviewId: string, questionId: string): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.currentQuestionIndex++;
    state.currentQuestionId = questionId;
    state.questionsAsked++;
    state.currentQuestionIsFollowUp = false;
    state.parentQuestionId = null;

    this.emit('questionChanged', { interviewId, questionId, index: state.currentQuestionIndex });
  }

  /**
   * Ask follow-up question (max 2 follow-ups per original question)
   */
  askFollowUp(interviewId: string, followUpQuestion: string, parentQuestionId: string): boolean {
    const state = this.states.get(interviewId);
    if (!state) return false;

    const MAX_FOLLOW_UP_DEPTH = 2;

    // Get or create tracker for parent question
    const tracker = state.followUpTracker.get(parentQuestionId) || { followUpDepth: 0, maxDepth: MAX_FOLLOW_UP_DEPTH };

    // Check if we've reached max depth
    if (tracker.followUpDepth >= MAX_FOLLOW_UP_DEPTH) {
      console.log(`[StateProvider] Max follow-up depth (${MAX_FOLLOW_UP_DEPTH}) reached for question ${parentQuestionId}`);
      return false;
    }

    // Increment follow-up depth
    tracker.followUpDepth++;
    state.followUpTracker.set(parentQuestionId, tracker);

    state.currentQuestionIsFollowUp = true;
    state.parentQuestionId = parentQuestionId;

    console.log(`[StateProvider] Follow-up asked for question ${parentQuestionId} (depth: ${tracker.followUpDepth}/${MAX_FOLLOW_UP_DEPTH})`);
    this.emit('followUpAsked', { interviewId, followUpQuestion, parentQuestionId, depth: tracker.followUpDepth });
    return true;
  }

  /**
   * Check if follow-up can be asked for a question (max depth 2)
   */
  canAskFollowUp(interviewId: string, questionId: string): boolean {
    const state = this.states.get(interviewId);
    if (!state) return false;

    const MAX_FOLLOW_UP_DEPTH = 2;

    // Cannot ask follow-up if current question is already a follow-up
    if (state.currentQuestionIsFollowUp) {
      return false;
    }

    // Check if this question has reached max follow-up depth
    const tracker = state.followUpTracker.get(questionId);
    if (tracker) {
      return tracker.followUpDepth < MAX_FOLLOW_UP_DEPTH;
    }

    // No follow-ups asked yet, can ask
    return true;
  }

  /**
   * Get current follow-up depth for a question
   */
  getFollowUpDepth(interviewId: string, questionId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    const tracker = state.followUpTracker.get(questionId);
    return tracker?.followUpDepth || 0;
  }

  /**
   * Get current hint depth for a question
   */
  getHintDepth(interviewId: string, questionId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    const tracker = state.hintTracker.get(questionId);
    return tracker?.hintDepth || 0;
  }

  /**
   * Get current clarification depth for a question
   */
  getClarificationDepth(interviewId: string, questionId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    const tracker = state.clarificationTracker.get(questionId);
    return tracker?.clarificationDepth || 0;
  }

  /**
   * Get current generic depth for a question
   */
  getGenericDepth(interviewId: string, questionId: string): number {
    const state = this.states.get(interviewId);
    if (!state) return 0;

    const tracker = state.genericTracker.get(questionId);
    return tracker?.genericDepth || 0;
  }

  /**
   * Get the current tracking ID based on interview phase.
   * Returns currentProblemId during coding phase, currentQuestionId otherwise.
   * This prevents stale state issues when transitioning between phases.
   */
  getCurrentTrackingId(interviewId: string): string | null {
    const state = this.states.get(interviewId);
    if (!state) return null;

    // In coding phase, use problem ID; otherwise use question ID
    if (state.currentState === 'coding' || state.currentState === 'coding_problem' || state.currentState === 'coding_intro') {
      return state.currentProblemId;
    }
    return state.currentQuestionId;
  }

  /**
   * Move to next problem
   */
  moveToNextProblem(interviewId: string, problemId: string): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.currentProblemIndex++;
    state.currentProblemId = problemId;
    // Clear theoretical question tracking to prevent stale state
    state.currentQuestionId = null;

    this.emit('problemChanged', { interviewId, problemId, index: state.currentProblemIndex });
  }

  /**
   * Set interview flow state
   */
  setFlowState(interviewId: string, flowState: InterviewState['currentState']): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    const previousState = state.currentState;
    state.currentState = flowState;

    this.emit('flowStateChanged', { interviewId, from: previousState, to: flowState });
  }

  /**
   * Set coding sub-state
   */
  setCodingSubState(interviewId: string, subState: InterviewState['codingSubState']): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.codingSubState = subState;
    this.emit('codingSubStateChanged', { interviewId, subState });
  }

  /**
   * Set agent speaking status
   */
  setAgentSpeaking(interviewId: string, speaking: boolean): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.agentSpeaking = speaking;
    this.emit('agentSpeakingChanged', { interviewId, speaking });
  }

  /**
   * Set user speaking status
   */
  setUserSpeaking(interviewId: string, speaking: boolean): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.userSpeaking = speaking;
    this.emit('userSpeakingChanged', { interviewId, speaking });
  }

  /**
   * Complete interview
   */
  completeInterview(interviewId: string): void {
    const state = this.states.get(interviewId);
    if (!state) return;

    state.currentState = 'completed';
    state.endTime = new Date();

    this.emit('interviewCompleted', { interviewId, state });
  }

  /**
   * Get context for tools (subset of state)
   */
  getToolContext(interviewId: string): any {
    const state = this.states.get(interviewId);
    if (!state) return null;

    return {
      interviewId: state.interviewId,
      currentQuestionIndex: state.currentQuestionIndex,
      currentQuestionId: state.currentQuestionId,
      currentProblemId: state.currentProblemId,
      hintsProvided: state.hintsProvided,
      clarificationsGiven: state.clarificationsGiven,
      questionsAsked: state.questionsAsked,
      totalQuestions: state.totalQuestions,
      currentState: state.currentState,
      conversationHistory: state.conversationHistory.slice(-10), // Last 10 messages
      recentEvaluations: state.evaluations.slice(-3), // Last 3 evaluations
    };
  }

  /**
   * Remove state (cleanup)
   */
  removeState(interviewId: string): void {
    const state = this.states.get(interviewId);
    if (state) {
      // Stop persistence interval
      const interval = this.persistenceIntervals.get(interviewId);
      if (interval) {
        clearInterval(interval);
        this.persistenceIntervals.delete(interviewId);
      }

      // Final persistence before removal
      this.persistState(interviewId);

      this.states.delete(interviewId);
      this.emit('stateRemoved', { interviewId });
      console.log(`[StateProvider] Removed state for interview ${interviewId}`);
    }
  }

  /**
   * Get all active interview IDs
   */
  getActiveInterviews(): string[] {
    return Array.from(this.states.keys());
  }

  /**
   * Get state count
   */
  getStateCount(): number {
    return this.states.size;
  }

  /**
   * Update the candidate's current code
   */
  updateCode(interviewId: string, code: string): void {
    const state = this.states.get(interviewId);
    if (!state) {
      console.warn(`[StateProvider] Cannot update code: state not found for interview ${interviewId}`);
      return;
    }

    state.currentCode = code;
    this.emit('codeUpdated', { interviewId, length: code.length, timestamp: new Date() });

    // Also emit a state updated event for general listeners
    this.emit('stateUpdated', {
      interviewId,
      state,
      updates: { currentCode: code }
    });

    console.log(`[StateProvider] Code updated for interview ${interviewId}: ${code.length} chars`);
  }
}

// Singleton instance
let stateProviderInstance: StateProvider | null = null;

export function getStateProvider(): StateProvider {
  if (!stateProviderInstance) {
    stateProviderInstance = new StateProvider();
    console.log('[StateProvider] Singleton instance created');
  }
  return stateProviderInstance;
}

