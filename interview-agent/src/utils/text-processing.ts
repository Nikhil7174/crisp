/**
 * Text processing utilities for the interview agent
 */

/**
 * Extract text content from a LiveKit ChatChunk
 * Handles different possible chunk structures
 */
export function extractChunkText(chunk: any): string {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (!chunk || typeof chunk !== 'object') {
    return '';
  }
  // Handle OpenAI/LiveKit standard structure (choices array)
  if (chunk.choices && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
    const choice = chunk.choices[0];
    if (choice.delta && choice.delta.content) {
      return typeof choice.delta.content === 'string' ? choice.delta.content : '';
    }
    return '';
  }
  // Handle 'delta' property
  if ('delta' in chunk) {
    const delta = chunk.delta;
    if (typeof delta === 'string') {
      return delta;
    }
    if (typeof delta === 'object' && delta !== null && 'content' in delta) {
      return typeof delta.content === 'string' ? delta.content : '';
    }
  }
  // Handle 'content' property
  if ('content' in chunk) {
    return typeof chunk.content === 'string' ? chunk.content : '';
  }
  // Handle 'text' property
  if ('text' in chunk) {
    return typeof chunk.text === 'string' ? chunk.text : '';
  }
  // Handle usage chunks (ignore them silently)
  if ('usage' in chunk || 'id' in chunk) {
    return '';
  }
  return '';
}

/**
 * Clean LLM response text to remove markdown formatting and evaluation sections
 */
export function cleanResponseText(text: string): string {
  // Remove markdown headers (###, ##, #)
  let cleaned = text.replace(/^#{1,6}\s+.+$/gm, '');

  // Remove evaluation sections
  cleaned = cleaned.replace(/###\s*EVALUATION\s*###/gi, '');
  cleaned = cleaned.replace(/###\s*ACTION\s*###/gi, '');
  cleaned = cleaned.replace(/###\s*SUMMARY\s*###/gi, '');

  // Remove lines that look like internal notes
  cleaned = cleaned.replace(/^- The candidate.*$/gmi, '');
  cleaned = cleaned.replace(/^- Update.*$/gmi, '');
  cleaned = cleaned.replace(/^- Now.*$/gmi, '');
  cleaned = cleaned.replace(/^- I'll update.*$/gmi, '');

  // Remove markdown formatting characters
  cleaned = cleaned.replace(/\*\*/g, ''); // Bold
  cleaned = cleaned.replace(/\*/g, ''); // Italic
  cleaned = cleaned.replace(/`/g, ''); // Code

  // Remove extra whitespace and newlines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  // If the cleaned text is too short or empty, return a fallback
  if (cleaned.length < 10) {
    return 'Thanks for your answer.';
  }

  return cleaned;
}

