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

import { cli, ServerOptions, log } from '@livekit/agents';
import { agent } from './services/interview/agent-definition.js';

// Re-export questions store functions for external use (e.g., controllers)
export { setInterviewQuestions, getInterviewQuestions } from './utils/questions-store.js';

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

  log().info('🚀 Starting LiveKit Interview Agent...');
  log().info(`📋 Mode: ${isProduction ? 'Production' : 'Development'}`);
  log().info('📋 Environment check:');
  log().info(`   - LIVEKIT_URL: ${process.env.LIVEKIT_URL ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - LIVEKIT_API_KEY: ${process.env.LIVEKIT_API_KEY ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - LIVEKIT_API_SECRET: ${process.env.LIVEKIT_API_SECRET ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - SERVER_URL: ${process.env.SERVER_URL || 'http://localhost:3001 (default)'}`);
  log().info(`   - OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - OPENAI_LLM_MODEL: ${process.env.OPENAI_LLM_MODEL || 'gpt-4o (default)'}`);
  log().info(`   - CARTESIA_API_KEY: ${process.env.CARTESIA_API_KEY ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - CARTESIA_ARUSHI_VOICE_ID: ${process.env.CARTESIA_ARUSHI_VOICE_ID ? '✅ Set' : '⚠️  Using default'}`);
  log().info(`   - DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? '✅ Set' : '❌ Missing'}`);
  log().info(`   - DEEPGRAM_MODEL: ${process.env.DEEPGRAM_MODEL || 'nova-2 (default)'}`);
  log().info('');

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
  log().info('🎬 Starting agent worker...');
  cli.runApp(opts);
}

