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
import * as silero from '@livekit/agents-plugin-silero';
import { llm } from '@livekit/agents';
import { ReadableStream } from 'stream/web';
import type { AudioFrame } from '@livekit/rtc-node';
import { z } from 'zod';
import { StateProvider } from './services/interview/state-provider.js';
import { Orchestrator } from './services/interview/orchestrator.js';
import { createToolExecutors } from './services/interview/tools/tool-executors.js';

/**
 * API response type for questions endpoint
 */
interface QuestionsAPIResponse {
  success: boolean;
  questions?: any[];
  codingProblems?: any[];
  sessionId?: string;
  maxTheoreticalQuestions?: number;
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
  toolExecutors?: Record<string, (params: any) => Promise<any>>;
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
    stateProvider: StateProvider
  ) {
    // Create function tools using llm.tool() - these are called by LLM
    // Tool executors are accessed from session userData in execute functions
    const tools: Record<string, llm.FunctionTool<any, any, any>> = {
      // LLM can call this to evaluate answers
      evaluateAnswer: llm.tool({
        description: 'Evaluates the candidate\'s answer to a theoretical question. Use this when the candidate provides a substantive answer.',
        parameters: z.object({
          answer: z.string().describe('The candidate\'s complete answer to evaluate'),
        }),
        execute: async ({ answer }, { ctx }) => {
          const sessionData = ctx.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.['evaluate_answer'];
          if (!executor) throw new llm.ToolError('evaluate_answer executor not found');
          const result = await executor({ answer });
          
          // NODE-DRIVEN: After evaluation, Node decides next question
          if (result.data?.shouldAskNextQuestion) {
            const { orchestrator } = sessionData;
            const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();
            
            let messageToSpeak = result.message;
            
            if (shouldMoveToCoding) {
              orchestrator.startCodingPhase();
              const { problem } = orchestrator.presentNextProblem();
              if (problem) {
                messageToSpeak = `${result.message} Great job on the theoretical questions! Now let's move to the coding section. Here's your coding problem: ${problem.title}. ${problem.description}`;
              }
            } else if (question) {
              messageToSpeak = `${result.message} ${question.question}`;
            } else {
              messageToSpeak = `${result.message} That completes all the questions.`;
            }
            
            // NODE-DRIVEN: Set flag so llmNode can inject this message directly
            // This prevents LLM from generating additional text
            (sessionData as any).nodeHandledEvaluation = true;
            (sessionData as any).nodeInjectedMessage = messageToSpeak;
            
            // Return only evaluation message - Node will inject full message in llmNode
            return result.message;
          }
          
          return result.message || JSON.stringify(result);
        },
      }),

      // LLM can call this to provide hints
      provideHint: llm.tool({
        description: 'Provides a hint to help the candidate with the current question or coding problem. Use this when the candidate explicitly asks for help.',
        parameters: z.object({
          context: z.string().optional().describe('Brief context about what the candidate is struggling with'),
        }),
        execute: async ({ context }, { ctx }) => {
          const sessionData = ctx.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.['provide_hint'];
          if (!executor) throw new llm.ToolError('provide_hint executor not found');
          const result = await executor({ context });
          return result.message || JSON.stringify(result);
        },
      }),

      // LLM can call this to provide clarifications
      provideClarification: llm.tool({
        description: 'Clarifies the current question or problem when the candidate asks for clarification.',
        parameters: z.object({
          clarificationRequest: z.string().describe('What the candidate is asking to be clarified'),
        }),
        execute: async ({ clarificationRequest }, { ctx }) => {
          const sessionData = ctx.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.['provide_clarification'];
          if (!executor) throw new llm.ToolError('provide_clarification executor not found');
          const result = await executor({ clarification_request: clarificationRequest });
          return result.message || JSON.stringify(result);
        },
      }),

      // LLM can call this to analyze code
      analyzeCode: llm.tool({
        description: 'Analyzes the candidate\'s code progress for the current coding problem.',
        parameters: z.object({
          code: z.string().describe('The candidate\'s current code to analyze'),
          question: z.string().optional().describe('Specific question the candidate has about their code'),
        }),
        execute: async ({ code, question }, { ctx }) => {
          const sessionData = ctx.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.['analyze_code'];
          if (!executor) throw new llm.ToolError('analyze_code executor not found');
          const result = await executor({ code, question });
          return result.message || JSON.stringify(result);
        },
      }),

      // LLM can call this to submit solution
      submitSolution: llm.tool({
        description: 'Submits and evaluates the candidate\'s final solution for the current coding problem.',
        parameters: z.object({
          code: z.string().describe('The candidate\'s final code solution'),
          explanation: z.string().optional().describe('The candidate\'s explanation of their approach'),
        }),
        execute: async ({ code, explanation }, { ctx }) => {
          const sessionData = ctx.userData as InterviewSessionData & { toolExecutors?: Record<string, (params: any) => Promise<any>> };
          const executor = sessionData.toolExecutors?.['submit_solution'];
          if (!executor) throw new llm.ToolError('submit_solution executor not found');
          const result = await executor({ code, explanation });
          return result.message || JSON.stringify(result);
        },
      }),
    };

    super({
      instructions,
      tools, // Pass function tools to agent constructor
    });
    
    this.questions = questions;
    this.codingProblems = codingProblems;
    this.orchestrator = orchestrator;
    this.stateProvider = stateProvider;
    this.interviewId = interviewId;
    
    console.log('InterviewAgent constructor called with function tools');
    console.log('Function tools available:', Object.keys(tools).join(', '));
  }

  /**
   * Function tools handle themselves via llm.tool() execute functions
   * This method is kept for backward compatibility but shouldn't be called
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
   * NODE-DRIVEN FLOW CONTROL
   * Called when user finishes speaking, BEFORE LLM processes
   * Node detects intent and controls flow, LLM processes with function tools
   */
  async onUserTurnCompleted(
    turnCtx: llm.ChatContext,
    newMessage: llm.ChatMessage
  ): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('=== onUserTurnCompleted - NODE DETECTS INTENT ===');
    console.log('User message:', newMessage.textContent);
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('='.repeat(80) + '\n');
    
    const { interviewId, stateProvider, orchestrator } = this.session.userData;
    const state = stateProvider.getState(interviewId);
    
    if (!state) {
      console.error('❌ [onUserTurnCompleted] No state found');
      return;
    }
    
    const userText = newMessage.textContent?.toLowerCase() || '';
    console.log('📊 Current State:', state.currentState);
    console.log('📍 Current Question Index:', state.currentQuestionIndex);
    console.log('🎯 Current Question ID:', state.currentQuestionId || 'N/A');
    
    // NODE DECIDES: Detect user intent
    const isSkip = userText.includes('skip') || 
                   userText.includes("i don't know") || 
                   userText.includes("don't know") ||
                   userText.includes('next question') ||
                   userText.includes('move on');
    
    if (isSkip && state.currentState === 'theoretical') {
      // NODE DECIDES: Skip current question - handle directly
      console.log('🎯 [Node] Detected skip intent - handling skip directly');
      
      // Call orchestrator to skip (updates state)
      const { interviewId } = this.session.userData;
      const toolExecutors = (this.session.userData as any).toolExecutors;
      if (toolExecutors && toolExecutors['skip_question']) {
        const skipResult = await toolExecutors['skip_question']({ reason: 'User requested skip' });
        
        // NODE DECIDES: Get next question
        const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();
        
        let messageToSpeak = skipResult.message;
        
        if (shouldMoveToCoding) {
          messageToSpeak = `${skipResult.message} Great job on the theoretical questions! Now let's move to the coding section.`;
          orchestrator.startCodingPhase();
          const { problem } = orchestrator.presentNextProblem();
          if (problem) {
            messageToSpeak += ` Here's your coding problem: ${problem.title}. ${problem.description}`;
          }
        } else if (question) {
          messageToSpeak = `${skipResult.message} ${question.question}`;
        } else {
          messageToSpeak = `${skipResult.message} That completes all the questions.`;
        }
        
        // BEST PRACTICE: Inject response into turnCtx - framework will speak it automatically
        console.log('🗣️ [Node] Injecting skip message + next question into turnCtx');
        console.log('📝 Message:', messageToSpeak.substring(0, 100) + '...');
        
        turnCtx.addMessage({
          role: 'assistant',
          content: messageToSpeak
        });
        
        // BEST PRACTICE: Prevent LLM from generating by clearing user message
        // According to LiveKit docs, this prevents LLM from processing
        newMessage.content = [];
        
        // Mark that Node handled this - llmNode will check this
        (this.session.userData as any).nodeHandledSkip = true;
        (this.session.userData as any).nodeInjectedMessage = messageToSpeak;
        
        // Persist context changes (this makes the injected message part of chat history)
        await this.updateChatCtx(turnCtx);
        
        // Return early - framework will use the injected message
        return;
      }
    } else {
      // NODE DECIDES: Let LLM process with function tools
      // LLM will call appropriate function tool (evaluateAnswer, provideHint, etc.)
      console.log('🎯 [Node] User intent detected - LLM will process with function tools');
      // LLM will automatically call the appropriate function tool based on user input
      
      // Persist chat context changes (for non-skip scenarios)
      await this.updateChatCtx(turnCtx);
    }
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
   * Override llmNode to ensure injected messages from Node are used
   * When Node injects a message in onUserTurnCompleted, we should use it
   * This follows LiveKit best practices for node-driven flow control
   */
  async llmNode(
    chatCtx: llm.ChatContext,
    toolCtx: llm.ToolContext,
    modelSettings: voice.ModelSettings
  ): Promise<ReadableStream<llm.ChatChunk | string> | null> {
    // Check if Node already handled this (e.g., for skip or evaluation scenarios)
    const sessionData = this.session.userData as InterviewSessionData & { 
      nodeHandledSkip?: boolean;
      nodeHandledEvaluation?: boolean;
      nodeInjectedMessage?: string;
    };
    
    if ((sessionData.nodeHandledSkip || sessionData.nodeHandledEvaluation) && sessionData.nodeInjectedMessage) {
      const scenario = sessionData.nodeHandledSkip ? 'skip' : 'evaluation';
      console.log(`🎯 [llmNode] Node handled ${scenario} - using injected message directly`);
      console.log('📝 Injected message:', sessionData.nodeInjectedMessage.substring(0, 100) + '...');
      
      // Add injected message to chat context so LLM has it in history
      chatCtx.addMessage({
        role: 'assistant',
        content: sessionData.nodeInjectedMessage
      });
      
      // Clear the flags so they don't affect next turn
      sessionData.nodeHandledSkip = false;
      sessionData.nodeHandledEvaluation = false;
      const injectedMessage = sessionData.nodeInjectedMessage;
      sessionData.nodeInjectedMessage = undefined;
      
      // Return the injected message as a stream - framework will speak it
      return new ReadableStream({
        start(controller) {
          controller.enqueue(injectedMessage);
          controller.close();
        }
      });
    }
    
    // Otherwise, use default LLM processing with function tools
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
      let questionsData: { questions: any[]; codingProblems: any[]; maxTheoreticalQuestions?: number } | undefined;
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
          };
          console.log(`✅ [Agent] Successfully fetched ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems from API`);
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

      // Create tool executors with access to orchestrator and state
      const toolExecutors = createToolExecutors(
        orchestrator,
        stateProvider
      );
      
      // Get current question/problem for context
      const currentState = stateProvider.getState(interviewId);
      // Note: questions are stored separately, not in state
      
      // Build instructions for the LLM (NODE-DRIVEN ARCHITECTURE)
      const phase = state?.currentState || 'idle';
      const instructions = `You are a technical interviewer assistant. Your role is to provide evaluation, hints, and clarifications.

NODE-DRIVEN ARCHITECTURE:
- The Node (code) controls interview flow - you do NOT control which question comes next
- You CANNOT call ask_next_question or skip_question - these are controlled by the Node
- The Node will automatically move to the next question after evaluation

YOUR RESPONSIBILITIES (use tools for these):
1. When candidate provides an answer:
   - Call evaluate_answer tool with their answer
   - Provide detailed, constructive feedback
   - The Node will handle moving to the next question

2. When candidate asks for help:
   - Call provide_hint tool
   - Provide helpful hints without giving away the answer

3. When candidate asks for clarification:
   - Call provide_clarification tool
   - Clarify the question or problem

4. For coding problems:
   - Call analyze_code tool to review their code
   - Call submit_solution tool when they're ready to submit

CRITICAL RULES:
- NEVER try to move to the next question - the Node handles this
- NEVER say "Let's move on" or "Next question" - the Node will do this automatically
- NEVER generate questions - the Node provides preset questions
- Focus on providing quality evaluation, hints, and clarifications
- Be concise and professional in your responses`;

      console.log('\n' + '📜'.repeat(40));
      console.log('📜 [LLM Instructions] Instructions being sent to LLM:');
      console.log('📜'.repeat(40));
      console.log(instructions);
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

      // Create agent with questions and tool executors
      const agent = new InterviewAgent(
        interviewId,
        instructions,
        questionsData.questions || [],
        questionsData.codingProblems || [],
        orchestrator,
        stateProvider
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
      
      const llmWithTools = new openai.LLM({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        // No provider tools - function tools are in agent constructor
      });
      
      console.log('🔧 [LLM Config] Using gpt-4o with function tools');
      console.log('   ✅ FUNCTION TOOLS: Tools defined with llm.tool() in agent constructor');
      console.log('   ✅ NODE-DRIVEN ARCHITECTURE: Node controls flow, LLM handles evaluation/hints');
      console.log('   ✅ LLM can use: evaluateAnswer, provideHint, provideClarification, analyzeCode, submitSolution');
      
      const session = new voice.AgentSession<InterviewSessionData>({
        vad,
        stt: new openai.STT({
          model: 'whisper-1',
        }),
        llm: llmWithTools,
        tts: new openai.TTS({
          model: 'tts-1',
          voice: 'alloy',
        }),
        userData: {
          interviewId: interviewId as string,
          orchestrator,
          stateProvider,
          currentPhase: (state?.currentState || 'idle') as 'theoretical' | 'coding' | 'completed',
          sendQuestionToUI,
          questions: questionsData?.questions || [],
          codingProblems: questionsData?.codingProblems || [],
          toolExecutors, // Add tool executors for Node to use
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

      console.log('✅ [Agent] Session created with function tools: evaluateAnswer, provideHint, provideClarification, analyzeCode, submitSolution');
      console.log('⚠️  [Agent] If tools are not being called, check:');
      console.log('   1. Are tools properly configured in LLM?');
      console.log('   2. Are instructions clear about using tools?');
      console.log('   3. Is the LLM model supporting function calling?');

      // Handle tool calls at session level (in addition to Agent.onToolCall)
      // @ts-ignore - toolCall event might not be in types
      session.on('toolCall', async (toolCall: any) => {
        console.log('\n' + '🎯'.repeat(40));
        console.log('🎯 [Session Tool Call] Tool call received at SESSION level');
        console.log('🎯'.repeat(40));
        console.log(`   Tool: ${toolCall.name}`);
        console.log(`   Arguments:`, JSON.stringify(toolCall.arguments, null, 2));
        console.log('🎯'.repeat(40) + '\n');
        
        // Delegate to agent's onToolCall method
        if (agent.onToolCall) {
          return await agent.onToolCall(toolCall);
        }
      });

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

