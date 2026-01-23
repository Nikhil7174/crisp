/**
 * Interview Agent Class
 * 
 * Main agent class that handles the interview flow and responds to candidate input.
 * Uses tag-based intent detection for interview orchestration.
 */

import { voice, llm } from '@livekit/agents';
import { ReadableStream } from 'stream/web';
import { StateProvider } from './state-provider.js';
import { Orchestrator } from './orchestrator.js';
import { detectJailbreak, getSafeResponse } from './security/jailbreak-detector.js';
import { extractChunkText, cleanResponseText } from '../../utils/text-processing.js';
import { getDepthContextPrompt } from '../../prompts/eachTurnPrompt.js';

/**
 * User data stored in the agent session
 */
export interface InterviewSessionData {
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
export class InterviewAgent extends voice.Agent<InterviewSessionData> {
  constructor(
    instructions: string,
    orchestrator: Orchestrator,
    stateProvider: StateProvider,
    role: string = 'Backend Engineer'
  ) {
    // TAG-BASED INTENT DETECTION - No tool calling
    super({
      instructions,
    });

    console.log('InterviewAgent constructor called - TAG-BASED INTENT DETECTION');
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

        const depthContext = getDepthContextPrompt(
          actualFollowUpDepth,
          actualHintDepth,
          actualClarificationDepth,
          actualGenericDepth
        );


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
                  const cleaned = cleanResponseText(buffer);
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
                  const cleanedBuffer = buffer ? cleanResponseText(buffer) : '';
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
              const chunkText = extractChunkText(value);
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
    const cleanedText = cleanResponseText(text);

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

