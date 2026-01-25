/**
 * Agent Definition
 * 
 * Defines the LiveKit agent with prewarm and entry handlers.
 * This is the main agent configuration that handles interview sessions.
 */

import { defineAgent, JobContext, JobProcess, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as silero from '@livekit/agents-plugin-silero';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import { StateProvider } from './state-provider.js';
import { Orchestrator } from './orchestrator.js';
import { getPersonaForRole, getPersonaInstructions } from './personas/role-personas.js';
import { getInterviewInstructions } from '../../prompts/systemPrompt.js';
import { InterviewAgent, InterviewSessionData } from './interview-agent.js';
import { getInterviewQuestions } from '../../utils/questions-store.js';

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
 * Agent definition
 */
export const agent = defineAgent({
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
      const instructions = getInterviewInstructions(role, personaInstructions);

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
        instructions,
        orchestrator,
        stateProvider,
        role // Pass role to agent
      );

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

        } catch (error) {
          console.error('❌ Failed to send question to UI:', error);
        }
      };

      // Listen for data from client (e.g. state requests) to handle late joiners/refreshes
      // Use 'dataReceived' string event name to avoid extra imports
      ctx.room.on('dataReceived', async (payload: Uint8Array, participant: any) => {
        try {
          const str = new TextDecoder().decode(payload);
          const msg = JSON.parse(str);

          if (msg.type === 'request-state') {
            // no-op

            const currentState = stateProvider.getState(interviewId);
            if (currentState) {
              // Resend theoretical question if active
              if (currentState.currentState === 'theoretical') {
                const q = orchestrator.getCurrentQuestion();
                if (q) {
                  // no-op
                  await sendQuestionToUI(q, currentState.currentQuestionIndex, 'theoretical');
                }
              }
              // Resend active coding problem
              else if (currentState.currentState === 'coding') {
                // Logic to get current coding problem if needed
                // For now, assuming orchestrator tracks it similarly
                // const p = orchestrator.getCurrentProblem(); 
              }
            }
          }
        } catch (error) {
          console.error('❌ [Agent] Error handling data message:', error);
        }
      });

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

