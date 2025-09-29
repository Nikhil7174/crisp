import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { InterviewSession, InterviewQuestion, InterviewAnswer, DetailedResumeData, FinalResults } from '../models/types';

export class InterviewController {
  private openaiService: OpenAIService;
  private sessions: Map<string, InterviewSession>;

  constructor() {
    this.openaiService = new OpenAIService();
    this.sessions = new Map();
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

      this.sessions.set(sessionId, session);

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
          options: q.options,
          correctAnswerId: q.correctAnswerId
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

  async submitAnswer(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, questionId, selectedOptionId, timeTaken } = req.body;

      if (!sessionId || !questionId || !selectedOptionId) {
        res.status(400).json({ error: 'Session ID, question ID, and selected option ID are required' });
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        res.status(404).json({ error: 'Interview session not found' });
        return;
      }

      if (session.status !== 'in_progress') {
        res.status(400).json({ error: 'Interview session is not active' });
        return;
      }

      // Find the question
      const question = session.questions.find(q => q.id === questionId);
      if (!question) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      // Handle timer expiry case
      let selectedOption;
      let isTimeout = false;

      if (selectedOptionId === 'timeout') {
        // For timer expiry, mark as incorrect and use first option as placeholder
        selectedOption = question.options[0];
        isTimeout = true;
      } else {
        // Find the selected option
        selectedOption = question.options.find(opt => opt.id === selectedOptionId);
        if (!selectedOption) {
          res.status(400).json({ error: 'Selected option not found' });
          return;
        }
      }

      // Create answer record
      const answerRecord: InterviewAnswer = {
        questionId,
        answer: isTimeout ? 'No answer selected (timeout)' : selectedOption.text,
        selectedOptionId: isTimeout ? 'timeout' : selectedOptionId,
        answeredAt: new Date(),
        timeTaken: timeTaken || 0,
        isCorrect: isTimeout ? false : selectedOption.isCorrect
      };

      // Update session
      session.answers.push(answerRecord);
      question.askedAt = new Date();

      // Check if all questions are answered
      const allQuestionsAnswered = session.questions.every(q =>
        session.answers.some(a => a.questionId === q.id)
      );

      if (allQuestionsAnswered) {
        session.status = 'completed';
        session.endTime = new Date();
        session.duration = session.endTime.getTime() - session.startTime.getTime();
      }

      // In submitAnswer - just return success/completion status
      res.json({
        success: true,
        isComplete: allQuestionsAnswered,
        message: 'Answer submitted successfully'
      });

    } catch (error) {
      console.error('Submit answer error:', error);
      res.status(500).json({
        error: 'Failed to submit answer',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getSessionResults(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      const session = this.sessions.get(sessionId);
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

      const session = this.sessions.get(sessionId);
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
