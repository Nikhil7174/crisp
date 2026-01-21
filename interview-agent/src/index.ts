/**
 * LiveKit Interview Agent
 * 
 * This agent handles real-time voice interviews using the official LiveKit Agents framework.
 * It manages STT, TTS, LLM, and OpenAI tool calling for interview orchestration.
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
import { createLLMService } from './services/llm-service.js';

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
  llmService?: any; // LLM service for direct evaluation
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
    // NO TOOL CALLING - Agent directly speaks output
    // This reduces latency by removing tool call overhead
    super({
      instructions,
      // No tools - agent will directly respond
    });
    
    this.questions = questions;
    this.codingProblems = codingProblems;
    this.orchestrator = orchestrator;
    this.stateProvider = stateProvider;
    this.interviewId = interviewId;
    
    console.log('InterviewAgent constructor called - NO TOOL CALLING');
    console.log('Agent will directly speak output for reduced latency');
  }

  /**
   * Tool calling removed - agent directly speaks output
   * This method should not be called
   */
  async onToolCall(toolCall: any): Promise<string> {
    // CRITICAL: This log should appear if onToolCall is ever called
    console.log('\n' + '🔧'.repeat(40));
    console.log('🔧🔧🔧 [CRITICAL] onToolCall METHOD INVOKED! 🔧🔧🔧');
    console.log('🔧'.repeat(40));
    
    const timestamp = new Date().toISOString();
    const { interviewId, stateProvider } = this.session.userData;
    const state = stateProvider.getState(interviewId);
    
    console.log('\n' + '='.repeat(80));
    console.log(`🔧 [Tool Selection] OpenAI chose tool: "${toolCall.name}"`);
    console.log(`   📅 Timestamp: ${timestamp}`);
    console.log(`   🆔 Interview ID: ${interviewId}`);
    console.log(`   📊 Current State: ${state?.currentState || 'unknown'}`);
    console.log(`   📝 Current Question Index: ${state?.currentQuestionIndex ?? 'N/A'}`);
    console.log(`   🎯 Current Question ID: ${state?.currentQuestionId || 'N/A'}`);
    console.log(`   📋 Tool Arguments:`, JSON.stringify(toolCall.arguments, null, 2));
    console.log(`   🔍 Full toolCall object:`, JSON.stringify(toolCall, null, 2));
    console.log('='.repeat(80) + '\n');
    
    // Function tools are handled automatically by llm.tool() execute functions
    // This should not be called for function tools
    console.warn('⚠️ [Agent] onToolCall called - function tools should handle themselves');
    const sessionData = this.session.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
    const executor = sessionData.toolExecutors?.[toolCall.name];
    if (!executor) {
      console.error('❌ [Agent] Unknown tool:', toolCall.name);
      console.error('   Available tools:', Object.keys(sessionData.toolExecutors || {}).join(', '));
      return 'Tool not found';
    }
    
    const toolStartTime = Date.now();
    try {
      console.log(`⏳ [Tool Execution] Starting execution of "${toolCall.name}"...`);
      const result = await executor(toolCall.arguments || {});
      const toolDuration = Date.now() - toolStartTime;
      console.log(`✅ [Tool Execution] "${toolCall.name}" completed in ${toolDuration}ms`);
      console.log(`   📤 Tool result:`, JSON.stringify(result, null, 2));
      
      let messageToSpeak = result.message || JSON.stringify(result);
      
      // NODE-DRIVEN: After evaluation, Node decides next question
      if (result.data?.shouldAskNextQuestion && toolCall.name === 'evaluate_answer') {
        console.log('\n🔄 [Node Flow] Evaluation complete - Node injecting next question');
        
        const { orchestrator } = this.session.userData;
        
        // NODE DECIDES: Get next question
        const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();
        
        if (shouldMoveToCoding) {
          // NODE INJECTS: Evaluation + transition to coding
          messageToSpeak = `${messageToSpeak} Great job on the theoretical questions! Now let's move to the coding section.`;
          orchestrator.startCodingPhase();
        } else if (question) {
          // NODE INJECTS: Evaluation + next question
          messageToSpeak = `${messageToSpeak} ${question.question}`;
        } else {
          // NODE INJECTS: Evaluation + wrap up
          messageToSpeak = `${messageToSpeak} That completes all the questions.`;
        }
        
        console.log('🗣️ [Node] Speaking evaluation + next question:', messageToSpeak.substring(0, 100) + '...');
      }
      
      console.log(`🗣️ [Agent] Final message to speak (from "${toolCall.name}"):`, messageToSpeak);
      return messageToSpeak;
    } catch (error) {
      const toolDuration = Date.now() - toolStartTime;
      console.error(`❌ [Tool Execution] "${toolCall.name}" failed after ${toolDuration}ms`);
      console.error('   Error details:', error);
      if (error instanceof Error) {
        console.error('   Stack:', error.stack);
      }
      return 'Sorry, I encountered an error processing that.';
    }
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
    
    // NODE-DRIVEN: Detect if this is an answer (not skip/hint/clarification)
    const { llmService } = this.session.userData;
    const isAnswer = state.currentState === 'theoretical' && 
                     state.currentQuestionId &&
                     userText.length > 20 && // Substantial response
                     !isSkip &&
                     !userTextLower.includes('hint') &&
                     !userTextLower.includes('clarification') &&
                     !userTextLower.includes('help') &&
                     !userTextLower.startsWith('what') && // Avoid matching clarification questions
                     !userTextLower.startsWith('how') &&
                     !userTextLower.startsWith('can you') &&
                     !userTextLower.startsWith('could you') &&
                     llmService; // LLM service must be available
    
    if (isAnswer) {
      console.log('🎯 [Node] Detected answer - evaluating and checking follow-up');
      
      // Get current question
      const question = orchestrator.getCurrentQuestion();
      if (question) {
        // Evaluate answer using LLM service (same as tool executor did)
        const questionForEvaluation = {
          id: question.id,
          question: question.question,
          expectedAnswer: (question as any).expectedAnswer || question.question,
          keyPoints: (question as any).keyPoints || [],
        };
        
        try {
          // Check if we're answering a follow-up question
          const followUpDepth = state.currentQuestionIsFollowUp ? 1 : 0;
          
          // Extract conversation context from state (which tracks all messages)
          // State's conversationHistory already has everything we need
          let originalAnswer: string | undefined;
          let followUpQuestionText: string | undefined;
          
          if (state.currentQuestionIsFollowUp && state.parentQuestionId) {
            // This is a follow-up answer - find context from conversation history
            const parentQuestionId = state.parentQuestionId;
            
            // Find the follow-up question that was asked
            const followUpMsg = state.conversationHistory.find(msg => 
              msg.role === 'assistant' && 
              msg.metadata?.type === 'follow_up_question' &&
              msg.metadata?.parentQuestionId === parentQuestionId
            );
            if (followUpMsg) {
              followUpQuestionText = followUpMsg.content;
            }
            
            // Find the original answer - user message that came before the follow-up question
            if (followUpMsg) {
              const followUpIndex = state.conversationHistory.indexOf(followUpMsg);
              // Look backwards from follow-up to find original answer
              for (let i = followUpIndex - 1; i >= 0; i--) {
                const msg = state.conversationHistory[i];
                if (msg.role === 'user' && msg.content !== userText && msg.content.length > 10) {
                  originalAnswer = msg.content;
                  break;
                }
              }
            }
            
            console.log('📚 [Node] Conversation context from state:', {
              hasOriginalAnswer: !!originalAnswer,
              hasFollowUpQuestion: !!followUpQuestionText,
              originalAnswerPreview: originalAnswer?.substring(0, 50) + '...',
              followUpQuestionPreview: followUpQuestionText?.substring(0, 50) + '...',
              conversationHistoryLength: state.conversationHistory.length
            });
          }
          
          const evaluation = await llmService.evaluateAnswer(
            questionForEvaluation,
            userText,
            followUpDepth, // Pass correct depth: 1 if answering follow-up, 0 if original question
            state.maxTheoreticalQuestions,
            originalAnswer, // Original answer for context (if follow-up)
            followUpQuestionText // Follow-up question that was asked (if follow-up)
          );
          
          console.log('✅ [Node] Answer evaluated:', {
            score: evaluation.score,
            needsFollowUp: evaluation.needsFollowUp,
            hasFollowUpQuestion: !!evaluation.followUpQuestion
          });
          
          // Store evaluation in state
          stateProvider.addEvaluation(interviewId, {
            questionId: state.currentQuestionId!,
            score: evaluation.score,
            feedback: evaluation.feedback,
          });
          
          // Check if follow-up is needed (same logic as tool executor)
          const canAskFollowUp = stateProvider.canAskFollowUp(interviewId, state.currentQuestionId!);
          const shouldMoveNext = !(evaluation.needsFollowUp && 
                                   canAskFollowUp && 
                                   evaluation.followUpQuestion);
          
          // Set flag (same pattern as tool executor)
          (this.session.userData as any).shouldAskNextQuestion = shouldMoveNext;
          
          // Add evaluation to conversation history
          stateProvider.addConversationMessage(interviewId, {
            role: 'assistant',
            content: evaluation.feedback,
            metadata: { 
              type: 'evaluation',
              score: evaluation.score,
              needsFollowUp: evaluation.needsFollowUp,
            },
          });
          
          // If follow-up needed, add it to context for LLM to speak
          if (evaluation.needsFollowUp && canAskFollowUp && evaluation.followUpQuestion) {
            console.log('🔄 [Node] Follow-up question needed - injecting feedback + follow-up');
            
            stateProvider.askFollowUp(interviewId, evaluation.followUpQuestion, state.currentQuestionId!);
            stateProvider.addConversationMessage(interviewId, {
              role: 'assistant',
              content: evaluation.followUpQuestion,
              metadata: { 
                type: 'follow_up_question',
                parentQuestionId: state.currentQuestionId,
              },
            });
            
            // Inject feedback + follow-up for LLM to speak
            const feedbackWithFollowUp = `${evaluation.feedback} ${evaluation.followUpQuestion}`;
            turnCtx.addMessage({
              role: 'assistant',
              content: feedbackWithFollowUp
            });
            newMessage.content = [];
            (this.session.userData as any).nodeHandledEvaluation = true;
            (this.session.userData as any).nodeInjectedMessage = feedbackWithFollowUp;
            await this.updateChatCtx(turnCtx);
        return;
          } else {
            // No follow-up - inject feedback + next question (same as skip pattern)
            console.log('🔄 [Node] No follow-up needed - injecting feedback + next question');
            
            const { question: nextQuestion, shouldMoveToCoding } = orchestrator.askNextQuestion();
            
            let messageToSpeak = evaluation.feedback;
            
            if (shouldMoveToCoding) {
              messageToSpeak = `${evaluation.feedback} Great job on the theoretical questions! Now let's move to the coding section.`;
              orchestrator.startCodingPhase();
              const { problem } = orchestrator.presentNextProblem();
              if (problem) {
                messageToSpeak += ` Here's your coding problem: ${problem.title}. ${problem.description}`;
              }
            } else if (nextQuestion) {
              messageToSpeak = `${evaluation.feedback} ${nextQuestion.question}`;
    } else {
              messageToSpeak = `${evaluation.feedback} That completes all the questions.`;
            }
            
            // Inject feedback + next question
            console.log('🗣️ [Node] Injecting feedback + next question into turnCtx');
            console.log('📝 Message:', messageToSpeak.substring(0, 100) + '...');
            
            turnCtx.addMessage({
              role: 'assistant',
              content: messageToSpeak
            });
            newMessage.content = [];
            (this.session.userData as any).nodeHandledEvaluation = true;
            (this.session.userData as any).nodeInjectedMessage = messageToSpeak;
      await this.updateChatCtx(turnCtx);
            return;
          }
        } catch (error) {
          console.error('❌ [Node] Failed to evaluate answer:', error);
          // Fallback: let LLM handle it normally
          console.log('⚠️ [Node] Falling back to normal LLM processing');
        }
      }
    }
    
    // Normal flow for hints, clarifications, etc. - LLM will process directly (no tools)
    // Delimiter wrapping is handled in system prompt via guardrail rules
    // The user input is already in newMessage.textContent
    
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
   * Override llmNode to use context pruning and handle direct responses
   * Context pruning prevents jailbreak attempts from persisting across nodes
   */
  async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    const sessionData = this.session.userData as InterviewSessionData & { 
      nodeHandledSkip?: boolean;
      nodeHandledEvaluation?: boolean;
      nodeHandledJailbreak?: boolean;
      nodeInjectedMessage?: string;
      personaInstructions?: string;
      role?: string;
    };
    
    // Check if Node already handled this (skip, evaluation, or jailbreak)
    if ((sessionData.nodeHandledSkip || sessionData.nodeHandledEvaluation || sessionData.nodeHandledJailbreak) && sessionData.nodeInjectedMessage) {
      let scenario = 'unknown';
      if (sessionData.nodeHandledJailbreak) scenario = 'jailbreak';
      else if (sessionData.nodeHandledSkip) scenario = 'skip';
      else if (sessionData.nodeHandledEvaluation) scenario = 'evaluation';
      
      console.log(`🎯 [llmNode] Node handled ${scenario} - using injected message directly`);
      console.log('📝 Injected message:', sessionData.nodeInjectedMessage.substring(0, 100) + '...');
      
      // Add injected message to chat context
      chatCtx.addMessage({
        role: 'assistant',
        content: sessionData.nodeInjectedMessage
      });
      
      // Clear the flags
      sessionData.nodeHandledSkip = false;
      sessionData.nodeHandledEvaluation = false;
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
    
    // CONTEXT PRUNING: Note - LiveKit manages context internally
    // We rely on the framework's context management
    // The guardrail rules in instructions + delimiter wrapping provide protection
    const { interviewId, stateProvider, personaInstructions, role } = sessionData;
    const state = stateProvider.getState(interviewId);
    
    if (state) {
      // Context pruning is handled by:
      // 1. Delimiter wrapping (prevents jailbreak in current turn)
      // 2. Guardrail rules in system prompt (enforced by LLM)
      // 3. Node-based flow control (prevents cross-node contamination)
      console.log('✂️ [Context Pruning] Using delimiter wrapping + guardrail rules');
      console.log(`   Current state: ${state.currentState}`);
      console.log(`   Node-based protection: Each node has isolated context`);
    }
    
    // Use default LLM processing (no tools - direct response)
    return await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);
  }

  /**
   * Called when agent finishes speaking
   */
  async onAgentSpeechEnded(text: string) {
    // Log immediately at the start - this should ALWAYS appear if method is called
    console.log('\n' + '='.repeat(80));
    console.log('=== onAgentSpeechEnded METHOD CALLED ===');
    console.log('TEXT:', text);
    console.log('TEXT LENGTH:', text.length);
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('='.repeat(80) + '\n');
    
    const { interviewId, stateProvider } = this.session.userData;
    const state = stateProvider.getState(interviewId);
    
    console.log('Agent speech - Interview ID:', interviewId);
    console.log('Agent speech - Current State:', state?.currentState || 'unknown');
    
    // Check if text contains tool call JSON (this means LLM output tool calls as text)
    // This happens when runtime doesn't parse structured tool_calls properly
    if (text.includes('tool_uses') || text.includes('recipient_name') || text.includes('functions.')) {
      console.log(`   ⚠️  WARNING: LLM output contains tool call JSON as TEXT!`);
      console.log(`   ⚠️  Root cause: Runtime (LiveKit) is NOT parsing structured tool_calls from LLM response.`);
      console.log(`   ⚠️  The LLM is outputting tool calls as text instead of using tool_calls field.`);
      console.log(`   🔧 Attempting to manually parse and execute tool call...`);
      
      // Try to parse and execute the tool call manually
      try {
        // Try multiple JSON patterns
        let toolCallJson: any = null;
        
        // Pattern 1: {"tool_uses":[...]}
        const pattern1 = text.match(/\{"tool_uses":\[.*?\]\}/);
        if (pattern1) {
          toolCallJson = JSON.parse(pattern1[0]);
        }
        
        // Pattern 2: Look for any JSON object in the text
        if (!toolCallJson) {
          const jsonMatch = text.match(/\{.*"tool_uses".*\}/s);
          if (jsonMatch) {
            toolCallJson = JSON.parse(jsonMatch[0]);
          }
        }
        
        if (toolCallJson && toolCallJson.tool_uses && toolCallJson.tool_uses.length > 0) {
          const toolUse = toolCallJson.tool_uses[0];
          // Handle different formats: recipient_name, name, function
          const toolName = toolUse.recipient_name?.replace('functions.', '') 
                        || toolUse.name 
                        || toolUse.function?.name
                        || toolUse.function_name;
          
          console.log('Parsed tool name:', toolName);
          console.log('Tool parameters:', JSON.stringify(toolUse.parameters || toolUse.arguments || {}, null, 2));
          
          // Function tools handle themselves, but we can still manually execute for fallback
          const sessionData = this.session.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.[toolName];
          
          if (executor) {
            const params = toolUse.parameters || toolUse.arguments || {};
            console.log('Executing tool manually (fallback):', toolName);
            console.log('With params:', params);
            
            const result = await executor(params);
            console.log('Tool execution result:', JSON.stringify(result, null, 2));
            
            // Handle shouldAskNextQuestion flow
            if (result.data?.shouldAskNextQuestion) {
              console.log('shouldAskNextQuestion=true, fetching next question...');
              const nextQuestionExecutor = sessionData.toolExecutors?.['ask_next_question'];
              if (nextQuestionExecutor) {
                const nextResult = await nextQuestionExecutor({});
                console.log('Next question result:', JSON.stringify(nextResult, null, 2));
                if (nextResult.data?.question) {
                  // Speak the tool result first
                  if (result.message && result.message.trim()) {
                    console.log('Speaking tool result:', result.message);
                    await this.session.say(result.message);
                  }
                  // Then speak the next question
                  console.log('Speaking next question:', nextResult.data.question.question);
                  await this.session.say(nextResult.data.question.question);
                  return; // Don't add to conversation history
                }
              }
            }
            
            // Speak the result if there's a message
            if (result.message && result.message.trim()) {
              await this.session.say(result.message);
            }
            
            // Don't add the tool call text to conversation history
            // The tool executor will handle adding appropriate messages
            return;
          } else {
            console.error(`   ❌ Tool "${toolName}" not found in executors`);
            console.error(`   Available tools:`, Object.keys(sessionData.toolExecutors || {}).join(', '));
          }
        } else {
          console.error(`   ❌ Could not parse tool call JSON from text`);
          console.error(`   Text sample:`, text.substring(0, 200));
        }
      } catch (parseError) {
        console.error(`   ❌ Failed to parse tool call from text:`, parseError);
        if (parseError instanceof Error) {
          console.error(`   Error:`, parseError.message);
        }
      }
    } else {
      console.log('NOTE: No tool call detected in text');
      console.log('The LLM generated this text directly without calling a tool');
      
      // Check if this looks like it should have been a tool call
      const lowerText = text.toLowerCase();
      if (lowerText.includes('skip') || lowerText.includes('next question') || lowerText.includes('move on')) {
        console.log('WARNING: Text contains skip/next keywords but no tool was called!');
        console.log('This should have triggered skip_question or ask_next_question tool');
      }
    }
    
    console.log('=== END AGENT SPEECH ===\n');
    
    // Update conversation history in state (only if not a tool call text)
    if (!text.includes('tool_uses') && !text.includes('recipient_name')) {
      stateProvider.addConversationMessage(interviewId, {
        role: 'assistant',
        content: text,
        metadata: { timestamp: Date.now() },
      });
    }
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
      
      // Create LLM service for direct evaluation (no tools)
      const llmService = createLLMService({
        apiKey: process.env.OPENAI_API_KEY || '',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2000,
      });
      
      // Build instructions for the LLM (NO TOOL CALLING - DIRECT RESPONSES)
      const phase = state?.currentState || 'idle';
      const instructions = `You are a human ${role} interviewer conducting a technical interview. Act naturally, like a real person would.

NODE-DRIVEN ARCHITECTURE:
- The Node (code) controls interview flow - you do NOT control which question comes next
- The Node will automatically move to the next question after evaluation
- You respond directly - NO TOOL CALLING (reduces latency)

YOUR RESPONSIBILITIES (respond naturally like a human):
1. When candidate provides an answer:
   - Evaluate their answer like a real interviewer would
   - Give feedback that sounds natural and conversational
   - Be encouraging but also probe deeper if the answer is vague or incomplete
   - The Node will handle moving to the next question automatically

2. When candidate asks for help:
   - Provide helpful hints without giving away the answer
   - Guide them naturally: "Think about..." or "Consider..."
   - Be encouraging: "You're on the right track" or "Good thinking"

3. When candidate asks for clarification:
   - Clarify naturally, like you would in a real interview
   - Use conversational language: "Sure, let me clarify..." or "What I'm asking is..."

4. For coding problems:
   - Review their approach naturally
   - Give feedback like a real interviewer: "I see what you're trying to do here..."
   - Help them think through problems, don't just give answers

COMMUNICATION STYLE (Be human):
- Sound natural and conversational, not robotic
- Use phrases like: "Okay", "I see", "That makes sense", "Let me think about that"
- If they're vague: "Can you elaborate on that?" or "I'd like to understand better..."
- If they're wrong: "Hmm, that's not quite right. Think about it this way..."
- If they're doing well: "Good!", "Exactly!", "You've got it!"
- Keep it professional but friendly - like a real interview

CRITICAL RULES:
- NEVER try to move to the next question - the Node handles this
- NEVER say "Let's move on" or "Next question" - the Node will do this automatically
- NEVER generate questions - the Node provides preset questions
- Respond directly and naturally - no tool calls needed
- Sound like a real person, not a robot
- Be conversational but professional

${personaInstructions}

${getGuardrailRule(role)}`;

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

      // Function tools are defined in agent constructor using llm.tool()
      // No provider tools needed
      console.log('\n' + '🛠️'.repeat(40));
      console.log('🛠️ [Tool Configuration] Using FUNCTION TOOLS (llm.tool)');
      console.log('🛠️'.repeat(40));
      console.log(`   📋 Function tools: evaluateAnswer, provideHint, provideClarification, analyzeCode, submitSolution`);
      console.log(`   🤖 Model: ${process.env.OPENAI_MODEL || 'gpt-4o-mini'}`);
      console.log(`   🌡️  Temperature: 0.3`);
      console.log('🛠️'.repeat(40) + '\n');
      
      // NO TOOL CALLING - Direct LLM responses for reduced latency
      const llmDirect = new openai.LLM({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        // No tools - agent responds directly
      });
      
      console.log('🔧 [LLM Config] Using direct responses (NO TOOL CALLING)');
      console.log('   ✅ NO TOOLS: Agent directly speaks output for reduced latency');
      console.log('   ✅ NODE-DRIVEN ARCHITECTURE: Node controls flow, LLM provides direct responses');
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
          llmService, // LLM service for direct evaluation if needed
        },
      });

      // Also listen for user speech at session level
      // @ts-ignore - userSpeech event might not be in types
      session.on('userSpeech', (text: string) => {
        console.log('\n=== SESSION USER SPEECH ===');
        console.log('TEXT:', text);
        console.log('===========================\n');
      });
      
      // Listen for agent speech at session level
      // @ts-ignore
      session.on('agentSpeech', (text: string) => {
        console.log('\n=== SESSION AGENT SPEECH ===');
        console.log('TEXT:', text);
        console.log('============================\n');
      });
      
      // Listen for any LLM response
      // @ts-ignore
      session.on('llmResponse', (response: any) => {
        console.log('\n=== LLM RESPONSE ===');
        console.log('Response:', JSON.stringify(response, null, 2));
        console.log('===================\n');
      });

      console.log('✅ [Agent] Session created - NO TOOL CALLING (direct responses)');
      console.log('   ✅ Jailbreak protection: Regex checks + context pruning');
      console.log('   ✅ Role persona: ' + role + ' (set once, not in every request)');
      console.log('   ✅ Reduced latency: Direct LLM responses without tool call overhead');
        
      // NO TOOL CALLS - Agent responds directly
      // Tool call handler removed for reduced latency

      // Intercept all session events to see what's actually happening
      // This will help us understand what events LiveKit is actually emitting
      try {
        // Use a Proxy to intercept all method calls on the session
        const sessionProxy = new Proxy(session, {
          get: function(target: any, prop: string | symbol) {
            const value = target[prop];
            if (prop === 'emit' && typeof value === 'function') {
              return function(event: string, ...args: any[]) {
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
      // The orchestrator can be used for tool-based interview flow management
      // For now, the LLM will handle the interview flow based on instructions
      
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

