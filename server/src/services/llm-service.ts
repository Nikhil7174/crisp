import OpenAI from 'openai'
import { EventEmitter } from 'events'

export interface Question {
  id: string
  question: string
  expectedAnswer: string
  keyPoints: string[]
  followUps?: FollowUp[]
}

export interface FollowUp {
  trigger: string | string[]
  question: string
  expectedAnswer: string
  keyPoints: string[]
}

export interface Evaluation {
  questionId: string
  candidateAnswer: string
  keyPointsCovered: string[]
  score: number
  needsFollowUp: boolean
  followUpQuestion?: string
  feedback: string
}

export interface IntentDetection {
  intent: 'answer' | 'hint_request' | 'clarification_request'
  confidence: number
}

export interface CodeAnalysis {
  progress: number // 0-100
  approach: 'correct' | 'incorrect' | 'incomplete' | 'unsure'
  isStuck: boolean
  issues: string[]
  suggestedHint?: string
  hintLevel: 1 | 2 | 3
  timeStuck: number // milliseconds
  codeQuality: 'good' | 'fair' | 'poor'
  testable: boolean
}

export interface LLMConfig {
  apiKey: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export class LLMService extends EventEmitter {
  private openai: OpenAI
  private config: LLMConfig
  private conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  constructor(config: LLMConfig) {
    super()
    this.config = config
    this.openai = new OpenAI({ apiKey: config.apiKey })
  }

  // Validate follow-up criteria programmatically
  private validateFollowUpCriteria(evaluation: Evaluation, followUpDepth: number): Evaluation {
    console.log('🔍 [LLM-Server] Validating follow-up criteria:', {
      score: evaluation.score,
      needsFollowUp: evaluation.needsFollowUp,
      followUpDepth,
      keyPointsCovered: evaluation.keyPointsCovered.length
    })

    // Rule 1: Never ask follow-up if already in a follow-up (followUpDepth > 0)
    if (followUpDepth > 0) {
      console.log('🚫 [LLM-Server] Blocking follow-up: already in follow-up mode')
      return {
        ...evaluation,
        needsFollowUp: false,
        followUpQuestion: undefined
      }
    }

    // Rule 2: Only ask follow-up if score < 60
    if (evaluation.needsFollowUp && evaluation.score >= 60) {
      console.log('🚫 [LLM-Server] Blocking follow-up: score >= 60 (score:', evaluation.score, ')')
      return {
        ...evaluation,
        needsFollowUp: false,
        followUpQuestion: undefined
      }
    }

    // Rule 3: Must have a follow-up question if needsFollowUp is true
    if (evaluation.needsFollowUp && !evaluation.followUpQuestion) {
      console.log('🚫 [LLM-Server] Blocking follow-up: no follow-up question provided')
      return {
        ...evaluation,
        needsFollowUp: false,
        followUpQuestion: undefined
      }
    }

    console.log('✅ [LLM-Server] Follow-up validation result:', {
      allowed: evaluation.needsFollowUp,
      reason: evaluation.needsFollowUp ? 'criteria met' : 'not needed'
    })

    return evaluation
  }

  async evaluateAnswer(question: Question, candidateAnswer: string, followUpDepth: number = 0, maxTheoreticalQuestions: number = 10): Promise<Evaluation> {
    console.log('🔍 [LLM-Server] evaluateAnswer called with:', {
      questionId: question.id,
      followUpDepth,
      candidateAnswerLength: candidateAnswer.length
    })
    
    try {
      const systemPrompt = `You are an AI interviewer evaluating a candidate's technical answer. Your job is to assess how well they covered the key points and determine if a follow-up is needed.

QUESTION: ${question.question}
EXPECTED ANSWER: ${question.expectedAnswer}
KEY POINTS TO COVER: ${question.keyPoints.join(', ')}

EVALUATION CRITERIA:
1. Score (0-100): Based on how many key points they covered and accuracy
2. Key Points Covered: List specific points they mentioned correctly
3. Needs Follow-up: ONLY set to true if ALL these conditions are met:
   - Score is BELOW 60
   - They missed MULTIPLE important key points (not just few minor details)
   - A follow-up could significantly improve their understanding
4. Follow-up Question: Only if needsFollowUp is true - ask about the most important missed points
5. Feedback: Constructive, encouraging, and specific

SCORING GUIDE:
- 90-100: Covered all key points accurately with good detail
- 80-89: Covered most key points well, minor gaps
- 70-79: Covered main points, some important details missing
- 60-69: Partial understanding, but acceptable - covered some key points
- 50-59: Basic understanding but missing key concepts
- 0-49: Major gaps or incorrect information

FOLLOW-UP DECISION RULES (STRICTLY ENFORCE):
✓ Ask follow-up ONLY if: score < 60 AND multiple key points missed
✗ DO NOT ask follow-up if: score >= 60 (even if they missed some details)
✗ DO NOT ask follow-up if: they covered most key points (even with minor gaps)

EXAMPLES:

Example 1 - Good Answer (no follow-up):
{
  "keyPointsCovered": ["function scope", "hoisting", "block scope", "reassignment"],
  "score": 85,
  "needsFollowUp": false,
  "feedback": "Excellent! You covered the main differences between var, let, and const including scope and hoisting behavior."
}

Example 2 - Decent Answer (no follow-up even with gaps):
{
  "keyPointsCovered": ["function scope", "block scope", "reassignment"],
  "score": 65,
  "needsFollowUp": false,
  "feedback": "Good job! You covered the main differences including scope and reassignment. You got the key concepts right."
}

Example 3 - Weak Answer (follow-up needed):
{
  "keyPointsCovered": ["scope"],
  "score": 45,
  "needsFollowUp": true,
  "followUpQuestion": "You mentioned scope, but can you explain the specific differences between var, let, and const in terms of scope, hoisting, and reassignment?",
  "feedback": "You're on the right track mentioning scope! Let's dive deeper into the specific differences between these three variable declarations."
}

NOTE: If needsFollowUp is false, omit the followUpQuestion field entirely (don't include it as null).

IMPORTANT: 
- Return ONLY valid JSON, no other text
- Be generous with scores for partial understanding
- STRICTLY: needsFollowUp = false if score >= 60
- Only ask follow-ups when the answer is significantly incomplete (score < 60)
- Keep feedback encouraging and constructive`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Candidate's answer: ${candidateAnswer}` }
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: this.config.maxTokens || 500
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      console.log('LLM Response content:', content)

      let evaluation: Omit<Evaluation, 'questionId' | 'candidateAnswer'>
      
      try {
        evaluation = JSON.parse(content)
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content)
        console.error('Parse error:', parseError)
        
        // Fallback: create a basic evaluation
        evaluation = {
          keyPointsCovered: [],
          score: 0,
          needsFollowUp: false,
          followUpQuestion: undefined,
          feedback: "I had trouble processing your answer. Could you please try again?"
        }
      }
      
      const result = {
        questionId: question.id,
        candidateAnswer,
        ...evaluation
      }
      
      // Validate follow-up criteria programmatically (safety check)
      const validatedResult = this.validateFollowUpCriteria(result, followUpDepth)
      
      console.log('🔍 [LLM-Server] evaluateAnswer final result:', {
        questionId: validatedResult.questionId,
        needsFollowUp: validatedResult.needsFollowUp,
        score: validatedResult.score,
        keyPointsCovered: validatedResult.keyPointsCovered.length,
        wasModified: validatedResult.needsFollowUp !== result.needsFollowUp
      })
      
      return validatedResult
    } catch (error) {
      console.error('Error evaluating answer:', error)
      throw error
    }
  }

  async generateFollowUp(question: Question, candidateAnswer: string): Promise<string> {
    try {
      const systemPrompt = `You are an AI interviewer. Generate a thoughtful follow-up question based on the candidate's answer.

Original Question: ${question.question}
Candidate's Answer: ${candidateAnswer}

Generate a follow-up question that:
1. Builds on their answer
2. Tests deeper understanding
3. Is relevant to the topic
4. Is conversational and natural

Respond with just the follow-up question text.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a follow-up question.` }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 200
      })

      return response.choices[0]?.message?.content || 'Could you tell me more about that?'
    } catch (error) {
      console.error('Error generating follow-up:', error)
      return 'Could you elaborate on that point?'
    }
  }

  async analyzeCode(code: string, problem: string, language: string = 'javascript'): Promise<CodeAnalysis> {
    try {
      const systemPrompt = `You are an AI code reviewer analyzing a candidate's code progress.

Problem: ${problem}
Language: ${language}

Analyze the code and provide:
1. Progress percentage (0-100)
2. Approach assessment (correct/incorrect/incomplete/unsure)
3. Whether candidate is stuck (boolean)
4. Issues found (array of strings)
5. Suggested hint if stuck (string)
6. Hint level (1-3, where 1=gentle, 2=moderate, 3=direct)
7. Time stuck estimate in milliseconds
8. Code quality (good/fair/poor)
9. Whether code is testable (boolean)

Respond in JSON format with these exact fields:
{
  "progress": 60,
  "approach": "correct",
  "isStuck": false,
  "issues": ["missing edge case", "inefficient algorithm"],
  "suggestedHint": "Consider handling the edge case where...",
  "hintLevel": 2,
  "timeStuck": 0,
  "codeQuality": "good",
  "testable": true
}`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Code to analyze:\n\`\`\`${language}\n${code}\n\`\`\`` }
        ],
        temperature: this.config.temperature || 0.2,
        max_tokens: this.config.maxTokens || 800
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      return JSON.parse(content) as CodeAnalysis
    } catch (error) {
      console.error('Error analyzing code:', error)
      throw error
    }
  }

  async generateResponse(context: string, conversationHistory: Array<{ role: string; content: string }>): Promise<string> {
    try {
      const systemPrompt = `You are an AI interviewer conducting a technical interview. 
      
Context: ${context}

Respond naturally and professionally. Keep responses concise but helpful.`

      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map(msg => ({ role: msg.role, content: msg.content }))
      ]

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: messages as any,
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 300
      })

      return response.choices[0]?.message?.content || 'I understand. Please continue.'
    } catch (error) {
      console.error('Error generating response:', error)
      return 'I understand. Please continue.'
    }
  }

  addToConversation(role: 'user' | 'assistant', content: string): void {
    this.conversationHistory.push({ role, content })
    
    // Keep only last 20 messages to manage context length
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20)
    }
  }

  getConversationHistory(): Array<{ role: string; content: string }> {
    return [...this.conversationHistory]
  }

  clearConversation(): void {
    this.conversationHistory = []
  }

  // Follow-up evaluation - separate from regular evaluation
  async evaluateFollowUpAnswer(
    originalQuestion: Question,
    originalCandidateAnswer: string,
    followUpQuestion: string,
    followUpAnswer: string,
    followUpDepth: number = 1
  ): Promise<Evaluation> {
    console.log('🔍 [LLM-Server] evaluateFollowUpAnswer called with:', {
      originalQuestionId: originalQuestion.id,
      followUpDepth,
      followUpAnswerLength: followUpAnswer.length,
      followUpQuestion: followUpQuestion.substring(0, 50) + '...'
    })
    
    try {
      const systemPrompt = `You are an AI interviewer evaluating a follow-up answer in a technical interview. This is a follow-up question based on the original question.

ORIGINAL QUESTION: ${originalQuestion.question}
ORIGINAL CANDIDATE ANSWER: ${originalCandidateAnswer}
FOLLOW-UP QUESTION: ${followUpQuestion}
FOLLOW-UP CANDIDATE ANSWER: ${followUpAnswer}
FOLLOW-UP DEPTH: ${followUpDepth}

CONTEXT: The candidate first answered the original question, then you asked a follow-up question to dig deeper. Now you're evaluating their answer to the follow-up question.

EVALUATION RULES:
1. Evaluate the follow-up answer against the FOLLOW-UP QUESTION context
2. Consider the original answer for context and continuity
3. Since this is a follow-up, ALWAYS set needsFollowUp: false (move to next question)
4. Provide constructive feedback on their follow-up answer
5. Acknowledge their progress from original to follow-up answer
6. Dont ask another question, just evaluate the follow-up answer

SCORING GUIDE:
- 90-100: Excellent follow-up answer, shows deep understanding
- 80-89: Good follow-up answer, addresses the follow-up well
- 70-79: Decent follow-up answer, some gaps but shows understanding
- 60-69: Basic follow-up answer, missing some key points
- 50-59: Incomplete follow-up answer, needs more detail
- 0-49: Poor follow-up answer, doesn't address the follow-up

EXAMPLES:

Example 1 - Good Follow-up Answer:
{
  "keyPointsCovered": ["hoisting behavior", "temporal dead zone", "block scoping"],
  "score": 85,
  "needsFollowUp": false,
  "feedback": "Great follow-up answer! You clearly explained the hoisting differences and the temporal dead zone concept. This shows a solid understanding of how var, let, and const behave differently."
}

Example 2 - Basic Follow-up Answer:
{
  "keyPointsCovered": ["hoisting"],
  "score": 65,
  "needsFollowUp": false,
  "feedback": "Okay, you mentioned that var is hoisted while let and const are not. This is correct, and you're building well on your original answer about scope differences."
}

IMPORTANT: 
- Return ONLY valid JSON, no other text
- ALWAYS set needsFollowUp: false for follow-up evaluations
- Evaluate against the follow-up question, not the original
- Acknowledge if any progress is made and be encouraging`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Evaluate this follow-up answer: ${followUpAnswer}` }
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: this.config.maxTokens || 500
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      let evaluation: Omit<Evaluation, 'questionId' | 'candidateAnswer'>
      
      try {
        evaluation = JSON.parse(content)
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content)
        console.error('Parse error:', parseError)
        
        // Fallback: create a basic evaluation
        evaluation = {
          keyPointsCovered: [],
          score: 0,
          needsFollowUp: false, // Always false for follow-up
          followUpQuestion: undefined,
          feedback: "I had trouble processing your follow-up answer. Could you please try again?"
        }
      }
      
      const result = {
        questionId: originalQuestion.id, // Use original question ID
        candidateAnswer: followUpAnswer, // Use follow-up answer
        ...evaluation
      }
      
      console.log('🔍 [LLM-Server] evaluateFollowUpAnswer result:', {
        questionId: result.questionId,
        needsFollowUp: result.needsFollowUp,
        score: result.score,
        keyPointsCovered: result.keyPointsCovered.length,
        isFollowUp: true
      })
      
      return result
    } catch (error) {
      console.error('Error evaluating follow-up answer:', error)
      throw error
    }
  }

  // Intent detection - separate from evaluation
  async detectIntent(candidateInput: string): Promise<IntentDetection> {
    try {
      const systemPrompt = `You are an AI interviewer analyzing candidate input during a technical interview. Classify the intent and respond with ONLY a valid JSON object.

CLASSIFY the candidate's input as one of:

1. "answer" - They are providing a substantive answer to the technical question
   - Contains technical concepts, explanations, or detailed responses
   - Examples: "var has function scope and is hoisted, let has block scope..."
   - Even incomplete answers that show understanding should be classified as "answer"

2. "hint_request" - They are explicitly asking for help, hints, or guidance
   - Contains phrases like: "I need help", "can you give me a hint", "I'm stuck", "what should I focus on"
   - Examples: "Can you give me a hint about this?", "I'm not sure where to start"

3. "clarification_request" - They are asking for clarification about the question itself
   - Contains phrases like: "what do you mean by", "can you clarify", "I don't understand the question"
   - Examples: "What do you mean by scope?", "Can you clarify what you're asking?"

SCORING GUIDELINES:
- If they provide ANY technical content related to the question → "answer" (even if incomplete)
- If they explicitly ask for help → "hint_request"  
- If they ask about the question itself → "clarification_request"
- When in doubt, default to "clarification_request"

Respond with:
{
  "intent": "answer",
  "confidence": 0.95
}

IMPORTANT: Return ONLY valid JSON, no other text.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Candidate input: ${candidateInput}` }
        ],
        temperature: this.config.temperature || 0.1,
        max_tokens: this.config.maxTokens || 100
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      const parsed = JSON.parse(content) as IntentDetection
      
      // Validate intent value - ensure it's one of the 3 valid options
      const validIntents = ['answer', 'hint_request', 'clarification_request'] as const
      if (!parsed.intent || !validIntents.includes(parsed.intent as any)) {
        console.warn('Invalid intent value received:', parsed.intent, '- defaulting to "clarification_request"')
        return { intent: 'clarification_request', confidence: parsed.confidence || 0.5 }
      }

      return parsed
    } catch (error) {
      console.error('Error detecting intent:', error)
      // Default to answer if detection fails
      return { intent: 'answer', confidence: 0.5 }
    }
  }

  // Hint generation - separate function
  async generateHint(question: Question, candidateAnswer: string): Promise<string> {
    try {
      const systemPrompt = `You are an AI interviewer providing helpful hints during a technical interview. Generate a constructive hint that guides the candidate toward the right direction without giving away the complete answer.

QUESTION: ${question.question}
KEY POINTS TO CONSIDER: ${question.keyPoints.join(', ')}

HINT GUIDELINES:
1. Provide helpful guidance - point them to important concepts and areas to explore
2. You can briefly explain what to think about, but don't give the full answer
3. Mention 2-3 key topics or aspects they should consider
4. Keep it conversational and natural
5. You can give a small example or analogy if it helps clarify the concept
6. Guide them toward the right thinking process
7. Get STRAIGHT TO THE POINT - no conversational openings

CRITICAL FORMAT RULES:
- DO NOT start with phrases like "Great question!", "That's a great topic!", "Good question!", etc.
- DO NOT include conversational greetings or acknowledgments
- START DIRECTLY with the actual hint content
- Keep it to 2-4 sentences

BALANCE:
- DO provide meaningful direction and helpful context
- DO explain what aspects to focus on
- DO mention specific concepts or mechanisms to consider
- DON'T write out the complete answer verbatim
- DON'T solve the entire problem for them
- DON'T include conversational pleasantries

EXAMPLES OF GOOD HINTS (note: direct, no opening phrases):

For a question about JavaScript var/let/const:
"Start by considering the differences in scope—how does each variable type behave in terms of block scope versus function scope? Also, think about hoisting: what happens to these variables before the code runs? Finally, consider whether you can reassign values to these variables after they are declared."

For a question about React hooks:
"Consider how hooks connect to the React lifecycle. When you call useState or useEffect, think about when they run during a component's lifecycle. Also, remember that hooks must follow certain rules about where and how they're called."

For a question about async/await:
"Focus on how JavaScript handles asynchronous operations. Async/await is built on Promises, so think about what Promise states exist and how await pauses execution. Consider what happens to the call stack when you await something."

For a question about database normalization:
"Think about the main goal: reducing redundancy and improving data integrity. Consider what happens when you have repeated data across multiple rows. The normal forms (1NF, 2NF, 3NF) each address specific types of redundancy - focus on breaking down data into logical, related tables."

REMEMBER: Start DIRECTLY with the hint. No greetings, no acknowledgments, no "great question" phrases.

Respond with just the hint text (no quotes or formatting).`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a helpful hint that guides the candidate in the right direction.` }
        ],
        temperature: this.config.temperature || 0.7,
        max_tokens: this.config.maxTokens || 250
      })

      return response.choices[0]?.message?.content || 'Think about the key concepts: ' + (question.keyPoints[0] || 'the main topic') + '. Consider what aspects are most important and how they relate to each other.'
    } catch (error) {
      console.error('Error generating hint:', error)
      return 'Think about the key concepts: ' + (question.keyPoints[0] || 'the main topic') + '. How would you approach this?'
    }
  }

  // Clarification generation - separate function
  async generateClarification(question: Question): Promise<string> {
    try {
      const systemPrompt = `You are an AI interviewer providing clarification. Rephrase the question in a clearer way to help the candidate understand what you're asking.

Original Question: ${question.question}
Expected Answer: ${question.expectedAnswer}
Key Points: ${question.keyPoints.join(', ')}

Rephrase the question to be clearer and more specific. You can:
1. Break it down into parts
2. Use simpler language
3. Add context or examples
4. Focus on the specific aspects you want them to address

Respond with just the clarified question.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Clarify this question.` }
        ],
        temperature: this.config.temperature || 0.5,
        max_tokens: this.config.maxTokens || 300
      })

      return response.choices[0]?.message?.content || `Let me rephrase that: ${question.question}`
    } catch (error) {
      console.error('Error generating clarification:', error)
      return `Let me rephrase that: ${question.question}`
    }
  }

  // Evaluate coding approach explanation
  async evaluateCodingApproach(explanation: string, problem: any): Promise<{
    isApproach: boolean
    isCorrect?: boolean
    isClarification: boolean
    feedback?: string
    clarification?: string
  }> {
    try {
      const systemPrompt = `You are an AI interviewer evaluating a candidate's approach to a coding problem.

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

The candidate said: "${explanation}"

Analyze their statement and determine:
1. Are they explaining their approach/solution strategy? (isApproach)
2. If it's an approach, is it correct/will it work? (isCorrect)
3. Are they asking a clarifying question about the problem? (isClarification)

If it's an approach:
- If CORRECT: Provide encouraging feedback (1 sentence)
- If INCORRECT: Provide a MINOR hint about what they're missing (1 sentence, don't give away the solution)

If it's a clarification request:
- Provide a brief answer to their question

Respond with JSON:
{
  "isApproach": boolean,
  "isCorrect": boolean (only if isApproach is true),
  "isClarification": boolean,
  "feedback": "string" (for approach feedback),
  "clarification": "string" (for clarification response)
}`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Evaluate: "${explanation}"` }
        ],
        temperature: 0.3,
        max_tokens: 200
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response
      const evaluation = JSON.parse(content)
      return evaluation

    } catch (error) {
      console.error('Error evaluating coding approach:', error)
      // Fallback response
      return {
        isApproach: true,
        isCorrect: true,
        isClarification: false,
        feedback: "I understand. Continue with your implementation."
      }
    }
  }

}

export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config)
}


