import OpenAI from 'openai'
import { EventEmitter } from 'events'
import { FinalEvaluationPayload } from '../models/types'

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
  intent: 'answer' | 'hint_request' | 'clarification_request' | 'skip_question'
  confidence: number
}

export interface CodeAnalysis {
  progress: number // 0-100
  approach: 'correct' | 'incorrect' | 'incomplete' | 'unsure'
  isStuck: boolean
  issues: string[]
  suggestedHint?: string
  hintLevel: 1 | 2 | 3
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
    
    const systemPrompt = `You are an AI interviewer evaluating a candidate's technical answer in a VOICE INTERVIEW. Your job is to assess how well they covered the key points and determine if a follow-up is needed.

IMPORTANT CONTEXT - VOICE INTERVIEW & SPEECH-TO-TEXT:
- This is a verbal interview - the candidate is speaking, not typing
- The candidate's answer comes from speech-to-text (STT) transcription
- STT transcription can have spelling errors, especially for technical jargon
- Examples: "componentDidMount" might be transcribed as "cmponent debt mount", "useEffect" as "use effect", "useState" as "use state"
- DO NOT penalize for spelling errors that look similar to technical terms
- Focus on understanding the MEANING and CONCEPTS, not exact spelling
- If a misspelled word sounds similar to a technical term, assume the candidate meant the correct term
- Only flag actual grammatical errors in sentence structure, not STT transcription errors

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

    const maxRetries = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [LLM-Server] Calling OpenAI API (attempt ${attempt}/${maxRetries})`)
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
      } catch (error: any) {
        lastError = error
        const isRetryableError = error.status === 429 || // Rate limit
                                error.status >= 500 ||   // Server errors
                                error.code === 'ETIMEDOUT' ||
                                error.message?.includes('timeout') ||
                                error.type === 'server_error' ||
                                error.type === 'rate_limit_error'
        
        console.error(`❌ [LLM-Server] OpenAI API error (attempt ${attempt}/${maxRetries}):`, error.message || error)
        
        if (isRetryableError && attempt < maxRetries) {
          const retryDelay = 2000 * attempt // Exponential backoff: 2s, 4s
          console.log(`🔄 [LLM-Server] Retryable error detected, retrying in ${retryDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // If not retryable or last attempt, break and throw
        if (!isRetryableError || attempt === maxRetries) {
          break
        }
      }
    }

    // All retries failed - throw error
    console.error('❌ [LLM-Server] All retry attempts failed')
    throw lastError || new Error('Failed to evaluate answer after retries')
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

  async analyzeCode(code: string, problem: string, language: string = 'javascript', previousCode: string = ''): Promise<CodeAnalysis> {
    try {
      const hasPreviousCode = previousCode && previousCode.trim().length > 0
      const previousCodeSection = hasPreviousCode ? 
        `\n\nCode from ~1 minute ago (for comparison):\n\`\`\`${language}\n${previousCode}\n\`\`\`` : 
        '\n\n(No previous code - first analysis)'
      
      const systemPrompt = `You are an AI code reviewer analyzing a candidate's code progress.

Problem: ${problem}
Language: ${language}

IMPORTANT: 
- Analyze the ACTUAL CODE that was written
- Compare CURRENT code with PREVIOUS code (if provided) to determine if stuck
- If code hasn't changed much or candidate is rewriting same thing, they're stuck
- Be specific about what's implemented, what's working, and what's not

Analyze the code and provide:
1. Progress percentage (0-100) - Based on actual implementation, not just approach
2. Approach assessment (correct/incorrect/incomplete/unsure) - Is their approach right?
3. **Whether candidate is stuck (boolean)** - Compare current vs previous code:
   - If no significant progress between current and previous: STUCK = true
   - If rewriting same logic differently: STUCK = true  
   - If new functionality added: STUCK = false
   - If making meaningful progress: STUCK = false
4. Issues found (array of strings) - BE SPECIFIC: "Your loop starts at index 1 instead of 0", "Missing null check for edge case", "Using O(n^2) algorithm instead of O(n)"
5. Suggested hint if stuck (string) - Specific to their current code
6. Hint level (1-3, where 1=gentle, 2=moderate, 3=direct)
7. Code quality (good/fair/poor) - Based on actual code written
8. Whether code is testable (boolean)

EXAMPLES OF GOOD ISSUES:
✓ "Your loop condition checks i < n but should be i <= n to include the last element"
✓ "You're not handling the case when the input array is empty"
✓ "The algorithm has O(n^2) time complexity due to nested loops, which won't scale"
✗ "Logic error" (too vague)
✗ "Edge case missing" (not specific enough)
✗ "Inefficient" (not explaining why)

Respond in JSON format with these exact fields:
{
  "progress": 60,
  "approach": "correct",
  "isStuck": false,
  "issues": ["Your loop starts at 1 but should start at 0", "Missing check for empty array"],
  "suggestedHint": "Check your loop initialization - arrays in C++ are 0-indexed",
  "hintLevel": 2,
  "codeQuality": "good",
  "testable": true
}`

      const userContent = `Current code:\n\`\`\`${language}\n${code}\n\`\`\`${previousCodeSection}\n\nAnalyze the current code and determine if candidate is stuck by comparing it with previous code.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: this.config.temperature || 0.2,
        max_tokens: this.config.maxTokens || 800
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      // Extract JSON from markdown code blocks if present
      let jsonContent = content.trim()
      const jsonMatch = jsonContent.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        jsonContent = jsonMatch[1].trim()
      }

      console.log('[analyzeCode] Raw LLM response:', content.substring(0, 200))
      console.log('[analyzeCode] Extracted JSON:', jsonContent.substring(0, 200))

      return JSON.parse(jsonContent) as CodeAnalysis
    } catch (error) {
      console.error('Error analyzing code:', error)
      if (error instanceof Error) {
        console.error('Error details:', error.message)
        console.error('Error stack:', error.stack)
      }
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
    
    const systemPrompt = `You are an AI interviewer evaluating a follow-up answer in a VOICE INTERVIEW. This is a follow-up question based on the original question.

IMPORTANT CONTEXT - VOICE INTERVIEW & SPEECH-TO-TEXT:
- This is a verbal interview - the candidate is speaking, not typing
- The candidate's answer comes from speech-to-text (STT) transcription
- STT transcription can have spelling errors, especially for technical jargon
- Examples: "componentDidMount" might be transcribed as "cmponent debt mount", "useEffect" as "use effect", "useState" as "use state"
- DO NOT penalize for spelling errors that look similar to technical terms
- Focus on understanding the MEANING and CONCEPTS, not exact spelling
- If a misspelled word sounds similar to a technical term, assume the candidate meant the correct term
- Only flag actual grammatical errors in sentence structure, not STT transcription errors

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

    const maxRetries = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [LLM-Server] Calling OpenAI API for follow-up (attempt ${attempt}/${maxRetries})`)
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
      } catch (error: any) {
        lastError = error
        const isRetryableError = error.status === 429 || // Rate limit
                                error.status >= 500 ||   // Server errors
                                error.code === 'ETIMEDOUT' ||
                                error.message?.includes('timeout') ||
                                error.type === 'server_error' ||
                                error.type === 'rate_limit_error'
        
        console.error(`❌ [LLM-Server] OpenAI API error for follow-up (attempt ${attempt}/${maxRetries}):`, error.message || error)
        
        if (isRetryableError && attempt < maxRetries) {
          const retryDelay = 2000 * attempt // Exponential backoff: 2s, 4s
          console.log(`🔄 [LLM-Server] Retryable error detected, retrying in ${retryDelay}ms...`)
          await new Promise(resolve => setTimeout(resolve, retryDelay))
          continue
        }
        
        // If not retryable or last attempt, break and throw
        if (!isRetryableError || attempt === maxRetries) {
          break
        }
      }
    }

    // All retries failed - throw error
    console.error('❌ [LLM-Server] All retry attempts failed for follow-up evaluation')
    throw lastError || new Error('Failed to evaluate follow-up answer after retries')
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

4. "skip_question" - They want to skip the question or don't know the answer
   - Contains phrases like: "skip this", "I don't know", "next question", "pass"
   - Examples: "I have no idea", "Can we skip this one?"

SCORING GUIDELINES:
- If they provide ANY technical content related to the question → "answer" (even if incomplete)
- If they explicitly ask for help → "hint_request"  
- If they ask about the question itself → "clarification_request"
- If they explicitly say they don't know or want to skip → "skip_question"
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
      const validIntents = ['answer', 'hint_request', 'clarification_request', 'skip_question'] as const
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
      // IMPORTANT: Do NOT include all keyPoints - only use the question text to avoid revealing too much
      const questionText = question.question

      const systemPrompt = `You are an AI interviewer providing subtle hints during a technical interview. Your goal is to nudge the candidate in the right direction while leaving MOST of the answer for them to discover and explain.

QUESTION: ${questionText}

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. Provide ONLY a subtle nudge - point to a general area or direction, NOT specific concepts
2. Cover AT MOST 1-2 aspects of the answer - leave the rest for the candidate to explain
3. Use vague, general language - avoid specific technical terms that reveal key points
4. Do NOT mention multiple key points or concepts - that gives away too much
5. Do NOT provide step-by-step guidance or cover all aspects
6. Do NOT ask follow-up questions about details - that implies you've given the answer
7. Keep it brief (1-2 sentences maximum)
8. Get STRAIGHT TO THE POINT - no conversational openings

WHAT TO DO:
- Point to a general area: "Think about how this relates to [general concept area]"
- Suggest a direction: "Consider what happens in [broad scenario]"
- Use vague prompts: "What aspects of [general topic] might be relevant here?"

WHAT NOT TO DO:
- Do NOT list multiple concepts or key points
- Do NOT mention specific mechanisms, algorithms, or techniques
- Do NOT cover multiple aspects of the answer
- Do NOT ask "What about X?" or "Can you explain Y?" - this implies you've given the answer
- Do NOT provide examples that reveal the solution approach
- Do NOT start with phrases like "Great question!", "That's a great topic!", etc.

EXAMPLES OF GOOD HINTS (subtle, leaving most for candidate):

For a question about JavaScript var/let/const:
"Consider how variable declarations might behave differently depending on where they're used in your code."

For a question about React hooks:
"Think about how React manages component state and side effects over time."

For a question about async/await:
"Consider how JavaScript handles operations that take time to complete."

For a question about database normalization:
"Think about what problems can arise when the same data appears in multiple places."

BAD EXAMPLES (too revealing - DON'T do this):
- "Start by considering scope differences, hoisting, and reassignment..." (covers too many aspects)
- "Think about block scope vs function scope, hoisting behavior, and whether values can be reassigned..." (gives away key points)
- "Consider useState and useEffect lifecycle, and remember hooks rules..." (too specific)

REMEMBER: 
- A hint should be a gentle nudge, not a roadmap
- Leave at least 70-80% of the answer for the candidate to explain
- If you're covering multiple points, you're giving away too much
- Start DIRECTLY with the hint - no greetings or acknowledgments

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
      // IMPORTANT: Only use the question text itself - do NOT use keyPoints or expectedAnswer
      const questionText = question.question

      const systemPrompt = `You are an AI interviewer providing clarification. Your ONLY job is to rephrase the question in a clearer way WITHOUT revealing the answer or any solution details.

Original Question: ${questionText}

CRITICAL RULES - YOU MUST FOLLOW THESE STRICTLY:
1. ONLY use information that is explicitly stated in the question text above
2. Do NOT reveal, hint at, or suggest:
   - The answer or solution
   - Key concepts or topics that would give away the answer
   - Specific techniques, algorithms, or approaches
   - What the candidate should focus on or consider
   - Any details that are not directly visible in the question text
3. You can ONLY:
   - Rephrase the question using simpler, clearer language
   - Break down complex sentences into simpler parts
   - Clarify ambiguous wording using only the context from the question itself
   - Restate what is being asked without adding new information
4. If the question is unclear, rephrase it using ONLY the words and concepts already present in the question
5. Do NOT add examples, analogies, or explanations that aren't in the original question
6. Keep it brief (1-2 sentences maximum)

EXAMPLES OF WHAT TO DO:
- If question says "Explain how X works", you can say "Can you describe the mechanism or process of X?"
- If question is complex, break it into simpler parts: "The question is asking about two things: first, [part 1 from question], and second, [part 2 from question]"

EXAMPLES OF WHAT NOT TO DO:
- Do NOT say "Think about [concept]" - this hints at the answer
- Do NOT say "Consider [specific approach]" - this reveals the solution
- Do NOT add context like "This relates to [topic]" - this gives away key points

Respond with just the rephrased clarification. Do NOT include any answer, solution, key points, or hints.`

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

  // Evaluate coding approach explanation with scoring
  async evaluateCodingApproach(explanation: string, problem: any, starterCode: string = '', currentCode: string = '', isFirstApproach: boolean = false): Promise<{
    isApproach: boolean
    score?: number
    isCorrect?: boolean
    isClarification: boolean
    feedback?: string
    clarification?: string
  }> {
    try {
      const starterContext = starterCode ? `\n\nStarter code provided to candidate:\n\`\`\`\n${starterCode}\n\`\`\`` : ''
      const codeContext = currentCode ? `\n\nCurrent code written by candidate:\n\`\`\`\n${currentCode}\n\`\`\`` : ''
      
      const systemPrompt = `You are an AI interviewer evaluating a candidate's approach to a coding problem in a VOICE INTERVIEW.

IMPORTANT CONTEXT - VOICE INTERVIEW & SPEECH-TO-TEXT:
- This is a verbal interview - the candidate is speaking, not typing
- The candidate's explanation comes from speech-to-text (STT) transcription
- STT transcription can have spelling errors, especially for technical jargon
- Examples: "componentDidMount" might be transcribed as "cmponent debt mount", "useEffect" as "use effect", "useState" as "use state", "binary search" as "binary search" or "binary research"
- DO NOT penalize for spelling errors that look similar to technical terms
- Focus on understanding the MEANING and CONCEPTS, not exact spelling
- If a misspelled word sounds similar to a technical term, assume the candidate meant the correct term
- Only flag actual grammatical errors in sentence structure, not STT transcription errors

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}${starterContext}${codeContext}

The candidate said: "${explanation}"

Analyze their statement and determine:
1. Are they explaining their approach/solution strategy? (isApproach)
2. If it's an approach, score it (0-100) based on:
   - Correctness of approach (40 points)
   - Data structure selection (20 points)
   - Algorithm selection (20 points)
   - Constraint consideration (20 points)
3. Are they asking a clarifying question about the problem? (isClarification)

SCORING RULES FOR APPROACH:
- Score > 70 OR uses correct algo AND data structure: Give positive feedback "You're on the right track! Go ahead and implement it."
- Score <= 70: Provide constructive feedback about what's WRONG in their current approach. 
  CRITICAL: Do NOT reveal the correct approach, algorithm, or data structure.
  CRITICAL: Do NOT suggest what they should use instead.
  CRITICAL: Only point out issues/problems in their current approach (e.g., "Your approach might have issues with time complexity" or "This might not handle edge cases properly").
  CRITICAL: After pointing out what's wrong, always tell them to implement their code anyway: "Please go ahead and implement your solution."

IMPORTANT - IMPLEMENTATION PROMPT:
${isFirstApproach ? '- This is the FIRST time the candidate is explaining their approach. Your feedback MUST end with a prompt to start implementing, such as "Please start implementing your solution." or "Go ahead and start coding."' : '- This is NOT the first approach explanation. Still end with "Please go ahead and implement your solution" after pointing out what\'s wrong.'}

If it's a clarification request:
- Provide a brief, helpful answer to their question without leaking the solution

Respond with JSON:
{
  "isApproach": boolean,
  "score": number (0-100, only if isApproach is true),
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
        max_tokens: 250
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      // Parse JSON response - handle both valid JSON and malformed responses
      let evaluation
      try {
        // Try to extract JSON from response (in case LLM adds extra text)
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          evaluation = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        console.error('Failed to parse evaluation response:', content)
        throw new Error(`Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      // Validate that we got a proper response structure
      if (typeof evaluation.isApproach !== 'boolean') {
        console.warn('Invalid evaluation structure, defaulting to unclear intent')
        throw new Error('Invalid evaluation structure')
      }

      return evaluation

    } catch (error) {
      console.error('Error evaluating coding approach:', error)
      // Conservative fallback: If we can't determine intent, ask for clarification
      // This prevents incorrectly treating unclear input as an approach
      return {
        isApproach: false,
        isClarification: false,
        feedback: "I'd like to hear your approach to solving this problem. How do you plan to tackle it?"
      }
    }
  }

  // Generate coding-specific clarification (with limit awareness)
  async generateCodingClarification(problem: any, clarificationRequest: string, clarificationCount: number, currentCode: string = ''): Promise<string> {
    try {
      // Check limit
      if (clarificationCount >= 5) {
        return "I've provided the maximum number of clarifications. Please proceed with the information you have."
      }

      const codeContext = currentCode ? `\n\nCurrent code written by candidate:\n\`\`\`\n${currentCode}\n\`\`\`` : ''
      
      const systemPrompt = `You are an AI interviewer providing clarification for a coding problem.

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}
Examples: ${JSON.stringify(problem.examples) || 'See problem description'}${codeContext}

Candidate's clarification request: "${clarificationRequest}"

CRITICAL RULES:
1. ONLY clarify what is already stated in the problem description - do NOT reveal the solution approach
2. Do NOT hint at algorithms, data structures, or techniques that would give away the answer
3. Do NOT provide step-by-step guidance or solution hints
4. ONLY rephrase or emphasize information already available in the problem statement

Provide a brief, direct clarification that:
1. Answers their specific doubt about the problem statement (not the solution)
2. Stays within the boundary of the question (doesn't leak the solution or approach)
3. Reiterates or makes clearer the already available information
4. Is individualistic and doesn't require previous context

Acceptable clarification types (only if already in problem):
- Constraint values: "The input n can be up to 10^5" (if already stated)
- Data structure choice: "You can use any built-in data structure" (if already stated)
- Output format: "Return the result as an integer" (if already stated)
- Edge cases: "Consider the case where the array is empty" (if already mentioned)

DO NOT provide:
- Algorithm suggestions
- Data structure recommendations (unless already stated)
- Solution approaches
- Step-by-step hints

Respond with just the clarification text (no preamble).`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Provide clarification for: "${clarificationRequest}"` }
        ],
        temperature: 0.5,
        max_tokens: 200
      })

      return response.choices[0]?.message?.content || `Let me clarify: ${problem.description}`
    } catch (error) {
      console.error('Error generating coding clarification:', error)
      return `Let me clarify: ${problem.description}`
    }
  }

  // Generate monitoring hint (for automatic 60s checks during code monitoring)
  async generateMonitoringHint(
    problem: any, 
    hintLevel: 1 | 2, 
    currentCode: string, 
    previousCode?: string | null,
    hasCodeChanged?: boolean,
    codeAnalysis?: any | null
  ): Promise<string> {
    try {
      const hasPreviousCode = previousCode && previousCode.trim().length > 0
      const codeComparison = hasPreviousCode ? 
        `\n\nCode from 1 minute ago (for comparison):\n\`\`\`\n${previousCode}\n\`\`\`` : 
        ''
      
      // Include code analysis if available
      const analysisContext = codeAnalysis ? 
        `\n\nCode Analysis:
- Progress: ${codeAnalysis.progress}%
- Approach: ${codeAnalysis.approach}
- Code Quality: ${codeAnalysis.codeQuality}
- Issues found: ${codeAnalysis.issues?.length > 0 ? codeAnalysis.issues.join('; ') : 'None detected'}
` : ''
      
      const systemPrompt = hintLevel === 1 ? 
        `You are an AI interviewer providing hints during CODE MONITORING phase (automatic 60-second checks).

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

Current code: ${currentCode || 'No code yet'}${codeComparison}${analysisContext}

CRITICAL INSTRUCTIONS FOR CODE MONITORING:
1. **If code is COMPLETE (progress > 85% AND approach is correct)**: 
   - Return encouraging message: "Your solution looks complete! Review it and submit when ready."
   - DO NOT give implementation hints if code is already complete
   
2. **If code has GOOD PROGRESS (progress 60-85%)**:
   - Point out what's missing or needs fixing
   - Be specific about next steps: "You need to handle the edge case where..." or "Your logic is correct, but you're missing..."
   
3. **If code has ISSUES (progress < 60%)**:
   - Analyze what's wrong with their current approach
   - Give specific hints: "Your loop condition is incorrect - you're checking X when you should check Y"
   
4. **If NO CODE or minimal code**:
   - Suggest data structures/approaches: "Try using a priority queue..." or "Consider a two-pointer approach"

IMPORTANT:
- Always analyze the ACTUAL code state first
- If code is complete, acknowledge it positively (don't give hints)
- Be specific and helpful - point out actual issues in their code
- Keep it brief (1-2 sentences)
- Don't give away the complete solution

HINT LEVEL 1: Focus on:
- Encouragement if code is good (progress > 85%)
- What's wrong with current approach (if code exists and has issues)
- What's the next step (if approach is correct but incomplete)
- Data structure suggestion (if no meaningful code yet)

Respond with just the message (no preamble).`
      :
        `You are an AI interviewer providing the SECOND hint during CODE MONITORING phase (automatic 60-second checks).

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

Current code: ${currentCode || 'No code yet'}${codeComparison}${analysisContext}

CRITICAL INSTRUCTIONS FOR CODE MONITORING:
1. **If code is COMPLETE (progress > 85% AND approach is correct)**: 
   - Return encouraging message: "Your solution looks complete! Review it and submit when ready."
   - DO NOT give implementation hints if code is already complete
   
2. **If code has GOOD PROGRESS (progress 60-85%)**:
   - Point out specific issues or what's missing
   - Be more direct: "You're missing the base case for your recursion" or "The time complexity can be improved by..."
   
3. **If code has ISSUES (progress < 60%)**:
   - Analyze what's wrong with their current approach
   - Give more specific hints: "Consider dynamic programming - think about overlapping subproblems"
   
4. **If NO CODE or minimal code**:
   - Suggest algorithm/technique: "Try a sliding window technique"

IMPORTANT:
- Always analyze the ACTUAL code state first
- If code is complete, acknowledge it positively (don't give hints)
- Be specific and helpful - point out actual issues in their code
- Keep it brief (1-2 sentences)
- Don't give away the complete solution

HINT LEVEL 2: Focus on:
- Encouragement if code is good (progress > 85%)
- What's wrong with current approach (if code exists and has issues)
- What's the next step (if approach is correct but incomplete)
- Algorithm/technique suggestion (if no meaningful code yet)

Respond with just the message (no preamble).`

      const userPrompt = hasCodeChanged ? 
        `The candidate has been working on this code. They seem stuck. Provide a helpful hint based on their current code and what they had before.` :
        `The candidate hasn't made significant code changes. Provide a hint to help them get started.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      })

      return response.choices[0]?.message?.content?.trim() || this.getDefaultHint(problem, hintLevel)
    } catch (error) {
      console.error('Error generating monitoring hint:', error)
      return this.getDefaultHint(problem, hintLevel)
    }
  }

  private getDefaultHint(problem: any, hintLevel: 1 | 2): string {
    const hints = problem.hints || []
    
    if (hints.length > 0) {
      const hintIndex = Math.min(hintLevel - 1, hints.length - 1)
      return hints[hintIndex]
    }

    // Fallback hints based on escalation level
    const fallbackHints = {
      1: "Think about what data structure might help you solve this efficiently. Consider using a hashmap, stack, or queue.",
      2: "Consider what algorithm or technique might be useful here. Think about binary search, dynamic programming, or two-pointer approaches."
    }

    return fallbackHints[hintLevel]
  }

  // Generate hints for coding approach phase (before any code is written)
  async generateCodingApproachHint(
    problem: any, 
    hintLevel: 1 | 2
  ): Promise<string> {
    try {
      const systemPrompt = hintLevel === 1 ? 
        `You are an AI interviewer providing the FIRST hint during the APPROACH PHASE (before any code is written).

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

IMPORTANT: The candidate has NOT written any code yet.

CRITICAL RULES:
1. Provide ONLY a subtle nudge - point to a general direction, NOT specific data structures or algorithms
2. Cover AT MOST 1 aspect of the approach - leave the rest for the candidate to discover
3. Use vague, general language - avoid naming specific data structures or algorithms
4. Do NOT mention specific techniques like "stack", "queue", "dynamic programming", "two-pointer", etc.
5. Do NOT give examples that reveal the approach
6. Keep it brief (1 sentence maximum)
7. DO NOT mention code, implementation, or "you haven't added code yet"
8. DO NOT reference starter code or function signatures

HINT LEVEL 1: Provide a vague, general direction
GOOD examples (subtle):
- "Think about how you might organize or group the input data"
- "Consider what information you need to track as you process the input"
- "What patterns do you notice in the problem description?"

BAD examples (too revealing - DON'T do this):
- "Consider using a stack to track..." (reveals data structure)
- "Think about separating digits into groups" (too specific)
- "A hash map might be useful here" (reveals solution)

Respond with just the hint text (no preamble).`
      :
        `You are an AI interviewer providing the SECOND hint during the APPROACH PHASE (before any code is written).

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

IMPORTANT: The candidate has NOT written any code yet.

CRITICAL RULES:
1. Provide a slightly more specific nudge, but still leave MOST of the approach for the candidate
2. Cover AT MOST 1-2 aspects - do NOT cover multiple techniques or approaches
3. You can hint at a general category (e.g., "optimization technique") but NOT specific algorithms
4. Do NOT mention specific algorithms like "dynamic programming", "two-pointer", "binary search", etc.
5. Do NOT ask follow-up questions about details - that implies you've given the answer
6. Keep it brief (1 sentence maximum)
7. DO NOT mention code, implementation, or "you haven't added code yet"
8. DO NOT reference starter code or function signatures

HINT LEVEL 2: Provide a slightly more specific direction, but still vague
GOOD examples (subtle):
- "Consider whether you need to process the data in multiple passes"
- "Think about how you might optimize repeated operations"
- "What if you could break this into smaller subproblems?"

BAD examples (too revealing - DON'T do this):
- "Consider dynamic programming - think about overlapping subproblems" (reveals algorithm)
- "A two-pointer approach might help" (reveals specific technique)
- "Use a stack or queue to track state" (reveals data structure)

REMEMBER: Leave at least 70-80% of the approach for the candidate to discover. A hint should nudge, not guide.

Respond with just the hint text (no preamble).`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      })

      return response.choices[0]?.message?.content || (hintLevel === 1 ? 
        'Think about what data structure would help you solve this efficiently.' :
        'Consider what algorithm or technique is commonly used for this type of problem.')
    } catch (error) {
      console.error('Error generating coding approach hint:', error)
      return hintLevel === 1 ? 
        'Think about what data structure would help you solve this efficiently.' :
        'Consider what algorithm or technique is commonly used for this type of problem.'
    }
  }

  // Monitor coding progress and provide guidance
  async monitorCodingProgress(problem: any, currentCode: string, previousCode: string): Promise<{
    hasSignificantChange: boolean
    progressPercentage: number
    feedback?: string
    shouldProvideHint: boolean
  }> {
    try {
      const systemPrompt = `You are an AI interviewer monitoring a candidate's coding progress.

Problem: ${problem.title}
Description: ${problem.description}

Previous code:
${previousCode || 'No previous code'}

Current code:
${currentCode}

Analyze the code changes and provide:
1. hasSignificantChange: Has the candidate made meaningful progress since last check? (boolean)
2. progressPercentage: Overall progress toward solution (0-100)
3. feedback: Brief feedback on their progress (optional, only if noteworthy)
4. shouldProvideHint: Should we provide a hint based on their progress? (boolean)

Consider:
- Significant change means new logic, not just formatting or comments
- Progress includes correct implementation, good structure, handling edge cases
- Suggest hint if they're stuck (no progress) or going in wrong direction

Respond with JSON:
{
  "hasSignificantChange": boolean,
  "progressPercentage": number,
  "feedback": "string (optional)",
  "shouldProvideHint": boolean
}`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze progress` }
        ],
        temperature: 0.3,
        max_tokens: 250
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      const result = JSON.parse(content)
      return result

    } catch (error) {
      console.error('Error monitoring coding progress:', error)
      return {
        hasSignificantChange: currentCode.length !== previousCode.length,
        progressPercentage: 0,
        shouldProvideHint: false
      }
    }
  }

  // Generate detailed feedback after code submission based on code analysis
  async generateSubmissionFeedback(
    problem: any,
    submittedCode: string,
    analysis: {
      progress: number
      approach: 'correct' | 'incorrect' | 'incomplete' | 'unsure'
      issues: string[]
      codeQuality: 'good' | 'fair' | 'poor'
    }
  ): Promise<string> {
    try {
      const systemPrompt = `You are an AI interviewer providing brief, clear feedback on a submitted coding solution.

Problem: ${problem.title}
Description: ${problem.description}

Submitted code:
\`\`\`
${submittedCode}
\`\`\`

Code Analysis:
- Progress: ${analysis.progress}%
- Approach: ${analysis.approach}
- Code Quality: ${analysis.codeQuality}
- Issues found: ${analysis.issues.length > 0 ? analysis.issues.join('; ') : 'None'}

CRITICAL RULES:
1. Be BRIEF and DIRECT (1-3 sentences maximum)
2. Clearly state if the solution is CORRECT or WRONG/INCOMPLETE
3. If wrong/incomplete, mention the MAIN issues (use the issues list above)
4. Be specific about what's wrong or missing, but don't give away the solution
5. Keep it conversational and natural for voice output
6. Do NOT ask questions - just provide feedback

Feedback structure:
- If correct: "Your solution is correct. [Brief praise if code quality is good]"
- If wrong: "Your solution has some issues. [Main problem from issues list]"
- If incomplete: "Your solution is incomplete. [What's missing or wrong]"

Examples:
- Correct: "Your solution is correct and handles all the edge cases well."
- Wrong: "Your solution has a logic error - your loop condition doesn't include the last element."
- Incomplete: "Your solution is incomplete - you're not handling the case when the input array is empty."

Respond with just the feedback text (no preamble, no quotes).`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Provide brief feedback on this submission.' }
        ],
        temperature: 0.5,
        max_tokens: 150
      })

      return response.choices[0]?.message?.content?.trim() || this.generateFallbackFeedback(analysis)
    } catch (error) {
      console.error('Error generating submission feedback:', error)
      return this.generateFallbackFeedback(analysis)
    }
  }

  private generateFallbackFeedback(analysis: {
    progress: number
    approach: 'correct' | 'incorrect' | 'incomplete' | 'unsure'
    issues: string[]
  }): string {
    if (analysis.approach === 'correct' && analysis.progress >= 80) {
      return "Your solution is correct. Well done."
    } else if (analysis.approach === 'incorrect') {
      const mainIssue = analysis.issues[0] || "there's a logic error in your approach"
      return `Your solution has issues. ${mainIssue}.`
    } else if (analysis.approach === 'incomplete') {
      const mainIssue = analysis.issues[0] || "some parts are missing"
      return `Your solution is incomplete. ${mainIssue}.`
    } else if (analysis.progress >= 50) {
      const mainIssue = analysis.issues[0] || "there are some issues to address"
      return `You've made good progress, but ${mainIssue}.`
    } else {
      return "Your solution needs more work. Let's move on."
    }
  }

  // Generate final feedback after code submission
  async generateFinalCodingFeedback(problem: any, submittedCode: string, testResults: any[]): Promise<{
    feedback: string
    complexityQuestions: string[]
    followUpQuestions: string[]
    shouldAskComplexity: boolean
    shouldAskOptimization: boolean
  }> {
    try {
      const passedTests = testResults.filter(t => t.passed).length
      const totalTests = testResults.length
      const allPassed = passedTests === totalTests

      const systemPrompt = `You are an AI interviewer providing final feedback on a coding solution.

Problem: ${problem.title}
Description: ${problem.description}

Submitted code:
${submittedCode}

Test results: ${passedTests}/${totalTests} passed
${allPassed ? 'All tests passed!' : 'Some tests failed.'}

Provide:
1. feedback: Constructive feedback on their solution (2-3 sentences)
2. complexityQuestions: Ask about time and space complexity (array of questions)
3. followUpQuestions: Ask about optimization or follow-up scenarios (array of questions, if applicable)
4. shouldAskComplexity: Should we ask about complexity? (boolean)
5. shouldAskOptimization: Should we ask about optimizations? (boolean)

Guidelines:
- If all tests passed: Praise their solution, ask about complexity
- If tests failed: Provide constructive feedback, ask what could be improved
- Always ask about time/space complexity
- Only ask optimization questions if solution is correct but could be improved

Respond with JSON:
{
  "feedback": "string",
  "complexityQuestions": ["What is the time complexity?", "What is the space complexity?"],
  "followUpQuestions": ["string", ...],
  "shouldAskComplexity": boolean,
  "shouldAskOptimization": boolean
}`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate final feedback` }
        ],
        temperature: 0.5,
        max_tokens: 400
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from OpenAI')
      }

      const result = JSON.parse(content)
      return result

    } catch (error) {
      console.error('Error generating final coding feedback:', error)
      return {
        feedback: "Thank you for your solution. Let's discuss the complexity.",
        complexityQuestions: [
          "What is the time complexity of your solution?",
          "What is the space complexity?"
        ],
        followUpQuestions: [],
        shouldAskComplexity: true,
        shouldAskOptimization: false
      }
    }
  }

  /**
   * Generate comprehensive evaluation from conversation history
   * Analyzes theoretical and coding sections separately and provides overall feedback
   */
  async generateComprehensiveEvaluation(
    payload: FinalEvaluationPayload | any[]
  ): Promise<{
    theoreticalSection?: {
      score: number
      feedback: string
      strengths: string[]
      areasForImprovement: string[]
      questionBreakdown?: Array<{
        questionId: string
        question: string
        score: number
        feedback: string
        keyPointsCovered: string[]
        timeTaken?: number
        hintsUsed?: number
      }>
    }
    codingSection?: {
      score: number
      feedback: string
      strengths: string[]
      areasForImprovement: string[]
      problemBreakdown?: Array<{
        problemId: string
        problem: string
        score: number
        feedback: string
        codeReview?: {
          strengths: string[]
          weaknesses: string[]
          suggestions: string[]
        }
        testResults?: Array<{
          passed: boolean
          input: string
          expectedOutput: string
          actualOutput: string
        }>
        timeComplexity?: string
        spaceComplexity?: string
        timeTaken?: number
        hintsUsed?: number
      }>
    }
    overall: {
      score: number
      feedback: string
      strengths: string[]
      areasForImprovement: string[]
      learningRecommendations?: string[]
    }
    summaryStatistics?: {
      totalQuestions: number
      totalProblems: number
      averageScore: number
      totalHints: number
      totalClarifications: number
      totalFollowUps: number
      averageTimePerQuestion: number
      averageTimePerProblem: number
    }
  }> {
    try {
      // Handle both old format (array) and new format (payload)
      let conversationHistory: any[]
      let evaluationPayload: FinalEvaluationPayload | null = null
      
      if (Array.isArray(payload)) {
        // Old format - just conversation history
        conversationHistory = payload as any[]
        evaluationPayload = null
      } else if (payload && typeof payload === 'object' && 'fullConversationHistory' in payload) {
        // New format - full payload
        evaluationPayload = payload as FinalEvaluationPayload
        conversationHistory = evaluationPayload.fullConversationHistory
      } else {
        // Fallback - treat as array
        conversationHistory = (payload as any) || []
        evaluationPayload = null
      }

      // Extract metrics from payload if available, otherwise from conversation history
      const hintCount = evaluationPayload?.hintRequestCount ?? conversationHistory.filter(
        msg => msg.metadata?.type === 'hint'
      ).length
      const clarificationCount = evaluationPayload?.clarificationRequestCount ?? conversationHistory.filter(
        msg => msg.metadata?.type === 'clarification'
      ).length
      const followUpCount = evaluationPayload?.followUpCount ?? conversationHistory.filter(
        msg => msg.metadata?.type === 'followup'
      ).length

      // Separate theoretical and coding messages
      const theoreticalMessages = conversationHistory.filter(
        msg => msg.metadata?.section === 'theoretical'
      )
      const codingMessages = conversationHistory.filter(
        msg => msg.metadata?.section === 'coding'
      )

      // Build conversation summary
      const conversationSummary = conversationHistory
        .map((msg, idx) => {
          const role = msg.role === 'user' ? 'Candidate' : msg.role === 'assistant' ? 'AI Interviewer' : 'System'
          const section = msg.metadata?.section || 'general'
          const type = msg.metadata?.type || 'message'
          const content = msg.content.substring(0, 200) // Limit content length
          return `[${idx + 1}] ${role} (${section}, ${type}): ${content}`
        })
        .join('\n')

      // Check which sections are present (have questions/problems)
      const hasTheoreticalSection = evaluationPayload 
        ? (evaluationPayload.theoreticalSection?.totalQuestions ?? 0) > 0
        : theoreticalMessages.length > 0
      
      const hasCodingSection = evaluationPayload
        ? (evaluationPayload.codingSection?.totalProblems ?? 0) > 0
        : codingMessages.length > 0

      // Build detailed context from payload if available
      let theoreticalContext = ''
      let codingContext = ''
      let performanceMetrics = ''

      if (evaluationPayload) {
        // Theoretical section context (only if section exists)
        if (hasTheoreticalSection && evaluationPayload.theoreticalSection && evaluationPayload.theoreticalSection.conversations.length > 0) {
          theoreticalContext = '\n\nTHEORETICAL SECTION DETAILS:\n'
          evaluationPayload.theoreticalSection.conversations.forEach((conv, idx) => {
            const question = evaluationPayload!.theoreticalSection.questions.find(q => q.id === conv.questionId)
            const hintCountForQ = conv.conversation.filter(m => m.metadata?.type === 'hint').length
            const clarificationCountForQ = conv.conversation.filter(m => m.metadata?.type === 'clarification').length
            const timeTaken = conv.conversation.length > 0 
              ? (conv.conversation[conv.conversation.length - 1].timestamp - conv.conversation[0].timestamp) / 1000
              : 0

            theoreticalContext += `\nQuestion ${idx + 1}:\n`
            theoreticalContext += `- Question: ${conv.question || question?.question || 'N/A'}\n`
            theoreticalContext += `- Difficulty: ${question?.difficulty || 'N/A'}\n`
            theoreticalContext += `- Score: ${conv.totalScore.toFixed(1)}/100\n`
            theoreticalContext += `- Hints used: ${hintCountForQ}\n`
            theoreticalContext += `- Clarifications: ${clarificationCountForQ}\n`
            theoreticalContext += `- Time taken: ${timeTaken.toFixed(1)}s\n`
            if (conv.evaluations && conv.evaluations.length > 0) {
              theoreticalContext += `- Key points covered: ${conv.evaluations.map(e => e.keyPointsCovered || []).flat().join(', ') || 'None'}\n`
              theoreticalContext += `- Feedback: ${conv.evaluations[0].feedback || 'N/A'}\n`
            }
            theoreticalContext += `- Conversation length: ${conv.conversation.length} messages\n`
          })
        }

        // Coding section context (only if section exists)
        if (hasCodingSection && evaluationPayload.codingSection && evaluationPayload.codingSection.conversations.length > 0) {
          codingContext = '\n\nCODING SECTION DETAILS:\n'
          evaluationPayload.codingSection.conversations.forEach((conv, idx) => {
            const hintCountForP = conv.conversation.filter(m => m.metadata?.type === 'hint').length
            const clarificationCountForP = conv.conversation.filter(m => m.metadata?.type === 'clarification').length
            const timeTaken = conv.submittedAt && conv.conversation.length > 0
              ? (new Date(conv.submittedAt).getTime() - conv.conversation[0].timestamp) / 1000
              : 0

            codingContext += `\nProblem ${idx + 1}:\n`
            codingContext += `- Problem: ${conv.problem?.problem || 'N/A'}\n`
            codingContext += `- Difficulty: ${conv.problem?.difficulty || 'N/A'}\n`
            codingContext += `- Language: ${conv.problem?.language || 'N/A'}\n`
            codingContext += `- Score: ${conv.evaluation?.score || 0}/100\n`
            codingContext += `- Hints used: ${hintCountForP}\n`
            codingContext += `- Clarifications: ${clarificationCountForP}\n`
            codingContext += `- Time taken: ${timeTaken.toFixed(1)}s\n`
            if (conv.finalCode) {
              codingContext += `- Final code length: ${conv.finalCode.length} characters\n`
            }
            if (conv.timeComplexity) {
              codingContext += `- Time complexity: ${conv.timeComplexity}\n`
            }
            if (conv.spaceComplexity) {
              codingContext += `- Space complexity: ${conv.spaceComplexity}\n`
            }
            if (conv.evaluation?.testResults) {
              const passedTests = conv.evaluation.testResults.filter(t => t.passed).length
              codingContext += `- Test results: ${passedTests}/${conv.evaluation.testResults.length} passed\n`
            }
            if (conv.evaluation?.feedback) {
              codingContext += `- Feedback: ${conv.evaluation.feedback}\n`
            }
            if (conv.codeAnalysisHistory && conv.codeAnalysisHistory.length > 0) {
              codingContext += `- Code analysis iterations: ${conv.codeAnalysisHistory.length}\n`
            }
          })
        }

        // Performance metrics
        performanceMetrics = '\n\nPERFORMANCE METRICS:\n'
        performanceMetrics += `- Total interview duration: ${(evaluationPayload.duration / 1000 / 60).toFixed(1)} minutes\n`
        if (hasTheoreticalSection) {
          performanceMetrics += `- Average time per theoretical question: ${evaluationPayload.averageTimePerQuestion?.toFixed(1) || 'N/A'} seconds\n`
          performanceMetrics += `- Theoretical section score: ${evaluationPayload.theoreticalSection?.overallScore?.toFixed(1) || 'N/A'}/100\n`
        }
        if (hasCodingSection) {
          performanceMetrics += `- Average time per coding problem: ${evaluationPayload.averageTimePerCodingProblem?.toFixed(1) || 'N/A'} seconds\n`
          performanceMetrics += `- Coding section score: ${evaluationPayload.codingSection?.overallScore?.toFixed(1) || 'N/A'}/100\n`
        }
        performanceMetrics += `- Total hints requested: ${hintCount}\n`
        performanceMetrics += `- Total clarifications requested: ${clarificationCount}\n`
        performanceMetrics += `- Total follow-up questions: ${followUpCount}\n`
        performanceMetrics += `- Overall score: ${evaluationPayload.totalScore?.toFixed(1) || 'N/A'}/100\n`
      }

      const systemPrompt = `You are an expert technical interviewer analyzing a complete interview conversation history. Your task is to provide comprehensive evaluation scores and feedback with detailed breakdowns.

IMPORTANT: Only evaluate sections that were actually part of the interview. If a section has 0 questions/problems, DO NOT include it in your response.

EVALUATION RULES AND RUBRICS:

${hasTheoreticalSection ? `1. THEORETICAL SECTION EVALUATION:` : ''}

   SCORING RUBRIC (0-100 scale):
   - Completeness (30 points): How many key points were covered?
     * 25-30: All or nearly all key points covered comprehensively
     * 18-24: Most key points covered, minor gaps
     * 12-17: Some key points covered, significant gaps
     * 6-11: Few key points covered, major gaps
     * 0-5: No or incorrect key points covered
   
   - Accuracy (30 points): Correctness of information provided
     * 25-30: All information accurate, demonstrates deep understanding
     * 18-24: Mostly accurate, minor inaccuracies
     * 12-17: Some inaccuracies, partial understanding
     * 6-11: Multiple inaccuracies, weak understanding
     * 0-5: Major inaccuracies, fundamental misunderstanding
   
   - Depth (20 points): Level of detail and explanation quality
     * 16-20: Deep, thorough explanations with examples
     * 12-15: Good explanations with some detail
     * 8-11: Basic explanations, limited detail
     * 4-7: Superficial explanations
     * 0-3: Minimal or no explanation
   
   - Clarity (10 points): Communication and articulation
     * 8-10: Clear, well-structured, easy to follow
     * 6-7: Generally clear with minor issues
     * 4-5: Somewhat unclear, needs improvement
     * 2-3: Unclear, difficult to follow
     * 0-1: Very unclear, confusing
   
   - Independence (10 points): Ability to answer without excessive help
     * 8-10: No hints needed, fully independent
     * 6-7: 1 hint, mostly independent
     * 4-5: 2-3 hints, some dependency
     * 2-3: 4+ hints, high dependency
     * 0-1: Excessive hints, very dependent

   QUALITY CRITERIA:
   - Excellent (90-100): Comprehensive answers covering all key points accurately with deep understanding, minimal/no hints
   - Good (80-89): Solid answers covering most key points, few hints needed, good understanding
   - Acceptable (70-79): Basic answers covering some key points, some hints/clarifications, acceptable understanding
   - Below Average (60-69): Incomplete answers, multiple hints needed, gaps in knowledge
   - Poor (<60): Major gaps, excessive hints, significant knowledge deficiencies

   PENALTY RULES:
   - Each hint request: -2 to -5 points (depending on hint level)
   - Each clarification request: -1 to -3 points
   - Each follow-up question needed: -3 to -7 points (indicates incomplete initial answer)
   - Incorrect information: -5 to -15 points per major inaccuracy

${hasCodingSection ? `2. CODING SECTION EVALUATION:` : ''}

   SCORING RUBRIC (0-100 scale):
   - Correctness (35 points): Does the code solve the problem correctly?
     * 28-35: All test cases pass, handles edge cases
     * 21-27: Most test cases pass, minor issues
     * 14-20: Some test cases pass, significant issues
     * 7-13: Few test cases pass, major issues
     * 0-6: No test cases pass or no solution
   
   - Code Quality (25 points): Readability, structure, best practices
     * 20-25: Clean, well-structured, follows best practices
     * 15-19: Generally good structure, minor issues
     * 10-14: Acceptable structure, some issues
     * 5-9: Poor structure, multiple issues
     * 0-4: Very poor structure, many issues
   
   - Problem-Solving Approach (20 points): Strategy, algorithm selection, logic
     * 16-20: Optimal approach, clear strategy, efficient algorithm
     * 12-15: Good approach, reasonable strategy
     * 8-11: Acceptable approach, some issues
     * 4-7: Suboptimal approach, significant issues
     * 0-3: Poor approach, major issues
   
   - Efficiency (10 points): Time and space complexity
     * 8-10: Optimal or near-optimal complexity
     * 6-7: Good complexity, acceptable trade-offs
     * 4-5: Acceptable complexity
     * 2-3: Suboptimal complexity
     * 0-1: Very poor complexity
   
   - Independence (10 points): Ability to solve without excessive help
     * 8-10: No hints needed, fully independent
     * 6-7: 1 hint, mostly independent
     * 4-5: 2-3 hints, some dependency
     * 2-3: 4+ hints, high dependency
     * 0-1: Excessive hints, very dependent

   QUALITY CRITERIA:
   - Excellent (90-100): Optimal solution, all tests pass, clean code, minimal/no hints
   - Good (80-89): Correct solution, most tests pass, good code quality, few hints
   - Acceptable (70-79): Working solution with some issues, acceptable code, some hints
   - Below Average (60-69): Partial solution, multiple issues, multiple hints needed
   - Poor (<60): Incomplete or incorrect solution, excessive hints, poor code quality

   PENALTY RULES:
   - Each hint request: -3 to -7 points (depending on hint level)
   - Each failed test case: -5 to -10 points
   - Poor time/space complexity: -5 to -15 points
   - Code quality issues: -2 to -8 points per major issue

3. OVERALL EVALUATION:
   - Weight: ${hasTheoreticalSection && hasCodingSection ? '60% theoretical, 40% coding' : hasTheoreticalSection ? '100% theoretical' : '100% coding'} (only consider sections that exist)
   - Consider: Overall interview performance, communication skills, problem-solving ability, technical knowledge
   - Provide specific learning recommendations based on identified gaps
   ${!hasTheoreticalSection ? '- NOTE: This interview did NOT include theoretical questions. Do NOT include theoreticalSection in your response.' : ''}
   ${!hasCodingSection ? '- NOTE: This interview did NOT include coding problems. Do NOT include codingSection in your response.' : ''}

METRICS TO CONSIDER:
- Hint requests: ${hintCount} (more hints = lower score)
- Clarification requests: ${clarificationCount} (more clarifications = lower score)
- Follow-up questions: ${followUpCount} (indicates initial answers were incomplete)
- Answer quality and completeness
- Technical depth and accuracy
- Problem-solving approach
- Communication clarity
${performanceMetrics}

Return ONLY valid JSON in this exact format:
${hasTheoreticalSection ? `{
  "theoreticalSection": {
    "score": <number 0-100>,
    "feedback": "<detailed feedback string explaining the score>",
    "strengths": ["<strength1>", "<strength2>", ...],
    "areasForImprovement": ["<area1>", "<area2>", ...],
    "questionBreakdown": [
      {
        "questionId": "<id>",
        "question": "<question text>",
        "score": <number 0-100>,
        "feedback": "<specific feedback for this question>",
        "keyPointsCovered": ["<point1>", "<point2>", ...],
        "timeTaken": <number in seconds>,
        "hintsUsed": <number>
      }
    ]
  },` : ''}
${hasCodingSection ? `  "codingSection": {
    "score": <number 0-100>,
    "feedback": "<detailed feedback string explaining the score>",
    "strengths": ["<strength1>", "<strength2>", ...],
    "areasForImprovement": ["<area1>", "<area2>", ...],
    "problemBreakdown": [
      {
        "problemId": "<id>",
        "problem": "<problem text>",
        "score": <number 0-100>,
        "feedback": "<specific feedback for this problem>",
        "codeReview": {
          "strengths": ["<code strength1>", "<code strength2>", ...],
          "weaknesses": ["<code weakness1>", "<code weakness2>", ...],
          "suggestions": ["<suggestion1>", "<suggestion2>", ...]
        },
        "testResults": [
          {
            "passed": <boolean>,
            "input": "<input>",
            "expectedOutput": "<expected>",
            "actualOutput": "<actual>"
          }
        ],
        "timeComplexity": "<complexity>",
        "spaceComplexity": "<complexity>",
        "timeTaken": <number in seconds>,
        "hintsUsed": <number>
      }
    ]
  },` : ''}
  "overall": {
    "score": <number 0-100>,
    "feedback": "<comprehensive feedback string>",
    "strengths": ["<strength1>", "<strength2>", ...],
    "areasForImprovement": ["<area1>", "<area2>", ...],
    "learningRecommendations": [
      "<specific recommendation1>",
      "<specific recommendation2>",
      ...
    ]
  },
  "summaryStatistics": {
    "totalQuestions": <number>,
    "totalProblems": <number>,
    "averageScore": <number>,
    "totalHints": <number>,
    "totalClarifications": <number>,
    "totalFollowUps": <number>,
    "averageTimePerQuestion": <number>,
    "averageTimePerProblem": <number>
  }
}

IMPORTANT:
- Be specific, constructive, and professional in all feedback
- Provide actionable recommendations
- Include question-wise and problem-wise breakdowns when detailed context is available
- Base scores on the rubrics provided above
- Consider all penalties when calculating final scores
- ${!hasTheoreticalSection ? 'DO NOT include theoreticalSection in your response - it was not part of this interview' : ''}
- ${!hasCodingSection ? 'DO NOT include codingSection in your response - it was not part of this interview' : ''}
- Only include sections that actually have questions/problems (totalQuestions > 0 or totalProblems > 0)`

      const userPrompt = `Analyze this interview conversation history and provide comprehensive evaluation:

CONVERSATION HISTORY:
${conversationSummary}

STATISTICS:
- Total messages: ${conversationHistory.length}
${hasTheoreticalSection ? `- Theoretical messages: ${theoreticalMessages.length}` : '- Theoretical section: NOT INCLUDED in this interview'}
${hasCodingSection ? `- Coding messages: ${codingMessages.length}` : '- Coding section: NOT INCLUDED in this interview'}
- Hint requests: ${hintCount}
- Clarification requests: ${clarificationCount}
- Follow-up questions: ${followUpCount}
${theoreticalContext}
${codingContext}
${performanceMetrics}

${hasTheoreticalSection ? 'Provide detailed evaluation for theoretical section.' : 'DO NOT evaluate theoretical section - it was not part of this interview.'}
${hasCodingSection ? 'Provide detailed evaluation for coding section.' : 'DO NOT evaluate coding section - it was not part of this interview.'}
Always provide overall performance evaluation. Include question-wise and problem-wise breakdowns when context is available.`

      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000 // Increased for detailed breakdowns
      })

      const content = response.choices[0]?.message?.content
      if (!content) {
        throw new Error('No response from LLM')
      }

      // Parse JSON response
      let evaluation
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/)
        const jsonContent = jsonMatch ? jsonMatch[1] : content
        evaluation = JSON.parse(jsonContent)
      } catch (parseError) {
        console.error('Failed to parse LLM response as JSON:', content)
        throw new Error('Invalid JSON response from LLM')
      }

      // Validate structure - overall is always required
      if (!evaluation.overall) {
        throw new Error('Invalid evaluation structure from LLM - overall section is required')
      }

      // Only validate sections that should exist
      if (hasTheoreticalSection && !evaluation.theoreticalSection) {
        console.warn('⚠️ Theoretical section expected but not found in LLM response')
      }
      if (hasCodingSection && !evaluation.codingSection) {
        console.warn('⚠️ Coding section expected but not found in LLM response')
      }

      // Ensure optional fields are present (may be undefined if LLM doesn't provide them or section doesn't exist)
      const result: any = {
        overall: {
          ...evaluation.overall,
          learningRecommendations: evaluation.overall.learningRecommendations || []
        },
        summaryStatistics: evaluation.summaryStatistics || {
          totalQuestions: hasTheoreticalSection ? (evaluationPayload?.theoreticalSection?.totalQuestions || 0) : 0,
          totalProblems: hasCodingSection ? (evaluationPayload?.codingSection?.totalProblems || 0) : 0,
          averageScore: evaluationPayload?.totalScore || 0,
          totalHints: hintCount,
          totalClarifications: clarificationCount,
          totalFollowUps: followUpCount,
          averageTimePerQuestion: hasTheoreticalSection ? (evaluationPayload?.averageTimePerQuestion || 0) : 0,
          averageTimePerProblem: hasCodingSection ? (evaluationPayload?.averageTimePerCodingProblem || 0) : 0
        }
      }

      // Only include sections that exist
      if (hasTheoreticalSection && evaluation.theoreticalSection) {
        result.theoreticalSection = {
          ...evaluation.theoreticalSection,
          questionBreakdown: evaluation.theoreticalSection.questionBreakdown || []
        }
      }

      if (hasCodingSection && evaluation.codingSection) {
        result.codingSection = {
          ...evaluation.codingSection,
          problemBreakdown: evaluation.codingSection.problemBreakdown || []
        }
      }

      return result

    } catch (error) {
      console.error('Error generating comprehensive evaluation:', error)
      // Return fallback evaluation - basic structure without section checks
      const fallbackResult: any = {
        overall: {
          score: 0,
          feedback: 'Unable to generate evaluation. Please review the conversation history manually.',
          strengths: [],
          areasForImprovement: ['Evaluation could not be generated'],
          learningRecommendations: []
        },
        summaryStatistics: {
          totalQuestions: 0,
          totalProblems: 0,
          averageScore: 0,
          totalHints: 0,
          totalClarifications: 0,
          totalFollowUps: 0,
          averageTimePerQuestion: 0,
          averageTimePerProblem: 0
        }
      }

      return fallbackResult
    }
  }

}

export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config)
}


