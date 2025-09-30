import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { DatabaseService } from '../services/databaseService';
import { CodeExecutionService } from '../services/codeExecutionService';
import { InterviewSession, InterviewQuestion, DetailedResumeData, FinalResults } from '../models/types';

export class InterviewController {
  private openaiService: OpenAIService;
  private dbService: DatabaseService;
  private codeExecutionService: CodeExecutionService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.dbService = DatabaseService.getInstance();
    this.codeExecutionService = new CodeExecutionService();
  }

  async startInterview(req: Request, res: Response): Promise<void> {
    try {
      const { candidateData } = req.body;

      if (!candidateData) {
        res.status(400).json({ error: 'Candidate data is required' });
        return;
      }

      // Generate 6 questions: 2 Easy + 2 Medium + 2 Hard
      const questions = await this.openaiService.generateInterviewQuestions(candidateData);

      // Create interview session
      const sessionId = this.generateSessionId();
      const session: InterviewSession = {
        id: sessionId,
        candidateId: candidateData.email || candidateData.name || 'unknown',
        status: 'in_progress',
        questions,
        answers: [],
        startTime: new Date()
      };

      // Save session to SQLite
      await this.dbService.saveSession({
        sessionId,
        candidateId: session.candidateId,
        status: session.status,
        questions: session.questions,
        answers: session.answers,
        startTime: session.startTime
      });

      // In startInterview - just return questions
      const responseData = {
        success: true,
        sessionId,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          type: q.type,
          difficulty: q.difficulty,
          timeLimit: q.timeLimit,
          // MCQ fields
          options: q.options,
          correctAnswerId: q.correctAnswerId,
          // Coding fields
          language: q.language,
          initialCode: q.initialCode,
          expectedOutput: q.expectedOutput,
          testCases: q.testCases,
          instructions: q.instructions
        })),
        message: 'Interview session started successfully'
      };

      res.json(responseData);

    } catch (error) {
      console.error('Start interview error:', error);
      res.status(500).json({
        error: 'Failed to start interview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Note: submitAnswer method removed - answers are only stored locally until interview completion

  /**
   * Validate coding question answer
   */
  async validateCodeAnswer(req: Request, res: Response): Promise<void> {
    try {
      const { questionId, code } = req.body;

      if (!questionId || !code) {
        res.status(400).json({ error: 'Question ID and code are required' });
        return;
      }

      // Only validate Q5 and Q6 (coding questions)
      if (questionId !== 'q5' && questionId !== 'q6') {
        res.status(400).json({ error: 'Only Q5 and Q6 are coding questions' });
        return;
      }

      // Validate JavaScript syntax first
      if (!this.codeExecutionService.isValidJavaScript(code)) {
        res.status(400).json({
          error: 'Invalid JavaScript syntax',
          testResults: []
        });
        return;
      }

      // Execute code validation
      const testResults = await this.codeExecutionService.validateQuestionCode(questionId, code);
      const summary = this.codeExecutionService.getTestSummary(testResults);

      res.json({
        success: true,
        testResults,
        summary,
        isCorrect: summary.isCorrect,
        message: `Code validation completed. ${summary.passedTests}/${summary.totalTests} tests passed.`
      });

    } catch (error) {
      console.error('Code validation error:', error);
      res.status(500).json({
        error: 'Failed to validate code',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getSessionResults(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await this.dbService.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Interview session not found' });
        return;
      }

      if (session.status !== 'completed') {
        res.status(400).json({ error: 'Interview session is not completed yet' });
        return;
      }

      // Generate comprehensive evaluation
      const finalResults = await this.openaiService.generateFinalResults(session);

      // Update session with results
      session.score = finalResults.finalScore;
      session.summary = finalResults.summary;

      res.json({
        success: true,
        results: finalResults
      });

    } catch (error) {
      console.error('Get results error:', error);
      res.status(500).json({
        error: 'Failed to get results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = await this.dbService.getSession(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Interview session not found' });
        return;
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          score: session.score,
          questionsCount: session.questions.length,
          answersCount: session.answers.length
        }
      });

    } catch (error) {
      console.error('Get session error:', error);
      res.status(500).json({
        error: 'Failed to get session',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async saveResults(req: Request, res: Response): Promise<void> {
    try {
      const completeSummary = req.body;

      // DEBUG: Log incoming request data
      console.log('=== SAVE RESULTS DEBUG ===');
      console.log('Request received at:', new Date().toISOString());
      console.log('Request body keys:', Object.keys(completeSummary));
      console.log('Session ID:', completeSummary.sessionId);
      console.log('Candidate Name:', completeSummary.candidateName);
      console.log('Candidate Email:', completeSummary.candidateEmail);
      console.log('Score:', completeSummary.score);
      console.log('Full request body:', JSON.stringify(completeSummary, null, 2));
      console.log('=== END SAVE RESULTS DEBUG ===');

      if (!completeSummary.sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Update session in SQLite if it exists
      const session = await this.dbService.getSession(completeSummary.sessionId);
      if (session) {
        // Update session with complete summary
        await this.dbService.updateSession(completeSummary.sessionId, {
          status: 'completed',
          end_time: new Date(),
          duration: completeSummary.duration,
          score: completeSummary.score,
          summary: JSON.stringify(completeSummary)
        });
      }

      // Log the complete summary for debugging
      console.log('=== COMPLETE INTERVIEW SUMMARY ===');
      console.log('Session ID:', completeSummary.sessionId);
      console.log('Score:', completeSummary.score);
      console.log('Correct Answers:', completeSummary.correctAnswers, '/', completeSummary.totalQuestions);
      console.log('Time Spent:', completeSummary.timeSpent, 'seconds');
      console.log('Strengths:', completeSummary.strengths);
      console.log('Areas for Improvement:', completeSummary.areasForImprovement);
      console.log('Question Analysis:', completeSummary.questionAnalysis);
      console.log('Complete Summary:', JSON.stringify(completeSummary, null, 2));
      console.log('=== END COMPLETE INTERVIEW SUMMARY ===');

      // Save to database
      try {
        const interviewSummary = {
          sessionId: completeSummary.sessionId,
          candidateName: completeSummary.candidateName || completeSummary.candidateId || 'Unknown',
          candidateEmail: completeSummary.candidateEmail || completeSummary.candidateId || 'unknown@example.com',
          candidatePhone: completeSummary.candidatePhone || '',
          startTime: completeSummary.startTime,
          endTime: completeSummary.endTime,
          duration: completeSummary.duration,
          score: completeSummary.score,
          totalQuestions: completeSummary.totalQuestions,
          correctAnswers: completeSummary.correctAnswers,
          timeSpent: completeSummary.timeSpent,
          strengths: completeSummary.strengths,
          areasForImprovement: completeSummary.areasForImprovement,
          overallFeedback: completeSummary.overallFeedback,
          detailedAnswers: completeSummary.detailedAnswers,
          questionAnalysis: completeSummary.questionAnalysis
        };

        // DEBUG: Log interview summary before saving
        console.log('=== DATABASE SAVE DEBUG ===');
        console.log('Interview summary to save:', JSON.stringify(interviewSummary, null, 2));
        console.log('About to call saveInterviewSummary...');

        await this.dbService.saveInterviewSummary(interviewSummary);
        console.log('✅ Interview summary saved to database successfully');
        console.log('=== END DATABASE SAVE DEBUG ===');
      } catch (dbError) {
        console.error('❌ Error saving to database:', dbError);
        console.error('Database error details:', JSON.stringify(dbError, null, 2));
        // Don't fail the request if database save fails
      }

      res.json({
        success: true,
        message: 'Complete interview summary saved successfully',
        sessionId: completeSummary.sessionId,
        summary: completeSummary
      });

    } catch (error) {
      console.error('Save results error:', error);
      res.status(500).json({
        error: 'Failed to save results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextQuestion(session: InterviewSession): InterviewQuestion | null {
    const unansweredQuestions = session.questions.filter(q =>
      !session.answers.some(a => a.questionId === q.id)
    );
    return unansweredQuestions[0] || null;
  }
}
