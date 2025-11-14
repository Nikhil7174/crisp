import express from 'express'
import { createLLMService, LLMService, Question, Evaluation, CodeAnalysis, IntentDetection } from '../services/llm-service'

const router = express.Router()

// Initialize LLM service
const llmService = createLLMService({
  apiKey: process.env.OPENAI_API_KEY || '',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 500
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

// Detect intent of candidate input
router.post('/detect-intent', async (req, res) => {
  try {
    const { candidateInput } = req.body

    if (!candidateInput) {
      return res.status(400).json({ 
        success: false, 
        error: 'Candidate input is required' 
      })
    }

    const intent = await llmService.detectIntent(candidateInput)
    
    res.json({
      success: true,
      intent
    })
  } catch (error) {
    console.error('Error detecting intent:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to detect intent'
    })
  }
})

// Generate hint for candidate
router.post('/generate-hint', async (req, res) => {
  try {
    const { question, candidateAnswer = '' } = req.body

    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question is required' 
      })
    }

    const hint = await llmService.generateHint(question, candidateAnswer)
    
    res.json({
      success: true,
      hint
    })
  } catch (error) {
    console.error('Error generating hint:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate hint'
    })
  }
})

// Generate clarification for question
router.post('/generate-clarification', async (req, res) => {
  try {
    const { question } = req.body

    if (!question) {
      return res.status(400).json({ 
        success: false, 
        error: 'Question is required' 
      })
    }

    const clarification = await llmService.generateClarification(question)
    
    res.json({
      success: true,
      clarification
    })
  } catch (error) {
    console.error('Error generating clarification:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate clarification'
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

// Evaluate coding approach explanation
router.post('/evaluate-coding-approach', async (req, res) => {
  try {
    const { explanation, problem, starterCode = '', currentCode = '' } = req.body

    if (!explanation || !problem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Explanation and problem are required' 
      })
    }

    const evaluation = await llmService.evaluateCodingApproach(explanation, problem, starterCode, currentCode)
    
    res.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('Error evaluating coding approach:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate coding approach',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate coding clarification
router.post('/generate-coding-clarification', async (req, res) => {
  try {
    const { problem, clarificationRequest, clarificationCount = 0, currentCode = '' } = req.body

    if (!problem || !clarificationRequest) {
      return res.status(400).json({ 
        success: false, 
        error: 'Problem and clarification request are required' 
      })
    }

    const clarification = await llmService.generateCodingClarification(
      problem, 
      clarificationRequest, 
      clarificationCount,
      currentCode
    )
    
    res.json({
      success: true,
      clarification
    })
  } catch (error) {
    console.error('Error generating coding clarification:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate coding clarification',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate monitoring hint (for automatic 60s checks)
router.post('/generate-monitoring-hint', async (req, res) => {
  try {
    const { problem, hintLevel = 1, currentCode = '', previousCode = null, hasCodeChanged = false, codeAnalysis = null } = req.body

    if (!problem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Problem is required' 
      })
    }

    if (hintLevel < 1 || hintLevel > 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Hint level must be 1 or 2' 
      })
    }

    const hint = await llmService.generateMonitoringHint(
      problem, 
      hintLevel as 1 | 2, 
      currentCode,
      previousCode,
      hasCodeChanged,
      codeAnalysis
    )
    
    res.json({
      success: true,
      hint
    })
  } catch (error) {
    console.error('Error generating monitoring hint:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate monitoring hint',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate coding hint (for manual requests)
router.post('/generate-coding-hint', async (req, res) => {
  try {
    const { problem, hintLevel = 1, currentCode = '', previousCode = null, hasCodeChanged = false, codeAnalysis = null } = req.body

    if (!problem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Problem is required' 
      })
    }

    if (hintLevel < 1 || hintLevel > 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Hint level must be 1 or 2' 
      })
    }

    const hint = await llmService.generateCodingHint(
      problem, 
      hintLevel as 1 | 2, 
      currentCode,
      previousCode,
      hasCodeChanged,
      codeAnalysis
    )
    
    res.json({
      success: true,
      hint
    })
  } catch (error) {
    console.error('Error generating coding hint:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate coding hint',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Monitor coding progress
router.post('/monitor-coding-progress', async (req, res) => {
  try {
    const { problem, currentCode, previousCode = '' } = req.body

    if (!problem || !currentCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Problem and current code are required' 
      })
    }

    const progress = await llmService.monitorCodingProgress(
      problem, 
      currentCode, 
      previousCode
    )
    
    res.json({
      success: true,
      progress
    })
  } catch (error) {
    console.error('Error monitoring coding progress:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to monitor coding progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// Generate final coding feedback
router.post('/generate-final-coding-feedback', async (req, res) => {
  try {
    const { problem, submittedCode, testResults = [] } = req.body

    if (!problem || !submittedCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Problem and submitted code are required' 
      })
    }

    const feedback = await llmService.generateFinalCodingFeedback(
      problem, 
      submittedCode, 
      testResults
    )
    
    res.json({
      success: true,
      feedback
    })
  } catch (error) {
    console.error('Error generating final coding feedback:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate final coding feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export default router