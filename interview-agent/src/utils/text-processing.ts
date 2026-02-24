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

/**
 * Detect if user input is an incomplete or nonsensical phrase
 * This prevents the agent from responding to mid-sentence pauses
 * that get detected as end-of-turn
 */
export function isIncompletePhrase(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return true;
  }

  const trimmed = text.trim();
  
  // Empty or whitespace-only
  if (trimmed.length === 0) {
    return true;
  }

  // Very short phrases (1-3 words) that are likely incomplete
  const words = trimmed.split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;
  const lowerText = trimmed.toLowerCase();

  // Check for repeated words/phrases (user emphasizing) - these are valid, not incomplete
  // e.g., "what range what range", "yes yes", "okay okay"
  if (wordCount >= 2 && wordCount <= 6) {
    const firstHalf = words.slice(0, Math.floor(wordCount / 2)).join(' ').toLowerCase();
    const secondHalf = words.slice(Math.floor(wordCount / 2)).join(' ').toLowerCase();
    if (firstHalf === secondHalf) {
      // Repeated phrase - valid emphasis, not incomplete
      return false;
    }
  }

  // Single word (unless it's a complete answer like "yes", "no", "okay")
  if (wordCount === 1) {
    const singleWord = words[0].toLowerCase();
    const completeSingleWords = ['yes', 'no', 'okay', 'ok', 'sure', 'right', 'correct', 'wrong', 'maybe', 'perhaps'];
    if (!completeSingleWords.includes(singleWord)) {
      return true;
    }
  }

  // Very short phrases (2-3 words) that are common incomplete patterns
  if (wordCount <= 3) {
    
    // Common incomplete phrase patterns
    const incompletePatterns = [
      /^i\s+(will|would|can|could|should|might|may|think|guess|mean|believe|know|understand|see|feel|want|need|try|start|begin|go|come|say|tell|ask|give|take|make|do|use|get|put|set|let|help|show|explain|describe|define)$/,
      /^think\s+(of|about|that|this|it|how|what|when|where|why|which|who)$/,
      /^let\s+(me|us|it|him|her|them|this|that)$/,
      /^i\s+(am|was|were|have|had|has)$/,
      /^so\s+(i|we|they|it|this|that|what|how|when|where|why|which|who)$/,
      /^well\s+(i|we|they|it|this|that|what|how|when|where|why|which|who)$/,
      /^(um|uh|er|ah|oh|hmm|huh)\s*$/,
    ];

    // Check if it matches incomplete patterns
    for (const pattern of incompletePatterns) {
      if (pattern.test(lowerText)) {
        return true;
      }
    }

    // Check for trailing incomplete words (ending with common prefixes)
    const lastWord = words[words.length - 1].toLowerCase();
    const incompleteEndings = ['ing', 'ed', 'er', 'ly', 'tion', 'sion', 'ment', 'ness', 'ity', 'ive', 'ous', 'ful', 'less'];
    // If last word is very short and might be cut off
    if (lastWord.length <= 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use'].includes(lastWord)) {
      return true;
    }
  }

  // Check for trailing spaces or incomplete punctuation (suggests mid-sentence)
  if (trimmed.endsWith(' ') || trimmed.endsWith(',') || trimmed.endsWith(';') || trimmed.endsWith(':')) {
    // If it's a very short phrase with trailing punctuation, likely incomplete
    if (wordCount <= 4) {
      return true;
    }
  }

  // Check if text doesn't end with proper sentence-ending punctuation
  // and is very short (likely incomplete thought)
  if (wordCount <= 4 && !trimmed.match(/[.!?]$/)) {
    // Allow common short complete phrases
    const shortCompletePhrases = [
      /^(yes|no|okay|ok|sure|right|correct|wrong|maybe|perhaps|exactly|absolutely|definitely|probably|possibly|certainly|definitely|indeed|precisely|exactly|absolutely|definitely|probably|possibly|certainly|definitely|indeed|precisely)$/i,
      /^(i\s+(see|understand|know|get|got|think|believe|agree|disagree|guess|mean|feel|want|need|try|can|could|should|will|would|might|may))$/i,
      /^(that\'?s?\s+(right|correct|wrong|true|false|good|bad|nice|great|fine|ok|okay|interesting|helpful|useful|clear|confusing|difficult|easy|hard|simple|complex|basic|advanced|important|relevant|irrelevant|related|unrelated|similar|different|same|equal|unequal|equivalent|nonequivalent|identical|distinct|unique|common|rare|typical|atypical|normal|abnormal|standard|nonstandard|regular|irregular|expected|unexpected|predictable|unpredictable|surprising|unsurprising|obvious|subtle|explicit|implicit|direct|indirect|straightforward|complicated|straightforward|complicated|straightforward|complicated))$/i,
    ];

    let isComplete = false;
    for (const pattern of shortCompletePhrases) {
      if (pattern.test(trimmed)) {
        isComplete = true;
        break;
      }
    }

    if (!isComplete) {
      return true;
    }
  }

  // Very short text (less than 10 characters) that's not a common word
  if (trimmed.length < 10 && wordCount <= 2) {
    const commonShortWords = ['yes', 'no', 'ok', 'okay', 'sure', 'right', 'wrong', 'maybe', 'thanks', 'thank you'];
    if (!commonShortWords.some(word => lowerText.includes(word))) {
      return true;
    }
  }

  return false;
}

