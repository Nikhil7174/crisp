import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { PrismaService } from '../services/prismaService';
import { CodeExecutionService } from '../services/codeExecutionService';
import { SecurityService } from '../services/securityService';
import { InterviewSession, InterviewQuestion, DetailedResumeData, FinalResults } from '../models/types';

export class InterviewController {
  private openaiService: OpenAIService;
  private dbService: PrismaService;
  private codeExecutionService: CodeExecutionService;
  private securityService: SecurityService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.dbService = PrismaService.getInstance();
    this.codeExecutionService = new CodeExecutionService();
    this.securityService = SecurityService.getInstance();
  }

  /**
   * Validate interview link (public endpoint)
   */
  async validateLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: 'Link token is required' });
        return;
      }

      const link = await this.dbService.getInterviewLinkByToken(token);

      if (!link) {
        res.status(404).json({ error: 'Interview link not found' });
        return;
      }

      // Check if link is active
      if (!link.is_active) {
        res.status(403).json({
          error: 'Link inactive',
          message: 'This interview link has been deactivated'
        });
        return;
      }

      // Check if link has expired
      if (link.expiry_date) {
        const expiryDate = new Date(link.expiry_date);
        if (expiryDate < new Date()) {
          res.status(403).json({
            error: 'Link expired',
            message: 'This interview link has expired'
          });
          return;
        }
      }

      // Check security agent connection
      const securityStatus = await this.securityService.getSecurityAgentStatus();

      res.json({
        success: true,
        link: {
          title: link.title,
          description: link.description,
          creatorName: link.creator.full_name,
          expiryDate: link.expiry_date
        },
        security: {
          agentConnected: securityStatus.connected,
          agentActive: securityStatus.active,
          error: securityStatus.error,
          timestamp: securityStatus.timestamp
        }
      });

    } catch (error) {
      console.error('Validate link error:', error);
      res.status(500).json({
        error: 'Failed to validate link',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async startInterview(req: Request, res: Response): Promise<void> {
    try {
      const { candidateData, linkToken } = req.body;
      const userId = (req as any).user?.userId; // Optional, only if authenticated

      if (!candidateData) {
        res.status(400).json({ error: 'Candidate data is required' });
        return;
      }

      if (!linkToken) {
        res.status(400).json({ error: 'Interview link token is required' });
        return;
      }

      // Validate the interview link
      const link = await this.dbService.getInterviewLinkByToken(linkToken);

      if (!link) {
        res.status(404).json({ error: 'Interview link not found' });
        return;
      }

      if (!link.is_active) {
        res.status(403).json({ error: 'Interview link is inactive' });
        return;
      }

      if (link.expiry_date && new Date(link.expiry_date) < new Date()) {
        res.status(403).json({ error: 'Interview link has expired' });
        return;
      }

      const interviewLinkId = link.id;

      // Session clearing removed - no longer needed without sessions table

      // Save resume data to user profile if user is authenticated and has resume data
      if (userId && candidateData.resumeData) {
        try {
          await this.dbService.updateUserResume(userId, candidateData.resumeData);
          console.log('Resume data saved to user profile for user:', userId);
        } catch (error) {
          console.error('Failed to save resume data to user profile:', error);
          // Don't fail the interview start if resume saving fails
        }
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

      // Session saving removed - no longer needed without sessions table

      // In startInterview - just return questions
      const responseData = {
        success: true,
        sessionId,
        interviewLinkId,
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

  // getSessionResults and getSession methods removed - no longer needed without sessions table

  async saveResults(req: Request, res: Response): Promise<void> {
    try {
      const completeSummary = req.body;
      const userId = (req as any).user?.userId; // Optional, only if authenticated

      // DEBUG: Log incoming request data
      console.log('=== SAVE RESULTS DEBUG ===');
      console.log('Request received at:', new Date().toISOString());
      console.log('User ID:', userId);
      console.log('Session ID:', completeSummary.sessionId);
      console.log('Candidate Name:', completeSummary.candidateName);
      console.log('Candidate Email:', completeSummary.candidateEmail);
      console.log('Score:', completeSummary.score);
      console.log('=== END SAVE RESULTS DEBUG ===');

      if (!completeSummary.sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      // Get interviewLinkId from the request body (should be included by frontend)
      const interviewLinkId = completeSummary.interviewLinkId || null;

      // Log the complete summary for debugging
      console.log('=== COMPLETE INTERVIEW SUMMARY ===');
      console.log('Session ID:', completeSummary.sessionId);
      console.log('Interview Link ID:', interviewLinkId);
      console.log('Score:', completeSummary.score);
      console.log('Correct Answers:', completeSummary.correctAnswers, '/', completeSummary.totalQuestions);
      console.log('=== END COMPLETE INTERVIEW SUMMARY ===');

      // Save to database
      try {
        const interviewSummary = {
          sessionId: completeSummary.sessionId,
          userId: userId || null,
          interviewLinkId: interviewLinkId,
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
          questionAnalysis: completeSummary.questionAnalysis,
          isMockInterview: false // All interviews are now link-based
        };

        await this.dbService.saveInterviewSummary(interviewSummary);
        console.log('✅ Interview summary saved to database successfully');
      } catch (dbError) {
        console.error('❌ Error saving to database:', dbError);
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

  async updateCheatingDetection(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { cheatingDetected, cheatingIncidents, securityAgentConnected } = req.body;

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      // Update the interview record with cheating detection data
      await this.dbService.updateCheatingDetection(sessionId, {
        cheatingDetected: cheatingDetected || false,
        cheatingIncidents: cheatingIncidents || [],
        securityAgentConnected: securityAgentConnected || false
      });

      res.json({
        success: true,
        message: 'Cheating detection data updated successfully'
      });

    } catch (error) {
      console.error('Update cheating detection error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update cheating detection data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
