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

  // Evaluate coding approach explanation with scoring
  async evaluateCodingApproach(explanation: string, problem: any, starterCode: string = '', currentCode: string = ''): Promise<{
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
      
      const systemPrompt = `You are an AI interviewer evaluating a candidate's approach to a coding problem.

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
- Score <= 70: Provide constructive feedback about what's wrong or missing. Be specific: "That's an interesting approach, but you might want to consider [specific issue] or [missing element]." DO NOT ask them to rethink - just point out what needs attention.

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

Provide a brief, direct clarification that:
1. Explicitly answers their specific doubt
2. Stays within the boundary of the question (doesn't leak the solution)
3. Reiterates or makes clearer the already available information
4. Is individualistic and doesn't require previous context

Common clarification types:
- Constraint values: "The input n can be up to 10^5"
- Data structure choice: "You can use any built-in data structure"
- Output format: "Return the result as an integer"
- Edge cases: "Consider the case where the array is empty"

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

  // Generate escalating hints for coding problems with context (for manual requests)
  async generateCodingHint(
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
        `\n\nCode from 1 minute ago (or starter code):\n\`\`\`\n${previousCode}\n\`\`\`` : 
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
        `You are an AI interviewer providing the FIRST hint for a coding problem during code monitoring.

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

Current code: ${currentCode || 'No code yet'}${codeComparison}${analysisContext}

IMPORTANT INSTRUCTIONS - ADAPT BASED ON CODE STATE:
1. **If code is mostly complete (progress > 80%)**: Give encouraging feedback like "Your solution looks good! Just check edge cases" or "You're almost there - review your boundary conditions"
2. **If code has good progress (50-80%)**: Point out what's missing or what needs to be fixed next
3. **If code has issues (progress < 50%)**: Analyze what's WRONG with their current approach
4. **If approach is correct but incomplete**: Tell them what's NEXT to implement
5. **If no code or minimal code**: Suggest what data structure might be useful
6. Be specific and helpful - point out actual issues in their code if any
7. Keep it brief (1-2 sentences)
8. Don't give away the complete solution
9. **CRITICAL**: If code looks complete/correct, acknowledge it positively rather than giving generic hints

HINT LEVEL 1: Focus on:
- Encouragement if code is good (progress > 80%)
- What's wrong with current approach (if code exists and has issues)
- What's the next step (if approach is correct but incomplete)
- Data structure suggestion (if no meaningful code yet)
- Examples: 
  * Good code: "Your solution looks solid! Double-check edge cases like empty inputs"
  * Issues: "Your loop condition is incorrect - you're checking X when you should check Y"
  * Incomplete: "You're on the right track, now you need to handle the edge case where..."
  * No code: "Try using a hashmap to track..." or "Consider a two-pointer approach"

Respond with just the hint text (no preamble).`
      :
        `You are an AI interviewer providing the SECOND hint for a coding problem during code monitoring.

Problem: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints?.join(', ') || 'See problem description'}

Current code: ${currentCode || 'No code yet'}${codeComparison}${analysisContext}

IMPORTANT INSTRUCTIONS - ADAPT BASED ON CODE STATE:
1. **If code is mostly complete (progress > 80%)**: Give encouraging feedback like "Your solution looks good! Just verify your logic handles all test cases" or "Great progress! Make sure to test with the provided examples"
2. **If code has good progress (50-80%)**: Point out specific issues or what's missing
3. **If code has issues (progress < 50%)**: Analyze what's WRONG with their current approach
4. **If approach is correct but incomplete**: Tell them what's NEXT to implement
5. **If no code or minimal code**: Suggest what algorithm/technique might be useful
6. Be specific and helpful - point out actual issues in their code if any
7. Keep it brief (1-2 sentences)
8. Don't give away the complete solution
9. **CRITICAL**: If code looks complete/correct, acknowledge it positively rather than giving generic hints

HINT LEVEL 2: Focus on:
- Encouragement if code is good (progress > 80%)
- What's wrong with current approach (if code exists and has issues)
- What's the next step (if approach is correct but incomplete)
- Algorithm/technique suggestion (if no meaningful code yet)
- Examples:
  * Good code: "Your implementation looks correct! Test it with the provided examples to ensure it works"
  * Issues: "You're missing the base case for your recursion" or "The time complexity can be improved by using binary search instead"
  * Incomplete: "Consider dynamic programming - think about overlapping subproblems"
  * No code: "Try a sliding window technique"

Respond with just the hint text (no preamble).`

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

      return response.choices[0]?.message?.content || (hintLevel === 1 ? 
        'Think about what data structure would help you solve this efficiently.' :
        'Consider what algorithm or technique is commonly used for this type of problem.')
    } catch (error) {
      console.error('Error generating coding hint:', error)
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

}

export function createLLMService(config: LLMConfig): LLMService {
  return new LLMService(config)
}


