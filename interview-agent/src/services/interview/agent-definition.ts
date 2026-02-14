/**
 * Agent Definition
 * 
 * Defines the LiveKit agent with prewarm and entry handlers.
 * This is the main agent configuration that handles interview sessions.
 */

import { defineAgent, JobContext, JobProcess, voice, log } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as cartesia from '@livekit/agents-plugin-cartesia';
import * as silero from '@livekit/agents-plugin-silero';
import * as deepgram from '@livekit/agents-plugin-deepgram';
// @ts-ignore
import { WebSocket } from 'ws';
import {
  AudioByteStream,
  AudioEnergyFilter,
  Future,
  Task,
  createTimedString,
  stt,
  waitForAbort,
} from '@livekit/agents';
import { generateCompleteHistory } from './history-utils.js';

// Inline PeriodicCollector helper (copied from plugin utils to avoid import issues)
class PeriodicCollector<T> {
  private duration: number;
  private callback: (value: any) => void;
  private lastFlushTime: number;
  private total: any = null;

  constructor(callback: (value: any) => void, options: { duration: number }) {
    this.duration = options.duration;
    this.callback = callback;
    this.lastFlushTime = performance.now() / 1e3;
  }

  push(value: any) {
    if (this.total === null) {
      this.total = value;
    } else {
      this.total = this.total + value;
    }
    if (performance.now() / 1e3 - this.lastFlushTime >= this.duration) {
      this.flush();
    }
  }

  flush() {
    if (this.total !== null) {
      this.callback(this.total);
      this.total = null;
    }
    this.lastFlushTime = performance.now() / 1e3;
  }
}

// Custom SpeechStream that handles Diarization
class CustomSpeechStream extends stt.SpeechStream {
  #opts: any;
  #audioEnergyFilter: AudioEnergyFilter;
  #logger = log();
  #speaking = false;
  #resetWS = new Future<void>();
  #requestId = '';
  #audioDurationCollector: PeriodicCollector<number>;
  #seenSpeakers = new Set<number>();
  #onUnauthorizedSpeaker?: (speakerId: number, word: string) => void;
  #hasWarnedThisSession = false; // Prevent spam
  label = 'deepgram.SpeechStream'; // Match label for logging

  constructor(sttInstance: stt.STT, opts: any, connOptions?: any, onUnauthorizedSpeaker?: (speakerId: number, word: string) => void) {
    super(sttInstance, opts.sampleRate, connOptions);
    this.#opts = opts;
    this.closed = false;
    this.#audioEnergyFilter = new AudioEnergyFilter();
    this.#onUnauthorizedSpeaker = onUnauthorizedSpeaker;
    this.#audioDurationCollector = new PeriodicCollector(
      (duration) => this.onAudioDurationReport(duration),
      { duration: 5.0 },
    );
  }

  // Override the run method to handle speaker data
  protected async run() {
    const maxRetry = 32;
    let retries = 0;
    let ws: WebSocket;
    const API_BASE_URL_V1 = 'wss://api.deepgram.com/v1/listen';

    // LAZY INIT: If sampleRate is missing, wait for the first valid audio frame to detect it
    let bufferedFirstFrame: any = null;
    if (!this.#opts.sampleRate) {
      this.#logger.info("Waiting for first audio frame to determine sample rate...");
      while (true) {
        // @ts-ignore
        const result = await this.input.next();
        if (result.done) {
          this.closed = true;
          return;
        }
        const val = result.value;
        // @ts-ignore
        if (val === stt.SpeechStream.FLUSH_SENTINEL) {
          continue; // Skip sentinels during detection
        }
        if (val && val.sampleRate) {
          bufferedFirstFrame = val;
          this.#opts.sampleRate = val.sampleRate;
          this.#opts.numChannels = val.channels;
          this.#logger.info(`Detected stats from audio source: ${this.#opts.sampleRate}Hz, ${this.#opts.numChannels}ch`);
          break;
        }
      }
    }

    while (!this.input.closed && !this.closed) {
      const streamURL = new URL(API_BASE_URL_V1);
      const params = {
        model: this.#opts.model,
        punctuate: this.#opts.punctuate,
        smart_format: this.#opts.smartFormat,
        dictation: this.#opts.dictation,
        diarize: this.#opts.diarize,
        numerals: this.#opts.numerals,
        no_delay: this.#opts.noDelay,
        interim_results: this.#opts.interimResults,
        encoding: 'linear16',
        vad_events: true,
        sample_rate: this.#opts.sampleRate,
        channels: this.#opts.numChannels,
        endpointing: this.#opts.endpointing || false,
        filler_words: this.#opts.fillerWords,
        keywords: this.#opts.keywords?.map((x: any) => x.join(':')),
        keyterm: this.#opts.keyterm,
        profanity_filter: this.#opts.profanityFilter,
        language: this.#opts.language,
        mip_opt_out: this.#opts.mipOptOut,
      };

      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) {
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            streamURL.searchParams.append(k, encodeURIComponent(v));
          } else if (Array.isArray(v)) {
            v.forEach((x) => streamURL.searchParams.append(k, encodeURIComponent(x)));
          }
        }
      });

      // @ts-ignore
      ws = new WebSocket(streamURL, {
        headers: { Authorization: `Token ${this.#opts.apiKey}` },
      });

      try {
        await new Promise((resolve, reject) => {
          ws.on('open', resolve);
          ws.on('error', (error: any) => reject(error));
          ws.on('close', (code: any) => reject(`WebSocket returned ${code}`));
        });

        await this.#runWS(ws, bufferedFirstFrame);
        // If runWS returns successfully (stream closed normally), clear buffer just in case
        bufferedFirstFrame = null;
      } catch (e) {
        if (!this.closed && !this.input.closed) {
          if (retries >= maxRetry) {
            throw new Error(`failed to connect to Deepgram after ${retries} attempts: ${e}`);
          }
          const delay = Math.min(retries * 5, 10);
          retries++;
          this.#logger.warn(
            `failed to connect to Deepgram, retrying in ${delay} seconds: ${e} (${retries}/${maxRetry})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        } else {
          this.#logger.warn(
            `Deepgram disconnected, connection is closed: ${e} (inputClosed: ${this.input.closed}, isClosed: ${this.closed})`,
          );
        }
      }
    }
    this.closed = true;
  }

  updateOptions(opts: any) {
    this.#opts = { ...this.#opts, ...opts };
    this.#resetWS.resolve();
  }

  async #runWS(ws: WebSocket, initialFrame: any) {
    this.#resetWS = new Future<void>();
    let closing = false;

    const keepalive = setInterval(() => {
      try {
        ws.send(JSON.stringify({ type: 'KeepAlive' }));
      } catch {
        clearInterval(keepalive);
        return;
      }
    }, 5000);

    const wsMonitor = Task.from(async (controller) => {
      const closed = new Promise<void>(async (_, reject) => {
        ws.once('close', (code: any, reason: any) => {
          if (!closing) {
            this.#logger.error(`WebSocket closed with code ${code}: ${reason}`);
            reject(new Error('WebSocket closed'));
          }
        });
      });
      await Promise.race([closed, waitForAbort(controller.signal)]);
    });

    const sendTask = async () => {
      const samples100Ms = Math.floor(this.#opts.sampleRate / 10);
      const stream = new AudioByteStream(
        this.#opts.sampleRate,
        this.#opts.numChannels,
        samples100Ms,
      );
      // @ts-ignore
      const abortPromise = waitForAbort(this.abortSignal);

      // Wrapper to process a data frame
      const processFrame = (data: any) => {
        let frames;
        // @ts-ignore
        if (data === stt.SpeechStream.FLUSH_SENTINEL) {
          frames = stream.flush();
          this.#audioDurationCollector.flush();
        } else {
          if (data.sampleRate !== this.#opts.sampleRate || data.channels !== this.#opts.numChannels) {
            this.#logger.warn(`Mismatch detected! Opts: sR=${this.#opts.sampleRate}, ch=${this.#opts.numChannels}. Data: sR=${data.sampleRate}, ch=${data.channels}`);
          }

          if (
            data.sampleRate === this.#opts.sampleRate ||
            data.channels === this.#opts.numChannels
          ) {
            frames = stream.write(data.data.buffer as ArrayBuffer);
          } else {
            throw new Error(`sample rate or channel count of frame does not match (Opts: ${this.#opts.sampleRate}/${this.#opts.numChannels} vs Data: ${data.sampleRate}/${data.channels})`);
          }
        }

        for (const frame of frames) {
          // @ts-ignore
          if (this.#audioEnergyFilter.pushFrame(frame)) {
            // @ts-ignore
            const frameDuration = frame.samplesPerChannel / frame.sampleRate;
            this.#audioDurationCollector.push(frameDuration);
            // @ts-ignore
            ws.send(frame.data.buffer);
          }
        }
      }

      try {
        // Process the buffered first frame if it exists
        if (initialFrame) {
          processFrame(initialFrame);
          // We don't null it here because the outer retry loop manages 'bufferedFirstFrame' persistence across retries if needed, 
          // but effectively we have consumed it for this connection.
        }

        while (!this.closed) {
          // @ts-ignore
          const result = await Promise.race([this.input.next(), abortPromise]);
          if (result === undefined) return;
          if (result.done) break;

          processFrame(result.value);
        }
      } finally {
        closing = true;
        ws.send(JSON.stringify({ type: 'CloseStream' }));
        wsMonitor.cancel();
      }
    };

    const listenTask = Task.from(async (controller) => {
      const putMessage = (message: stt.SpeechEvent) => {
        // @ts-ignore
        if (!this.queue.closed) {
          try {
            // @ts-ignore
            this.queue.put(message);
          } catch (e) { }
        }
      };

      const listenMessage = new Promise<void>((resolve, reject) => {
        ws.on('message', (msg: any) => {
          try {
            const json = JSON.parse(msg.toString());

            // INTERCEPT LOGIC: Check for speaker data
            if (json['type'] === 'Results') {
              const alts = json['channel']?.['alternatives'];
              if (alts && alts.length > 0) {
                const words = alts[0]['words'];
                if (words) {
                  for (const word of words) {
                    if (typeof word.speaker === 'number') {
                      // Debug: Log every speaker seen to verify diarization
                      // log().info(`🗣️ [DIARIZATION] Speaker ${word.speaker} detected (Word: "${word.word}")`);

                      // Speaker Guard Logic - Only speaker 0 (candidate) is allowed
                      if (word.speaker >= 1) {
                        log().warn(`🚨 [SECURITY] Unauthorized speaker detected! ID: ${word.speaker} Word: "${word.word}"`);

                        // Trigger TTS warning (only once per session to avoid spam)
                        if (this.#onUnauthorizedSpeaker && !this.#hasWarnedThisSession) {
                          this.#hasWarnedThisSession = true;
                          log().error(`🚨 [TTS WARNING] Triggering voice warning for speaker ${word.speaker}`);
                          this.#onUnauthorizedSpeaker(word.speaker, word.word);
                        }
                      } else {
                        // Log allowed speaker (only ID 0 - the candidate)
                        if (!this.#seenSpeakers.has(word.speaker)) {
                          this.#seenSpeakers.add(word.speaker);
                          log().info(`🗣️ [DIARIZATION] Candidate speaker detected: ${word.speaker}`);
                        }
                      }
                    }
                  }
                }
              }
            }

            switch (json['type']) {
              case 'SpeechStarted': {
                if (this.#speaking) return;
                this.#speaking = true;
                putMessage({ type: stt.SpeechEventType.START_OF_SPEECH });
                break;
              }
              case 'Results': {
                const metadata = json['metadata'];
                const requestId = metadata['request_id'];
                const isFinal = json['is_final'];
                const isEndpoint = json['speech_final'];
                this.#requestId = requestId;

                // Use helper to convert
                const alternatives = (deepgram as any).liveTranscriptionToSpeechData
                  ? (deepgram as any).liveTranscriptionToSpeechData(this.#opts.language!, json, this.startTimeOffset)
                  : this.localTranscriptionToSpeechData(this.#opts.language!, json, (this as any).startTimeOffset || 0);

                if (alternatives[0] && alternatives[0].text) {
                  if (!this.#speaking) {
                    this.#speaking = true;
                    putMessage({ type: stt.SpeechEventType.START_OF_SPEECH });
                  }
                  if (isFinal) {
                    putMessage({ type: stt.SpeechEventType.FINAL_TRANSCRIPT, alternatives: [alternatives[0], ...alternatives.slice(1)] });
                  } else {
                    putMessage({ type: stt.SpeechEventType.INTERIM_TRANSCRIPT, alternatives: [alternatives[0], ...alternatives.slice(1)] });
                  }
                }

                if (isEndpoint && this.#speaking) {
                  this.#speaking = false;
                  putMessage({ type: stt.SpeechEventType.END_OF_SPEECH });
                }
                break;
              }
              case 'Metadata': break;
              default:
                this.#logger.child({ msg: json }).warn('received unexpected message from Deepgram');
                break;
            }

            if (this.closed || closing) resolve();
          } catch (err) {
            this.#logger.error(`STT: Error processing message: ${msg}`);
            reject(err);
          }
        });
      });
      // @ts-ignore
      await Promise.race([listenMessage, waitForAbort(controller.signal)]);
    }, this.abortController); // @ts-ignore

    // @ts-ignore
    await Promise.race([this.#resetWS.await, Promise.all([sendTask(), listenTask.result, wsMonitor])]);
    closing = true;
    ws.close();
    clearInterval(keepalive);
  }

  private onAudioDurationReport(duration: number) {
    const usageEvent: stt.SpeechEvent = {
      type: stt.SpeechEventType.RECOGNITION_USAGE,
      requestId: this.#requestId,
      recognitionUsage: { audioDuration: duration },
    };
    // @ts-ignore
    this.queue.put(usageEvent);
  }

  // Helper copied from plugin since it's likely not exported
  private localTranscriptionToSpeechData(language: string, data: any, startTimeOffset: number): stt.SpeechData[] {
    const alts: any[] = data['channel']['alternatives'];
    return alts.map((alt) => {
      const wordsData: any[] = alt['words'] ?? [];
      return {
        language,
        startTime: wordsData.length ? wordsData[0]['start'] + startTimeOffset : startTimeOffset,
        endTime: wordsData.length ? wordsData[wordsData.length - 1]['end'] + startTimeOffset : startTimeOffset,
        confidence: alt['confidence'],
        text: alt['transcript'],
        words: wordsData.map((word) =>
          createTimedString({
            text: word['word'] ?? '',
            startTime: (word['start'] ?? 0) + startTimeOffset,
            endTime: (word['end'] ?? 0) + startTimeOffset,
            confidence: word['confidence'] ?? 0.0,
            // startTimeOffset,
          })
        ),
      };
    });
  }
}

class CustomDeepgramSTT extends deepgram.STT {
  #internalOpts: any;
  #onUnauthorizedSpeaker?: (speakerId: number, word: string) => void;

  constructor(opts: any, onUnauthorizedSpeaker?: (speakerId: number, word: string) => void) {
    super(opts);
    this.#internalOpts = opts;
    this.#onUnauthorizedSpeaker = onUnauthorizedSpeaker;
  }

  stream(options?: any): any {
    const combinedOpts = { ...this.#internalOpts, ...options };
    return new CustomSpeechStream(this, combinedOpts, options?.connOptions, this.#onUnauthorizedSpeaker);
  }
}
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
    log().info('🔥 Prewarming agent resources...');

    try {
      // Load VAD model (Voice Activity Detection) with requested 1.0s threshold
      // Use Silero VAD for robustness against background noise
      // 100ms ensures high responsiveness when the agent is listening, while voiceOptions
      // control interruption behavior when the agent is speaking.
      const vad = await silero.VAD.load({ minSpeechDuration: 100 });
      proc.userData.vad = vad; // Assign to userData
      log().info('✅ VAD model loaded');

      // Initialize shared services
      proc.userData.stateProvider = new StateProvider();
      log().info('✅ State provider initialized');

      log().info('🎉 Prewarm complete');
    } catch (error) {
      log().error('❌ Prewarm failed:', error);
      throw error;
    }
  },

  /**
   * Entry: Called when a job is assigned to this worker
   * A job represents a single interview session
   */
  entry: async (ctx: JobContext) => {
    log().info('🚀 New interview job received');

    try {
      // Connect to the LiveKit room
      await ctx.connect();
      log().info('✅ Connected to LiveKit room:', ctx.room.name);

      // Wait for participant to join
      log().info('⏳ Waiting for participant...');
      const participant = await ctx.waitForParticipant();
      log().info('👤 Participant joined:', participant.identity);

      // Extract interview ID from room name or metadata
      const interviewId = ctx.room.name || 'unknown';
      if (!interviewId || interviewId === 'unknown') {
        throw new Error('Interview ID is required');
      }
      log().info('📋 Interview ID:', interviewId);

      // Fetch questions from server API
      let questionsData: { questions: any[]; codingProblems: any[]; maxTheoreticalQuestions?: number; role?: string } | undefined;
      try {
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
        log().info(`🌐 [Agent] Server URL: ${serverUrl}`);

        // Extract sessionId from roomName (format: interview-${sessionId})
        const sessionId = interviewId.startsWith('interview-')
          ? interviewId.replace('interview-', '')
          : interviewId;
        log().info(`🔑 [Agent] Extracted sessionId: ${sessionId} from interviewId: ${interviewId}`);

        const apiUrl = `${serverUrl}/api/interview/questions?sessionId=${sessionId}&roomName=${encodeURIComponent(interviewId)}`;
        log().info(`📡 [Agent] Fetching questions from: ${apiUrl}`);

        const fetchStartTime = Date.now();
        const response = await fetch(apiUrl);
        const fetchDuration = Date.now() - fetchStartTime;
        log().info(`⏱️ [Agent] Fetch completed in ${fetchDuration}ms, status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          log().error({
            status: response.status,
            statusText: response.statusText,
            errorBody: errorText,
            url: apiUrl,
          }, `❌ [Agent] API request failed:`);
          throw new Error(`Failed to fetch questions: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as QuestionsAPIResponse;
        log().info({
          success: data.success,
          hasQuestions: !!data.questions,
          hasCodingProblems: !!data.codingProblems,
          questionsCount: data.questions?.length || 0,
          codingProblemsCount: data.codingProblems?.length || 0,
        }, `📦 [Agent] API response received:`);

        if (data.success && data.questions && data.codingProblems) {
          questionsData = {
            questions: data.questions,
            codingProblems: data.codingProblems,
            maxTheoreticalQuestions: data.maxTheoreticalQuestions,
            role: data.role || 'Backend Engineer', // Get role from API
          };
          log().info(`✅ [Agent] Successfully fetched ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems from API`);
          log().info(`✅ [Agent] Role: ${questionsData.role}`);
        } else {
          log().error({
            success: data.success,
            hasQuestions: !!data.questions,
            hasCodingProblems: !!data.codingProblems,
            responseKeys: Object.keys(data),
          }, `❌ [Agent] Invalid response format:`);
          throw new Error('Invalid response format from questions API');
        }
      } catch (error) {
        log().error('❌ [Agent] Failed to fetch questions from API:', error);
        log().error({
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          interviewId,
          serverUrl: process.env.SERVER_URL || 'http://localhost:3001',
        }, '❌ [Agent] Error details:');

        // Fallback to in-memory store (for backward compatibility during migration)
        log().info(`🔄 [Agent] Attempting fallback to in-memory store...`);
        try {
          const fallbackData = getInterviewQuestions(interviewId);
          if (fallbackData) {
            questionsData = fallbackData;
            log().info(`📚 [Agent] Using fallback: Loaded ${questionsData.questions.length} questions from in-memory store`);
          } else {
            log().warn(`⚠️ [Agent] No questions found for interview ${interviewId} (neither API nor store)`);
            log().warn(`⚠️ [Agent] This will cause the agent to fail initialization`);
          }
        } catch (fallbackError) {
          log().error('❌ [Agent] Fallback also failed:', fallbackError);
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
        log().info('📊 [Agent] No existing state found, initializing new interview state');

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
              log().info(`✅ [Agent] Initialized state with ${questionsData.questions.length} questions and ${questionsData.codingProblems.length} coding problems`);
            } else {
              log().error(`❌ [Agent] State initialization failed - state is still null after initializeState call`);
              throw new Error('State initialization failed');
            }
          } catch (stateError) {
            log().error({ error: stateError }, '❌ [Agent] Failed to initialize state:');
            log().error({
              error: stateError instanceof Error ? stateError.message : String(stateError),
              stack: stateError instanceof Error ? stateError.stack : undefined,
              interviewId,
              candidateId: participant.identity,
            }, '❌ [Agent] State error details:');
            throw stateError;
          }
        } else {
          // Fallback: create minimal state if no questions available
          log().warn('⚠️ [Agent] No questions data available, using minimal state');
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
        log().info({
          currentQuestionIndex: state.currentQuestionIndex,
          currentState: state.currentState,
          totalQuestions: state.totalQuestions,
          totalProblems: state.totalProblems,
        }, '📊 [Agent] Interview state loaded:');
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

      log().info(`\n👤 [Persona] Using ${persona.role} persona`);
      log().info(`   Focus areas: ${persona.focusAreas.length}`);
      log().info(`   Evaluation criteria: ${persona.evaluationCriteria.length}`);


      // Build instructions for the LLM (TAG-BASED PROTOCOL)
      const phase = state?.currentState || 'idle';
      const instructions = getInterviewInstructions(role, personaInstructions);

      log().info('\n' + '📜'.repeat(40));
      log().info('📜 [LLM Instructions] Instructions being sent to LLM:');
      log().info('📜'.repeat(40));
      log().info(instructions.substring(0, 500) + '...');
      log().info('📜'.repeat(40) + '\n');

      // Ensure we have questions before creating the agent
      if (!questionsData || (!questionsData.questions.length && !questionsData.codingProblems.length)) {
        log().error(`❌ [Agent] No questions available for interview ${interviewId}`);
        log().error({
          hasData: !!questionsData,
          questionsCount: questionsData?.questions?.length || 0,
          codingProblemsCount: questionsData?.codingProblems?.length || 0,
        }, `❌ [Agent] Questions data:`);
        throw new Error(`No questions available for interview ${interviewId}. Please ensure questions are generated and stored.`);
      }

      log().info(`✅ [Agent] Questions validated: ${questionsData.questions.length} questions, ${questionsData.codingProblems.length} coding problems`);

      // Create agent with questions (no tools - direct responses)
      const agent = new InterviewAgent(
        instructions,
        orchestrator,
        stateProvider,
        role // Pass role to agent
      );

      // General helper to send any event to UI
      const sendEventToUI = async (eventType: string, data: any = {}) => {
        try {
          const payload = {
            type: eventType,
            ...data,
            timestamp: Date.now(),
          };

          const encoded = new TextEncoder().encode(JSON.stringify(payload));
          if (ctx.room.localParticipant) {
            await ctx.room.localParticipant.publishData(encoded, { reliable: true });
          } else {
            log().warn('⚠️ Local participant not available, cannot send event to UI');
          }
        } catch (error) {
          log().error(`❌ Failed to send ${eventType} to UI:`, error);
        }
      };

      // Helper function to send questions to UI (backward compatibility / specific helper)
      const sendQuestionToUI = async (question: any, questionIndex: number, questionType: 'theoretical' | 'coding') => {
        await sendEventToUI(questionType === 'theoretical' ? 'question-changed' : 'coding-problem-changed', {
          question: questionType === 'theoretical' ? question : undefined,
          codingProblem: questionType === 'coding' ? question : undefined,
          questionIndex,
          questionId: question.id,
        });
      };

      // Helper function to send final evaluation directly to backend API
      const sendFinalEvaluationToBackend = async (finalState: any, interviewLinkId?: number) => {
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
        try {
          const sessionId = interviewId.startsWith('interview-')
            ? interviewId.replace('interview-', '')
            : interviewId;

          const payload = {
            sessionId,
            candidateId: finalState.candidateId || 'unknown',
            interviewLinkId: interviewLinkId,
            startTime: finalState.startTime?.toISOString(),
            endTime: finalState.endTime?.toISOString(),
            duration: finalState.endTime && finalState.startTime
              ? finalState.endTime.getTime() - finalState.startTime.getTime()
              : 0,
            fullConversationHistory: [] as any[], // Placeholder, will populate below
            theoreticalSection: {
              totalQuestions: finalState.totalQuestions || 0,
              questionsAsked: finalState.questionsAsked || 0,
              conversations: [],
            },
            codingSection: {
              totalProblems: finalState.totalProblems || 0,
              problemsCompleted: finalState.currentProblemIndex || 0,
              conversations: [], // detailed conversations handled by fullConversationHistory
              // Include final code if available for the current problem (Respect "no code" policy)
              finalCode: (finalState.currentCode && finalState.currentCode.trim().length > 0) ? finalState.currentCode : undefined,
              timeComplexity: finalState.currentTimeComplexity || '',
              spaceComplexity: finalState.currentSpaceComplexity || '',
              problem: orchestrator.getCurrentProblem() || undefined,
            },
            // Required fields with defaults (will be updated by LLM evaluation later)
            totalScore: 0,
            strengths: [],
            areasForImprovement: [],
            overallFeedback: 'Interview completed. Evaluation pending.',
            hintRequestCount: finalState.hintsProvided || 0,
            clarificationRequestCount: finalState.clarificationsGiven || 0,
            followUpCount: finalState.followUpsGiven || 0,
            averageTimePerQuestion: (finalState.endTime && finalState.startTime && (finalState.questionsAsked || 0) + (finalState.currentProblemIndex || 0) > 0)
              ? Math.round(((finalState.endTime.getTime() - finalState.startTime.getTime()) / 1000) / ((finalState.questionsAsked || 0) + (finalState.currentProblemIndex || 0)))
              : 0,
            averageTimePerCodingProblem: 0, // Could be specialized if we track section timing
          };

          // GENERATE COMPLETE HISTORY (Verbal + Non-Verbal)
          try {
            // Retrieve ChatContext from session userData (stored via llmNode)
            const chatCtx = (sessionRef?.userData as any)?.chatCtx;

            // Get non-verbal events (code submissions, problem logs) from state history
            // Note: We filtered out verbal logs from state, so this should contain only system/code events
            const nonVerbalEvents = finalState.conversationHistory || [];

            const fullHistory = generateCompleteHistory(
              chatCtx,
              nonVerbalEvents,
              finalState.questions || [],
              finalState.problems || []
            );

            payload.fullConversationHistory = fullHistory;
            log().info(`📜 [Agent] Generated complete history: ${fullHistory.length} messages (${(chatCtx?.items || []).length} verbal, ${nonVerbalEvents.length} non-verbal)`);
          } catch (histError) {
            log().error('❌ [Agent] Failed to generate complete history:', histError);
            // Fallback to whatever is in state (likely incomplete but better than nothing)
            payload.fullConversationHistory = finalState.conversationHistory || [];
          }

          log().info({
            sessionId,
            conversationHistoryLength: payload.fullConversationHistory.length,
          }, '📤 [Agent] Sending final evaluation to backend API...');

          const response = await fetch(`${serverUrl}/api/interview/final-evaluation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            const data = await response.json() as { success?: boolean };
            log().info('✅ [Agent] Final evaluation sent to backend successfully:', data.success);
          } else {
            const errorText = await response.text();
            log().error('❌ [Agent] Backend API error:', response.status, errorText);
          }
        } catch (error) {
          log().error('❌ [Agent] Failed to send final evaluation to backend:', error);
        }
      };

      // TAG-BASED INTENT DETECTION - No tool calling
      const llmDirect = new openai.LLM({
        model: process.env.OPENAI_LLM_MODEL || process.env.OPENAI_MODEL || 'gpt-4o',
        temperature: 0.3,
      });

      log().info('🔧 [LLM Config] Using TAG-BASED INTENT DETECTION');
      log().info('   ✅ TAG SYSTEM: LLM uses tags [FOLLOW_UP], [NEXT], [HINT], [CLARIFY] to signal intent');
      log().info('   ✅ NODE-DRIVEN ARCHITECTURE: Node controls flow, LLM provides conversational responses');
      log().info('   ✅ JAILBREAK PROTECTION: 0-latency regex checks + context pruning');
      log().info('   ✅ ROLE PERSONA: Using ' + role + ' persona (set once)');

      // Create a reference for the session that will be populated after creation
      let sessionRef: voice.AgentSession<InterviewSessionData> | null = null;

      const session = new voice.AgentSession<InterviewSessionData>({
        vad,
        stt: new CustomDeepgramSTT(
          {
            model: (process.env.DEEPGRAM_MODEL || 'nova-2') as any,
            apiKey: process.env.DEEPGRAM_API_KEY,
            diarize: true,
          },
          // Callback for unauthorized speaker warnings
          async (speakerId: number, word: string) => {
            log().error(`🚨 [TTS WARNING] Triggering voice warning for speaker ${speakerId}`);
            if (sessionRef) {
              try {
                // Use session.say() to speak the warning
                await sessionRef.say(
                  "Warning: An additional voice has been detected. Please ensure you are alone during the interview.",
                  { allowInterruptions: false }
                );
                log().info(`✅ [TTS WARNING] Voice warning played successfully`);
              } catch (error: any) {
                log().error(`❌ [TTS WARNING] Failed to play voice warning: ${error.message}`);
              }
            }
          }
        ),
        llm: llmDirect, // Direct LLM (no tools)
        tts: new cartesia.TTS({
          model: 'sonic-3',
          voice: process.env.CARTESIA_ARUSHI_VOICE_ID || 'f786b574-daa5-4673-aa0c-cbe3e8534c02', // Arushi voice ID
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
          sendEventToUI, // Add generic sender to userData
          questions: questionsData?.questions || [],
          codingProblems: questionsData?.codingProblems || [],
          role, // Role for persona
          personaInstructions, // Persona instructions (set once)
        },
        voiceOptions: {
          allowInterruptions: true,
          minInterruptionDuration: 2000, // Prevent barge-in unless speech > 2s
          minInterruptionWords: 3, // Prevent interruption from short completed turns (approx < 2s)
        },
      });

      // Populate the session reference
      sessionRef = session;

      log().info({ options: JSON.stringify(session.options, null, 2) }, '🔧 [Agent] Session options:');

      // Listen for data from client (e.g. state requests) to handle late joiners/refreshes
      // Use 'dataReceived' string event name to avoid extra imports
      ctx.room.on('dataReceived', async (payload: Uint8Array, participant: any) => {
        try {
          const str = new TextDecoder().decode(payload);
          const msg = JSON.parse(str);

          if (msg.type === 'request-state') {
            const currentState = stateProvider.getState(interviewId);
            if (currentState) {
              // Resend theoretical question if active
              if (currentState.currentState === 'theoretical') {
                const q = orchestrator.getCurrentQuestion();
                if (q) {
                  await sendQuestionToUI(q, currentState.currentQuestionIndex, 'theoretical');
                }
              }
              // Resend active coding problem
              else if (currentState.currentState === 'coding' || currentState.currentState === 'coding_problem') {
                // Re-send current coding problem if needed
                // Note: Typically the client persists this, but good for reconnection
              }
            }
          } else if (msg.type === 'code_snapshot') {
            // Handle code snapshot (and optional notepad)
            if (msg.code !== undefined && session.userData) {
              // Update the currentCode in persistent state
              stateProvider.updateCode(interviewId, msg.code);
              log().info(`💻 [Agent] Received code_snapshot (${msg.code.length} chars) - Updated State`);

              // Update complexity if provided
              if (msg.complexity) {
                const time = msg.complexity.time || msg.complexity.timeComplexity;
                const space = msg.complexity.space || msg.complexity.spaceComplexity;
                stateProvider.updateComplexity(interviewId, time, space);
              }

              // Also update notepad if provided
              if (msg.notepad !== undefined) {
                stateProvider.updateNotepad(interviewId, msg.notepad);
                log().info(`📝 [Agent] Received notepad (${msg.notepad.length} chars) - Updated State`);
              }
            } else {
              log().warn(`⚠️ [Agent] code_snapshot received but msg.code or session.userData was undefined`);
            }
          } else if (msg.type === 'security_warning') {
            const warningMessage = msg.message;
            log().info(`🚨 [Agent] Received security warning: ${warningMessage}`);

            await session.say(`Attention: ${warningMessage}`);

          } else if (msg.type === 'user_quit') {
            log().info('🛑 [Agent] User quit - saving interview state');

            const state = stateProvider.getState(interviewId);
            if (state) {
              orchestrator.wrapUpInterview();
              orchestrator.completeInterview();

              const finalState = stateProvider.getState(interviewId);
              if (finalState) {
                await sendFinalEvaluationToBackend(finalState);
                log().info('✅ [Agent] Interview saved successfully on user quit');
              }
            } else {
              log().warn('⚠️ [Agent] No state found during user_quit');
            }

          } else if (msg.type === 'confirm_next_question') {
            log().info({ metadata: msg.metadata }, '✅ [Agent] Received confirm_next_question from UI');
            // Proceed to next question logic
            const state = stateProvider.getState(interviewId);

            // Check current phase
            const currentPhase = state?.currentState;

            // If in coding phase, update complexity in state before moving on
            if (currentPhase === 'coding' || currentPhase === 'coding_problem') {
              const complexity = msg.metadata?.complexity || {};
              const time = complexity.time || complexity.timeComplexity;
              const space = complexity.space || complexity.spaceComplexity;
              stateProvider.updateComplexity(interviewId, time, space);
              log().info(`📝 [Agent] Updated complexity in state before transitioning: Time=${time}, Space=${space}`);

              const { problem, shouldWrapUp } = orchestrator.presentNextProblem();

              if (shouldWrapUp || !problem) {
                // No more problems - complete the interview
                log().info('🎉 [Agent] All problems completed - wrapping up interview');
                orchestrator.wrapUpInterview();

                const messageToSpeak = "That completes the interview. Thank you for your time! I'll now generate your evaluation.";
                await session.say(messageToSpeak);

                // Complete the interview after wrap-up speech
                orchestrator.completeInterview();

                // Get final state and send interview_completed to UI
                const finalState = stateProvider.getState(interviewId);
                if (finalState) {
                  // Send final evaluation directly to backend API
                  await sendFinalEvaluationToBackend(finalState);

                  await sendEventToUI('interview_completed', {
                    state: {
                      currentState: finalState.currentState,
                      totalQuestions: finalState.totalQuestions,
                      questionsAsked: finalState.questionsAsked,
                      totalProblems: finalState.totalProblems,
                      problemsCompleted: finalState.currentProblemIndex,
                      startTime: finalState.startTime?.toISOString(),
                      endTime: finalState.endTime?.toISOString(),
                    },
                    evaluations: finalState.evaluations,
                  });
                  log().info('📤 [Agent] Sent interview_completed to UI');
                }
              } else {
                // Present next coding problem
                const messageToSpeak = "Great work on that problem! Let's move to the next one.";
                const problemIndex = state?.currentProblemIndex || 0;
                await sendQuestionToUI(problem, problemIndex, 'coding');

                // Store the problem description in conversation history for LLM evaluation
                stateProvider.addConversationMessage(interviewId, {
                  role: 'assistant',
                  content: `Coding Problem: ${problem.title}\n\nDescription: ${problem.description}\n\nConstraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}`,
                  metadata: { type: 'problem', section: 'coding', problemId: problem.id, title: problem.title, phase: 'coding' },
                });

                // Inject problem context
                (session.userData as any).pendingProblemInjection = problem;

                await session.say(messageToSpeak);
              }
            } else {
              // Theoretical phase - get next question
              const { question, shouldMoveToCoding } = orchestrator.askNextQuestion();

              let messageToSpeak = "Great, let's move on.";

              if (shouldMoveToCoding) {
                orchestrator.startCodingPhase();
                const { problem } = orchestrator.presentNextProblem();
                if (problem) {
                  messageToSpeak = "Great job! Moving to the coding section. Here is your problem.";
                  // Send to UI
                  const problemIndex = state?.currentProblemIndex || 0;
                  await sendQuestionToUI(problem, problemIndex, 'coding');

                  // Store the problem description in conversation history for LLM evaluation
                  stateProvider.addConversationMessage(interviewId, {
                    role: 'assistant',
                    content: `Coding Problem: ${problem.title}\n\nDescription: ${problem.description}\n\nConstraints: ${problem.constraints ? problem.constraints.join(', ') : 'None'}`,
                    metadata: { type: 'problem', section: 'coding', problemId: problem.id, title: problem.title, phase: 'coding' },
                  });

                  // Inject problem context into chat (hidden)
                  (session.userData as any).pendingProblemInjection = problem;
                } else {
                  // No coding problems - complete interview
                  log().info('🎉 [Agent] No coding problems - completing interview');
                  orchestrator.wrapUpInterview();
                  messageToSpeak = "That completes the interview. Thank you for your time!";
                  await session.say(messageToSpeak);

                  orchestrator.completeInterview();

                  const finalState = stateProvider.getState(interviewId);
                  if (finalState) {
                    // Send final evaluation directly to backend API
                    await sendFinalEvaluationToBackend(finalState);

                    await sendEventToUI('interview_completed', {
                      state: {
                        currentState: finalState.currentState,
                        totalQuestions: finalState.totalQuestions,
                        questionsAsked: finalState.questionsAsked,
                        totalProblems: finalState.totalProblems,
                        problemsCompleted: finalState.currentProblemIndex,
                        startTime: finalState.startTime?.toISOString(),
                        endTime: finalState.endTime?.toISOString(),
                      },
                      evaluations: finalState.evaluations,
                    });
                    log().info('📤 [Agent] Sent interview_completed to UI');
                  }
                  return; // Don't speak again
                }
              } else if (question) {
                // Next theoretical
                messageToSpeak = `Moving on. ${question.question}`;
                const questionIndex = Math.max((state?.currentQuestionIndex || 1) - 1, 0);
                await sendQuestionToUI(question, questionIndex, 'theoretical');
              } else {
                // No more questions and no coding - complete
                log().info('🎉 [Agent] All theoretical questions completed, no coding problems');
                orchestrator.wrapUpInterview();
                messageToSpeak = "That completes all the questions. Thank you for your time!";
                await session.say(messageToSpeak);

                orchestrator.completeInterview();

                const finalState = stateProvider.getState(interviewId);
                if (finalState) {
                  // Send final evaluation directly to backend API
                  await sendFinalEvaluationToBackend(finalState);

                  await sendEventToUI('interview_completed', {
                    state: {
                      currentState: finalState.currentState,
                      totalQuestions: finalState.totalQuestions,
                      questionsAsked: finalState.questionsAsked,
                      totalProblems: finalState.totalProblems,
                      problemsCompleted: finalState.currentProblemIndex,
                      startTime: finalState.startTime?.toISOString(),
                      endTime: finalState.endTime?.toISOString(),
                    },
                    evaluations: finalState.evaluations,
                  });
                  log().info('📤 [Agent] Sent interview_completed to UI');
                }
                return;
              }

              // Speak the transition 
              await session.say(messageToSpeak);
            }
          }
        } catch (error) {
          log().error('❌ [Agent] Error handling data message:', error);
        }
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
          log().info(`⏱️ [TIMING] STT transcription complete at ${sttCompleteTime}`);
        }

        log().info('\n=== SESSION USER SPEECH ===');
        log().info({ text }, 'TEXT:');
        log().info('===========================\n');
      });

      // Listen for agent speech at session level and call onAgentSpeechEnded
      // @ts-ignore
      session.on('agentSpeech', (text: string) => {
        log().info('\n=== SESSION AGENT SPEECH ===');
        log().info({ text }, 'TEXT:');
        log().info('============================\n');

        // Call the agent's onAgentSpeechEnded method
        agent.onAgentSpeechEnded(text).catch(err => {
          log().error('❌ Error in onAgentSpeechEnded:', err);
        });
      });

      // Listen for any LLM response
      // @ts-ignore
      session.on('llmResponse', (response: any) => {
        log().info('\n=== LLM RESPONSE ===');
        log().info({ response: JSON.stringify(response, null, 2) }, 'Response:');
        log().info('===================\n');
      });

      log().info('✅ [Agent] Session created - TAG-BASED INTENT DETECTION');
      log().info('   ✅ Jailbreak protection: Regex checks + context pruning');
      log().info('   ✅ Role persona: ' + role + ' (set once, not in every request)');
      log().info('   ✅ Tag system: LLM uses tags to signal intent, Node processes tags for flow control');

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
                  log().info(`\n=== SESSION EMIT: ${event} ===`);
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
                    log().info({ args: serialized }, 'Args:');
                  } catch (e) {
                    log().info({ count: args.length }, 'Args (non-serializable):');
                  }
                  log().info('===========================\n');
                }
                return value.apply(target, [event, ...args]);
              };
            }
            return value;
          }
        });
        log().info('✅ Event interception enabled - will log all relevant session events');
        // Note: We can't replace the session object, but the proxy will intercept emits
      } catch (e) {
        log().error('❌ Failed to intercept events:', e);
      }

      // Handle session errors
      // @ts-ignore
      session.on('error', (error: any) => {
        log().error('❌ [Agent] Session error:', error);
      });

      // Start the agent session first
      log().info('🎬 [Agent] Starting interview agent session...');
      log().info('⚠️  If onUserSpeech/onAgentSpeechEnded are not called, check SESSION EMIT logs above');
      try {
        await session.start({
          agent,
          room: ctx.room,
        });
        log().info('✅ [Agent] Interview agent session started successfully');
      } catch (sessionError) {
        log().error('❌ [Agent] Failed to start session:', sessionError);
        log().error({
          error: sessionError instanceof Error ? sessionError.message : String(sessionError),
          stack: sessionError instanceof Error ? sessionError.stack : undefined,
          interviewId,
          hasAgent: !!agent,
          hasRoom: !!ctx.room,
        }, '❌ [Agent] Session error details:');
        throw sessionError;
      }

      // Note: The agent will start the conversation via onEnter() method
      // The tag-based system controls interview flow through intent detection

    } catch (error) {
      log().error('❌ [Agent] Interview job failed:', error);
      log().error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        interviewId: ctx.room?.name || 'unknown',
        roomName: ctx.room?.name,
      }, '❌ [Agent] Job error details:');
      throw error;
    }
  },
});

