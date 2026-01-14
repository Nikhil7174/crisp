/**
 * LiveKit Interview Agent
 * 
 * This agent handles real-time voice interviews using the official LiveKit Agents framework.
 * It manages STT, TTS, LLM, and OpenAI tool calling for interview orchestration.
 */

import { defineAgent, JobContext, JobProcess, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { StateProvider } from './services/interview/state-provider.js';
import { Orchestrator } from './services/interview/orchestrator.js';
import { toolDefinitions } from './services/interview/tools/tool-definitions.js';
import { createToolExecutors } from './services/interview/tools/tool-executors.js';

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
}

/**
 * Main Interview Agent
 * Handles the interview flow and responds to candidate input
 */
class InterviewAgent extends voice.Agent<InterviewSessionData> {
  private questions: any[] = [];
  private codingProblems: any[] = [];
  private room: any; // LiveKit Room instance

  constructor(interviewId: string, instructions: string, questions: any[] = [], codingProblems: any[] = []) {
    super({
      instructions,
    });
    this.questions = questions;
    this.codingProblems = codingProblems;
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
    console.log('🎙️ Interview agent entered, starting conversation');
    
    // Send first question to UI if available
    // Use the sendQuestionToUI from userData if available, otherwise use instance method
    const { sendQuestionToUI } = this.session.userData;
    if (this.questions.length > 0 && sendQuestionToUI) {
      try {
        await sendQuestionToUI(this.questions[0], 0, 'theoretical');
      } catch (error) {
        console.error('❌ Failed to send first question via helper:', error);
        // Fallback to instance method
        if (this.room) {
          await this.sendQuestionToUI(this.questions[0], 0, 'theoretical');
        }
      }
    }
    
    // Generate initial greeting and start the interview
    // The LLM will use the instructions provided to conduct the interview
    this.session.generateReply({
      instructions: `Greet the candidate warmly and introduce yourself as their technical interviewer. 
      Then immediately begin the interview by asking the first technical question. 
      Be conversational and professional.`,
    });
  }

  /**
   * Called when the agent exits
   */
  async onExit() {
    console.log('👋 Interview agent exiting');
  }

  /**
   * Called when user speaks
   */
  async onUserSpeech(text: string) {
    console.log('🗣️ Candidate said:', text);
    
    // Update conversation history in state
    const { interviewId, stateProvider } = this.session.userData;
    stateProvider.addConversationMessage(interviewId, {
      role: 'user',
      content: text,
      metadata: { timestamp: Date.now() },
    });
  }

  /**
   * Called when agent starts speaking
   */
  async onAgentSpeechStarted() {
    console.log('🤖 Agent started speaking');
  }

  /**
   * Called when agent finishes speaking
   */
  async onAgentSpeechEnded(text: string) {
    console.log('🤖 Agent said:', text);
    
    // Update conversation history in state
    const { interviewId, stateProvider } = this.session.userData;
    stateProvider.addConversationMessage(interviewId, {
      role: 'assistant',
      content: text,
      metadata: { timestamp: Date.now() },
    });
  }
}

/**
 * Define the agent entry point
 */
export default defineAgent({
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
      
      // Get questions from store (set by controller when spawning worker)
      const questionsData = getInterviewQuestions(interviewId);
      if (!questionsData) {
        console.warn(`⚠️ No questions found for interview ${interviewId}`);
      } else {
        console.log(`📚 Loaded ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems`);
      }
      
      // Get shared resources from prewarm
      const vad = ctx.proc.userData.vad as silero.VAD;
      const stateProvider = ctx.proc.userData.stateProvider as StateProvider;
      
      // Initialize orchestrator for this interview
      const orchestrator = new Orchestrator(interviewId, stateProvider);
      
      // Load or initialize interview state
      let state = stateProvider.getState(interviewId);
      
      // If state doesn't exist, we need to initialize it
      // This happens when the interview is first started
      if (!state) {
        console.log('📊 No existing state found, state will be initialized by orchestrator');
        // State will be initialized when orchestrator.startInterview() is called
        // For now, we'll proceed with a minimal state
        state = {
          interviewId,
          candidateId: participant.identity || 'unknown',
          currentQuestionIndex: 0,
          currentQuestionId: null,
          totalQuestions: 0, // Will be set when state is initialized
          questionsAsked: 0,
          currentProblemId: null,
          currentProblemIndex: 0,
          totalProblems: 0, // Will be set when state is initialized
          hintsProvided: 0,
          clarificationsGiven: 0,
          evaluations: [],
          codeAnalysisResults: [],
          currentState: 'idle',
          startTime: new Date(),
          conversationHistory: [],
          agentSpeaking: false,
          userSpeaking: false,
          maxTheoreticalQuestions: 0,
          maxCodingProblems: 0,
        };
      } else {
        console.log('📊 Interview state loaded:', {
          currentQuestionIndex: state.currentQuestionIndex,
          currentState: state.currentState,
        });
      }
      
      // Create tool executors with access to orchestrator and state
      const toolExecutors = createToolExecutors(orchestrator, stateProvider);
      
      // Get current question/problem for context
      const currentState = stateProvider.getState(interviewId);
      // Note: questions are stored separately, not in state
      
      // Build instructions for the LLM
      const phase = state?.currentState || 'idle';
      const instructions = `You are conducting a technical interview. 
      
Current Phase: ${phase}

Your role:
- Ask technical questions clearly
- Listen to candidate responses
- Use tools to provide hints, clarifications, or evaluate answers
- Be professional, encouraging, and constructive
- Adapt your tone based on candidate performance

Available tools:
- provide_hint: Give hints when candidate requests help
- provide_clarification: Clarify questions when candidate is confused
- evaluate_answer: Evaluate candidate's answer and decide next steps
- skip_question: Skip to next question if candidate wants to move on
- analyze_code: Analyze candidate's code during coding problems
- submit_solution: Evaluate final code submission

Remember: This is a voice interview, so keep responses natural and conversational.
${phase === 'idle' ? 'IMPORTANT: Start by greeting the candidate and introducing yourself. Then begin with the first question.' : ''}`;

      // Create agent with questions
      const agent = new InterviewAgent(
        interviewId,
        instructions,
        questionsData?.questions || [],
        questionsData?.codingProblems || []
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

      // Create agent session
      const session = new voice.AgentSession<InterviewSessionData>({
        vad,
        stt: new openai.STT({
          model: 'whisper-1',
        }),
        llm: new openai.LLM({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          temperature: 0.7,
          // @ts-ignore - tools property exists but may not be in type definitions
          tools: toolDefinitions,
        }),
        tts: new openai.TTS({
          model: 'tts-1',
          voice: 'alloy',
        }),
        userData: {
          interviewId: interviewId as string,
          orchestrator,
          stateProvider,
          currentPhase: (state?.currentState || 'idle') as 'theoretical' | 'coding' | 'completed',
          sendQuestionToUI, // Make it accessible from tools
          questions: questionsData?.questions || [],
          codingProblems: questionsData?.codingProblems || [],
        },
      });

      // Handle tool calls from the LLM
      // @ts-ignore - toolCall event exists but may not be in type definitions
      session.on('toolCall', async (toolCall: any) => {
        console.log('🔧 Tool called:', toolCall.name, toolCall.arguments);
        
        try {
          const executor = toolExecutors[toolCall.name];
          if (!executor) {
            console.error('❌ Unknown tool:', toolCall.name);
            return { error: `Unknown tool: ${toolCall.name}` };
          }
          
          // Execute the tool
          const result = await executor(toolCall.arguments);
          console.log('✅ Tool result:', result);
          
          return result;
        } catch (error) {
          console.error('❌ Tool execution failed:', error);
          return {
            error: error instanceof Error ? error.message : 'Tool execution failed',
          };
        }
      });

      // Handle session errors
      // @ts-ignore - error event exists but may not be in type definitions
      session.on('error', (error: any) => {
        console.error('❌ Session error:', error);
      });

      // Start the agent session first
      console.log('🎬 Starting interview agent session...');
      await session.start({
        agent,
        room: ctx.room,
      });
      
      console.log('✅ Interview agent session started successfully');
      
      // Note: The agent will start the conversation via onEnter() method
      // The orchestrator can be used for tool-based interview flow management
      // For now, the LLM will handle the interview flow based on instructions
      
    } catch (error) {
      console.error('❌ Interview job failed:', error);
      throw error;
    }
  },
});

