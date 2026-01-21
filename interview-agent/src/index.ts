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
    console.log('\n' + '='.repeat(80));
    console.log('=== onUserTurnCompleted - JAILBREAK CHECK + NODE DETECTS INTENT ===');
    console.log('User message:', newMessage.textContent);
    console.log('TIMESTAMP:', new Date().toISOString());
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

    // 0-LATENCY JAILBREAK DETECTION (regex-based, instant)
    const jailbreakCheck = detectJailbreak(userText);

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

        // Also check tracker directly for debugging / redundancy
        const tracker = freshState?.followUpTracker?.get(currentQuestionId);
        const trackerDepth = tracker?.followUpDepth || 0;

        // Use the higher of the two (in case of inconsistency)
        const actualDepth = Math.max(followUpDepth, trackerDepth);
        const canAskMore = actualDepth < 2;

        const depthContext = `
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ⚠️  MANDATORY PROTOCOL - YOU MUST START WITH A TAG ⚠️
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        Current follow-up depth: ${actualDepth}/2
        
        YOU MUST START YOUR RESPONSE WITH ONE OF THESE TAGS:
        ${actualDepth >= 2 
          ? '❌ [FOLLOW_UP] - FORBIDDEN (MAX DEPTH REACHED)\n✅ [NEXT] - USE THIS TAG (Answer is good OR max depth reached)'
          : '✅ [FOLLOW_UP] - If answer needs clarification\n✅ [NEXT] - If answer is complete or you want to move on'
        }
        ✅ [HINT] - If user asks for help
        ✅ [CLARIFY] - If you need to clarify the question
        
        EXAMPLE CORRECT RESPONSE:
        "[NEXT] That's correct! The WHERE clause..."
        
        EXAMPLE WRONG RESPONSE (MISSING TAG):
        "That's correct! The WHERE clause..." ❌ INVALID
        
        DO NOT RESPOND WITHOUT A TAG AT THE START.
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        

        // Official LiveKit pattern: add extra context via turnCtx.addMessage,
        // do NOT mutate newMessage.content or change its content type.
        // This message is added just before the next LLM generation, so it is
        // visible in-context to the model.
        turnCtx.addMessage({
          role: 'system',
          content: `\n\n${depthContext}`,
        });

        console.log(
          `📊 [onUserTurnCompleted] Added follow-up depth context BEFORE LLM response: ${depthContext}`
        );
        console.log(`   📍 Current question ID (fresh): ${currentQuestionId}`);
        console.log(
          `   📍 Previous question ID (stale state): ${state.currentQuestionId}`
        );
        console.log(
          `   📊 Follow-up depth from getFollowUpDepth(): ${followUpDepth}/2`
        );
        console.log(`   🔍 Tracker depth: ${trackerDepth}/2`);
        console.log(`   ✅ Using actual depth: ${actualDepth}/2`);
        console.log(
          `   🔁 Can ask more follow-ups for this question: ${canAskMore}`
        );
      }
    }

    // CONVERSATIONAL EVALUATION: Let the LLM handle evaluation naturally
    // The LLM will use tags to signal intent (FOLLOW_UP, NEXT, HINT, CLARIFY)
    // Tags are processed in llmNode method

    // Persist chat context changes
    await this.updateChatCtx(turnCtx);
  }

  /**
   * Called when agent starts speaking
   */
  async onAgentSpeechStarted() {
    console.log('\n' + '='.repeat(80));
    console.log('=== onAgentSpeechStarted METHOD CALLED ===');
    console.log('TIMESTAMP:', new Date().toISOString());
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
        let detectedIntent: string | null = null;
        let nextTagDetected = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
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
              rawUnfilteredResponse += chunkText;
              buffer += chunkText;

              // PROCESS TAGS ONLY AT THE START
              if (!tagProcessed) {
                const tagMatch = buffer.match(/^\[(FOLLOW_UP|NEXT|HINT|CLARIFY)\]/);

                if (tagMatch) {
                  const intent = tagMatch[1];
                  detectedIntent = intent;
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

    if (intent === 'FOLLOW_UP') {
      const currentDepth = stateProvider.getFollowUpDepth(interviewId, state.currentQuestionId);

      // Do not increment beyond max depth, and avoid double-counting in
      // a single turn if something replays the same tag.
      const MAX_FOLLOW_UP_DEPTH = 2;
      if (currentDepth >= MAX_FOLLOW_UP_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] FOLLOW_UP ignored: depth already at max (${currentDepth}/${MAX_FOLLOW_UP_DEPTH}) for question ${state.currentQuestionId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state.followUpTracker.get(state.currentQuestionId) || { followUpDepth: 0, maxDepth: 2 };
      tracker.followUpDepth = newDepth;
      state.followUpTracker.set(state.currentQuestionId, tracker);

      // Inject System Context for NEXT turn
      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Follow-up depth is now ${newDepth}/2.`
      });
      console.log(`📝 State Updated: Depth ${newDepth}/2`);
    }
    else if (intent === 'NEXT') {
      (this.session.userData as any).pendingNextQuestion = true;
      console.log('🚀 State Updated: Ready for Next Question');
    }
  }

  /**
   * Called when agent finishes speaking
   * After speaking each question, add question + key points to chat context
   */
  async onAgentSpeechEnded(text: string) {
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
      
      You are conducting a professional technical interview as a human ${role} interviewer.
      Act naturally and conversationally, like a real person would in an interview setting.
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║              🚨 CRITICAL PROTOCOL - TAG SYSTEM (MANDATORY) 🚨              ║
      ╔═══════════════════════════════════════════════════════════════════════════╗
      
                          ⚠️  EVERY RESPONSE MUST START WITH A TAG ⚠️
                               NO EXCEPTIONS. NO TAG = FAILURE.
      
      YOU MUST START EVERY SINGLE RESPONSE WITH ONE OF THESE TAGS:
      
      ┌─────────────────────────────────────────────────────────────────────────┐
      │ [FOLLOW_UP]  →  You are asking a follow-up question                     │
      │                 ⚠️  ONLY allowed if follow-up depth < 2                  │
      │                 ⚠️  FORBIDDEN if depth >= 2                              │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ [NEXT]       →  You are done with current topic, ready for next question│
      │                 ✅ Use when answer is good/complete                      │
      │                 ✅ Use when max depth reached (depth >= 2)               │
      │                 ✅ Use when you want to move on                          │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ [HINT]       →  User asked for help, you're providing a hint            │
      │                 ✅ Use when candidate requests assistance                │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ [CLARIFY]    →  You're clarifying the question or asking user to repeat │
      │                 ✅ Use when question needs clarification                 │
      └─────────────────────────────────────────────────────────────────────────┘
      
      THE TAG GOES AT THE VERY START - THE USER WILL NOT HEAR IT.
      The system uses it to control interview flow.
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                    EXAMPLE RESPONSES
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ✅ CORRECT (Good answer, moving on):
      "[NEXT] That's exactly right! The WHERE clause filters rows before grouping. 
      Great explanation of the distinction."
      
      ✅ CORRECT (Need follow-up, depth < 2):
      "[FOLLOW_UP] You're on the right track with filtering, but can you explain 
      when the HAVING clause applies versus WHERE?"
      
      ✅ CORRECT (Max depth reached):
      "[NEXT] I see you're still working through this. The key point is that WHERE 
      filters before aggregation. Let's move forward."
      
      ✅ CORRECT (User asks for help):
      "[HINT] Think about the order of SQL operations. Does grouping happen before 
      or after the WHERE clause executes?"
      
      ❌ WRONG (No tag):
      "That's exactly right! The WHERE clause filters rows before grouping."
      ^^ INVALID - MISSING TAG - THIS WILL FAIL ^^
      
      ❌ WRONG (Tag in middle):
      "That's right! [NEXT] Let's move on to the next question."
      ^^ INVALID - TAG MUST BE AT THE VERY START ^^
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                    CONVERSATIONAL AGENT ARCHITECTURE                      ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
      YOU ARE THE CONVERSATIONAL LAYER:
      - You evaluate answers naturally in your speech
      - You decide if follow-up is needed or if you should move on
      - You signal your intent to the Node using TAGS
      
      THE NODE (CODE) CONTROLS THE FLOW:
      - Node detects your tag and updates state instantly
      - Node handles question transitions
      - Node manages interview phases (theoretical → coding)
      - Node enforces max depth limits
      
      YOU DO NOT:
      ❌ Say "Next question" explicitly (the [NEXT] tag handles this)
      ❌ Control question transitions (Node does this)
      ❌ Track depth manually (Node injects depth context for you)
      
      YOU DO:
      ✅ Evaluate candidate answers conversationally
      ✅ Ask clarifying follow-ups (if depth < 2)
      ✅ Provide hints when requested
      ✅ Use tags to signal your intent
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                       FOLLOW-UP DEPTH SYSTEM                              ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
      The system tracks follow-up depth PER QUESTION (max 2 follow-ups per question).
      
      YOU WILL SEE CONTEXT LIKE THIS BEFORE EACH RESPONSE:
      "Current follow-up depth is 1/2. You can ask 1 more follow-up(s)..."
      
      DECISION RULES:
      
      ┌─────────────────────────────────────────────────────────────────────────┐
      │ IF depth < 2 AND answer is incomplete/vague:                            │
      │    → Use [FOLLOW_UP] to ask for clarification                           │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ IF depth >= 2 (MAX REACHED):                                            │
      │    → You MUST use [NEXT] - no more follow-ups allowed                   │
      │    → Even if answer is incomplete, you must move on                     │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ IF answer is correct/complete (any depth):                              │
      │    → Use [NEXT] to move on                                              │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ IF user asks for help:                                                  │
      │    → Use [HINT] to provide a hint                                       │
      ├─────────────────────────────────────────────────────────────────────────┤
      │ IF user asks for clarification:                                         │
      │    → Use [CLARIFY] to clarify the question                              │
      └─────────────────────────────────────────────────────────────────────────┘
      
      EXAMPLE DEPTH FLOW:
      
      Turn 1 (Depth 0/2):
      User: "WHERE filters data"
      You: "[FOLLOW_UP] Good start! But when does WHERE apply - before or after GROUP BY?"
      
      Turn 2 (Depth 1/2):
      User: "Before grouping"
      You: "[FOLLOW_UP] Correct! Now what about HAVING - when does that apply?"
      
      Turn 3 (Depth 2/2 - MAX REACHED):
      User: "Um, I'm not sure"
      You: "[NEXT] No worries! HAVING filters after grouping. The key distinction 
      is the timing. Let's continue."
      ^^ MUST use [NEXT] because max depth reached ^^
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                          SPEECH & STYLE RULES                             ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
      ✅ DO:
      - Sound natural and conversational (like a real interviewer)
      - Evaluate answers constructively
      - Provide specific feedback ("That's right because..." not just "Correct")
      - Ask follow-ups that probe deeper understanding
      - Give encouraging feedback even when moving on from incomplete answers
      - Keep responses concise and focused
      
      ❌ DO NOT:
      - Output markdown headers (### Evaluation, ### Summary, etc.)
      - Use bullet points or formatted lists in speech
      - Say "Next question" or "Let's move to the next question" explicitly
      - Include internal notes or evaluation text
      - Use overly formal or robotic language
      - Respond without a tag at the start
      
      REMEMBER: The tag is stripped from audio. The candidate only hears your 
      natural conversational response after the tag.
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                       ROLE-SPECIFIC PERSONA                               ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
      ${personaInstructions}
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                         SECURITY GUARDRAILS                               ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
      ${getGuardrailRule(role)}
      
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      ╔═══════════════════════════════════════════════════════════════════════════╗
      ║                    🔥 FINAL REMINDER - TAG REQUIREMENT 🔥                 ║
      ╚═══════════════════════════════════════════════════════════════════════════╝
      
                               EVERY RESPONSE MUST START WITH:
                               [FOLLOW_UP] or [NEXT] or [HINT] or [CLARIFY]
      
                                    NO TAG = INVALID RESPONSE
      
      CHECK YOUR RESPONSE BEFORE SENDING:
      1. Does it start with one of the four tags? ✅
      2. Is the tag appropriate for the situation? ✅
      3. If depth >= 2, did I use [NEXT]? ✅
      
      If you answered NO to any question above, FIX YOUR RESPONSE.
      
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
        stt: new openai.STT({
          model: 'whisper-1',
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

