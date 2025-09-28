import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { InterviewSession, InterviewQuestion, InterviewAnswer } from '../models/types';

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
      
      if (!candidateData || !candidateData.text) {
        res.status(400).json({ error: 'Candidate data is required' });
        return;
      }
      
      // Generate interview questions
      const questions = await this.openaiService.generateInterviewQuestions(
        candidateData.text,
        5
      );
      
      // Create interview session
      const sessionId = this.generateSessionId();
      const session: InterviewSession = {
        id: sessionId,
        candidateId: candidateData.email || 'unknown',
        status: 'pending',
        questions,
        answers: [],
        startTime: new Date()
      };
      
      this.sessions.set(sessionId, session);
      
      res.json({
        success: true,
        sessionId,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          type: q.type,
          difficulty: q.difficulty,
          timeLimit: q.timeLimit
        })),
        message: 'Interview session started successfully'
      });
      
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
      const { sessionId, questionId, answer, timeTaken } = req.body;
      
      if (!sessionId || !questionId || !answer) {
        res.status(400).json({ error: 'Session ID, question ID, and answer are required' });
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
      
      // Evaluate the answer
      const evaluation = await this.openaiService.evaluateAnswer(
        question.question,
        answer,
        session.candidateId // Using candidateId as a placeholder for resume text
      );
      
      // Create answer record
      const answerRecord: InterviewAnswer = {
        questionId,
        answer,
        answeredAt: new Date(),
        timeTaken: timeTaken || 0,
        score: evaluation.score,
        feedback: evaluation.feedback
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
        session.score = this.calculateOverallScore(session.answers);
      }
      
      res.json({
        success: true,
        evaluation,
        isComplete: allQuestionsAnswered,
        nextQuestion: allQuestionsAnswered ? null : this.getNextQuestion(session),
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
      
      res.json({
        success: true,
        results: {
          sessionId: session.id,
          score: session.score,
          duration: session.duration,
          answers: session.answers.map(answer => {
            const question = session.questions.find(q => q.id === answer.questionId);
            return {
              question: question?.question,
              answer: answer.answer,
              score: answer.score,
              feedback: answer.feedback,
              timeTaken: answer.timeTaken
            };
          }),
          summary: this.generateSummary(session)
        }
      });
      
    } catch (error) {
      console.error('Get results error:', error);
      res.status(500).json({ 
        error: 'Failed to get results',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private calculateOverallScore(answers: InterviewAnswer[]): number {
    const totalScore = answers.reduce((sum, answer) => sum + (answer.score || 0), 0);
    return Math.round(totalScore / answers.length * 10) / 10;
  }
  
  private getNextQuestion(session: InterviewSession): InterviewQuestion | null {
    const unansweredQuestions = session.questions.filter(q => 
      !session.answers.some(a => a.questionId === q.id)
    );
    return unansweredQuestions[0] || null;
  }
  
  private generateSummary(session: InterviewSession): string {
    const avgScore = session.score || 0;
    const totalQuestions = session.questions.length;
    const duration = session.duration ? Math.round(session.duration / 60000) : 0; // minutes
    
    return `Interview completed with ${avgScore}/10 average score. 
    Answered ${totalQuestions} questions in ${duration} minutes. 
    ${avgScore >= 7 ? 'Excellent performance!' : avgScore >= 5 ? 'Good performance.' : 'Room for improvement.'}`;
  }
}
