import { StateProvider } from '../state-provider.js';
import { Orchestrator } from '../orchestrator.js';
import { createLLMService } from '../../llm-service.js';
import {
  ToolName,
  ToolResult,
  ProvideHintParams,
  ProvideClarificationParams,
  EvaluateAnswerParams,
  SkipQuestionParams,
  AnalyzeCodeParams,
  SubmitSolutionParams,
} from './tool-definitions.js';

/**
 * Retry helper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[ToolExecutor] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Ask next question (orchestrator provides the fixed question)
 */
async function askNextQuestion(
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    console.error(`❌ [askNextQuestion] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  console.log(`\n📝 [askNextQuestion] Executing tool`);
  console.log(`   🆔 Interview ID: ${interviewId}`);
  console.log(`   📊 Current State: ${state.currentState}`);
  console.log(`   📍 Current Question Index: ${state.currentQuestionIndex}`);
  console.log(`   📋 Total Questions: ${state.totalQuestions}`);

  // Get next question from orchestrator (uses stored questions)
  const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();

  if (shouldMoveToCoding) {
    return {
      success: true,
      message: "Great job on the theoretical questions! Now let's move to the coding section.",
      shouldSpeak: true,
      data: { phase: 'coding' },
    };
  }

  if (!question) {
    return {
      success: false,
      message: 'No more questions available',
      shouldSpeak: true,
    };
  }

  // Question is already added to conversation history by orchestrator
  // Just return it for TTS to speak
  return {
    success: true,
    message: question.question,
    shouldSpeak: true,
    data: { question },
  };
}

/**
 * Provide hint for current question/problem
 */
async function provideHint(
  params: ProvideHintParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    console.error(`❌ [provideHint] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  // Increment hint counter
  const hintsProvided = stateProvider.incrementHints(interviewId);

  console.log(`\n💡 [provideHint] Executing tool`);
  console.log(`   🆔 Interview ID: ${interviewId}`);
  console.log(`   🎯 Current Question ID: ${state.currentQuestionId || 'N/A'}`);
  console.log(`   📊 Current State: ${state.currentState}`);
  console.log(`   🔢 Hint #${hintsProvided}`);
  console.log(`   📝 Context: ${params.context || 'none provided'}`);

  let hintMessage = '';

  if (state.currentState === 'theoretical' && state.currentQuestionId) {
    // Generate hint for theoretical question
    hintMessage = await generateTheoreticalHint(state.currentQuestionId, hintsProvided, params.context);
  } else if (state.currentState === 'coding' && state.currentProblemId) {
    // Generate hint for coding problem
    hintMessage = await generateCodingHint(state.currentProblemId, hintsProvided, params.context);
  } else {
    hintMessage = 'I can provide hints once we start a question or problem.';
  }

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: hintMessage,
    metadata: { type: 'hint', hintNumber: hintsProvided },
  });

  return {
    success: true,
    message: hintMessage,
    shouldSpeak: true,
    data: { hintsProvided },
  };
}

async function provideClarification(
  params: ProvideClarificationParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    console.error(`❌ [provideClarification] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  // Increment clarification counter
  const clarificationsGiven = stateProvider.incrementClarifications(interviewId);

  console.log(`\n❓ [provideClarification] Executing tool`);
  console.log(`   🆔 Interview ID: ${interviewId}`);
  console.log(`   🎯 Current Question ID: ${state.currentQuestionId || 'N/A'}`);
  console.log(`   📊 Current State: ${state.currentState}`);
  console.log(`   🔢 Clarification #${clarificationsGiven}`);
  console.log(`   📝 Request: "${params.clarification_request}"`);

  let clarificationMessage = '';

  if (state.currentState === 'theoretical' && state.currentQuestionId) {
    clarificationMessage = await generateTheoreticalClarification(
      state.currentQuestionId,
      params.clarification_request
    );
  } else if (state.currentState === 'coding' && state.currentProblemId) {
    clarificationMessage = await generateCodingClarification(
      state.currentProblemId,
      params.clarification_request
    );
  } else {
    clarificationMessage = 'Let me know what you need clarification on once we start a question.';
  }

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: clarificationMessage,
    metadata: { type: 'clarification', clarificationNumber: clarificationsGiven },
  });

  return {
    success: true,
    message: clarificationMessage,
    shouldSpeak: true,
    data: { clarificationsGiven },
  };
}

/**
 * Evaluate candidate's answer to theoretical question
 * Enforces follow-up rules: max 1 per original question, no nested follow-ups
 */
async function evaluateAnswer(
  params: EvaluateAnswerParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator,
  llmService: any
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    console.error(`❌ [evaluateAnswer] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  if (!state.currentQuestionId) {
    console.warn(`⚠️ [evaluateAnswer] No active question to evaluate for ${interviewId}`);
    return {
      success: false,
      message: 'No active question to evaluate',
      shouldSpeak: true,
    };
  }

  console.log(`\n✅ [evaluateAnswer] Executing tool`);
  console.log(`   🆔 Interview ID: ${interviewId}`);
  console.log(`   🎯 Question ID: ${state.currentQuestionId}`);
  console.log(`   📝 Answer length: ${params.answer.length} characters`);
  console.log(`   📄 Answer preview: "${params.answer.substring(0, 100)}${params.answer.length > 100 ? '...' : ''}"`);

  // Get the full question object from orchestrator
  const question = orchestrator.getCurrentQuestion();
  if (!question) {
    console.error(`❌ [evaluateAnswer] Question not found for ID: ${state.currentQuestionId}`);
    return {
      success: false,
      message: 'Question not found',
      shouldSpeak: true,
    };
  }

  // Ensure question has required fields for evaluation
  const questionForEvaluation = {
    id: question.id,
    question: question.question,
    expectedAnswer: (question as any).expectedAnswer || question.question, // Fallback to question text if not available
    keyPoints: (question as any).keyPoints || [], // Default to empty array if not available
  };

  // Call LLM service to evaluate answer with retry
  const evaluation = await retryWithBackoff(async () => {
    return await llmService.evaluateAnswer(
      questionForEvaluation,
      params.answer,
      0,
      state.maxTheoreticalQuestions
    );
  }).catch(error => {
    console.error('[ToolExecutor] All retry attempts failed for evaluation:', error);
    return {
      questionId: state.currentQuestionId!,
      candidateAnswer: params.answer,
      score: 50,
      keyPointsCovered: [],
      needsFollowUp: false,
      feedback: "I'm having trouble processing your answer right now. Let's move on to the next question.",
    };
  });

  // Add evaluation to state
  stateProvider.addEvaluation(interviewId, {
    questionId: state.currentQuestionId!,
    score: evaluation.score,
    feedback: evaluation.feedback,
  });

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: evaluation.feedback,
    metadata: { 
      type: 'evaluation',
      score: evaluation.score,
      needsFollowUp: evaluation.needsFollowUp,
    },
  });

  let responseMessage = evaluation.feedback;

  // Check if follow-up is allowed
  const canAskFollowUp = stateProvider.canAskFollowUp(interviewId, state.currentQuestionId!);
  
  if (evaluation.needsFollowUp && 'followUpQuestion' in evaluation && evaluation.followUpQuestion && canAskFollowUp) {
    // Ask follow-up
    const followUpAsked = stateProvider.askFollowUp(
      interviewId,
      evaluation.followUpQuestion,
      state.currentQuestionId!
    );

    if (followUpAsked) {
      responseMessage += ` ${evaluation.followUpQuestion}`;
      
      stateProvider.addConversationMessage(interviewId, {
        role: 'assistant',
        content: evaluation.followUpQuestion,
        metadata: { 
          type: 'follow_up_question',
          parentQuestionId: state.currentQuestionId,
        },
      });
      
      console.log(`[ToolExecutor] Follow-up asked for question ${state.currentQuestionId}`);
    } else {
      console.log(`[ToolExecutor] Follow-up blocked - already asked for question ${state.currentQuestionId}`);
      responseMessage += " Let's move to the next question.";
    }
  } else {
    if (evaluation.needsFollowUp && !canAskFollowUp) {
      console.log(`[ToolExecutor] Follow-up blocked - ${state.currentQuestionIsFollowUp ? 'current is follow-up' : 'already asked'}`);
    }
    // Don't add "Let's move to the next question" - Node will handle this
    // responseMessage += " Let's move to the next question.";
  }

  // NODE-DRIVEN: Signal that Node should move to next question (unless follow-up was asked)
  const shouldMoveNext = !(evaluation.needsFollowUp && canAskFollowUp && 'followUpQuestion' in evaluation && evaluation.followUpQuestion);

  return {
    success: true,
    message: responseMessage,
    shouldSpeak: true,
    data: { 
      evaluation,
      shouldAskNextQuestion: shouldMoveNext, // Node will use this to inject next question
    },
  };
}

/**
 * Skip current question
 */
async function skipQuestion(
  params: SkipQuestionParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    console.error(`❌ [skipQuestion] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  console.log(`\n⏭️ [skipQuestion] Executing tool`);
  console.log(`   🆔 Interview ID: ${interviewId}`);
  console.log(`   🎯 Current Question ID: ${state.currentQuestionId || 'N/A'}`);
  console.log(`   📍 Current Question Index: ${state.currentQuestionIndex}`);
  console.log(`   📝 Reason: ${params.reason || 'not specified'}`);

  const skipMessage = 'No problem, let\'s move on to the next question.';

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: skipMessage,
    metadata: { type: 'skip', reason: params.reason },
  });

  // Signal that we should ask the next question
  return {
    success: true,
    message: skipMessage,
    shouldSpeak: true,
    data: { shouldAskNextQuestion: true },
  };
}

/**
 * Analyze candidate's code
 */
async function analyzeCode(
  params: AnalyzeCodeParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  if (!state.currentProblemId) {
    return {
      success: false,
      message: 'No active coding problem to analyze',
      shouldSpeak: true,
    };
  }

  console.log(`[ToolExecutor] Analyzing code for problem ${state.currentProblemId}`);

  // Simple code analysis (can be enhanced with actual analysis service)
  const analysis = await analyzeCodeSimple(params.code, state.currentProblemId, params.question);

  // Add analysis to state
  stateProvider.addCodeAnalysis(interviewId, {
    problemId: state.currentProblemId,
    progress: analysis.progress,
    approach: analysis.approach,
    issues: analysis.issues,
  });

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: analysis.feedback,
    metadata: { type: 'code_analysis', progress: analysis.progress },
  });

  return {
    success: true,
    message: analysis.feedback,
    shouldSpeak: true,
    data: { analysis },
  };
}

/**
 * Submit and evaluate final solution
 */
async function submitSolution(
  params: SubmitSolutionParams, 
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);
  
  if (!state) {
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  if (!state.currentProblemId) {
    return {
      success: false,
      message: 'No active coding problem to submit',
      shouldSpeak: true,
    };
  }

  console.log(`[ToolExecutor] Submitting solution for problem ${state.currentProblemId}`);

  // Evaluate the solution
  const evaluation = await evaluateSolution(params.code, state.currentProblemId, params.explanation);

  // Add to conversation history
  stateProvider.addConversationMessage(interviewId, {
    role: 'assistant',
    content: evaluation.feedback,
    metadata: { 
      type: 'solution_evaluation',
      score: evaluation.score,
    },
  });

  let responseMessage = evaluation.feedback;
  responseMessage += ' Great work! Let\'s move on to the next problem.';

  // Move to next problem after 5 seconds
  setTimeout(() => {
    console.log(`[ToolExecutor] Moving to next problem for interview ${interviewId}`);
  }, 5000);

  return {
    success: true,
    message: responseMessage,
    shouldSpeak: true,
    data: { evaluation },
  };
}

// Helper functions for generating hints and clarifications

async function generateTheoreticalHint(questionId: string, hintNumber: number, context?: string): Promise<string> {
  // Simplified hint generation - can be enhanced with LLM
  return `Here's hint #${hintNumber}: Think about the fundamental concepts related to this question. ${context ? `Specifically regarding ${context}.` : ''}`;
}

async function generateCodingHint(problemId: string, hintNumber: number, context?: string): Promise<string> {
  // Simplified hint generation - can be enhanced with LLM
  return `Here's hint #${hintNumber}: Consider the time and space complexity of your approach. ${context ? `Particularly for ${context}.` : ''}`;
}

async function generateTheoreticalClarification(questionId: string, request: string): Promise<string> {
  // Simplified clarification - can be enhanced with LLM
  return `Let me clarify: ${request}. The question is asking about the core concepts and how they apply in practice.`;
}

async function generateCodingClarification(problemId: string, request: string): Promise<string> {
  // Simplified clarification - can be enhanced with LLM
  return `To clarify ${request}: Focus on the problem constraints and expected output format.`;
}

async function analyzeCodeSimple(code: string, problemId: string, question?: string): Promise<any> {
  // Simplified code analysis - should be replaced with actual analysis service
  const codeLength = code.length;
  const progress = Math.min(100, (codeLength / 500) * 100);
  
  return {
    progress,
    approach: 'iterative',
    issues: codeLength < 50 ? ['Code seems incomplete'] : [],
    feedback: question 
      ? `Regarding your question about ${question}: Your approach looks reasonable. Keep working on it!`
      : `Your code is about ${progress.toFixed(0)}% complete. Keep going!`,
  };
}

async function evaluateSolution(code: string, problemId: string, explanation?: string): Promise<any> {
  // Simplified solution evaluation - should be replaced with actual test execution
  const hasCode = code.length > 100;
  const score = hasCode ? 85 : 50;
  
  return {
    score,
    feedback: hasCode 
      ? `Excellent work! Your solution demonstrates good understanding. Score: ${score}/100.`
      : `Your solution needs more work. Score: ${score}/100. Try to complete the implementation.`,
    testsPassed: hasCode ? 8 : 3,
    totalTests: 10,
  };
}

/**
 * Create tool executors with access to orchestrator and state provider
 * This factory function is used by the LiveKit agent to create tool handlers
 * Note: Questions are stored in the orchestrator, so we don't need them here
 */
export function createToolExecutors(
  orchestrator: Orchestrator,
  stateProvider: StateProvider
): Record<string, (params: any) => Promise<any>> {
  const llmService = createLLMService({
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2000,
  });

  return {
    [ToolName.ASK_NEXT_QUESTION]: async () => {
      const interviewId = orchestrator.getInterviewId();
      return await askNextQuestion(interviewId, stateProvider, orchestrator);
    },
    
    [ToolName.PROVIDE_HINT]: async (params: ProvideHintParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await provideHint(params, interviewId, stateProvider, orchestrator);
    },
    
    [ToolName.PROVIDE_CLARIFICATION]: async (params: ProvideClarificationParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await provideClarification(params, interviewId, stateProvider, orchestrator);
    },
    
    [ToolName.EVALUATE_ANSWER]: async (params: EvaluateAnswerParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await evaluateAnswer(params, interviewId, stateProvider, orchestrator, llmService);
    },
    
    [ToolName.SKIP_QUESTION]: async (params: SkipQuestionParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await skipQuestion(params, interviewId, stateProvider, orchestrator);
    },
    
    [ToolName.ANALYZE_CODE]: async (params: AnalyzeCodeParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await analyzeCode(params, interviewId, stateProvider, orchestrator);
    },
    
    [ToolName.SUBMIT_SOLUTION]: async (params: SubmitSolutionParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await submitSolution(params, interviewId, stateProvider, orchestrator);
    },
  };
}
