/**
 * OpenAI Tool Definitions for Interview Agent
 * These tools replace the intent detection + separate API call pattern
 */

/**
 * NODE-DRIVEN ARCHITECTURE:
 * ask_next_question and skip_question are REMOVED from LLM tools
 * These are now controlled by Node in onUserTurnCompleted()
 * LLM can only use: evaluate_answer, provide_hint, provide_clarification, analyze_code, submit_solution
 */
export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'provide_hint',
      description: 'Provides a hint to help the candidate with the current question or coding problem. Use this when the candidate explicitly asks for help or a hint.',
      parameters: {
        type: 'object',
        properties: {
          context: {
            type: 'string',
            description: 'Brief context about what the candidate is struggling with (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'provide_clarification',
      description: 'Clarifies the current question or problem when the candidate asks for clarification or doesn\'t understand something. Use this when the candidate says things like "what do you mean by...", "can you clarify...", etc.',
      parameters: {
        type: 'object',
        properties: {
          clarification_request: {
            type: 'string',
            description: 'What the candidate is asking to be clarified',
          },
        },
        required: ['clarification_request'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'evaluate_answer',
      description: 'Evaluates the candidate\'s answer to a theoretical question. Use this when the candidate provides a substantive answer to the current question.',
      parameters: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'The candidate\'s complete answer to evaluate',
          },
        },
        required: ['answer'],
      },
    },
  },
  // skip_question REMOVED - Node controls this in onUserTurnCompleted()
  {
    type: 'function',
    function: {
      name: 'analyze_code',
      description: 'Analyzes the candidate\'s code progress for the current coding problem. Use this when the candidate asks for feedback on their code or approach.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The candidate\'s current code to analyze',
          },
          question: {
            type: 'string',
            description: 'Specific question the candidate has about their code (optional)',
          },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_solution',
      description: 'Submits and evaluates the candidate\'s final solution for the current coding problem. Use this when the candidate explicitly says they\'re done or ready to submit their solution.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The candidate\'s final code solution',
          },
          explanation: {
            type: 'string',
            description: 'The candidate\'s explanation of their approach and solution',
          },
        },
        required: ['code'],
      },
    },
  },
];

/**
 * Tool names enum for type safety
 * NOTE: ASK_NEXT_QUESTION and SKIP_QUESTION are Node-controlled, not LLM tools
 */
export enum ToolName {
  // Flow control tools (Node-controlled, not available to LLM)
  ASK_NEXT_QUESTION = 'ask_next_question', // Used by Node only
  SKIP_QUESTION = 'skip_question', // Used by Node only
  // LLM-available tools
  PROVIDE_HINT = 'provide_hint',
  PROVIDE_CLARIFICATION = 'provide_clarification',
  EVALUATE_ANSWER = 'evaluate_answer',
  ANALYZE_CODE = 'analyze_code',
  SUBMIT_SOLUTION = 'submit_solution',
}

/**
 * Tool parameter types
 */
export interface ProvideHintParams {
  context?: string;
}

export interface ProvideClarificationParams {
  clarification_request: string;
}

export interface EvaluateAnswerParams {
  answer: string;
}

export interface SkipQuestionParams {
  reason?: string;
}

export interface AnalyzeCodeParams {
  code: string;
  question?: string;
}

export interface SubmitSolutionParams {
  code: string;
  explanation?: string;
}

/**
 * Tool result type
 */
export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  shouldSpeak?: boolean; // Whether agent should speak the message
}

// Also export as interviewTools for backward compatibility
export { toolDefinitions as interviewTools };
