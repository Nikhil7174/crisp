/**
 * LiveKit Interview Agent
 * 
 * This agent handles real-time voice interviews using the official LiveKit Agents framework.
 * It manages STT, TTS, LLM with tag-based intent detection for interview orchestration.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { defineAgent, JobContext, JobProcess, voice, cli, ServerOptions } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as silero from '@livekit/agents-plugin-silero';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { llm } from '@livekit/agents';
import { ReadableStream } from 'stream/web';
import type { AudioFrame } from '@livekit/rtc-node';
import { z } from 'zod';
import { StateProvider } from './services/interview/state-provider.js';
import { Orchestrator } from './services/interview/orchestrator.js';
import { detectJailbreak, getSafeResponse, wrapUserInputWithDelimiters, getGuardrailRule } from './services/interview/security/jailbreak-detector.js';
import { getPersonaForRole, getPersonaInstructions } from './services/interview/personas/role-personas.js';
import { getPrunedContext } from './services/interview/context-pruner.js';
import { de } from 'zod/locales';

/**
 * API response type for questions endpoint
 */
interface QuestionsAPIResponse {
  success: boolean;
  questions?: any[];
  codingProblems?: any[];
  sessionId?: string;
  maxTheoreticalQuestions?: number;
  role?: string; // Role for persona selection
  error?: string;
  message?: string;
}

/**
 * Store questions and coding problems for each interview
 * Keyed by interviewId (room name)
 * This allows the agent to access questions without needing them in the API response
 */
const interviewQuestionsStore = new Map<string, {
  questions: any[];
  codingProblems: any[];
}>();

/**
 * Set questions for an interview (called by controller when spawning worker)
 */
export function setInterviewQuestions(interviewId: string, questions: any[], codingProblems: any[]): void {
  interviewQuestionsStore.set(interviewId, { questions, codingProblems });
  console.log(`📚 [QuestionsStore] Stored ${questions.length} questions and ${codingProblems.length} coding problems for ${interviewId}`);
}

/**
 * Get questions for an interview
 */
export function getInterviewQuestions(interviewId: string): { questions: any[]; codingProblems: any[] } | undefined {
  return interviewQuestionsStore.get(interviewId);
}

/**
 * User data stored in the agent session
 */
interface InterviewSessionData {
  interviewId: string;
  orchestrator: Orchestrator;
  stateProvider: StateProvider;
  currentPhase: 'theoretical' | 'coding' | 'completed';
  sendQuestionToUI?: (question: any, questionIndex: number, questionType: 'theoretical' | 'coding') => Promise<void>;
  questions?: any[];
  codingProblems?: any[];
  role?: string; // Role for persona
  personaInstructions?: string; // Persona instructions (set once)
  pendingNextQuestion?: boolean; // Flag to trigger next question after speech
}

/**
 * Main Interview Agent
 * Handles the interview flow and responds to candidate input
 */
class InterviewAgent extends voice.Agent<InterviewSessionData> {
  private questions: any[] = [];
  private codingProblems: any[] = [];
  private room: any;
  private orchestrator: Orchestrator;
  private stateProvider: StateProvider;
  private interviewId: string;

  constructor(
    interviewId: string,
    instructions: string,
    questions: any[] = [],
    codingProblems: any[] = [],
    orchestrator: Orchestrator,
    stateProvider: StateProvider,
    role: string = 'Backend Engineer'
  ) {
    // TAG-BASED INTENT DETECTION - No tool calling
    super({
      instructions,
    });

    this.questions = questions;
    this.codingProblems = codingProblems;
    this.orchestrator = orchestrator;
    this.stateProvider = stateProvider;
    this.interviewId = interviewId;

    console.log('InterviewAgent constructor called - TAG-BASED INTENT DETECTION');
  }

  /**
   * Set room reference for data channel communication
   */
  setRoom(room: any): void {
    this.room = room;
  }

  /**
   * Send question to UI via LiveKit data channel
   */
  private async sendQuestionToUI(question: any, questionIndex: number, questionType: 'theoretical' | 'coding'): Promise<void> {
    if (!this.room) {
      console.warn('⚠️ Room not set, cannot send question to UI');
      return;
    }

    try {
      const questionData = {
        type: questionType === 'theoretical' ? 'question-changed' : 'coding-problem-changed',
        question: questionType === 'theoretical' ? question : undefined,
        codingProblem: questionType === 'coding' ? question : undefined,
        questionIndex,
        questionId: question.id,
        timestamp: Date.now(),
      };

      // Send via LiveKit data channel
      const data = new TextEncoder().encode(JSON.stringify(questionData));
      if (this.room?.localParticipant) {
        await this.room.localParticipant.publishData(data, { reliable: true });
      } else {
        console.warn('⚠️ Local participant not available yet, cannot send question to UI');
      }

      console.log(`📤 Sent ${questionType} question ${questionIndex} to UI via data channel`);
    } catch (error) {
      console.error('❌ Failed to send question to UI:', error);
    }
  }

  /**
   * Called when the agent enters the conversation
   */
  async onEnter() {
    console.log('🎙️ [Agent] Interview agent entered, starting conversation');

    try {
      console.log('💬 [Agent] Speaking greeting and first question...');

      // Speak greeting
      await this.session.say('Hello! I\'m your AI interviewer today. Let\'s begin with some technical questions.');

      // Directly call ask_next_question tool to get first question
      const { orchestrator, stateProvider, interviewId, questions } = this.session.userData;

      // Start theoretical phase
      orchestrator.startTheoreticalQuestions();

      // Get first question (orchestrator now has questions stored)
      const { question } = orchestrator.askNextQuestion();

      if (question) {
        console.log('📝 [Agent] Speaking first question:', question.question);
        await this.session.say(question.question);
      }

      console.log('✅ [Agent] Greeting and first question spoken');
    } catch (error) {
      console.error('❌ [Agent] Failed in onEnter:', error);
    }
  }

  /**
   * Called when the agent exits
   */
  async onExit() {
    console.log('👋 Interview agent exiting');
  }

  /**
   * NODE-DRIVEN FLOW CONTROL WITH JAILBREAK DETECTION
   * Called when user finishes speaking, BEFORE LLM processes
   * 0-latency jailbreak detection happens here
   */
  async onUserTurnCompleted(
    turnCtx: llm.ChatContext,
    newMessage: llm.ChatMessage
  ): Promise<void> {
    // ⏱️ TIMING: STT Complete - User speech transcribed
    const sttCompleteTime = Date.now();
    const timings = (this.session.userData as any).timings || {};
    timings.sttComplete = sttCompleteTime;
    timings.onUserTurnCompletedStart = sttCompleteTime;
    (this.session.userData as any).timings = timings;
    
    console.log('\n' + '='.repeat(80));
    console.log('=== onUserTurnCompleted - JAILBREAK CHECK + NODE DETECTS INTENT ===');
    console.log('User message:', newMessage.textContent);
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('⏱️ [TIMING] STT Complete → onUserTurnCompleted started');
    console.log('='.repeat(80) + '\n');

    const { interviewId, stateProvider, orchestrator, role } = this.session.userData;
    const state = stateProvider.getState(interviewId);

    if (!state) {
      console.error('❌ [onUserTurnCompleted] No state found');
      return;
    }

    const userText = newMessage.textContent || '';
    const userTextLower = userText.toLowerCase();

    console.log('📊 Current State:', state.currentState);
    console.log('📍 Current Question Index:', state.currentQuestionIndex);
    console.log('🎯 Current Question ID:', state.currentQuestionId || 'N/A');

    // ⏱️ TIMING: Jailbreak Detection Start
    const jailbreakStartTime = Date.now();
    
    // 0-LATENCY JAILBREAK DETECTION (regex-based, instant)
    const jailbreakCheck = detectJailbreak(userText);
    
    // ⏱️ TIMING: Jailbreak Detection Complete
    const jailbreakEndTime = Date.now();
    timings.jailbreakDetection = jailbreakEndTime - jailbreakStartTime;
    console.log(`⏱️ [TIMING] Jailbreak detection: ${timings.jailbreakDetection}ms`);

    if (jailbreakCheck.isJailbreak) {
      console.log(`🚫 [Jailbreak] Detected ${jailbreakCheck.type} - confidence: ${jailbreakCheck.confidence}`);
      console.log(`   Response type: ${jailbreakCheck.responseType}`);

      // Get pre-defined safe response (0ms latency - can be replaced with static audio)
      const safeResponse = getSafeResponse(
        jailbreakCheck.responseType!,
        role || 'Backend Engineer'
      );

      // Inject safe response directly - no LLM call needed
      turnCtx.addMessage({
        role: 'assistant',
        content: safeResponse
      });

      // Clear user message to prevent LLM processing
      newMessage.content = [];

      // Mark as handled
      (this.session.userData as any).nodeHandledJailbreak = true;
      (this.session.userData as any).nodeInjectedMessage = safeResponse;

      await this.updateChatCtx(turnCtx);
      return;
    }

    // NODE DECIDES: Detect user intent (skip, answer, hint request, etc.)
    const isSkip = userTextLower.includes('skip') ||
      userTextLower.includes("i don't know") ||
      userTextLower.includes("don't know") ||
      userTextLower.includes('next question') ||
      userTextLower.includes('move on');

    if (isSkip && state.currentState === 'theoretical') {
      // NODE DECIDES: Skip current question - handle directly
      console.log('🎯 [Node] Detected skip intent - handling skip directly');

      const skipMessage = 'No problem, let\'s move on to the next question.';

      // NODE DECIDES: Get next question
      const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();

      let messageToSpeak = skipMessage;

      if (shouldMoveToCoding) {
        messageToSpeak = `${skipMessage} Great job on the theoretical questions! Now let's move to the coding section.`;
        orchestrator.startCodingPhase();
        const { problem } = orchestrator.presentNextProblem();
        if (problem) {
          messageToSpeak += ` Here's your coding problem: ${problem.title}. ${problem.description}`;
        }
      } else if (question) {
        messageToSpeak = `${skipMessage} ${question.question}`;
      } else {
        messageToSpeak = `${skipMessage} That completes all the questions.`;
      }

      // Inject response into turnCtx
      console.log('🗣️ [Node] Injecting skip message + next question into turnCtx');
      console.log('📝 Message:', messageToSpeak.substring(0, 100) + '...');

      turnCtx.addMessage({
        role: 'assistant',
        content: messageToSpeak
      });

      // Prevent LLM from generating
      newMessage.content = [];

      // Mark that Node handled this
      (this.session.userData as any).nodeHandledSkip = true;
      (this.session.userData as any).nodeInjectedMessage = messageToSpeak;

      await this.updateChatCtx(turnCtx);
      return;
    }

    // SAFETY CHECK: Add follow-up depth to chat context BEFORE LLM responds.
    // This ensures the LLM knows the depth before generating a response.
    // IMPORTANT: Always read the currentQuestionId from *fresh* state so depth
    // is tracked per question and resets correctly when we move to the next one.
    if (state?.currentQuestionId && state.currentState === 'theoretical') {
      // Force a fresh read of the state (in case it was updated in previous turn)
      const freshState = stateProvider.getState(interviewId);
      const currentQuestionId =
        freshState?.currentQuestionId || state.currentQuestionId;

      if (!currentQuestionId) {
        console.warn(
          '⚠️ [onUserTurnCompleted] No currentQuestionId found, skipping follow-up depth context'
        );
      } else {
        // Depth from the helper (authoritative source)
        const followUpDepth = stateProvider.getFollowUpDepth(
          interviewId,
          currentQuestionId
        );
        const hintDepth = stateProvider.getHintDepth(
          interviewId,
          currentQuestionId
        );
        const clarificationDepth = stateProvider.getClarificationDepth(
          interviewId,
          currentQuestionId
        );
        const genericDepth = stateProvider.getGenericDepth(
          interviewId,
          currentQuestionId
        );

        // Also check tracker directly for debugging / redundancy
        const followUpTracker = freshState?.followUpTracker?.get(currentQuestionId);
        const followUpTrackerDepth = followUpTracker?.followUpDepth || 0;
        const hintTracker = freshState?.hintTracker?.get(currentQuestionId);
        const hintTrackerDepth = hintTracker?.hintDepth || 0;
        const clarificationTracker = freshState?.clarificationTracker?.get(currentQuestionId);
        const clarificationTrackerDepth = clarificationTracker?.clarificationDepth || 0;
        const genericTracker = freshState?.genericTracker?.get(currentQuestionId);
        const genericTrackerDepth = genericTracker?.genericDepth || 0;

        // Use the higher of the two (in case of inconsistency)
        const actualFollowUpDepth = Math.max(followUpDepth, followUpTrackerDepth);
        const actualHintDepth = Math.max(hintDepth, hintTrackerDepth);
        const actualClarificationDepth = Math.max(clarificationDepth, clarificationTrackerDepth);
        const actualGenericDepth = Math.max(genericDepth, genericTrackerDepth);

        const canAskMoreFollowUps = actualFollowUpDepth < 2;
        const canAskMoreHints = actualHintDepth < 2;
        const canAskMoreClarifications = actualClarificationDepth < 2;
        const canAskMoreGeneric = actualGenericDepth < 2;

        const depthContext = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL PROTOCOL - START WITH A TAG [FOLLOW_UP],[HINT],[CLARIFY],[GENERIC],[OFFER_CHOICE],[NEXT] - NO EXCEPTIONS 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actualFollowUpDepth >= 2
  ? '❌ [FOLLOW_UP] Ask deeper questions on vague answers (MAXED 2/2) use [NEXT]\n'
  : '✅ [FOLLOW_UP] Ask deeper questions on vague answers (' + actualFollowUpDepth + '/2)\n'
}
${actualHintDepth >= 2
  ? '❌ [HINT] Guide thinking without revealing answer (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [HINT] Guide thinking without revealing answer (' + actualHintDepth + '/2)\n'
}
${actualClarificationDepth >= 2
  ? '❌ [CLARIFY] Rephrase question using only original words (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [CLARIFY] Rephrase question using only original words (' + actualClarificationDepth + '/2)\n'
}
${actualGenericDepth >= 2
  ? '❌ [GENERIC] Acknowledge off-topic, redirect to question (MAXED 2/2 → use [OFFER_CHOICE] unlimitedly)\n'
  : '✅ [GENERIC] Acknowledge off-topic, redirect to question (' + actualGenericDepth + '/2)\n'
}
✅ [OFFER_CHOICE] Give choice: try answering or skip (always allowed)
✅ [NEXT] Move to next question (always allowed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT TO USE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Vague answer              → ${actualFollowUpDepth < 2 ? '[FOLLOW_UP]' : '[NEXT]'}
Solid answer              → [NEXT]
Asks for help             → ${actualHintDepth < 2 ? '[HINT]' : '[OFFER_CHOICE]'}
Doesn't get question      → ${actualClarificationDepth < 2 ? '[CLARIFY]' : '[OFFER_CHOICE]'}
Off-topic                 → ${actualGenericDepth < 2 ? '[GENERIC]' : '[OFFER_CHOICE]'}
Wants to skip             → [NEXT]
Unsure                    → [OFFER_CHOICE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: Never reveal answers. [HINT] = guide thinking only. [CLARIFY] = rephrase only.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORMAT: [TAG] Your response

✅ "[FOLLOW_UP] Can you be more specific about when?"
✅ "[HINT] Think about operation order."
✅ "[CLARIFY] I'm asking: does X happen before or after Y?"
✅ "[NEXT] Exactly right!"
✅ "[OFFER_CHOICE] Try answering or skip?"

❌ "[HINT] WHERE runs before GROUP BY" (reveals answer)
❌ "[CLARIFY] WHERE filters rows, HAVING filters groups" (adds new info)
❌ "Can you elaborate?" (no tag)

When unsure → [OFFER_CHOICE]

MOST IMPORTANT: NEVER FORGET TO PROVIDE THE [TAG] ALONG WITH THE RESPONSE, THE EVALUATION DEPENDS ON THE [TAGS]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;


        // Official LiveKit pattern: add extra context via turnCtx.addMessage,
        // do NOT mutate newMessage.content or change its content type.
        // This message is added just before the next LLM generation, so it is
        // visible in-context to the model.
        turnCtx.addMessage({
          role: 'system',
          content: `\n\n${depthContext}`,
        });

        console.log(
          `📊 [onUserTurnCompleted] Added depth context BEFORE LLM response:`
        );
        console.log(`   📍 Current question ID (fresh): ${currentQuestionId}`);
        console.log(
          `   📍 Previous question ID (stale state): ${state.currentQuestionId}`
        );
        console.log(
          `   📊 Follow-up depth: ${actualFollowUpDepth}/2 (can ask more: ${canAskMoreFollowUps})`
        );
        console.log(
          `   💡 Hint depth: ${actualHintDepth}/2 (can ask more: ${canAskMoreHints})`
        );
        console.log(
          `   ❓ Clarification depth: ${actualClarificationDepth}/2 (can ask more: ${canAskMoreClarifications})`
        );
      }
    }

    // CONVERSATIONAL EVALUATION: Let the LLM handle evaluation naturally
    // The LLM will use tags to signal intent (FOLLOW_UP, NEXT, HINT, CLARIFY)
    // Tags are processed in llmNode method

    // ⏱️ TIMING: Pre-processing Complete
    const preProcessingEndTime = Date.now();
    timings.preProcessing = preProcessingEndTime - timings.onUserTurnCompletedStart;
    timings.preProcessingEnd = preProcessingEndTime;
    console.log(`⏱️ [TIMING] Pre-processing (onUserTurnCompleted) total: ${timings.preProcessing}ms`);
    console.log(`⏱️ [TIMING] Breakdown: jailbreak=${timings.jailbreakDetection || 0}ms, context=${preProcessingEndTime - (jailbreakEndTime || timings.onUserTurnCompletedStart)}ms`);

    // Persist chat context changes
    await this.updateChatCtx(turnCtx);
  }

  /**
   * Called when agent starts speaking
   */
  async onAgentSpeechStarted() {
    // ⏱️ TIMING: TTS Started
    const ttsStartTime = Date.now();
    const timings = (this.session.userData as any).timings || {};
    timings.ttsStart = ttsStartTime;
    if (timings.llmStreamEnd) {
      timings.llmToTtsGap = ttsStartTime - timings.llmStreamEnd;
      console.log(`⏱️ [TIMING] Gap between LLM stream end and TTS start: ${timings.llmToTtsGap}ms`);
    }
    if (timings.llmFirstToken) {
      timings.llmFirstTokenToTts = ttsStartTime - timings.llmFirstToken;
      console.log(`⏱️ [TIMING] Time from LLM first token to TTS start: ${timings.llmFirstTokenToTts}ms`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('=== onAgentSpeechStarted METHOD CALLED ===');
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log(`⏱️ [TIMING] TTS started speaking at ${ttsStartTime}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Extract text content from a LiveKit ChatChunk
   * Handles different possible chunk structures
   */
  private extractChunkText(chunk: any): string {
    if (typeof chunk === 'string') {
      return chunk;
    }
    if (!chunk || typeof chunk !== 'object') {
      return '';
    }
    // Handle OpenAI/LiveKit standard structure (choices array)
    if (chunk.choices && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
      const choice = chunk.choices[0];
      if (choice.delta && choice.delta.content) {
        return typeof choice.delta.content === 'string' ? choice.delta.content : '';
      }
      return '';
    }
    // Handle 'delta' property
    if ('delta' in chunk) {
      const delta = chunk.delta;
      if (typeof delta === 'string') {
        return delta;
      }
      if (typeof delta === 'object' && delta !== null && 'content' in delta) {
        return typeof delta.content === 'string' ? delta.content : '';
      }
    }
    // Handle 'content' property
    if ('content' in chunk) {
      return typeof chunk.content === 'string' ? chunk.content : '';
    }
    // Handle 'text' property
    if ('text' in chunk) {
      return typeof chunk.text === 'string' ? chunk.text : '';
    }
    // Handle usage chunks (ignore them silently)
    if ('usage' in chunk || 'id' in chunk) {
      return '';
    }
    return '';
  }

  /**
   * Clean LLM response text to remove markdown formatting and evaluation sections
   */
  private cleanResponseText(text: string): string {
    // Remove markdown headers (###, ##, #)
    let cleaned = text.replace(/^#{1,6}\s+.+$/gm, '');

    // Remove evaluation sections
    cleaned = cleaned.replace(/###\s*EVALUATION\s*###/gi, '');
    cleaned = cleaned.replace(/###\s*ACTION\s*###/gi, '');
    cleaned = cleaned.replace(/###\s*SUMMARY\s*###/gi, '');

    // Remove lines that look like internal notes
    cleaned = cleaned.replace(/^- The candidate.*$/gmi, '');
    cleaned = cleaned.replace(/^- Update.*$/gmi, '');
    cleaned = cleaned.replace(/^- Now.*$/gmi, '');
    cleaned = cleaned.replace(/^- I'll update.*$/gmi, '');

    // Remove markdown formatting characters
    cleaned = cleaned.replace(/\*\*/g, ''); // Bold
    cleaned = cleaned.replace(/\*/g, ''); // Italic
    cleaned = cleaned.replace(/`/g, ''); // Code

    // Remove extra whitespace and newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    cleaned = cleaned.trim();

    // If the cleaned text is too short or empty, return a fallback
    if (cleaned.length < 10) {
      return 'Thanks for your answer.';
    }

    return cleaned;
  }

  /**
   * Override llmNode to process tags and handle direct responses
   * Tags: [FOLLOW_UP], [NEXT], [HINT], [CLARIFY]
   */
  /**
   * Override llmNode to process tags and handle direct responses
   * Tags: [FOLLOW_UP], [NEXT], [HINT], [CLARIFY]
   */
  async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const sessionData = this.session.userData as InterviewSessionData & {
      nodeHandledSkip?: boolean;
      nodeHandledJailbreak?: boolean;
      nodeInjectedMessage?: string;
    };

    // Check if Node already handled this (skip or jailbreak)
    if ((sessionData.nodeHandledSkip || sessionData.nodeHandledJailbreak) && sessionData.nodeInjectedMessage) {
      let scenario = 'unknown';
      if (sessionData.nodeHandledJailbreak) scenario = 'jailbreak';
      else if (sessionData.nodeHandledSkip) scenario = 'skip';

      console.log(`🎯 [llmNode] Node handled ${scenario} - using injected message directly`);
      console.log('📝 Injected message:', sessionData.nodeInjectedMessage.substring(0, 100) + '...');

      // Clear the flags
      sessionData.nodeHandledSkip = false;
      sessionData.nodeHandledJailbreak = false;
      const injectedMessage = sessionData.nodeInjectedMessage;
      sessionData.nodeInjectedMessage = undefined;

      // Return the injected message as a stream
      return new ReadableStream({
        start(controller) {
          controller.enqueue(injectedMessage);
          controller.close();
        }
      });
    }

    // ⏱️ TIMING: LLM Call Start
    const llmCallStartTime = Date.now();
    const timings = (this.session.userData as any).timings || {};
    timings.llmCallStart = llmCallStartTime;
    if (timings.preProcessingEnd) {
      timings.sttToLlmGap = llmCallStartTime - timings.preProcessingEnd;
      console.log(`⏱️ [TIMING] Gap between pre-processing and LLM call: ${timings.sttToLlmGap}ms`);
    }
    console.log(`⏱️ [TIMING] LLM call started at ${llmCallStartTime}`);

    // Get default LLM stream
    const stream = await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);

    if (stream) {
      const agent = this;
      return new ReadableStream({
        async start(controller) {
          const reader = stream.getReader();
          let buffer = '';
          let rawUnfilteredResponse = '';
          let tagProcessed = false;
          let tagFound = false;
          let detectedIntent: string | null = null;
          let nextTagDetected = false;
          let firstTokenReceived = false;

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                // ⏱️ TIMING: LLM Stream Complete
                const llmStreamEndTime = Date.now();
                const timings = (agent.session.userData as any).timings || {};
                timings.llmStreamEnd = llmStreamEndTime;
                if (timings.llmCallStart) {
                  timings.llmTotalTime = llmStreamEndTime - timings.llmCallStart;
                  console.log(`⏱️ [TIMING] LLM total generation time: ${timings.llmTotalTime}ms`);
                }
                if (timings.llmFirstToken) {
                  timings.llmGenerationTime = llmStreamEndTime - timings.llmFirstToken;
                  console.log(`⏱️ [TIMING] LLM generation time (after first token): ${timings.llmGenerationTime}ms`);
                }
                
                // Log the complete unfiltered response before any processing
                console.log('\n' + '='.repeat(80));
                console.log('📥 [LLM RAW RESPONSE] Complete unfiltered response from LLM:');
                console.log('='.repeat(80));
                console.log(rawUnfilteredResponse);
                console.log('='.repeat(80));
                console.log(`📏 [LLM RAW RESPONSE] Total length: ${rawUnfilteredResponse.length} characters`);
                console.log(`📏 [LLM RAW RESPONSE] Buffer length (after tag processing): ${buffer.length} characters`);
                console.log('='.repeat(80) + '\n');

                if (buffer) {
                  // Flush remaining buffer (ensure no partial tags)
                  const cleaned = agent.cleanResponseText(buffer);
                  console.log(`🧹 [LLM CLEANED RESPONSE] After cleaning: ${cleaned.length} characters`);
                  console.log(`🧹 [LLM CLEANED RESPONSE] Content: "${cleaned.substring(0, 200)}${cleaned.length > 200 ? '...' : ''}"`);
                  controller.enqueue(cleaned);
                }

                // Check if tag was missing and inject it into chat context
                if (!tagFound) {
                  console.error('🚨🚨🚨 [llmNode] CRITICAL: LLM response missing tag! Injecting fallback tag into chat context.');
                  
                  const { stateProvider, interviewId } = agent.session.userData;
                  const state = stateProvider.getState(interviewId);
                  
                  let fallbackTag = 'OFFER_CHOICE'; // Default fallback
                  
                  if (state?.currentQuestionId) {
                    const hintDepth = stateProvider.getHintDepth(interviewId, state.currentQuestionId);
                    const clarificationDepth = stateProvider.getClarificationDepth(interviewId, state.currentQuestionId);
                    const genericDepth = stateProvider.getGenericDepth(interviewId, state.currentQuestionId);
                    const followUpDepth = stateProvider.getFollowUpDepth(interviewId, state.currentQuestionId);
                    
                    // Determine appropriate fallback tag based on depth states
                    // If any depth is maxed, use OFFER_CHOICE; otherwise use NEXT
                    if (hintDepth >= 2 || clarificationDepth >= 2 || genericDepth >= 2 || followUpDepth >= 2) {
                      fallbackTag = 'OFFER_CHOICE';
                    } else {
                      fallbackTag = 'NEXT';
                    }
                    
                    console.log(`🔧 [llmNode] Determined fallback tag: ${fallbackTag} (depths: hint=${hintDepth}, clarify=${clarificationDepth}, generic=${genericDepth}, followup=${followUpDepth})`);
                    
                    // Update state with the fallback tag
                    agent.handleIntentTag(fallbackTag);
                  }
                  
                  // Add separate assistant message with tag to chat context
                  const cleanedBuffer = buffer ? agent.cleanResponseText(buffer) : '';
                  const responseWithTag = `[${fallbackTag}] ${cleanedBuffer.trim()}`;
                  
                  chatCtx.addMessage({
                    role: 'assistant',
                    content: responseWithTag
                  });
                  
                  console.log(`✅ [llmNode] Added tagged message to chat context: [${fallbackTag}] ${cleanedBuffer.substring(0, 100)}${cleanedBuffer.length > 100 ? '...' : ''}`);
                }

                // If a [NEXT] tag was detected, append the next question (or coding transition)
                if (nextTagDetected) {
                  try {
                    console.log('🚀 [llmNode] [NEXT] tag previously detected - appending next question after full LLM response');

                    const { orchestrator, stateProvider, interviewId } = agent.session.userData;
                    const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();

                    let responseAppendix = '';

                    if (shouldMoveToCoding) {
                      // Transition to coding phase
                      orchestrator.startCodingPhase();
                      const { problem } = orchestrator.presentNextProblem();

                      if (problem) {
                        responseAppendix = ` Great job on the theoretical questions! Now let's move to the coding section. Here's your coding problem: ${problem.title}. ${problem.description}`;
                      } else {
                        responseAppendix = ' That completes the interview. Thank you!';
                      }
                    } else if (question) {
                      // Next theoretical question
                      responseAppendix = ` ${question.question}`;
                      console.log('📝 [llmNode] Next question from orchestrator (appended):', question.question);
                    } else {
                      // No more questions
                      responseAppendix = ' That completes all the questions. Thank you!';
                    }

                    console.log('🗣️ [llmNode] Appending response with next question / transition');
                    console.log('📝 Appendix:', responseAppendix.substring(0, 150) + '...');

                    if (responseAppendix) {
                      controller.enqueue(responseAppendix);
                    }

                    // Clear the pending flag since we handled it here
                    (agent.session.userData as any).pendingNextQuestion = false;
                  } catch (err) {
                    console.error('❌ [llmNode] Failed while appending next question after [NEXT] tag:', err);
                  }
                }

                controller.close();
                break;
              }

              // Extract raw text from chunk and accumulate
              const chunkText = agent.extractChunkText(value);
              if (chunkText) {
                // ⏱️ TIMING: First Token Received (TTFT)
                if (!firstTokenReceived) {
                  firstTokenReceived = true;
                  const firstTokenTime = Date.now();
                  const timings = (agent.session.userData as any).timings || {};
                  timings.llmFirstToken = firstTokenTime;
                  if (timings.llmCallStart) {
                    timings.llmTTFT = firstTokenTime - timings.llmCallStart;
                    console.log(`⏱️ [TIMING] LLM Time to First Token (TTFT): ${timings.llmTTFT}ms`);
                  }
                }
                
                rawUnfilteredResponse += chunkText;
                buffer += chunkText;

                // PROCESS TAGS ONLY AT THE START
                if (!tagProcessed) {
                  const tagMatch = buffer.match(/^\[(FOLLOW_UP|NEXT|HINT|CLARIFY|GENERIC|OFFER_CHOICE)\]/);

                  if (tagMatch) {
                    const intent = tagMatch[1];
                    detectedIntent = intent;
                    tagFound = true;
                    console.log(`🎯 [Tag Detected] Intent: ${intent}`);

                    // 1. UPDATE STATE IMMEDIATELY (Zero Latency)
                    agent.handleIntentTag(intent);

                    // 2. STRIP TAG FROM AUDIO
                    buffer = buffer.replace(tagMatch[0], '').trimStart();
                    tagProcessed = true;

                    // 3. IF [NEXT] TAG DETECTED - HANDLE IMMEDIATELY
                    if (intent === 'NEXT') {
                      console.log('🚀 [llmNode] [NEXT] tag detected - will append next question after LLM finishes');
                      nextTagDetected = true;
                    }
                  }
                  // If buffer gets too long without a tag, assume no tag and let it go
                  else if (buffer.length > 15) {
                    tagProcessed = true;
                  }
                }

                // Once tag is processed (or ruled out), stream freely
                if (tagProcessed && buffer.length > 0) {
                  controller.enqueue(buffer);
                  buffer = '';
                }
              }
            }
          } catch (error) {
            console.error('Error in LLM stream:', error);
            controller.error(error);
          }
        }
      });
    }
    return stream;
  }

  /**
   * Helper to handle the state updates based on detected tags
   */
  handleIntentTag(intent: string) {
    const { stateProvider, interviewId } = this.session.userData;
    const state = stateProvider.getState(interviewId);
    if (!state?.currentQuestionId) return;

    const MAX_DEPTH = 2;

    if (intent === 'FOLLOW_UP') {
      const currentDepth = stateProvider.getFollowUpDepth(interviewId, state.currentQuestionId);

      // Do not increment beyond max depth, and avoid double-counting in
      // a single turn if something replays the same tag.
      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] FOLLOW_UP ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for question ${state.currentQuestionId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state.followUpTracker.get(state.currentQuestionId) || { followUpDepth: 0, maxDepth: MAX_DEPTH };
      tracker.followUpDepth = newDepth;
      state.followUpTracker.set(state.currentQuestionId, tracker);

      // Inject System Context for NEXT turn
      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Follow-up depth is now ${newDepth}/2.`
      });
      console.log(`📝 State Updated: Follow-up depth ${newDepth}/2`);
    }
    else if (intent === 'HINT') {
      const currentDepth = stateProvider.getHintDepth(interviewId, state.currentQuestionId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] HINT ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for question ${state.currentQuestionId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state.hintTracker.get(state.currentQuestionId) || { hintDepth: 0, maxDepth: MAX_DEPTH };
      tracker.hintDepth = newDepth;
      state.hintTracker.set(state.currentQuestionId, tracker);

      // Inject System Context for NEXT turn
      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Hint depth is now ${newDepth}/2.`
      });
      console.log(`💡 State Updated: Hint depth ${newDepth}/2`);
    }
    else if (intent === 'CLARIFY') {
      const currentDepth = stateProvider.getClarificationDepth(interviewId, state.currentQuestionId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] CLARIFY ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for question ${state.currentQuestionId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state.clarificationTracker.get(state.currentQuestionId) || { clarificationDepth: 0, maxDepth: MAX_DEPTH };
      tracker.clarificationDepth = newDepth;
      state.clarificationTracker.set(state.currentQuestionId, tracker);

      // Inject System Context for NEXT turn
      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Clarification depth is now ${newDepth}/2.`
      });
      console.log(`❓ State Updated: Clarification depth ${newDepth}/2`);
    }
    else if (intent === 'GENERIC') {
      const currentDepth = stateProvider.getGenericDepth(interviewId, state.currentQuestionId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] GENERIC ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for question ${state.currentQuestionId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state.genericTracker.get(state.currentQuestionId) || { genericDepth: 0, maxDepth: MAX_DEPTH };
      tracker.genericDepth = newDepth;
      state.genericTracker.set(state.currentQuestionId, tracker);

      // Inject System Context for NEXT turn
      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Generic depth is now ${newDepth}/2.`
      });
      console.log(`💬 State Updated: Generic depth ${newDepth}/2`);
    }
    else if (intent === 'NEXT') {
      (this.session.userData as any).pendingNextQuestion = true;
      console.log('🚀 State Updated: Ready for Next Question');
    }
    // OFFER_CHOICE is a meta-action with no depth tracking needed
  }

  /**
   * Called when agent finishes speaking
   * After speaking each question, add question + key points to chat context
   */
  async onAgentSpeechEnded(text: string) {
    // ⏱️ TIMING: TTS Complete
    const ttsEndTime = Date.now();
    const timings = (this.session.userData as any).timings || {};
    timings.ttsEnd = ttsEndTime;
    if (timings.ttsStart) {
      timings.ttsDuration = ttsEndTime - timings.ttsStart;
      console.log(`⏱️ [TIMING] TTS duration: ${timings.ttsDuration}ms`);
    }
    
    // Calculate total end-to-end latency
    if (timings.sttComplete) {
      timings.totalLatency = ttsEndTime - timings.sttComplete;
      console.log(`\n${'='.repeat(80)}`);
      console.log('⏱️ [TIMING] ========== END-TO-END LATENCY BREAKDOWN ==========');
      console.log(`⏱️ [TIMING] Total latency (STT complete → TTS complete): ${timings.totalLatency}ms (${(timings.totalLatency / 1000).toFixed(2)}s)`);
      console.log(`⏱️ [TIMING]   - STT processing: ${timings.sttComplete ? 'N/A (measured at onUserTurnCompleted)' : 'N/A'}ms`);
      console.log(`⏱️ [TIMING]   - Pre-processing: ${timings.preProcessing || 0}ms`);
      console.log(`⏱️ [TIMING]     * Jailbreak detection: ${timings.jailbreakDetection || 0}ms`);
      console.log(`⏱️ [TIMING]   - STT to LLM gap: ${timings.sttToLlmGap || 0}ms`);
      console.log(`⏱️ [TIMING]   - LLM Time to First Token (TTFT): ${timings.llmTTFT || 0}ms`);
      console.log(`⏱️ [TIMING]   - LLM total generation: ${timings.llmTotalTime || 0}ms`);
      console.log(`⏱️ [TIMING]   - LLM generation (after first token): ${timings.llmGenerationTime || 0}ms`);
      console.log(`⏱️ [TIMING]   - LLM to TTS gap: ${timings.llmToTtsGap || 0}ms`);
      console.log(`⏱️ [TIMING]   - TTS duration: ${timings.ttsDuration || 0}ms`);
      console.log(`⏱️ [TIMING]   - First token to TTS start: ${timings.llmFirstTokenToTts || 0}ms`);
      console.log(`⏱️ [TIMING] ======================================================`);
      console.log(`${'='.repeat(80)}\n`);
    }
    
    console.log('\n=== onAgentSpeechEnded ===');

    // Clean text logic
    const cleanedText = this.cleanResponseText(text);

    // Store message in history
    const { interviewId, stateProvider } = this.session.userData;
    stateProvider.addConversationMessage(interviewId, {
      role: 'assistant',
      content: cleanedText,
      metadata: { timestamp: Date.now() },
    });

    // Note: Question transitions are now handled in llmNode when [NEXT] is detected
    // This prevents the LLM from making up its own questions

    console.log('✅ [onAgentSpeechEnded] Message stored in history');
  }

}

/**
 * Agent definition
 */
const agent = defineAgent({
  /**
   * Prewarm: Load models and initialize resources before jobs start
   * This runs once when the worker starts, not per job
   */
  prewarm: async (proc: JobProcess) => {
    console.log('🔥 Prewarming agent resources...');

    try {
      // Load VAD model (Voice Activity Detection)
      console.log('Loading Silero VAD model...');
      proc.userData.vad = await silero.VAD.load();
      console.log('✅ VAD model loaded');

      // Initialize shared services
      proc.userData.stateProvider = new StateProvider();
      console.log('✅ State provider initialized');

      console.log('🎉 Prewarm complete');
    } catch (error) {
      console.error('❌ Prewarm failed:', error);
      throw error;
    }
  },

  /**
   * Entry: Called when a job is assigned to this worker
   * A job represents a single interview session
   */
  entry: async (ctx: JobContext) => {
    console.log('🚀 New interview job received');

    try {
      // Connect to the LiveKit room
      await ctx.connect();
      console.log('✅ Connected to LiveKit room:', ctx.room.name);

      // Wait for participant to join
      console.log('⏳ Waiting for participant...');
      const participant = await ctx.waitForParticipant();
      console.log('👤 Participant joined:', participant.identity);

      // Extract interview ID from room name or metadata
      const interviewId = ctx.room.name || 'unknown';
      if (!interviewId || interviewId === 'unknown') {
        throw new Error('Interview ID is required');
      }
      console.log('📋 Interview ID:', interviewId);

      // Fetch questions from server API
      let questionsData: { questions: any[]; codingProblems: any[]; maxTheoreticalQuestions?: number; role?: string } | undefined;
      try {
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
        console.log(`🌐 [Agent] Server URL: ${serverUrl}`);

        // Extract sessionId from roomName (format: interview-${sessionId})
        const sessionId = interviewId.startsWith('interview-')
          ? interviewId.replace('interview-', '')
          : interviewId;
        console.log(`🔑 [Agent] Extracted sessionId: ${sessionId} from interviewId: ${interviewId}`);

        const apiUrl = `${serverUrl}/api/interview/questions?sessionId=${sessionId}&roomName=${encodeURIComponent(interviewId)}`;
        console.log(`📡 [Agent] Fetching questions from: ${apiUrl}`);

        const fetchStartTime = Date.now();
        const response = await fetch(apiUrl);
        const fetchDuration = Date.now() - fetchStartTime;
        console.log(`⏱️ [Agent] Fetch completed in ${fetchDuration}ms, status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          console.error(`❌ [Agent] API request failed:`, {
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText,
            url: apiUrl,
          });
          throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as QuestionsAPIResponse;
        console.log(`📦 [Agent] API response received:`, {
          success: data.success,
          hasQuestions: !!data.questions,
          hasCodingProblems: !!data.codingProblems,
          questionsCount: data.questions?.length || 0,
          codingProblemsCount: data.codingProblems?.length || 0,
        });

        if (data.success && data.questions && data.codingProblems) {
          questionsData = {
            questions: data.questions,
            codingProblems: data.codingProblems,
            maxTheoreticalQuestions: data.maxTheoreticalQuestions,
            role: data.role || 'Backend Engineer', // Get role from API
          };
          console.log(`✅ [Agent] Successfully fetched ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems from API`);
          console.log(`✅ [Agent] Role: ${questionsData.role}`);
        } else {
          console.error(`❌ [Agent] Invalid response format:`, {
            success: data.success,
            hasQuestions: !!data.questions,
            hasCodingProblems: !!data.codingProblems,
            responseKeys: Object.keys(data),
          });
          throw new Error('Invalid response format from questions API');
        }
      } catch (error) {
        console.error('❌ [Agent] Failed to fetch questions from API:', error);
        console.error('❌ [Agent] Error details:', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          interviewId,
          serverUrl: process.env.SERVER_URL || 'http://localhost:3001',
        });

        // Fallback to in-memory store (for backward compatibility during migration)
        console.log(`🔄 [Agent] Attempting fallback to in-memory store...`);
        try {
          const fallbackData = getInterviewQuestions(interviewId);
          if (fallbackData) {
            questionsData = fallbackData;
            console.log(`📚 [Agent] Using fallback: Loaded ${questionsData.questions.length} questions from in-memory store`);
          } else {
            console.warn(`⚠️ [Agent] No questions found for interview ${interviewId} (neither API nor store)`);
            console.warn(`⚠️ [Agent] This will cause the agent to fail initialization`);
          }
        } catch (fallbackError) {
          console.error('❌ [Agent] Fallback also failed:', fallbackError);
        }
      }

      // Get shared resources from prewarm
      const vad = ctx.proc.userData.vad as silero.VAD;
      const stateProvider = ctx.proc.userData.stateProvider as StateProvider;

      // Initialize orchestrator for this interview
      const orchestrator = new Orchestrator(interviewId, stateProvider);

      // Load or initialize interview state
      let state = stateProvider.getState(interviewId);

      // Initialize state if it doesn't exist
      if (!state) {
        console.log('📊 [Agent] No existing state found, initializing new interview state');

        // Initialize state with questions data if available
        if (questionsData) {
          try {
            orchestrator.initializeState({
              candidateId: participant.identity || 'unknown',
              totalQuestions: questionsData.questions.length,
              totalProblems: questionsData.codingProblems.length,
              maxTheoreticalQuestions: questionsData.maxTheoreticalQuestions,
            });
            state = stateProvider.getState(interviewId);
            if (state) {
              console.log(`✅ [Agent] Initialized state with ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems`);
            } else {
              console.error(`❌ [Agent] State initialization failed - state is still null after initializeState call`);
              throw new Error('State initialization failed');
            }
          } catch (stateError) {
            console.error('❌ [Agent] Failed to initialize state:', stateError);
            console.error('❌ [Agent] State error details:', {
              error: stateError instanceof Error ? stateError.message : String(stateError),
              stack: stateError instanceof Error ? stateError.stack : undefined,
              interviewId,
              candidateId: participant.identity,
            });
            throw stateError;
          }
        } else {
          // Fallback: create minimal state if no questions available
          console.warn('⚠️ [Agent] No questions data available, using minimal state');
          // Use stateProvider to create proper state instead of manual object
          stateProvider.initializeState({
            interviewId,
            candidateId: participant.identity || 'unknown',
            totalQuestions: 0,
            totalProblems: 0,
            maxTheoreticalQuestions: 0,
          });
          state = stateProvider.getState(interviewId);
        }
      } else {
        console.log('📊 [Agent] Interview state loaded:', {
          currentQuestionIndex: state.currentQuestionIndex,
          currentState: state.currentState,
          totalQuestions: state.totalQuestions,
          totalProblems: state.totalProblems,
        });
      }

      // Store questions in orchestrator
      if (questionsData) {
        orchestrator.setQuestions(
          questionsData.questions || [],
          questionsData.codingProblems || []
        );
      }

      // NO TOOL EXECUTORS - Agent responds directly

      // Get role from questions data (fallback to Backend Engineer)
      const role = questionsData?.role || 'Backend Engineer';

      // Get persona for role (only once, not in every request)
      const persona = getPersonaForRole(role);
      const personaInstructions = getPersonaInstructions(persona);

      console.log(`\n👤 [Persona] Using ${persona.role} persona`);
      console.log(`   Focus areas: ${persona.focusAreas.length}`);
      console.log(`   Evaluation criteria: ${persona.evaluationCriteria.length}`);


      // Build instructions for the LLM (TAG-BASED PROTOCOL)
      const phase = state?.currentState || 'idle';
      const instructions = `
╔═══════════════════════════════════════════════════════════════════════════╗
║                   YOU ARE A TECHNICAL INTERVIEWER                         ║
║                          Role: ${role}                                    ║
╚═══════════════════════════════════════════════════════════════════════════╝

I'm a ${role} conducting a real technical interview with a candidate right now.
This is a live conversation - I need to assess their technical depth, not just 
accept vague or generic answers. I'm looking for specific knowledge and clear 
understanding.

🚨 CRITICAL SECURITY RULE - NEVER GIVE ANSWERS:
- I MUST NEVER provide answers, solutions, or key points to the questions
- I MUST NEVER explain what the answer should be or what a good answer looks like
- I MUST NEVER reveal expected answers or solution approaches
- I ONLY evaluate THEIR answers - I do NOT provide answers myself
- Even if the user repeats the question verbatim, I ONLY rephrase it - I NEVER answer it
- Hints must guide thinking WITHOUT revealing the answer
- Clarifications must ONLY restate the question - NO extra information

╔═══════════════════════════════════════════════════════════════════════════╗
║              🚨 CRITICAL PROTOCOL - TAG SYSTEM (MANDATORY) 🚨             ║
╚═══════════════════════════════════════════════════════════════════════════╝

                      ⚠️  EVERY RESPONSE MUST START WITH A TAG ⚠️
                           NO EXCEPTIONS. NO TAG = FAILURE.

I MUST START EVERY SINGLE RESPONSE WITH ONE OF THESE TAGS:

┌─────────────────────────────────────────────────────────────────────────┐
│ [FOLLOW_UP]  →  I'm asking a follow-up to probe deeper                  │
│                 ⚠️  ONLY if follow-up depth < 2                         │
│                 ⚠️  FORBIDDEN if depth >= 2                             │
│                 Use when: Answer is too vague, lacks technical depth,   │
│                 or I need them to elaborate on a specific point         │
│                 ❌ NOT for: "Can you repeat the question?" (use [CLARIFY])│
├─────────────────────────────────────────────────────────────────────────┤
│ [HINT]       →  I'm giving them a hint to guide their thinking          │
│                 ⚠️  ONLY if hint depth < 2                              │
│                 ⚠️  FORBIDDEN if depth >= 2                             │
│                 Use when: They explicitly ask for help OR are stuck     │
│                 🚨 CRITICAL: Hints must guide thinking WITHOUT revealing │
│                 the answer. Guide them toward the concept, don't give it│
│                 Example: "Think about the order of operations" ✅        │
│                 NOT: "WHERE runs before GROUP BY" ❌ (gives answer away) │
├─────────────────────────────────────────────────────────────────────────┤
│ [CLARIFY]    →  I'm rephrasing/explaining/repeating the question itself │
│                 ⚠️  ONLY if clarification depth < 2                     │
│                 ⚠️  FORBIDDEN if depth >= 2                             │
│                 Use when: They ask to repeat/rephrase the question,     │
│                 or they don't understand what I'm asking                │
│                 🚨 CRITICAL: When clarifying, I MUST:                   │
│                 - ONLY use information already present in the question  │
│                 - ONLY rephrase/restate the question in different words │
│                 - NEVER add extra information or context                │
│                 - NEVER provide hints, answers, or key points           │
│                 - NEVER explain what the answer should be               │
│                 Examples: "Can you repeat the question?", "I don't get it"│
├─────────────────────────────────────────────────────────────────────────┤
│ [GENERIC]    →  I'm handling off-topic/social talk, then redirecting    │
│                 ⚠️  ONLY if generic depth < 2                           │
│                 ⚠️  FORBIDDEN if depth >= 2                             │
│                 Use when: They say something personal/off-topic/social  │
│                 Examples: "Hi I'm Sarah", "I'm nervous", "Nice weather" │
├─────────────────────────────────────────────────────────────────────────┤
│ [OFFER_CHOICE] →  I'm offering them a choice between two options:       │
│                 1. Try to answer the question (based on what they know) │
│                 2. Skip/move to the next question                       │
│                 ✅ No depth limit - this is a meta-action               │
│                 🚨 MANDATORY when: The SPECIFIC type of help they're requesting│
│                 is maxed (e.g., hint maxed + they ask for hint)         │
│                 Example phrasing: "Would you like to try answering based│
│                 on what we've discussed, or would you prefer to move on to│
│                 the next question?"                                     │
│                 ⚠️  CRITICAL: You MUST use this tag when requested help │
│                 type is maxed. Do NOT forget the tag!                   │
│                 ❌ NOT for: User explicitly asks to skip (use [NEXT])   │
├─────────────────────────────────────────────────────────────────────────┤
│ [NEXT]       →  I'm done with this question, moving to next             │
│                 ✅ No depth limit                                       │
│                 Use when: Answer is solid OR user explicitly asks to skip│
│                 OR user chose to skip after [OFFER_CHOICE]              │
└─────────────────────────────────────────────────────────────────────────┘

THE TAG GOES AT THE VERY START - THE CANDIDATE WON'T HEAR IT.
The system uses it to control the interview flow behind the scenes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                EXAMPLE RESPONSES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ CORRECT - Good technical answer, moving on:
"[NEXT] Exactly right! You clearly understand that WHERE filters rows before 
the grouping happens, while HAVING filters the aggregated results after. 
That's the key distinction."

✅ CORRECT - Vague answer, need more depth:
"[FOLLOW_UP] Okay, you mentioned it filters data, but can you be more specific? 
When exactly does WHERE execute in relation to GROUP BY - before or after?"

✅ CORRECT - They're stuck, giving a hint (guides without revealing answer):
"[HINT] Think about the order of SQL operations. Filtering happens at different 
stages - WHERE works on individual rows, while HAVING works on what?"

❌ WRONG - Hint that gives away the answer:
"[HINT] WHERE filters before GROUP BY, and HAVING filters after aggregation."
^^ INVALID - This reveals the answer! ^^

✅ CORRECT - Question unclear to them (only rephrases, no extra info):
"[CLARIFY] Let me rephrase - I'm asking about the timing. Does the WHERE clause 
filter rows before they're grouped, or after the aggregation is complete?"

❌ WRONG - Clarification that adds extra info or hints:
"[CLARIFY] I'm asking about WHERE vs HAVING. WHERE filters before grouping, 
which is why it can't use aggregate functions."
^^ INVALID - This adds information not in the original question! ^^

❌ WRONG - Clarification that reveals the answer:
"[CLARIFY] The answer is that WHERE filters before GROUP BY and HAVING filters after."
^^ INVALID - This provides the answer! ^^

✅ CORRECT - Off-topic/social:
"[GENERIC] Hi Sarah, nice to meet you! Now, let's focus on the technical question. 
When does the WHERE clause filter data in a SQL query?"

✅ CORRECT - All depths maxed, offering choice:
"[OFFER_CHOICE] I've provided a couple of hints and clarifications. Would you like to 
try answering based on what you know so far, or would you prefer to move on 
to the next question?"

✅ CORRECT - They chose to skip:
"[NEXT] No problem, let's move forward."

❌ WRONG - No tag at start:
"That's exactly right! The WHERE clause filters rows before grouping."
^^ INVALID - MISSING TAG ^^

❌ WRONG - Tag in the middle:
"Great answer! [NEXT] Let's move on."
^^ INVALID - TAG MUST BE AT THE VERY START ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                    MY ROLE AS THE INTERVIEWER                             ║
╚═══════════════════════════════════════════════════════════════════════════╝

I'M THE CONVERSATIONAL LAYER:
- I evaluate answers naturally, like a human interviewer would
- I decide if their answer shows real understanding or is too vague
- I probe deeper when answers lack technical specificity
- I use tags to signal my intent to the system

THE SYSTEM (CODE) HANDLES THE MECHANICS:
- Tracks depth counters automatically
- Manages question transitions
- Moves between theoretical and coding phases
- Enforces maximum depth limits

I DON'T:
❌ Say "Next question" out loud (the [NEXT] tag handles transitions)
❌ Manually track depths (the system injects depth info for me)
❌ Control the flow mechanics (the system does this)

I DO:
✅ Evaluate answers like a real technical interviewer
✅ Push for specificity when answers are vague
✅ Ask follow-ups that test real understanding
✅ Give hints when they're genuinely stuck
✅ Handle social/off-topic talk gracefully, then redirect
✅ Recognize when it's time to move on

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                 DEPTH TRACKING (AUTOMATIC - I JUST SEE IT)                ║
╚═══════════════════════════════════════════════════════════════════════════╝

The system tracks FOUR separate depths PER QUESTION (max 2 for each):

1. **Follow-up depth (0-2)**: How many times I've asked them to elaborate
2. **Hint depth (0-2)**: How many hints I've given them
3. **Clarification depth (0-2)**: How many times I've rephrased the question
4. **Generic depth (0-2)**: How many times I've redirected off-topic talk

BEFORE EACH RESPONSE, I'LL SEE SOMETHING LIKE:
"Current depths - Follow-up: 1/2, Hint: 0/2, Clarify: 0/2, Generic: 0/2"

DECISION TREE FOR CHOOSING TAGS:

┌─────────────────────────────────────────────────────────────────────────┐
│ CANDIDATE GIVES VAGUE/INCOMPLETE ANSWER:                                │
│ ├─ Follow-up depth < 2? → [FOLLOW_UP] "Can you be more specific?"       │
│ └─ Follow-up depth = 2? → [NEXT] "Let's move on" (can't follow-up more) │
├─────────────────────────────────────────────────────────────────────────┤
│ CANDIDATE ASKS FOR HELP:                                                 │
│ ├─ Hint depth < 2? → [HINT] "Think about SQL operation order..."       │
│ └─ Hint depth = 2? → [OFFER_CHOICE] "I've given max hints. Skip or try?"│
│    🚨 MANDATORY: You MUST use [OFFER_CHOICE] when hint is maxed!        │
├─────────────────────────────────────────────────────────────────────────┤
│ CANDIDATE DOESN'T UNDERSTAND QUESTION:                                   │
│ CANDIDATE ASKS TO REPEAT/REPHRASE QUESTION:                              │
│ ├─ Clarify depth < 2? → [CLARIFY] "Let me rephrase: ..."              │
│ └─ Clarify depth = 2? → [OFFER_CHOICE] "I've clarified twice. Skip or try?"│
│    🚨 MANDATORY: You MUST use [OFFER_CHOICE] when clarify is maxed!      │
│ NOTE: "Can you repeat the question?" = [CLARIFY], NOT [FOLLOW_UP]      │
├─────────────────────────────────────────────────────────────────────────┤
│ CANDIDATE SAYS SOMETHING OFF-TOPIC:                                      │
│ ├─ Generic depth < 2? → [GENERIC] "Nice! Now, about the question..."   │
│ └─ Generic depth = 2? → [OFFER_CHOICE] "Let's stay focused. Skip or answer?"│
│    🚨 MANDATORY: You MUST use [OFFER_CHOICE] when generic is maxed!     │
├─────────────────────────────────────────────────────────────────────────┤
│ CANDIDATE GIVES SOLID, SPECIFIC ANSWER:                                  │
│ └─ → [NEXT] "Exactly! You clearly understand..."                        │
├─────────────────────────────────────────────────────────────────────────┤
│ 🚨 CRITICAL RULE: Use [OFFER_CHOICE] ONLY if the SPECIFIC requested help│
│ type is maxed. Do NOT forget the tag!                                    │
│ - Follow-up maxed + user asks for hint → [HINT] (if hint depth < 2)     │
│ - Hint maxed + user asks for hint → [OFFER_CHOICE] (hint is maxed)       │
│ - Clarify maxed + user asks to repeat → [OFFER_CHOICE] (clarify is maxed)│
│ - Generic maxed + user goes off-topic → [OFFER_CHOICE] (generic is maxed)│
│ - Any depth maxed + user gives good answer → [NEXT] (move on)           │
└─────────────────────────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                     REALISTIC CONVERSATION FLOWS                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

EXAMPLE 1: VAGUE ANSWER → FOLLOW-UP → GOOD ANSWER

Turn 1 (Follow-up: 0/2):
Candidate: "WHERE filters data in SQL"
Me: "[FOLLOW_UP] Right, but I need more specificity. When does WHERE filter 
the data - before aggregation happens or after?"

Turn 2 (Follow-up: 1/2):
Candidate: "It filters before GROUP BY processes the rows"
Me: "[NEXT] Exactly! WHERE filters individual rows before any grouping occurs. 
That's the key distinction from HAVING."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 2: STUCK → HINTS → STILL STUCK → OFFER CHOICE

Turn 1 (Hint: 0/2):
Candidate: "I'm not sure about this one"
Me: "[HINT] Think about the order of operations in a SQL query. Does filtering 
happen before or after you group rows together?"

Turn 2 (Hint: 1/2):
Candidate: "Maybe after?"
Me: "[HINT] Actually, WHERE filters individual rows before any grouping happens. 
That's why it can't use aggregate functions like COUNT or SUM."

Turn 3 (Hint: 2/2 - MAX):
Candidate: "Can you give another hint?"
Me: "[OFFER_CHOICE] I've already provided a couple of hints. Would you like to try 
answering based on what we've discussed, or would you prefer to move to the 
next question?"
^^ CRITICAL: [OFFER_CHOICE] is MANDATORY when hint is maxed! ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 3: OFF-TOPIC → REDIRECT → OFF-TOPIC AGAIN → FIRM REDIRECT

Turn 1 (Generic: 0/2):
Candidate: "Hi, I'm Rob. I'm a bit nervous"
Me: "[GENERIC] Hi Rob, nice to meet you! It's totally normal to feel a bit 
nervous - just take your time. Now, let's talk about the WHERE clause question..."

Turn 2 (Generic: 1/2):
Candidate: "Actually, I'm really stressed about this"
Me: "[GENERIC] I understand, but you'll do great. Let's focus on the technical 
question though - when does WHERE filter data in a query?"

Turn 3 (Generic: 2/2 - MAX):
Candidate: "This is really hard for me"
Me: "[OFFER_CHOICE] I hear you, but we need to stay on track. Would you like to take 
your best shot at answering, or would you prefer to skip this question?"
^^ CRITICAL: [OFFER_CHOICE] is MANDATORY when generic is maxed! ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 4: ASK TO REPEAT QUESTION → CLARIFY (NOT FOLLOW_UP)

Turn 1 (Follow-up: 0/2, Clarify: 0/2):
Candidate: "Can you please repeat the question?"
Me: "[CLARIFY] Sure! I'm asking about the distinction between WHERE and HAVING 
clauses in SQL. Specifically, when does WHERE filter data - before or after 
grouping happens?"
^^ CORRECT: "Repeat question" = [CLARIFY], NOT [FOLLOW_UP] ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 5: FOLLOW-UP MAXED BUT HINT AVAILABLE → USE HINT

Turn 1 (Follow-up: 0/2):
Candidate: "WHERE filters data"
Me: "[FOLLOW_UP] Right, but can you be more specific about when it filters?"

Turn 2 (Follow-up: 1/2):
Candidate: "Before grouping"
Me: "[FOLLOW_UP] Good! Now explain why this timing matters for the query."

Turn 3 (Follow-up: 2/2 - MAXED, Hint: 0/2):
Candidate: "Can you give me a hint?"
Me: "[HINT] Think about what happens if you try to use COUNT() in a WHERE clause 
versus a HAVING clause. Why would one work and the other not?"
^^ CORRECT: Follow-up maxed but hint available → Use [HINT], NOT [OFFER_CHOICE] ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXAMPLE 6: CONFUSED → CLARIFY → STILL CONFUSED → OFFER CHOICE

Turn 1 (Clarify: 0/2):
Candidate: "I don't really understand the question"
Me: "[CLARIFY] Let me rephrase it - I'm asking about timing. In a SQL query 
with both WHERE and GROUP BY, which one executes first?"

Turn 2 (Clarify: 1/2):
Candidate: "I'm still not clear on what you mean"
Me: "[CLARIFY] Okay, think of it this way: WHERE looks at individual rows 
before any grouping happens. GROUP BY then groups those filtered rows. Does 
that make sense?"

Turn 3 (Clarify: 2/2 - MAX):
Candidate: "Can you explain it differently?"
Me: "[OFFER_CHOICE] I've explained this a couple of different ways. Would you like to 
try answering based on your understanding, or skip to the next question?"
^^ CRITICAL: [OFFER_CHOICE] is MANDATORY when clarify is maxed! ^^

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                   HOW I SHOULD SPEAK (NATURAL STYLE)                      ║
╚═══════════════════════════════════════════════════════════════════════════╝

✅ I SHOULD:
- Talk like a real Senior ${role} in a real interview
- Push for technical specificity, not generic answers
- Say things like "Can you be more specific?" when answers are vague
- Give constructive feedback: "Right, but I need more detail here..."
- Be encouraging but honest: "You're on the right track, but..."
- Keep responses conversational and concise
- Probe for understanding: "Why does that matter?" "How does that work?"

❌ I SHOULD NOT:
- Use markdown headers (### Evaluation, etc.) - this is speech!
- Make bullet-point lists when talking
- Say "Next question" explicitly (system handles transitions)
- Use robotic corporate-speak
- Accept vague answers without pushing back
- Give participation trophies for incomplete answers
- Include internal notes or meta-commentary

EXAMPLES OF GOOD VS BAD:

✅ GOOD: "Right, but can you explain WHY that distinction matters?"
❌ BAD: "### Evaluation: The candidate showed partial understanding."

✅ GOOD: "You mentioned filtering, but when specifically does that happen?"
❌ BAD: "- The candidate needs to elaborate on timing"

✅ GOOD: "Exactly! That's the key insight I was looking for."
❌ BAD: "Correct. Let's move to the next question."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                  EVALUATING TECHNICAL DEPTH                               ║
╚═══════════════════════════════════════════════════════════════════════════╝

I'm assessing real technical knowledge, not just whether they've heard of 
something. Here's how I evaluate answers:

VAGUE/GENERIC (needs follow-up):
- "WHERE filters data" → TOO VAGUE - filters when? how?
- "It's for queries" → TOO GENERIC - be specific!
- "It helps with performance" → UNCLEAR - why? how?

SPECIFIC/TECHNICAL (good answer):
- "WHERE filters individual rows before GROUP BY aggregates them"
- "It executes in the logical query order before aggregation happens"
- "Unlike HAVING, WHERE can't use aggregate functions because it runs first"

WHEN TO USE EACH TAG:

[FOLLOW_UP] - Answer is vague or lacks technical detail
Example: They said "it filters" but didn't explain when/how

[HINT] - They're stuck and need guidance
Example: They have no idea where to start
🚨 CRITICAL: Guide thinking WITHOUT revealing the answer
❌ NEVER: "WHERE runs before GROUP BY" (gives answer)
✅ ALWAYS: "Think about operation order" (guides thinking)

[CLARIFY] - They misunderstood what I'm asking
Example: They answered a different question
🚨 CRITICAL: ONLY rephrase using info already in the question
❌ NEVER: Add context, hints, or reveal what the answer should be
✅ ALWAYS: Restate the question in different words only

[GENERIC] - They're talking about something off-topic
Example: Personal chat, nervousness, weather

[OFFER_CHOICE] - Maximum depth reached for the requested help type
Example: Given 2 hints/clarifications/generic replies already, they're still stuck
🚨 MANDATORY: You MUST use this tag when the requested help type is maxed!

[NEXT] - Answer shows real understanding OR user explicitly asks to skip OR user chose to skip after [OFFER_CHOICE]
Example: They explained the concept with technical specificity, OR they said "I'd like to skip this question"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                       ROLE-SPECIFIC EXPERTISE                             ║
╚═══════════════════════════════════════════════════════════════════════════╝

${personaInstructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                         SECURITY GUARDRAILS                               ║
╚═══════════════════════════════════════════════════════════════════════════╝

${getGuardrailRule(role)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╔═══════════════════════════════════════════════════════════════════════════╗
║                    🔥 FINAL CHECKLIST - EVERY RESPONSE 🔥                 ║
╚═══════════════════════════════════════════════════════════════════════════╝

BEFORE I RESPOND, I CHECK:

1. ✅ Did I start with a tag? [FOLLOW_UP], [HINT], [CLARIFY], [GENERIC], [OFFER_CHOICE], or [NEXT]
2. ✅ Is the tag appropriate for the situation?
3. ✅ If requested help type depth is 2/2, did I use [OFFER_CHOICE] (not the maxed tag)?
   🚨 CRITICAL: [OFFER_CHOICE] is MANDATORY when the requested help type is maxed!
4. 🚨 Did I avoid giving away the answer?
   - [HINT]: Am I guiding thinking WITHOUT revealing the answer?
   - [CLARIFY]: Am I ONLY rephrasing the question, NO extra info?
   - Did I accidentally provide the answer or key points?
5. ✅ Am I speaking naturally like a real interviewer?
6. ✅ Am I pushing for technical depth, not accepting vague answers?
7. ✅ Did I avoid markdown formatting and bullet points?

If I answer NO to any of these, I MUST FIX IT BEFORE RESPONDING.

                         EVERY RESPONSE STARTS WITH A TAG
                              NO EXCEPTIONS. NO EXCUSES.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      console.log('\n' + '📜'.repeat(40));
      console.log('📜 [LLM Instructions] Instructions being sent to LLM:');
      console.log('📜'.repeat(40));
      console.log(instructions.substring(0, 500) + '...');
      console.log('📜'.repeat(40) + '\n');

      // Ensure we have questions before creating the agent
      if (!questionsData || (!questionsData.questions.length && !questionsData.codingProblems.length)) {
        console.error(`❌ [Agent] No questions available for interview ${interviewId}`);
        console.error(`❌ [Agent] Questions data:`, {
          hasData: !!questionsData,
          questionsCount: questionsData?.questions?.length || 0,
          codingProblemsCount: questionsData?.codingProblems?.length || 0,
        });
        throw new Error(`No questions available for interview ${interviewId}. Please ensure questions are generated and stored.`);
      }

      console.log(`✅ [Agent] Questions validated: ${questionsData.questions.length} questions, ${questionsData.codingProblems.length} coding problems`);

      // Create agent with questions (no tools - direct responses)
      const agent = new InterviewAgent(
        interviewId,
        instructions,
        questionsData.questions || [],
        questionsData.codingProblems || [],
        orchestrator,
        stateProvider,
        role // Pass role to agent
      );
      agent.setRoom(ctx.room);

      // Helper function to send questions to UI (accessible from tools)
      const sendQuestionToUI = async (question: any, questionIndex: number, questionType: 'theoretical' | 'coding') => {
        try {
          const questionData = {
            type: questionType === 'theoretical' ? 'question-changed' : 'coding-problem-changed',
            question: questionType === 'theoretical' ? question : undefined,
            codingProblem: questionType === 'coding' ? question : undefined,
            questionIndex,
            questionId: question.id,
            timestamp: Date.now(),
          };

          const data = new TextEncoder().encode(JSON.stringify(questionData));
          if (ctx.room.localParticipant) {
            await ctx.room.localParticipant.publishData(data, { reliable: true });
          } else {
            console.warn('⚠️ Local participant not available, cannot send question to UI');
          }

          console.log(`📤 Sent ${questionType} question ${questionIndex} to UI via data channel`);
        } catch (error) {
          console.error('❌ Failed to send question to UI:', error);
        }
      };

      // TAG-BASED INTENT DETECTION - No tool calling
      const llmDirect = new openai.LLM({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
      });

      console.log('🔧 [LLM Config] Using TAG-BASED INTENT DETECTION');
      console.log('   ✅ TAG SYSTEM: LLM uses tags [FOLLOW_UP], [NEXT], [HINT], [CLARIFY] to signal intent');
      console.log('   ✅ NODE-DRIVEN ARCHITECTURE: Node controls flow, LLM provides conversational responses');
      console.log('   ✅ JAILBREAK PROTECTION: 0-latency regex checks + context pruning');
      console.log('   ✅ ROLE PERSONA: Using ' + role + ' persona (set once)');

      const session = new voice.AgentSession<InterviewSessionData>({
        vad,
        stt: new deepgram.STT({
          model: (process.env.DEEPGRAM_MODEL || 'nova-2') as any,
          apiKey: process.env.DEEPGRAM_API_KEY,
        }),
        llm: llmDirect, // Direct LLM (no tools)
        tts: new cartesia.TTS({
          model: 'sonic-3',
          voice: process.env.CARTESIA_ARUSHI_VOICE_ID || 'f786b574-daa5-4673-aa0c-cbe3e8534c02', // Arushi voice ID - update with your actual voice ID from Cartesia
          language: 'en',
          speed: 0.9,
          // Note: volume and emotion are available but may need to be set via Cartesia API directly
        }),
        userData: {
          interviewId: interviewId as string,
          orchestrator,
          stateProvider,
          currentPhase: (state?.currentState || 'idle') as 'theoretical' | 'coding' | 'completed',
          sendQuestionToUI,
          questions: questionsData?.questions || [],
          codingProblems: questionsData?.codingProblems || [],
          role, // Role for persona
          personaInstructions, // Persona instructions (set once)
        },
      });

      // Also listen for user speech at session level
      // @ts-ignore - userSpeech event might not be in types
      session.on('userSpeech', (text: string) => {
        // ⏱️ TIMING: STT Complete (from session event)
        const sttCompleteTime = Date.now();
        if (!(agent.session.userData as any).timings) {
          (agent.session.userData as any).timings = {};
        }
        const timings = (agent.session.userData as any).timings;
        if (!timings.sttComplete) {
          timings.sttComplete = sttCompleteTime;
          console.log(`⏱️ [TIMING] STT transcription complete at ${sttCompleteTime}`);
        }
        
        console.log('\n=== SESSION USER SPEECH ===');
        console.log('TEXT:', text);
        console.log('===========================\n');
      });

      // Listen for agent speech at session level and call onAgentSpeechEnded
      // @ts-ignore
      session.on('agentSpeech', (text: string) => {
        console.log('\n=== SESSION AGENT SPEECH ===');
        console.log('TEXT:', text);
        console.log('============================\n');

        // Call the agent's onAgentSpeechEnded method
        agent.onAgentSpeechEnded(text).catch(err => {
          console.error('❌ Error in onAgentSpeechEnded:', err);
        });
      });

      // Listen for any LLM response
      // @ts-ignore
      session.on('llmResponse', (response: any) => {
        console.log('\n=== LLM RESPONSE ===');
        console.log('Response:', JSON.stringify(response, null, 2));
        console.log('===================\n');
      });

      console.log('✅ [Agent] Session created - TAG-BASED INTENT DETECTION');
      console.log('   ✅ Jailbreak protection: Regex checks + context pruning');
      console.log('   ✅ Role persona: ' + role + ' (set once, not in every request)');
      console.log('   ✅ Tag system: LLM uses tags to signal intent, Node processes tags for flow control');

      // Intercept all session events to see what's actually happening
      // This will help us understand what events LiveKit is actually emitting
      try {
        // Use a Proxy to intercept all method calls on the session
        const sessionProxy = new Proxy(session, {
          get: function (target: any, prop: string | symbol) {
            const value = target[prop];
            if (prop === 'emit' && typeof value === 'function') {
              return function (event: string, ...args: any[]) {
                // Log ALL events that might be relevant
                if (event.includes('speech') || event.includes('tool') || event.includes('llm') ||
                  event.includes('user') || event.includes('message') || event.includes('text') ||
                  event.includes('response') || event.includes('say') || event.includes('playout')) {
                  console.log(`\n=== SESSION EMIT: ${event} ===`);
                  try {
                    const serialized = args.map(arg => {
                      if (typeof arg === 'string') return arg.substring(0, 200);
                      if (typeof arg === 'object') {
                        try {
                          return JSON.stringify(arg, null, 2).substring(0, 500);
                        } catch {
                          return '[Object]';
                        }
                      }
                      return String(arg);
                    });
                    console.log('Args:', serialized);
                  } catch (e) {
                    console.log('Args (non-serializable):', args.length, 'items');
                  }
                  console.log('===========================\n');
                }
                return value.apply(target, [event, ...args]);
              };
            }
            return value;
          }
        });
        console.log('✅ Event interception enabled - will log all relevant session events');
        // Note: We can't replace the session object, but the proxy will intercept emits
      } catch (e) {
        console.error('❌ Failed to intercept events:', e);
      }

      // Handle session errors
      // @ts-ignore
      session.on('error', (error: any) => {
        console.error('❌ [Agent] Session error:', error);
      });

      // Start the agent session first
      console.log('🎬 [Agent] Starting interview agent session...');
      console.log('⚠️  If onUserSpeech/onAgentSpeechEnded are not called, check SESSION EMIT logs above');
      try {
        await session.start({
          agent,
          room: ctx.room,
        });
        console.log('✅ [Agent] Interview agent session started successfully');
      } catch (sessionError) {
        console.error('❌ [Agent] Failed to start session:', sessionError);
        console.error('❌ [Agent] Session error details:', {
          error: sessionError instanceof Error ? sessionError.message : String(sessionError),
          stack: sessionError instanceof Error ? sessionError.stack : undefined,
          interviewId,
          hasAgent: !!agent,
          hasRoom: !!ctx.room,
        });
        throw sessionError;
      }

      // Note: The agent will start the conversation via onEnter() method
      // The tag-based system controls interview flow through intent detection

    } catch (error) {
      console.error('❌ [Agent] Interview job failed:', error);
      console.error('❌ [Agent] Job error details:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        interviewId: ctx.room?.name || 'unknown',
        roomName: ctx.room?.name,
      });
      throw error;
    }
  },
});

/**
 * Export the agent definition
 */
export default agent;

/**
 * Start the agent if run directly
 * Usage: node dist/index.js [dev|start]
 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const command = process.argv[2] || 'dev';
  const isProduction = command === 'start';

  console.log('🚀 Starting LiveKit Interview Agent...');
  console.log(`📋 Mode: ${isProduction ? 'Production' : 'Development'}`);
  console.log('📋 Environment check:');
  console.log(`   - LIVEKIT_URL: ${process.env.LIVEKIT_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - LIVEKIT_API_KEY: ${process.env.LIVEKIT_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - LIVEKIT_API_SECRET: ${process.env.LIVEKIT_API_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - SERVER_URL: ${process.env.SERVER_URL || 'http://localhost:3001 (default)'}`);
  console.log(`   - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - OPENAI_LLM_MODEL: ${process.env.OPENAI_LLM_MODEL || 'gpt-4o (default)'}`);
  console.log(`   - CARTESIA_API_KEY: ${process.env.CARTESIA_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - CARTESIA_ARUSHI_VOICE_ID: ${process.env.CARTESIA_ARUSHI_VOICE_ID ? '✅ Set' : '⚠️  Using default'}`);
  console.log(`   - DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   - DEEPGRAM_MODEL: ${process.env.DEEPGRAM_MODEL || 'nova-2 (default)'}`);
  console.log('');

  // Get the agent file path
  const agentPath = fileURLToPath(import.meta.url);

  // Create ServerOptions with defaults
  const opts = new ServerOptions({
    agent: agentPath,
    production: isProduction,
    // Use environment variables or defaults
    wsURL: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY,
    apiSecret: process.env.LIVEKIT_API_SECRET,
    logLevel: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  });

  // Start the agent
  console.log('🎬 Starting agent worker...');
  cli.runApp(opts);
}

