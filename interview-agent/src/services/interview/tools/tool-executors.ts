import { StateProvider } from '../state-provider.js';
import { Orchestrator } from '../orchestrator.js';
import { createLLMService } from '../../llm-service.js';
import { z } from 'zod';
import { JobContext, log } from '@livekit/agents';
import {
  ToolName,
  ToolResult,
  ProvideHintParams,
  ProvideClarificationParams,
  EvaluateAnswerParams,
  SkipQuestionParams,
  AnalyzeCodeParams,
  SubmitSolutionParams,
  UpdateInterviewStateParams,
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
        log().info(`[ToolExecutor] Attempt ${attempt} failed, retrying in ${delay}ms...`);
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
    log().error(`❌ [askNextQuestion] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  log().info(`\n📝 [askNextQuestion] Executing tool`);
  log().info(`   Interview ID: ${interviewId}`);
  log().info(`   📊 Current State: ${state.currentState}`);
  log().info(`   📍 Current Question Index: ${state.currentQuestionIndex}`);
  log().info(`   📋 Total Questions: ${state.totalQuestions}`);

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
    log().error(`❌ [provideHint] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  // Increment hint counter
  const hintsProvided = stateProvider.incrementHints(interviewId);

  log().info(`\n💡 [provideHint] Executing tool`);
  log().info(`   Interview ID: ${interviewId}`);
  log().info(`   Question ID: ${state.currentQuestionId || 'N/A'}`);
  log().info(`   📊 Current State: ${state.currentState}`);
  log().info(`   🔢 Hint #${hintsProvided}`);
  log().info(`   📝 Context: ${params.context || 'none provided'}`);

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
    log().error(`❌ [provideClarification] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  // Increment clarification counter
  const clarificationsGiven = stateProvider.incrementClarifications(interviewId);

  log().info(`\n❓ [provideClarification] Executing tool`);
  log().info(`   Interview ID: ${interviewId}`);
  log().info(`   Question ID: ${state.currentQuestionId || 'N/A'}`);
  log().info(`   📊 Current State: ${state.currentState}`);
  log().info(`   🔢 Clarification #${clarificationsGiven}`);
  log().info(`   📝 Request: "${params.clarification_request}"`);

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
 * Update interview state in orchestrator
 */
async function updateInterviewState(
  params: UpdateInterviewStateParams,
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);

  if (!state) {
    log().error(`❌ [updateInterviewState] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  log().info(`\n📊 [updateInterviewState] Executing tool`);
  log().info(`   Interview ID: ${interviewId}`);
  log().info({ params }, `   Parameters:`);

  // Get current follow-up depth for the question
  const currentQuestionId = state.currentQuestionId;
  let followUpDepth = params.followUpDepth;

  if (currentQuestionId) {
    // Get current depth from state (this is the source of truth)
    const currentDepth = stateProvider.getFollowUpDepth(interviewId, currentQuestionId);

    // If followUpDepth provided in params, it means LLM wants to track a follow-up was asked
    // The LLM should set followUpDepth to (currentDepth + 1) after speaking a follow-up
    if (params.followUpDepth !== undefined && params.followUpDepth > currentDepth) {
      // LLM is tracking that a follow-up was asked - update state
      const newDepth = params.followUpDepth;
      if (newDepth <= 2) {
        // Track the follow-up by calling askFollowUp (this increments depth in state)
        // We need to extract the follow-up question from conversation or use a placeholder
        // Since LLM already spoke it, we just need to track it in state
        const tracker = state.followUpTracker.get(currentQuestionId) || { followUpDepth: 0, maxDepth: 2 };
        if (newDepth > tracker.followUpDepth) {
          // Increment depth to match what LLM specified
          tracker.followUpDepth = newDepth;
          state.followUpTracker.set(currentQuestionId, tracker);
          log().info(`📝 [updateInterviewState] Follow-up tracked - depth updated to ${newDepth}/2`);
        }
        followUpDepth = newDepth;
      } else {
        log().info(`⚠️ [updateInterviewState] Invalid followUpDepth ${newDepth} - max is 2, using current depth ${currentDepth}`);
        followUpDepth = currentDepth;
      }
    } else {
      // Use current depth from state
      followUpDepth = currentDepth;
    }

    // Check if we can ask follow-up (max depth 2)
    const canAskFollowUp = stateProvider.canAskFollowUp(interviewId, currentQuestionId);

    // If LLM wants to ask follow-up but can't, override it
    if (params.needsFollowUp && !canAskFollowUp) {
      log().info(`⚠️ [updateInterviewState] Cannot ask follow-up - max depth (2) reached for question ${currentQuestionId}`);
      params.needsFollowUp = false;
    }

    // If shouldAskNextQuestion is true, we're moving to next question
    if (params.shouldAskNextQuestion) {
      log().info(`✅ [updateInterviewState] Moving to next question`);
    }
  }

  return {
    success: true,
    message: '', // No message to speak, just state update
    shouldSpeak: false,
    data: {
      shouldAskNextQuestion: params.shouldAskNextQuestion,
      followUpsAsked: followUpDepth || 0,
      followUpDepth: followUpDepth || 0,
      needsFollowUp: params.needsFollowUp || false,
      answerNeedsMoreExplanation: params.answerNeedsMoreExplanation || false,
      missedKeyPoints: params.missedKeyPoints || [],
      maxFollowUpDepth: 2,
      canAskFollowUp: currentQuestionId ? stateProvider.canAskFollowUp(interviewId, currentQuestionId) : false,
      // IMPORTANT: Return current depth so LLM knows the state
      currentFollowUpDepth: currentQuestionId ? stateProvider.getFollowUpDepth(interviewId, currentQuestionId) : 0,
    },
  };
}

/**
 * Evaluate candidate's answer to theoretical question
 * LIGHT EVALUATION: Just checks if answer could be more explained or missed key points
 * Uses conversational LLM instead of isolated API call
 */
async function evaluateAnswer(
  params: EvaluateAnswerParams,
  interviewId: string,
  stateProvider: StateProvider,
  orchestrator: Orchestrator,
  llmService: any,
  chatCtx?: any // Conversational LLM context
): Promise<ToolResult> {
  const state = stateProvider.getState(interviewId);

  if (!state) {
    log().error(`❌ [evaluateAnswer] Interview state not found for ${interviewId}`);
    return {
      success: false,
      message: 'Interview state not found',
      shouldSpeak: false,
    };
  }

  if (!state.currentQuestionId) {
    log().warn(`⚠️ [evaluateAnswer] No active question to evaluate for ${interviewId}`);
    return {
      success: false,
      message: 'No active question to evaluate',
      shouldSpeak: true,
    };
  }

  log().info(`\n✅ [evaluateAnswer] Executing LIGHT evaluation tool`);
  log().info(`   Interview ID: ${interviewId}`);
  log().info(`   Question ID: ${state.currentQuestionId}`);
  log().info(`   Answer length: ${params.answer.length} characters`);

  // Get the full question object from orchestrator
  const question = orchestrator.getCurrentQuestion();
  if (!question) {
    log().error(`❌ [evaluateAnswer] Question not found for ID: ${state.currentQuestionId}`);
    return {
      success: false,
      message: 'Question not found',
      shouldSpeak: true,
    };
  }

  // LIGHT EVALUATION: Use conversational LLM to check if answer needs more explanation or missed key points
  // The conversational LLM will evaluate in context and provide feedback
  // We'll use the chat context if available, otherwise fall back to isolated call
  let evaluation: any;

  if (chatCtx && llmService.useLiveKitLLM) {
    // Use conversational LLM for evaluation
    console.log(`💬 [evaluateAnswer] Using conversational LLM for evaluation`);

    const evaluationPrompt = `Evaluate this answer to the current question. This is a LIGHT evaluation - just check:
1. Could the answer be more explained? (answerNeedsMoreExplanation: true/false)
2. Did the answer miss any key points? (missedKeyPoints: array of missed points)
3. Does this need a follow-up question? (needsFollowUp: true/false, only if answer is significantly incomplete)

Current Question: ${question.question}
Key Points: ${((question as any).keyPoints || []).join(', ')}
Candidate's Answer: ${params.answer}

Provide a brief, conversational feedback and indicate if follow-up is needed.`;

    try {
      // Use the conversational LLM context
      const chatCtxCopy = chatCtx; // Use the existing chat context
      chatCtxCopy.addMessage({
        role: 'user',
        content: evaluationPrompt,
      });

      const stream = await llmService.liveKitLLM?.chat({ chatCtx: chatCtxCopy });
      let evaluationText = '';
      if (stream) {
        for await (const chunk of stream) {
          const chunkText = typeof chunk === 'string' ? chunk : chunk.content || '';
          evaluationText += chunkText;
        }
      }

      // Parse the evaluation (simplified - in production, use structured output)
      const needsFollowUp = evaluationText.toLowerCase().includes('follow-up') ||
        evaluationText.toLowerCase().includes('needs more');
      const answerNeedsMoreExplanation = evaluationText.toLowerCase().includes('could be more') ||
        evaluationText.toLowerCase().includes('needs more explanation');

      // Extract missed key points (simplified)
      const missedKeyPoints: string[] = [];
      const keyPoints = (question as any).keyPoints || [];
      for (const point of keyPoints) {
        if (!params.answer.toLowerCase().includes(point.toLowerCase().substring(0, 10))) {
          missedKeyPoints.push(point);
        }
      }

      evaluation = {
        questionId: state.currentQuestionId!,
        candidateAnswer: params.answer,
        score: missedKeyPoints.length === 0 && !answerNeedsMoreExplanation ? 85 : 65,
        keyPointsCovered: keyPoints.filter((p: string) => !missedKeyPoints.includes(p)),
        needsFollowUp: needsFollowUp && missedKeyPoints.length > 0,
        feedback: evaluationText || "Good answer! Let's continue.",
        answerNeedsMoreExplanation,
        missedKeyPoints,
      };
    } catch (error) {
      console.error('[ToolExecutor] Conversational LLM evaluation failed:', error);
      // Fallback to basic evaluation
      evaluation = {
        questionId: state.currentQuestionId!,
        candidateAnswer: params.answer,
        score: 70,
        keyPointsCovered: [],
        needsFollowUp: false,
        feedback: "Thanks for your answer. Let's continue.",
        answerNeedsMoreExplanation: false,
        missedKeyPoints: [],
      };
    }
  } else {
    // Fallback to isolated evaluation (lighter version)
    console.log(`🔍 [evaluateAnswer] Using isolated LLM for evaluation (fallback)`);

    const questionForEvaluation = {
      id: question.id,
      question: question.question,
      expectedAnswer: (question as any).expectedAnswer || question.question,
      keyPoints: (question as any).keyPoints || [],
    };

    const fullEvaluation = await retryWithBackoff(async () => {
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

    // Convert to light evaluation format
    const keyPoints = (question as any).keyPoints || [];
    const missedKeyPoints = keyPoints.filter((p: string) =>
      !fullEvaluation.keyPointsCovered.some((covered: string) =>
        covered.toLowerCase().includes(p.toLowerCase().substring(0, 10))
      )
    );

    evaluation = {
      ...fullEvaluation,
      answerNeedsMoreExplanation: fullEvaluation.score < 70,
      missedKeyPoints,
    };
  }

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

  // Get current follow-up depth
  const currentFollowUpDepth = stateProvider.getFollowUpDepth(interviewId, state.currentQuestionId!);
  const canAskFollowUp = stateProvider.canAskFollowUp(interviewId, state.currentQuestionId!);

  // Return evaluation result - LLM will decide whether to ask follow-up based on depth
  // The LLM should check the followUpDepth and only ask if < 2
  return {
    success: true,
    message: evaluation.feedback, // Just feedback, LLM will add follow-up if needed
    shouldSpeak: true,
    data: {
      evaluation,
      currentFollowUpDepth,
      maxFollowUpDepth: 2,
      canAskFollowUp,
      // If follow-up is needed and allowed, include the question for LLM to speak
      followUpQuestion: (evaluation.needsFollowUp && canAskFollowUp && 'followUpQuestion' in evaluation && evaluation.followUpQuestion)
        ? evaluation.followUpQuestion
        : undefined,
      // LLM should use update_interview_state after speaking follow-up
      shouldAskNextQuestion: !(evaluation.needsFollowUp && canAskFollowUp && 'followUpQuestion' in evaluation && evaluation.followUpQuestion),
      answerNeedsMoreExplanation: evaluation.answerNeedsMoreExplanation,
      missedKeyPoints: evaluation.missedKeyPoints || [],
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
  stateProvider: StateProvider,
  llmService?: any,
  chatCtx?: any // Conversational LLM context for evaluation
): Record<string, (params: any) => Promise<any>> {
  // Create LLM service if not provided
  const service = llmService || createLLMService({
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
      return await evaluateAnswer(params, interviewId, stateProvider, orchestrator, service, chatCtx);
    },

    [ToolName.UPDATE_INTERVIEW_STATE]: async (params: UpdateInterviewStateParams) => {
      const interviewId = orchestrator.getInterviewId();
      return await updateInterviewState(params, interviewId, stateProvider, orchestrator);
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
