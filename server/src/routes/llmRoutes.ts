import express from 'express'
import { createLLMService } from '../services/llm-service'

const router = express.Router()

// Initialize LLM service
const llmService = createLLMService({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 4000
})

// Evaluate candidate's answer
router.post('/evaluate-answer', async (req, res) => {
  try {
    const { question, candidateAnswer, followUpDepth = 0, maxTheoreticalQuestions = 10 } = req.body

    if (!question || !candidateAnswer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question and candidate answer are required' 
      })
    }

    const evaluation = await llmService.evaluateAnswer(question, candidateAnswer, followUpDepth, maxTheoreticalQuestions)
    
    res.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('Error evaluating answer:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate answer',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate follow-up question
router.post('/generate-followup', async (req, res) => {
  try {
    const { question, candidateAnswer } = req.body

    if (!question || !candidateAnswer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question and candidate answer are required' 
      })
    }

    const followUpQuestion = await llmService.generateFollowUp(question, candidateAnswer)
    
    res.json({
      success: true,
      followUpQuestion
    })
  } catch (error) {
    console.error('Error generating follow-up:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate follow-up question'
    })
  }
})

// Analyze code progress
router.post('/analyze-code', async (req, res) => {
  try {
    const { code, previousCode, problem, language } = req.body

    if (!code || !problem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Code and problem description are required' 
      })
    }

    const analysis = await llmService.analyzeCode(code, problem, language || 'javascript', previousCode || '')
    
    res.json({
      success: true,
      analysis
    })
  } catch (error) {
    console.error('Error analyzing code:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to analyze code',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate conversational response
router.post('/generate-response', async (req, res) => {
  try {
    const { context, conversationHistory } = req.body

    if (!context) {
      return res.status(400).json({ 
        success: false, 
        error: 'Context is required' 
      })
    }

    const response = await llmService.generateResponse(
      context, 
      conversationHistory || []
    )
    
    res.json({
      success: true,
      response
    })
  } catch (error) {
    console.error('Error generating response:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate response'
    })
  }
})

// Add to conversation history
router.post('/conversation/add', async (req, res) => {
  try {
    const { role, content } = req.body

    if (!role || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Role and content are required' 
      })
    }

    llmService.addToConversation(role, content)
    
    res.json({
      success: true,
      message: 'Added to conversation history'
    })
  } catch (error) {
    console.error('Error adding to conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to add to conversation'
    })
  }
})

// Get conversation history
router.get('/conversation/history', async (req, res) => {
  try {
    const history = llmService.getConversationHistory()
    
    res.json({
      success: true,
      history
    })
  } catch (error) {
    console.error('Error getting conversation history:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation history'
    })
  }
})

// Clear conversation history
router.delete('/conversation/clear', async (req, res) => {
  try {
    llmService.clearConversation()
    
    res.json({
      success: true,
      message: 'Conversation history cleared'
    })
  } catch (error) {
    console.error('Error clearing conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear conversation'
    })
  }
})


// Evaluate follow-up answer
router.post('/evaluate-followup', async (req, res) => {
  try {
    const { 
      originalQuestion, 
      originalCandidateAnswer, 
      followUpQuestion, 
      followUpAnswer, 
      followUpDepth = 1 
    } = req.body

    if (!originalQuestion || !originalCandidateAnswer || !followUpQuestion || !followUpAnswer) {
      return res.status(400).json({ 
        success: false, 
        error: 'Original question, original answer, follow-up question, and follow-up answer are required' 
      })
    }

    const evaluation = await llmService.evaluateFollowUpAnswer(
      originalQuestion,
      originalCandidateAnswer,
      followUpQuestion,
      followUpAnswer,
      followUpDepth
    )
    
    res.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('Error evaluating follow-up answer:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate follow-up answer',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})


// Generate comprehensive evaluation from conversation history or full evaluation payload
router.post('/generate-comprehensive-evaluation', async (req, res) => {
  try {
    const { conversationHistory, fullEvaluationPayload } = req.body

    // Support both old format (conversationHistory) and new format (fullEvaluationPayload)
    let payload: any = null
    
    if (fullEvaluationPayload && typeof fullEvaluationPayload === 'object' && 'fullConversationHistory' in fullEvaluationPayload) {
      // New format - full evaluation payload
      payload = fullEvaluationPayload
      if (!payload.fullConversationHistory || !Array.isArray(payload.fullConversationHistory) || payload.fullConversationHistory.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Full evaluation payload must contain non-empty fullConversationHistory array' 
        })
      }
    } else if (conversationHistory && Array.isArray(conversationHistory)) {
      // Old format - just conversation history (backward compatibility)
      if (conversationHistory.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Conversation history cannot be empty' 
        })
      }
      payload = conversationHistory
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Either conversationHistory (array) or fullEvaluationPayload (object) is required' 
      })
    }

    const evaluation = await llmService.generateComprehensiveEvaluation(payload)
    
    res.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('Error generating comprehensive evaluation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate comprehensive evaluation',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router