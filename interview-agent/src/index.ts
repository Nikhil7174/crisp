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
  cli.runApp(opts);
}

