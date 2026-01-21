/**
 * Node-Based Context Pruning
 * 
 * In a node-based architecture, we control exactly what history the LLM sees.
 * This prevents jailbreak attempts from persisting across nodes.
 */

import { llm } from '@livekit/agents';
import { InterviewState } from './state-provider.js';

export interface PrunedContext {
  messages: llm.ChatMessage[];
  systemPrompt: string;
}

/**
 * Get scoped history for current node
 * Only includes last 2 turns + node-specific context
 * This automatically removes "poison" from previous nodes
 */
export function getPrunedContext(
  fullHistory: llm.ChatMessage[],
  currentState: InterviewState,
  nodeSpecificContext: string
): PrunedContext {
  // Get last 2 turns (user + assistant pairs)
  // This ensures we have recent context but remove old jailbreak attempts
  const lastNTurns = 2;
  const prunedMessages: llm.ChatMessage[] = [];
  
  // Count turns (user + assistant = 1 turn)
  let turnCount = 0;
  let userMessage: llm.ChatMessage | null = null;
  
  // Iterate backwards to get last N turns
  for (let i = fullHistory.length - 1; i >= 0 && turnCount < lastNTurns; i--) {
    const message = fullHistory[i];
    
    if (message.role === 'user') {
      userMessage = message;
      // If we have a user message, check if there's a corresponding assistant message
      if (i + 1 < fullHistory.length && fullHistory[i + 1].role === 'assistant') {
        // This is part of a complete turn
        prunedMessages.unshift(fullHistory[i + 1]); // Assistant response
        prunedMessages.unshift(message); // User message
        turnCount++;
        userMessage = null;
      } else {
        // User message without assistant response yet (current turn)
        prunedMessages.unshift(message);
      }
    } else if (message.role === 'assistant' && userMessage) {
      // Complete the turn
      prunedMessages.unshift(message);
      prunedMessages.unshift(userMessage);
      turnCount++;
      userMessage = null;
    }
  }
  
  // If we have an orphaned user message, include it
  if (userMessage) {
    prunedMessages.unshift(userMessage);
  }
  
  // Build node-specific system prompt
  const systemPrompt = buildNodeSystemPrompt(currentState, nodeSpecificContext);
  
  return {
    messages: prunedMessages,
    systemPrompt,
  };
}

/**
 * Build system prompt specific to current node
 * Each node has its own context, preventing cross-node contamination
 */
function buildNodeSystemPrompt(state: InterviewState, nodeContext: string): string {
  let prompt = nodeContext; // Base context (persona, guardrails, etc.)
  
  // Add node-specific instructions
  if (state.currentState === 'theoretical' && state.currentQuestionId) {
    prompt += `\n\nCURRENT NODE: Theoretical Question Phase
- You are asking a theoretical question about backend engineering
- Evaluate the candidate's answer
- Provide constructive feedback
- Stay focused on this question only`;
  } else if (state.currentState === 'coding' && state.currentProblemId) {
    prompt += `\n\nCURRENT NODE: Coding Problem Phase
- You are helping with a coding problem
- Analyze code progress
- Provide hints if needed
- Stay focused on this problem only`;
  } else if (state.currentState === 'intro') {
    prompt += `\n\nCURRENT NODE: Introduction Phase
- Greet the candidate
- Explain the interview process
- Prepare to start questions`;
  } else {
    prompt += `\n\nCURRENT NODE: ${state.currentState}
- Stay focused on the interview
- Be professional and helpful`;
  }
  
  return prompt;
}

/**
 * Get conversation history for a specific node
 * This ensures jailbreak attempts in one node don't affect others
 */
export function getNodeHistory(
  fullHistory: llm.ChatMessage[],
  nodeStartIndex: number
): llm.ChatMessage[] {
  // Return only messages from this node onwards
  return fullHistory.slice(nodeStartIndex);
}




