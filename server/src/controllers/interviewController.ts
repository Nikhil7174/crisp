import { Request, Response } from 'express';
import { OpenAIService } from '../services/openaiService';
import { PrismaService } from '../services/prismaService';
import { prisma } from '../lib/prisma';
import { CodeExecutionService } from '../services/codeExecutionService';
import { SecurityService } from '../services/securityService';
import { QuestionGenerationService } from '../services/questionGenerationService';
import { InterviewSession, InterviewQuestion, DetailedResumeData, FinalResults, FinalEvaluationPayload } from '../models/types';

/**
 * In-memory store for interview questions
 * Keyed by sessionId or roomName (interview-${sessionId})
 * This allows the agent process to fetch questions via API
 */
const interviewQuestionsStore = new Map<string, {
  questions: InterviewQuestion[];
  codingProblems: InterviewQuestion[];
  sessionId: string;
  maxTheoreticalQuestions?: number;
  role?: string; // Role for persona selection
  interviewLinkId?: number;
}>();

export class InterviewController {
  private openaiService: OpenAIService;
  private dbService: PrismaService;
  private codeExecutionService: CodeExecutionService;
  private securityService: SecurityService;
  private questionGenerationService: QuestionGenerationService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.dbService = PrismaService.getInstance();
    this.codeExecutionService = new CodeExecutionService();
    this.securityService = SecurityService.getInstance();
    this.questionGenerationService = new QuestionGenerationService();
  }

  /**
   * Validate interview link (public endpoint)
   */
  async validateLink(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token || typeof token !== 'string') {
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
    const { candidateData, linkToken } = req.body;
    try {
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

      // Generate questions using the new question generation service
      const questions = await this.questionGenerationService.generateInterviewQuestions(link);

      // Create interview session
      const sessionId = this.generateSessionId();

      // Separate theoretical and coding questions
      const theoreticalQuestions = questions.filter(q => q.type === 'theoretical');
      const codingQuestions = questions.filter(q => q.type === 'machine_coding');

      console.log(`📊 Separated: ${theoreticalQuestions.length} theoretical, ${codingQuestions.length} coding questions`);

      // Map theoretical questions
      const mappedTheoretical: InterviewQuestion[] = theoreticalQuestions.map(q => ({
        id: q.id,
        question: q.question,
        type: 'technical',
        difficulty: q.difficulty,
        timeLimit: q.timeLimit,
        expectedAnswer: q.expectedAnswer,
        explanation: q.explanation,
        keyPoints: q.keyPoints,
        documentation: q.documentation
      }));

      // Map coding questions (with all coding-specific fields)
      const mappedCoding: InterviewQuestion[] = codingQuestions.map(q => {
        // Set time limit based on difficulty
        let timeLimit = 1800; // Default 30 minutes
        if (q.difficulty === 'easy') {
          timeLimit = 900; // 15 minutes
        } else if (q.difficulty === 'medium') {
          timeLimit = 1500; // 25 minutes
        } else if (q.difficulty === 'hard') {
          timeLimit = 1800; // 30 minutes
        }

        return {
          id: q.id,
          question: q.question,
          title: q.question,    // Required by Orchestrator
          description: q.problemStatement || q.question, // Required by Orchestrator
          type: 'coding',
          difficulty: q.difficulty,
          timeLimit: q.timeLimit || timeLimit,
          expectedAnswer: q.expectedAnswer,
          explanation: q.explanation,
          keyPoints: q.keyPoints,
          documentation: q.documentation,
          language: (q.language && ['javascript', 'typescript', 'python', 'java', 'cpp'].includes(q.language))
            ? q.language as 'javascript' | 'typescript' | 'python' | 'java' | 'cpp'
            : 'javascript',
          initialCode: q.starterCode,
          starterCodes: q.starterCodes, // Include multi-language starter codes
          expectedOutput: q.testCases?.[0]?.expectedOutput,
          testCases: q.testCases,
          instructions: q.problemStatement,
          constraints: q.constraints,
          examples: q.examples
        };
      });

      // Combine for database storage (keeping all questions together in DB)
      const allQuestions = [...mappedTheoretical, ...mappedCoding];

      const session: InterviewSession = {
        id: sessionId,
        candidateId: candidateData.email || candidateData.name || 'unknown',
        status: 'in_progress',
        questions: allQuestions,
        answers: [],
        startTime: new Date()
      };

      // Session saving removed - no longer needed without sessions table

      // Create LiveKit room and spawn agent
      const roomName = `interview-${sessionId}`;
      const candidateName = candidateData.name || candidateData.email || 'Candidate';

      // Import LiveKit token generation
      const { AccessToken } = await import('livekit-server-sdk');

      const LIVEKIT_URL = process.env.LIVEKIT_URL || 'wss://your-livekit-server.livekit.cloud';
      const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
      const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

      // Generate LiveKit access token for the candidate
      let livekitToken = '';
      try {
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
          identity: candidateName,
          name: candidateName,
        });
        at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
        livekitToken = await at.toJwt();
        console.log(`✅ LiveKit token generated for ${candidateName} in room ${roomName}`);
      } catch (tokenError) {
        console.error('⚠️ Failed to generate LiveKit token:', tokenError);
        throw new Error('Failed to generate LiveKit access token');
      }

      // Store questions in memory for the agent to fetch via API
      try {
        interviewQuestionsStore.set(sessionId, {
          questions: mappedTheoretical,
          codingProblems: mappedCoding,
          sessionId,
          maxTheoreticalQuestions: link.max_interview_questions || 10,
          role: link.role || 'Backend Engineer', // Include role for persona
          interviewLinkId: link.id,
        });
        // Also store by roomName for easier lookup
        interviewQuestionsStore.set(roomName, {
          questions: mappedTheoretical,
          codingProblems: mappedCoding,
          sessionId,
          maxTheoreticalQuestions: link.max_interview_questions || 10,
          role: link.role || 'Backend Engineer', // Include role for persona
          interviewLinkId: link.id,
        });
        console.log(`📚 [QuestionsStore] Stored ${mappedTheoretical.length} questions and ${mappedCoding.length} coding problems for session ${sessionId} (room: ${roomName})`);
        console.log(`📚 [QuestionsStore] Store size: ${interviewQuestionsStore.size} entries`);
      } catch (storeError) {
        console.error('❌ [QuestionsStore] Failed to store questions:', storeError);
        console.error('❌ [QuestionsStore] Error details:', {
          sessionId,
          roomName,
          theoreticalCount: mappedTheoretical.length,
          codingCount: mappedCoding.length,
          error: storeError instanceof Error ? storeError.message : String(storeError),
          stack: storeError instanceof Error ? storeError.stack : undefined,
        });
        throw new Error('Failed to store interview questions');
      }

      // The LiveKit agent process (running separately) will pick up jobs when rooms are created
      // The agent will fetch questions from this API endpoint
      // Make sure the interview-agent process is running: cd crisp/interview-agent && npm start
      console.log(`ℹ️  LiveKit room created: ${roomName}. Agent will connect when process is running.`);

      // Return with proper separation for security agent app + LiveKit info
      const responseData = {
        success: true,
        sessionId,
        interviewLinkId,
        theoreticalQuestions: mappedTheoretical,
        codingQuestions: mappedCoding,
        maxTheoreticalQuestions: link.max_interview_questions || 10,
        // Also include combined for backward compatibility
        questions: allQuestions,
        // LiveKit room information
        roomName,
        wsUrl: LIVEKIT_URL,
        token: livekitToken,
        message: 'Interview session started successfully'
      };

      res.json(responseData);

    } catch (error) {
      console.error('❌ [StartInterview] Start interview error:', error);
      console.error('❌ [StartInterview] Error details:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        candidateData: candidateData ? { name: candidateData.name, email: candidateData.email } : null,
        linkToken: linkToken ? 'provided' : 'missing',
        hasCandidateData: !!candidateData,
        hasLinkToken: !!linkToken,
      });
      res.status(500).json({
        error: 'Failed to start interview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Note: submitAnswer method removed - answers are only stored locally until interview completion

  /**
   * Get questions for an interview session
   * Used by the LiveKit agent process to fetch questions
   */
  async getInterviewQuestions(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, roomName } = req.query;

      console.log(`📥 [QuestionsAPI] Request received - sessionId: ${sessionId}, roomName: ${roomName}`);
      console.log(`📥 [QuestionsAPI] Store size: ${interviewQuestionsStore.size} entries`);

      if (!sessionId && !roomName) {
        console.error('❌ [QuestionsAPI] Missing parameters - sessionId and roomName both undefined');
        res.status(400).json({
          success: false,
          error: 'sessionId or roomName is required'
        });
        return;
      }

      // Helper function to extract string from query parameter
      const extractString = (param: any): string | undefined => {
        if (typeof param === 'string') return param;
        if (Array.isArray(param) && param.length > 0 && typeof param[0] === 'string') return param[0];
        return undefined;
      };

      // Ensure we have string values, not arrays or ParsedQs objects
      const sessionIdStr = extractString(sessionId);
      const roomNameStr = extractString(roomName);

      // Try to find by sessionId first, then roomName
      const identifier = sessionIdStr || roomNameStr;

      if (!identifier) {
        console.error('❌ [QuestionsAPI] Could not extract valid identifier from query parameters');
        res.status(400).json({
          success: false,
          error: 'Valid sessionId or roomName is required'
        });
        return;
      }

      console.log(`🔍 [QuestionsAPI] Looking up identifier: ${identifier}`);

      // Try both identifiers
      let questionsData = interviewQuestionsStore.get(identifier);
      if (!questionsData && sessionIdStr && roomNameStr) {
        // Try the other identifier
        const alternateIdentifier = identifier === sessionIdStr ? roomNameStr : sessionIdStr;
        console.log(`🔍 [QuestionsAPI] Trying alternate identifier: ${alternateIdentifier}`);
        questionsData = interviewQuestionsStore.get(alternateIdentifier);
      }

      if (!questionsData) {
        console.error(`❌ [QuestionsAPI] Questions not found for identifier: ${identifier}`);
        console.error(`❌ [QuestionsAPI] Available keys in store:`, Array.from(interviewQuestionsStore.keys()));
        res.status(404).json({
          success: false,
          error: 'Questions not found for this interview session',
          sessionId: sessionIdStr,
          roomName: roomNameStr,
          identifier,
          storeSize: interviewQuestionsStore.size,
        });
        return;
      }

      console.log(`✅ [QuestionsAPI] Found questions: ${questionsData.questions.length} questions, ${questionsData.codingProblems.length} coding problems`);
      res.json({
        success: true,
        questions: questionsData.questions,
        codingProblems: questionsData.codingProblems,
        sessionId: questionsData.sessionId,
        maxTheoreticalQuestions: questionsData.maxTheoreticalQuestions,
        role: questionsData.role || 'Backend Engineer', // Include role in response
        interviewLinkId: questionsData.interviewLinkId,
      });
    } catch (error) {
      console.error('❌ [QuestionsAPI] Get interview questions error:', error);
      console.error('❌ [QuestionsAPI] Error details:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to get interview questions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

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

  /**
   * Demo interview link tokens keyed by role shortcode.
   * Each token must correspond to a valid, active InterviewLink in the database.
   *   fe → Frontend Engineer  (9nibe1p6cyaq51gq098b9)
   *   be → Backend Engineer   (zlee8albfyp5i9xqs9bmrh)
   *   ai → AI/ML Engineer     (3wswte70y5lriniftbor2)
   */
  private static DEMO_LINK_TOKENS: Record<string, string> = {
    fe: process.env.TOKEN_FE || '',
    be: process.env.TOKEN_BE || '',
    ai: process.env.TOKEN_AI || '',
  };

  private static DEFAULT_DEMO_ROLE = 'be';

  /**
   * Start a demo interview (public — no auth required).
   * Accepts an optional `role` query param: 'fe' | 'be' | 'ai'
   * Falls back to the backend ('be') token if the role is missing or unrecognised.
   */
  async startDemoInterview(req: Request, res: Response): Promise<void> {
    try {
      const roleParam = (req.body.type || req.body.role || req.query.role as string | undefined)?.toLowerCase();
      const role = roleParam && roleParam in InterviewController.DEMO_LINK_TOKENS
        ? roleParam
        : InterviewController.DEFAULT_DEMO_ROLE;

      const linkToken = InterviewController.DEMO_LINK_TOKENS[role];
      console.log(`🎮 [DemoInterview] Role: ${role}, Token: ${linkToken}`);

      // Validate the interview link from DB (same as startInterview)
      const link = await this.dbService.getInterviewLinkByToken(linkToken);

      if (!link) {
        res.status(404).json({ error: `Demo interview link not found in database (role: ${role})` });
        return;
      }

      if (!link.is_active) {
        res.status(403).json({ error: 'Demo interview link is inactive' });
        return;
      }

      if (link.expiry_date && new Date(link.expiry_date) < new Date()) {
        res.status(403).json({ error: 'Demo interview link has expired' });
        return;
      }

      const interviewLinkId = link.id;

      // Generate questions using the same service as real interviews
      const questions = await this.questionGenerationService.generateInterviewQuestions(link);

      const sessionId = this.generateSessionId();

      // Separate theoretical and coding questions
      const theoreticalQuestions = questions.filter(q => q.type === 'theoretical');
      const codingQuestions = questions.filter(q => q.type === 'machine_coding');

      console.log(`🎮 [DemoInterview] ${theoreticalQuestions.length} theoretical, ${codingQuestions.length} coding`);

      // Map theoretical questions
      const mappedTheoretical: InterviewQuestion[] = theoreticalQuestions.map(q => ({
        id: q.id,
        question: q.question,
        type: 'technical',
        difficulty: q.difficulty,
        timeLimit: q.timeLimit,
        expectedAnswer: q.expectedAnswer,
        explanation: q.explanation,
        keyPoints: q.keyPoints,
        documentation: q.documentation,
      }));

      // Map coding questions
      const mappedCoding: InterviewQuestion[] = codingQuestions.map(q => {
        let timeLimit = 1800;
        if (q.difficulty === 'easy') timeLimit = 900;
        else if (q.difficulty === 'medium') timeLimit = 1500;

        return {
          id: q.id,
          question: q.question,
          title: q.question,
          description: q.problemStatement || q.question,
          type: 'coding',
          difficulty: q.difficulty,
          timeLimit: q.timeLimit || timeLimit,
          expectedAnswer: q.expectedAnswer,
          explanation: q.explanation,
          keyPoints: q.keyPoints,
          documentation: q.documentation,
          language: (q.language && ['javascript', 'typescript', 'python', 'java', 'cpp'].includes(q.language))
            ? q.language as 'javascript' | 'typescript' | 'python' | 'java' | 'cpp'
            : 'javascript',
          initialCode: q.starterCode,
          starterCodes: q.starterCodes,
          expectedOutput: q.testCases?.[0]?.expectedOutput,
          testCases: q.testCases,
          instructions: q.problemStatement,
          constraints: q.constraints,
          examples: q.examples,
        };
      });

      const allQuestions = [...mappedTheoretical, ...mappedCoding];
      const roomName = `interview-${sessionId}`;
      const candidateName = 'Demo User';

      // Generate LiveKit token
      const { AccessToken } = await import('livekit-server-sdk');
      const LIVEKIT_URL = process.env.LIVEKIT_URL || '';
      const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
      const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';

      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: candidateName,
        name: candidateName,
      });
      at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
      const livekitToken = await at.toJwt();

      // Store questions in memory for the agent
      interviewQuestionsStore.set(sessionId, {
        questions: mappedTheoretical,
        codingProblems: mappedCoding,
        sessionId,
        maxTheoreticalQuestions: link.max_interview_questions || 10,
        role: link.role || 'Backend Engineer',
        interviewLinkId,
      });
      interviewQuestionsStore.set(roomName, {
        questions: mappedTheoretical,
        codingProblems: mappedCoding,
        sessionId,
        maxTheoreticalQuestions: link.max_interview_questions || 10,
        role: link.role || 'Backend Engineer',
        interviewLinkId,
      });

      console.log(`✅ [DemoInterview] Session ${sessionId} ready, room ${roomName}`);

      res.json({
        success: true,
        sessionId,
        interviewLinkId,
        theoreticalQuestions: mappedTheoretical,
        codingQuestions: mappedCoding,
        maxTheoreticalQuestions: link.max_interview_questions || 10,
        questions: allQuestions,
        roomName,
        wsUrl: LIVEKIT_URL,
        token: livekitToken,
        message: 'Demo interview session started successfully',
      });

    } catch (error) {
      console.error('❌ [DemoInterview] Error:', error);
      res.status(500).json({
        error: 'Failed to start demo interview',
        message: error instanceof Error ? error.message : 'Unknown error',
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

      if (!sessionId || typeof sessionId !== 'string') {
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

  /**
   * Update vision security data - receives vision security events from desktop app
   */
  async updateVisionSecurity(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { suspiciousEvents } = req.body;

      if (!sessionId || typeof sessionId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      if (!suspiciousEvents || !Array.isArray(suspiciousEvents)) {
        res.status(400).json({
          success: false,
          error: 'suspiciousEvents array is required'
        });
        return;
      }

      // Store security events in SecurityEvent table
      const interview = await prisma.interview.findUnique({
        where: { session_id: sessionId },
        include: { interview_link: true }
      });

      if (!interview) {
        res.status(404).json({ success: false, error: 'Interview not found' });
        return;
      }

      // Create SecurityEvent records for each suspicious event type
      const createPromises = suspiciousEvents.map(async (event) => {
        return prisma.securityEvent.create({
          data: {
            interview_id: interview.id,
            interview_link_id: interview.interview_link_id,
            session_id: sessionId,
            event_type: event.type,
            source: 'vision_system',
            severity: event.severity || 'medium',
            message: event.description || `Detected ${event.type}`,
            metadata: JSON.stringify({
              count: event.count,
              totalDuration: event.totalDuration,
              occurrences: event.events,
              screenshot: event.screenshot // If present in the event object
            })
          }
        });
      });

      await Promise.all(createPromises);

      // Also mark cheating_detected flag on interview if there are events
      if (suspiciousEvents.length > 0) {
        await prisma.interview.update({
          where: { id: interview.id },
          data: {
            cheating_detected: true
          }
        });
      }

      console.log(`✅ Vision security events logged for session ${sessionId}: ${suspiciousEvents.length} event types`);

      res.json({
        success: true,
        message: 'Vision security data updated successfully',
        eventsLogged: suspiciousEvents.length
      });

    } catch (error) {
      console.error('Update vision security error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update vision security data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Save final evaluation data (conversation history and structured evaluation)
   */
  async saveFinalEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const payload: FinalEvaluationPayload = req.body;
      const userId = (req as any).user?.userId; // Optional, only if authenticated

      console.log('=== SAVE FINAL EVALUATION DEBUG ===');
      console.log('Request received at:', new Date().toISOString());
      console.log('User ID:', userId);
      console.log('Session ID:', payload.sessionId);
      console.log('Candidate ID:', payload.candidateId);
      console.log('Interview Link ID:', payload.interviewLinkId);
      console.log('Total Score:', payload.totalScore);
      console.log('Start Time:', payload.startTime);
      console.log('End Time:', payload.endTime);
      console.log('Duration:', payload.duration, 'ms');
      console.log('Full Conversation History Length:', payload.fullConversationHistory?.length || 0);
      console.log('Theoretical Section - Questions:', payload.theoreticalSection?.totalQuestions || 0);
      console.log('Theoretical Section - Conversations:', payload.theoreticalSection?.conversations?.length || 0);
      console.log('Coding Section - Problems:', payload.codingSection?.totalProblems || 0);
      console.log('Coding Section - Conversations:', payload.codingSection?.conversations?.length || 0);
      console.log('Hint Request Count:', payload.hintRequestCount || 0);
      console.log('Clarification Request Count:', payload.clarificationRequestCount || 0);
      console.log('Follow Up Count:', payload.followUpCount || 0);
      console.log('Vision Security Warnings:', JSON.stringify((payload as any).visionSecurityWarnings, null, 2));
      console.log('Vision Security Warnings Type:', typeof (payload as any).visionSecurityWarnings);
      console.log('Vision Security Warnings Keys:', (payload as any).visionSecurityWarnings ? Object.keys((payload as any).visionSecurityWarnings) : 'null/undefined');
      console.log('Vision Security Warnings Length:', (payload as any).visionSecurityWarnings ? Object.keys((payload as any).visionSecurityWarnings).length : 0);
      console.log('=== END SAVE FINAL EVALUATION DEBUG ===');

      // Validate required fields
      if (!payload.sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required'
        });
        return;
      }

      if (!payload.candidateId) {
        res.status(400).json({
          success: false,
          error: 'Candidate ID is required'
        });
        return;
      }

      if (!payload.startTime || !payload.endTime) {
        res.status(400).json({
          success: false,
          error: 'Start time and end time are required'
        });
        return;
      }

      // Save to database
      let interviewId: number | null = null;
      try {
        const savedEvaluation = await this.dbService.saveFinalEvaluation({
          sessionId: payload.sessionId,
          candidateId: payload.candidateId,
          interviewLinkId: payload.interviewLinkId,
          startTime: payload.startTime,
          endTime: payload.endTime,
          duration: payload.duration,
          fullConversationHistory: payload.fullConversationHistory,
          theoreticalSection: payload.theoreticalSection,
          codingSection: payload.codingSection,
          totalScore: payload.totalScore,
          strengths: payload.strengths,
          areasForImprovement: payload.areasForImprovement,
          overallFeedback: payload.overallFeedback,
          hintRequestCount: payload.hintRequestCount,
          clarificationRequestCount: payload.clarificationRequestCount,
          followUpCount: payload.followUpCount,
          averageTimePerQuestion: payload.averageTimePerQuestion,
          averageTimePerCodingProblem: payload.averageTimePerCodingProblem,
          visionSecurityWarnings: (payload as any).visionSecurityWarnings,
        });

        // Get interview ID from the saved evaluation (it has interview_id field)
        interviewId = (savedEvaluation as any).interview_id;
        console.log('✅ Final evaluation saved to database successfully');
        console.log('✅ Interview ID:', interviewId);
      } catch (dbError) {
        console.error('❌ Error saving final evaluation to database:', dbError);
        res.status(500).json({
          success: false,
          error: 'Failed to save final evaluation',
          message: dbError instanceof Error ? dbError.message : 'Unknown database error'
        });
        return;
      }

      // Automatically generate LLM evaluation after saving (non-blocking)
      if (
        interviewId &&
        payload.fullConversationHistory &&
        payload.fullConversationHistory.length > 0
      ) {
        // Generate LLM evaluation asynchronously (don't block the response)
        // Using Promise to avoid blocking the response
        (async () => {
          try {
            console.log('🤖 Starting automatic LLM evaluation generation for interview', interviewId);
            const { createLLMService } = await import('../services/llm-service');
            const llmService = createLLMService({
              apiKey: process.env.OPENAI_API_KEY || '',
              model: 'gpt-4o-mini',
              temperature: 0.3,
              maxTokens: 4000, // Increased for detailed breakdowns
            });

            // Pass the full evaluation payload for enhanced evaluation with rules and context
            const llmEvaluation = await llmService.generateComprehensiveEvaluation(
              payload
            );

            await this.dbService.updateLLMEvaluation(interviewId!, llmEvaluation);
            console.log('✅ LLM evaluation generated and stored automatically for interview', interviewId);
          } catch (llmError) {
            console.error('⚠️ Failed to generate LLM evaluation automatically:', llmError);
            console.error('⚠️ Error details:', llmError instanceof Error ? llmError.message : String(llmError));
            // Don't fail the request - LLM evaluation can be generated later via the API
          }
        })();
      } else {
        console.log('⚠️ Skipping LLM evaluation generation:', {
          hasInterviewId: !!interviewId,
          hasConversationHistory: !!(payload.fullConversationHistory && payload.fullConversationHistory.length > 0),
        });
      }

      res.json({
        success: true,
        message: 'Final evaluation saved successfully',
        sessionId: payload.sessionId
      });

    } catch (error) {
      console.error('Save final evaluation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save final evaluation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Save candidate feedback after interview completion
   */
  async saveCandidateFeedback(req: Request, res: Response): Promise<void> {
    try {
      const {
        sessionId,
        rating,
        overallExperience,
        technicalQuestionsQuality,
        interviewPlatformRating,
        suggestions,
        wouldRecommend
      } = req.body;

      if (!sessionId || !rating) {
        res.status(400).json({
          success: false,
          error: 'Session ID and rating are required'
        });
        return;
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
        return;
      }

      // Find interview by session ID using prisma directly
      const interview = await prisma.interview.findUnique({
        where: { session_id: sessionId }
      });

      if (!interview) {
        res.status(404).json({
          success: false,
          error: 'Interview not found'
        });
        return;
      }

      // Save feedback
      const feedback = await this.dbService.saveCandidateFeedback({
        interviewId: interview.id,
        sessionId,
        rating,
        overallExperience,
        technicalQuestionsQuality,
        interviewPlatformRating,
        suggestions,
        wouldRecommend
      });

      res.json({
        success: true,
        data: feedback
      });
    } catch (error) {
      console.error('Save candidate feedback error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save candidate feedback',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}