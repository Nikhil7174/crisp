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
import { getInterviewContextPrompt } from '../../prompts/contextPrompts.js';
import { getDSASystemMessage } from '../../prompts/dsaSystemPrompt.js';

/**
 * User data stored in the agent session
 */
export interface InterviewSessionData {
  interviewId: string;
  orchestrator: Orchestrator;
  stateProvider: StateProvider;
  currentPhase: 'theoretical' | 'coding' | 'completed';
  sendQuestionToUI?: (question: any, questionIndex: number, questionType: 'theoretical' | 'coding') => Promise<void>;
  sendEventToUI?: (eventType: string, data?: any) => Promise<void>;
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
      // CHECK: Are we starting with Theoretical or Coding?
      // Some interviews might skip theoretical or are resuming
      const { orchestrator, stateProvider, interviewId } = this.session.userData;
      const state = stateProvider.getState(interviewId);

      let shouldStartCoding = false;
      if (state && state.currentState === 'coding') {
        shouldStartCoding = true;
      } else {
        // Default to theoretical flow
        orchestrator.startTheoreticalQuestions();
        const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();

        if (shouldMoveToCoding) {
          shouldStartCoding = true;
        } else if (question) {
          const { sendQuestionToUI } = this.session.userData;
          if (sendQuestionToUI) {
            const state = stateProvider.getState(interviewId);
            const questionIndex = Math.max((state?.currentQuestionIndex || 1) - 1, 0);
            await sendQuestionToUI(question, questionIndex, 'theoretical');
          }
          // Store question in conversation history
          stateProvider.addConversationMessage(interviewId, {
            role: 'assistant',
            content: question.question,
            metadata: { type: 'question', section: 'theoretical', questionId: question.id, phase: 'theoretical' },
          });
          console.log('📝 [Agent] Speaking first question:', question.question);
          await this.session.say(question.question);
        }
      }

      // HANDLE CODING START (Direct Entry)
      if (shouldStartCoding) {
        orchestrator.startCodingPhase();
        const { problem } = orchestrator.presentNextProblem();

        if (problem) {
          const { sendQuestionToUI } = this.session.userData;
          // Send to UI
          if (sendQuestionToUI) {
            const state = stateProvider.getState(interviewId);
            const problemIndex = state?.currentProblemIndex || 0;
            await sendQuestionToUI(problem, problemIndex, 'coding');
          }

          // Speak intro
          const intro = `Let's move straight to the coding section. Here's a problem for you to solve.`;
          // Store coding intro in conversation history
          stateProvider.addConversationMessage(interviewId, {
            role: 'assistant',
            content: intro,
            metadata: { type: 'coding_intro', section: 'coding', problemId: problem.id, phase: 'coding' },
          });
          // Store the problem description in conversation history for LLM evaluation
          stateProvider.addConversationMessage(interviewId, {
            role: 'assistant',
            content: `Coding Problem: ${problem.title}\n\nDescription: ${problem.description}\n\nConstraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}`,
            metadata: { type: 'problem', section: 'coding', problemId: problem.id, title: problem.title, phase: 'coding' },
          });
          await this.session.say(intro);

          // INJECT PROBLEM CONTEXT (Hidden)
          // This handles the "Coding Q-1" case correctly
          const problemContextMessage = `
[SYSTEM_INJECTION_DO_NOT_SPEAK]
Here is the coding problem I need to solve:
Title: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}
Examples: ${problem.examples ? JSON.stringify(problem.examples) : 'None'}
`;
          // We can't access turnCtx here easily as we are in onEnter (no chat context yet?).
          // But wait! onEnter doesn't provide a turnCtx. 
          // However, we can add it to the conversation history via stateProvider so it's there for the next turn.
          // OR better: Just rely on the fact that `onUserTurnCompleted` will pull context from state? 
          // NO, `onUserTurnCompleted` injects *system* context. The *problem description* needs to be in history.

          // We can manually add a "user" message to the session's chat context if available?
          // LiveKit agents 0.8+ doesn't expose a global chat context easily outside a turn.
          // WORKAROUND: We can just let the ephemeral system context handle it for the very first turn?
          // OR rely on the fact that the USER will speak first after this intro.
          // When the user speaks, `onUserTurnCompleted` runs.
          // BUT `onUserTurnCompleted` only runs *after* the user turn. The LLM needs this context *during* its response?
          // Wait, LLM responds to User.

          // If we are here, Agent speaks -> User speaks -> Agent responds.
          // When User speaks, we enter `onUserTurnCompleted`.
          // We can inject the problem context THERE if we detect we just started coding phase?

          // ACTUALLY: We can just add it to stateProvider conversation history? 
          // The LLM context is built from that history usually.
          // But LiveKit Agent builds context from its own internal history.

          // Use `this.session.chatCtx` if it exists (it might not be public).
          // Actually, `onEnter` initializes the session. 

          // ALTERNATIVE: Use `this.session.say` with hidden text? No.

          // Let's use `stateProvider` to store this "pending injection" and handle it in `onUserTurnCompleted`
          // OR just rely on the fact that for the FIRST coding turn, the user will probably ask "Can you repeat?" or just start coding.
          // If they start coding, we add their code.

          // BETTER FIX:
          // Since `startCodingPhase()` sets the state to 'coding', `onUserTurnCompleted` will run when the user replies.
          // We can rely on `onUserTurnCompleted` to inject the *Unified Context*.
          // BUT we removed the problem description from valid context! We need it in history!

          // We need to inject it as a "fake" user message.
          // Since we can't easily access the ChatContext in onEnter, we will store a flag in session data.
          (this.session.userData as any).pendingProblemInjection = problem;
        }
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

    // CHECK FOR PENDING PROBLEM INJECTION (From onEnter)
    // If we started directly in coding phase, we need to inject the problem context now
    const pendingProblem = (this.session.userData as any).pendingProblemInjection;
    if (pendingProblem) {
      // HOT SWAP: Inject DSA system prompt FIRST to override theoretical tags (only once)
      if (!(this.session.userData as any).dsaPromptInjected) {
        const dsaSystemPrompt = getDSASystemMessage(role);
        turnCtx.addMessage({
          role: 'system',
          content: dsaSystemPrompt
        });
        (this.session.userData as any).dsaPromptInjected = true;
        console.log('🔄 [onUserTurnCompleted] HOT SWAPPED to DSA system prompt (from pending injection)');
      }

      // THEN inject problem context
      const problemContextMessage = `
[SYSTEM_INJECTION_DO_NOT_SPEAK]
Here is the coding problem I need to solve:
Title: ${pendingProblem.title}
Description: ${pendingProblem.description}
Constraints: ${pendingProblem.constraints ? pendingProblem.constraints.join(', ') : 'None'}
Examples: ${pendingProblem.examples ? JSON.stringify(pendingProblem.examples) : 'None'}
`;
      turnCtx.addMessage({
        role: 'user',
        content: problemContextMessage
      });
      console.log('📝 [onUserTurnCompleted] Injected PENDING coding problem context (from onEnter)');

      // Clear flag
      (this.session.userData as any).pendingProblemInjection = undefined;
    }

    const userText = newMessage.textContent || '';
    const userTextLower = userText.toLowerCase();

    // Store user message in conversation history
    if (userText && userText.trim()) {
      // Determine section based on current state
      const section = (state.currentState === 'coding' || state.currentState === 'coding_problem' || state.currentState === 'coding_intro')
        ? 'coding'
        : 'theoretical';

      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: userText,
        metadata: {
          timestamp: Date.now(),
          section: section,
          type: 'answer',
          questionId: state.currentQuestionId,
          problemId: state.currentProblemId,
          phase: state.currentState
        },
      });
      console.log('📝 [onUserTurnCompleted] Stored user message in conversation history');
    }

    console.log('📊 Current State:', state.currentState);
    // Log correct ID/index based on current phase
    if (state.currentState === 'coding' || state.currentState === 'coding_problem' || state.currentState === 'coding_intro') {
      console.log('📍 Current Problem Index:', state.currentProblemIndex);
      console.log('🎯 Current Problem ID:', state.currentProblemId || 'N/A');
    } else {
      console.log('📍 Current Question Index:', state.currentQuestionIndex);
      console.log('🎯 Current Question ID:', state.currentQuestionId || 'N/A');
    }

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
        orchestrator.startCodingPhase();
        const { problem } = orchestrator.presentNextProblem();
        if (problem) {
          // Agent should not speak the full coding problem, just announce it
          messageToSpeak = `${skipMessage} Great job on the theoretical questions! Now let's move to the coding section. Here's a coding question, try to solve it and explain your approach.`;

          // Send coding problem to UI via data channel
          const { sendQuestionToUI } = this.session.userData;
          if (sendQuestionToUI) {
            const state = stateProvider.getState(interviewId);
            const problemIndex = state?.currentProblemIndex || 0;
            await sendQuestionToUI(problem, problemIndex, 'coding');
          }

          // Store the problem description in conversation history for LLM evaluation
          stateProvider.addConversationMessage(interviewId, {
            role: 'assistant',
            content: `Coding Problem: ${problem.title}\n\nDescription: ${problem.description}\n\nConstraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}`,
            metadata: { type: 'problem', section: 'coding', problemId: problem.id, title: problem.title, phase: 'coding' },
          });

          // HOT SWAP: Inject DSA system prompt FIRST to override theoretical tags (only once)
          if (!(this.session.userData as any).dsaPromptInjected) {
            const dsaSystemPrompt = getDSASystemMessage(role);
            turnCtx.addMessage({
              role: 'system',
              content: dsaSystemPrompt
            });
            (this.session.userData as any).dsaPromptInjected = true;
            console.log('🔄 [onUserTurnCompleted] HOT SWAPPED to DSA system prompt');
          }

          // THEN inject problem context
          const problemContextMessage = `
[SYSTEM_INJECTION_DO_NOT_SPEAK]
Here is the coding problem I need to solve:
Title: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}
Examples: ${problem.examples ? JSON.stringify(problem.examples) : 'None'}
`;
          turnCtx.addMessage({
            role: 'user',
            content: problemContextMessage
          });
          console.log('📝 [onUserTurnCompleted] Injected coding problem into ChatContext (hidden from speech)');
        } else if (question) {
          messageToSpeak = `${skipMessage} Great job on the theoretical questions! Now let's move to the coding section.`;
        }
      } else if (question) {
        messageToSpeak = `${skipMessage} ${question.question}`;
        const { sendQuestionToUI } = this.session.userData;
        if (sendQuestionToUI) {
          const state = stateProvider.getState(interviewId);
          const questionIndex = Math.max((state?.currentQuestionIndex || 1) - 1, 0);
          await sendQuestionToUI(question, questionIndex, 'theoretical');
          // no-op
        }
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

    // UNIFIED CONTEXT INJECTION
    // Replace separate 'theoretical' and 'coding' blocks with single unified call

    // CODE INJECTION REDUNDANCY FIXED:
    // We used to inject code as a user message here, but it's now handled by the System Context Prompt.
    // See getInterviewContextPrompt -> getDSADepthContextPrompt


    // Now inject the system context (Theoretical or DSA)
    // Force a fresh read of the state in case it was updated
    const freshState = stateProvider.getState(interviewId);
    if (freshState) {
      const currentCode = freshState.currentCode || undefined;
      console.log(`🔍 [Code Check] currentCode in State: ${currentCode ? currentCode.length + ' chars' : 'UNDEFINED/NULL'}`);

      const contextPrompt = getInterviewContextPrompt(
        freshState,
        stateProvider,
        orchestrator,
        currentCode
      );

      if (contextPrompt) {
        turnCtx.addMessage({
          role: 'system',
          content: `\n\n${contextPrompt}`,
        });

        console.log(`📊 [onUserTurnCompleted] Injected Unified Context for state: ${freshState.currentState}`);
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

          let streamClosed = false;
          const safeEnqueue = (text: string) => {
            if (!text || streamClosed) return;
            try {
              controller.enqueue(text);
            } catch (err) {
              streamClosed = true;
              console.warn('⚠️ [llmNode] Attempted to enqueue after close, skipping', err);
            }
          };

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
                  safeEnqueue(cleaned);
                }

                // Check if tag was missing and inject it into chat context
                if (!tagFound) {
                  console.error('🚨🚨🚨 [llmNode] CRITICAL: LLM response missing tag! Injecting fallback tag into chat context.');

                  const { stateProvider, interviewId } = agent.session.userData;
                  const state = stateProvider.getState(interviewId);

                  let fallbackTag = 'OFFER_CHOICE'; // Default fallback

                  // Use helper to get correct tracking ID based on phase
                  const trackingId = stateProvider.getCurrentTrackingId(interviewId);
                  if (trackingId) {
                    const hintDepth = stateProvider.getHintDepth(interviewId, trackingId);
                    const clarificationDepth = stateProvider.getClarificationDepth(interviewId, trackingId);
                    const genericDepth = stateProvider.getGenericDepth(interviewId, trackingId);
                    const followUpDepth = stateProvider.getFollowUpDepth(interviewId, trackingId);

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
                        // Agent should not speak the full coding problem, just announce it
                        responseAppendix = ` Great job on the theoretical questions! Now let's move to the coding section. Here's a coding question, try to solve it and explain your approach.`;

                        // Send coding problem to UI via data channel
                        const { sendQuestionToUI } = agent.session.userData;
                        if (sendQuestionToUI) {
                          const state = stateProvider.getState(interviewId);
                          const problemIndex = state?.currentProblemIndex || 0;
                          await sendQuestionToUI(problem, problemIndex, 'coding');
                        }

                        // Store the problem description in conversation history for LLM evaluation
                        stateProvider.addConversationMessage(interviewId, {
                          role: 'assistant',
                          content: `Coding Problem: ${problem.title}\n\nDescription: ${problem.description}\n\nConstraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}`,
                          metadata: { type: 'problem', section: 'coding', problemId: problem.id, title: problem.title, phase: 'coding' },
                        });

                        // HOT SWAP: Inject DSA system prompt FIRST to override theoretical tags (only once)
                        if (!(agent.session.userData as any).dsaPromptInjected) {
                          const { role } = agent.session.userData;
                          const dsaSystemPrompt = getDSASystemMessage(role || 'Backend Engineer');
                          chatCtx.addMessage({
                            role: 'system',
                            content: dsaSystemPrompt
                          });
                          (agent.session.userData as any).dsaPromptInjected = true;
                          console.log('🔄 [llmNode] HOT SWAPPED to DSA system prompt');
                        }

                        // THEN inject problem context
                        const problemContextMessage = `
[SYSTEM_INJECTION_DO_NOT_SPEAK]
Here is the coding problem I need to solve:
Title: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}
Examples: ${problem.examples ? JSON.stringify(problem.examples) : 'None'}
`;
                        chatCtx.addMessage({
                          role: 'user',
                          content: problemContextMessage
                        });
                        console.log('📝 [llmNode] Injected coding problem into ChatContext (hidden from speech)');
                      } else {
                        responseAppendix = ' That completes the interview. Thank you!';
                      }
                    } else if (question) {
                      // Next theoretical question
                      responseAppendix = ` ${question.question}`;
                      console.log('📝 [llmNode] Next question from orchestrator (appended):', question.question);
                      const { sendQuestionToUI } = agent.session.userData;
                      if (sendQuestionToUI) {
                        const state = stateProvider.getState(interviewId);
                        const questionIndex = Math.max((state?.currentQuestionIndex || 1) - 1, 0);
                        await sendQuestionToUI(question, questionIndex, 'theoretical');
                        // no-op
                      }
                    } else {
                      // No more questions
                      responseAppendix = ' That completes all the questions. Thank you!';
                    }

                    console.log('🗣️ [llmNode] Appending response with next question / transition');
                    console.log('📝 Appendix:', responseAppendix.substring(0, 150) + '...');

                    if (responseAppendix) {
                      safeEnqueue(responseAppendix);
                    }

                    // Clear the pending flag since we handled it here
                    (agent.session.userData as any).pendingNextQuestion = false;
                  } catch (err) {
                    console.error('❌ [llmNode] Failed while appending next question after [NEXT] tag:', err);
                  }
                }

                if (!streamClosed) {
                  streamClosed = true;
                  controller.close();
                }
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
                  const tagMatch = buffer.match(/^\[(FOLLOW_UP|NEXT|HINT|CLARIFY|GENERIC|OFFER_CHOICE|CHECK_CODE|DEBUG_HINT|CONVERSE)\]/);

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

                    // 3. IF [NEXT] OR [CHECK_CODE] TAG DETECTED - HANDLE
                    if (intent === 'NEXT' || intent === 'CHECK_CODE') {
                      if (nextTagDetected) {
                        console.log(`⚠️ [llmNode] Duplicate [${intent}] tag ignored`);
                      } else {
                        // CHECK PHASE: If Coding + [NEXT], show modal instead of auto-proceeding
                        const { stateProvider, interviewId } = agent.session.userData;
                        const state = stateProvider.getState(interviewId);

                        const isCodingPhase = state?.currentState === 'coding' || state?.currentState === 'coding_problem';

                        if (intent === 'NEXT' && isCodingPhase) {
                          console.log(`🛡️ [llmNode] [NEXT] tag in CODING phase -> Triggering CONFIRMATION MODAL instead of auto-next`);

                          // Trigger Modal
                          const { sendEventToUI } = agent.session.userData;
                          if (sendEventToUI) {
                            sendEventToUI('show_confirmation_modal', {
                              message: "Are you sure you want to move to the next question?"
                            });
                          }

                          // DO NOT set nextTagDetected = true
                          // This prevents the "appending next question" logic below
                        } else {
                          // Standard behavior (Theoretical [NEXT] or CHECK_CODE)
                          console.log(`🚀 [llmNode] [${intent}] tag detected - will append next question/action after LLM finishes`);
                          nextTagDetected = true;
                        }
                      }
                    }
                  }
                  // If buffer gets too long without a tag, assume no tag and let it go
                  else if (buffer.length > 15) {
                    tagProcessed = true;
                  }
                }

                // Once tag is processed (or ruled out), stream freely
                if (tagProcessed && buffer.length > 0) {
                  safeEnqueue(buffer);
                  buffer = '';
                }
              }
            }
          } catch (error) {
            console.error('Error in LLM stream:', error);
            if (!streamClosed) {
              streamClosed = true;
              controller.error(error);
            }
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

    // Use helper to get correct tracking ID based on phase
    const trackingId = stateProvider.getCurrentTrackingId(interviewId);
    if (!trackingId) return;

    const MAX_DEPTH = 2;

    if (intent === 'FOLLOW_UP') {
      const currentDepth = stateProvider.getFollowUpDepth(interviewId, trackingId);

      // Do not increment beyond max depth, and avoid double-counting in
      // a single turn if something replays the same tag.
      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] FOLLOW_UP ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for ${trackingId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state!.followUpTracker.get(trackingId) || { followUpDepth: 0, maxDepth: MAX_DEPTH };
      tracker.followUpDepth = newDepth;
      state!.followUpTracker.set(trackingId, tracker);

      // Increment global follow-up counter for stats
      stateProvider.incrementFollowUps(interviewId);

      // State is tracked internally, not stored in conversation history
      console.log(`📝 State Updated: Follow-up depth ${newDepth}/2`);
    }
    else if (intent === 'HINT') {
      const currentDepth = stateProvider.getHintDepth(interviewId, trackingId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] HINT ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for ${trackingId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state!.hintTracker.get(trackingId) || { hintDepth: 0, maxDepth: MAX_DEPTH };
      tracker.hintDepth = newDepth;
      state!.hintTracker.set(trackingId, tracker);

      // Increment global hint counter for stats
      stateProvider.incrementHints(interviewId);

      // State is tracked internally, not stored in conversation history
      console.log(`💡 State Updated: Hint depth ${newDepth}/2`);
    }
    else if (intent === 'CLARIFY') {
      const currentDepth = stateProvider.getClarificationDepth(interviewId, trackingId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] CLARIFY ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for ${trackingId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state!.clarificationTracker.get(trackingId) || { clarificationDepth: 0, maxDepth: MAX_DEPTH };
      tracker.clarificationDepth = newDepth;
      state!.clarificationTracker.set(trackingId, tracker);

      // Increment global clarification counter for stats
      stateProvider.incrementClarifications(interviewId);

      // State is tracked internally, not stored in conversation history
      console.log(`❓ State Updated: Clarification depth ${newDepth}/2`);
    }
    else if (intent === 'GENERIC') {
      const currentDepth = stateProvider.getGenericDepth(interviewId, trackingId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] GENERIC ignored: depth already at max (${currentDepth}/${MAX_DEPTH}) for ${trackingId}`
        );
        return;
      }

      const newDepth = currentDepth + 1;

      // Update Tracker
      const tracker = state!.genericTracker.get(trackingId) || { genericDepth: 0, maxDepth: MAX_DEPTH };
      tracker.genericDepth = newDepth;
      state!.genericTracker.set(trackingId, tracker);

      // State is tracked internally, not stored in conversation history
      console.log(`💬 State Updated: Generic depth ${newDepth}/2`);
    }
    else if (intent === 'DEBUG_HINT') {
      // Re-use clarification tracker for debug hints as per prompt logic
      const currentDepth = stateProvider.getClarificationDepth(interviewId, trackingId);

      if (currentDepth >= MAX_DEPTH) {
        console.log(
          `🛑 [handleIntentTag] DEBUG_HINT ignored: depth already at max (${currentDepth}/${MAX_DEPTH})`
        );
        return;
      }

      const newDepth = currentDepth + 1;
      const tracker = state!.clarificationTracker.get(trackingId) || { clarificationDepth: 0, maxDepth: MAX_DEPTH };
      tracker.clarificationDepth = newDepth;
      state!.clarificationTracker.set(trackingId, tracker);

      stateProvider.addConversationMessage(interviewId, {
        role: 'user',
        content: `[SYSTEM] Debug Hint depth (clarification) is now ${newDepth}/2.`
      });
      console.log(`🐞 State Updated: Debug Hint depth ${newDepth}/2`);
    }
    else if (intent === 'NEXT' || intent === 'CHECK_CODE') {
      (this.session.userData as any).pendingNextQuestion = true;
      console.log(`🚀 State Updated: Ready for Next Question/Problem (via ${intent})`);
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

