import OpenAI from 'openai'
import { EventEmitter } from 'events'
import { FinalEvaluationPayload } from '../models/types.js'
import * as openai from '@livekit/agents-plugin-openai'
import { llm } from '@livekit/agents'

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
  // Optional: Use LiveKit LLM instead of direct OpenAI client
  useLiveKitLLM?: boolean
  liveKitLLM?: openai.LLM // Pass existing LiveKit LLM instance to reuse
}

export class LLMService extends EventEmitter {
  private openai?: OpenAI
  private liveKitLLM?: openai.LLM
  private config: LLMConfig
  private conversationHistory: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
  private useLiveKitLLM: boolean

  constructor(config: LLMConfig) {
    super()
    this.config = config
    this.useLiveKitLLM = config.useLiveKitLLM ?? false

    if (config.liveKitLLM) {
      // Reuse existing LiveKit LLM instance
      this.liveKitLLM = config.liveKitLLM
      this.useLiveKitLLM = true
    } else if (this.useLiveKitLLM) {
      // Create new LiveKit LLM instance
      this.liveKitLLM = new openai.LLM({
        model: config.model || 'gpt-4o-mini',
        temperature: config.temperature || 0.3,
      })
    } else {
      // Fallback to direct OpenAI client (original behavior)
      this.openai = new OpenAI({ apiKey: config.apiKey })
    }
  }

  /**
   * Extract text content from a LiveKit ChatChunk
   * Handles different possible chunk structures
   */
  /**
     * Extract text content from a LiveKit ChatChunk
     * Handles different possible chunk structures
     */
  private extractChunkText(chunk: any): string {
    if (typeof chunk === 'string') {
      return chunk
    }

    if (!chunk || typeof chunk !== 'object') {
      return ''
    }

    // 1. Handle OpenAI/LiveKit standard structure (choices array)
    if (chunk.choices && Array.isArray(chunk.choices) && chunk.choices.length > 0) {
      const choice = chunk.choices[0]
      if (choice.delta && choice.delta.content) {
        return typeof choice.delta.content === 'string' ? choice.delta.content : ''
      }
      return ''
    }

    // 2. Handle 'delta' property
    if ('delta' in chunk) {
      const delta = chunk.delta
      if (typeof delta === 'string') {
        return delta
      }
      if (typeof delta === 'object' && delta !== null && 'content' in delta) {
        return typeof delta.content === 'string' ? delta.content : ''
      }
    }

    // 3. Handle 'content' property
    if ('content' in chunk) {
      return typeof chunk.content === 'string' ? chunk.content : ''
    }

    // 4. Handle 'text' property
    if ('text' in chunk) {
      return typeof chunk.text === 'string' ? chunk.text : ''
    }

    // 5. Handle usage chunks (ignore them silently to avoid logs)
    if ('usage' in chunk || 'id' in chunk) {
      return ''
    }

    return ''
  }
  /**
   * Helper method to call LLM (either LiveKit LLM or direct OpenAI)
   * This allows us to reuse the same LLM instance for both conversation and evaluation
   */
  private async callLLM(systemPrompt: string, userMessage: string, maxTokens?: number): Promise<string> {
    if (this.useLiveKitLLM && this.liveKitLLM) {
      // Use LiveKit LLM (standalone mode)
      const chatCtx = new llm.ChatContext()
      chatCtx.addMessage({ role: 'system', content: systemPrompt })
      chatCtx.addMessage({ role: 'user', content: userMessage })

      // Collect streamed response
      let fullContent = ''
      const stream = await this.liveKitLLM.chat({ chatCtx })
      for await (const chunk of stream) {
        const chunkText = this.extractChunkText(chunk)
        if (chunkText) {
          fullContent += chunkText
        }
      }
      return fullContent
    } else {
      // Use direct OpenAI client (original behavior)
      if (!this.openai) {
        throw new Error('OpenAI client not initialized. Provide apiKey or useLiveKitLLM=true')
      }
      const response = await this.openai.chat.completions.create({
        model: this.config.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: this.config.temperature || 0.3,
        max_tokens: maxTokens || this.config.maxTokens || 500
      })
      return response.choices[0]?.message?.content || ''
    }
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

    // Rule 2: Only ask follow-up if score < 70
    if (evaluation.needsFollowUp && evaluation.score >= 70) {
      console.log('🚫 [LLM-Server] Blocking follow-up: score >= 70 (score:', evaluation.score, ')')
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

  async evaluateAnswer(
    question: Question,
    candidateAnswer: string,
    followUpDepth: number = 0,
    maxTheoreticalQuestions: number = 10,
    originalAnswer?: string,
    followUpQuestion?: string
  ): Promise<Evaluation> {
    console.log('🔍 [LLM-Server] evaluateAnswer called with:', {
      questionId: question.id,
      followUpDepth,
      candidateAnswerLength: candidateAnswer.length
    })

    const systemPrompt = `You are a human technical interviewer conducting a voice interview. You're evaluating a candidate's answer naturally, like a real person would.

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

${followUpDepth > 0 && originalAnswer ? `IMPORTANT - FOLLOW-UP CONTEXT:
This is a FOLLOW-UP question. The candidate already answered the original question.

ORIGINAL QUESTION: ${question.question}
CANDIDATE'S ORIGINAL ANSWER: ${originalAnswer}
FOLLOW-UP QUESTION THAT WAS ASKED: ${followUpQuestion || 'N/A'}
CANDIDATE'S FOLLOW-UP ANSWER: ${candidateAnswer}

When evaluating this follow-up answer, you MUST consider BOTH answers together:
- The original answer + the follow-up answer = their complete response
- Don't penalize them for not repeating what they already said in the original answer
- If they covered WHERE in the original answer and HAVING in the follow-up, that's a complete answer!
- Evaluate the COMBINED understanding, not just the follow-up answer in isolation
- A good follow-up answer that completes the original answer should score well (70+)

Example: If original answer covered "WHERE filters rows" and follow-up answer covers "HAVING filters groups after aggregation", together they have a complete answer about both clauses.` : ''}

YOUR EVALUATION APPROACH (Think like a human interviewer):
1. Score (0-100): How well did they answer? Be fair but thorough
2. Key Points Covered: What did they actually mention correctly?
3. Needs Follow-up: Would a real interviewer ask a follow-up here?
   - YES if: Score < 70 AND they missed important parts of the answer
   - NO if: They gave a decent answer (even if not perfect)
4. Follow-up Question: If needed, ask naturally about what they missed
5. Feedback: Sound like a real person - be conversational, encouraging, but also probe deeper if needed

SCORING GUIDE (Think like a human):
- 90-100: Excellent answer - covered everything well
- 80-89: Good answer - got most of it right
- 70-79: Decent answer - covered main points, some gaps
- 60-69: Partial answer - got some parts right but missed important details
- 50-59: Weak answer - only answered part of the question, missing key concepts
- 0-49: Poor answer - major gaps or incorrect information

FOLLOW-UP DECISION (Human logic):
✓ Ask follow-up if: Score < 70 AND they clearly missed important parts
✗ Don't ask follow-up if: Score >= 70 OR they gave a reasonable answer (even if not perfect)

FEEDBACK STYLE (Be human):
- Sound natural and conversational
- Acknowledge what they got right
- Gently point out what's missing
- If they're vague or unclear, probe deeper: "Can you elaborate on that?" or "I'd like to understand better..."
- Be encouraging but don't let them off easy - if the answer is weak, let them know
- Use natural language, not robotic phrases

EXAMPLES:

Example 1 - Good Answer (no follow-up):
{
  "keyPointsCovered": ["WHERE filters before grouping", "HAVING filters after aggregation"],
  "score": 85,
  "needsFollowUp": false,
  "feedback": "Good! You covered the main difference - WHERE filters rows before grouping, and HAVING filters groups after aggregation. That's the key distinction."
}

Example 2 - Weak Answer (follow-up needed):
{
  "keyPointsCovered": ["WHERE filters rows"],
  "score": 55,
  "needsFollowUp": true,
  "followUpQuestion": "You mentioned WHERE filters rows, which is correct. But can you explain what HAVING does and when you'd use it versus WHERE?",
  "feedback": "Okay, you're right that WHERE filters rows. But the question asks about both WHERE and HAVING - can you tell me about HAVING as well?"
}

NOTE: If needsFollowUp is false, omit the followUpQuestion field entirely (don't include it as null).

IMPORTANT: 
- Return ONLY valid JSON, no other text
- Think like a human interviewer - be fair but thorough
- STRICTLY: needsFollowUp = false if score >= 70
- Make feedback sound natural and conversational, not robotic`

    const maxRetries = 3
    let lastError: any = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔍 [LLM-Server] Calling OpenAI API (attempt ${attempt}/${maxRetries})`)
        // Build user message with context
        let userMessage = `Candidate's answer: ${candidateAnswer}`;
        if (followUpDepth > 0 && originalAnswer) {
          userMessage = `This is a follow-up answer. Here's the full context:

Original question: ${question.question}
Candidate's original answer: ${originalAnswer}
Follow-up question asked: ${followUpQuestion || 'N/A'}
Candidate's follow-up answer: ${candidateAnswer}

Evaluate the candidate's COMPLETE understanding by considering BOTH answers together.`;
        }

        const content = await this.callLLM(systemPrompt, userMessage, this.config.maxTokens || 500)

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

      const content = await this.callLLM(systemPrompt, 'Generate a follow-up question.', this.config.maxTokens || 200)
      return content || 'Could you tell me more about that?'
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

      const content = await this.callLLM(systemPrompt, userContent, this.config.maxTokens || 800)

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

      // Build messages for LiveKit or OpenAI
      if (this.useLiveKitLLM && this.liveKitLLM) {
        const chatCtx = new llm.ChatContext()
        messages.forEach(msg => {
          chatCtx.addMessage({ role: msg.role as any, content: msg.content })
        })

        let fullContent = ''
        const stream = await this.liveKitLLM.chat({ chatCtx })
        for await (const chunk of stream) {
          const chunkText = this.extractChunkText(chunk)
          if (chunkText) {
            fullContent += chunkText
          }
        }
        return fullContent || 'I understand. Please continue.'
      } else {
        if (!this.openai) {
          throw new Error('OpenAI client not initialized. Provide apiKey or useLiveKitLLM=true')
        }
        const response = await this.openai.chat.completions.create({
          model: this.config.model || 'gpt-4',
          messages: messages as any,
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 300
        })
        return response.choices[0]?.message?.content || 'I understand. Please continue.'
      }
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
        const content = await this.callLLM(
          systemPrompt,
          `Evaluate this follow-up answer: ${followUpAnswer}`,
          this.config.maxTokens || 500
        )

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

      const content = await this.callLLM(systemPrompt, userPrompt, 4000)

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

export function createLLMService(config: LLMConfig, liveKitLLM?: openai.LLM): LLMService {
  // If LiveKit LLM is provided, use it instead of creating a new OpenAI client
  if (liveKitLLM) {
    return new LLMService({
      ...config,
      liveKitLLM,
      useLiveKitLLM: true,
    })
  }
  return new LLMService(config)
}


