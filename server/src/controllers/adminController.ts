import { Request, Response } from 'express';
import { PrismaService } from '../services/prismaService';
import { AuthService } from '../services/authService';
import { QuestionGenerationService } from '../services/questionGenerationService';

interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
        userType: 'candidate' | 'interviewer';
        type: string;
    };
}

export class InterviewerController {
    private dbService: PrismaService;
    private authService: AuthService;
    private questionGenerationService: QuestionGenerationService;

    constructor() {
        this.dbService = PrismaService.getInstance();
        this.authService = AuthService.getInstance();
        this.questionGenerationService = new QuestionGenerationService();
    }


    async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            // Get only interviews from this interviewer's links
            const interviews = await this.dbService.getInterviewsByInterviewer(interviewerId);

            // Calculate summary statistics
            const totalInterviews = interviews.length;
            const totalCandidates = new Set(interviews.map(i => i.candidate_email)).size;

            // Calculate average score from completed interviews
            // Priority: LLM evaluation overall score > finalEvaluation totalScore > interview.score
            const scores: number[] = [];

            interviews.forEach(i => {
                if (!i.end_time) return; // Skip incomplete interviews

                // Try to get score from various sources
                let score: number | null = null;

                // Check LLM evaluation first (most accurate)
                if ((i as any).finalEvaluation?.llmEvaluation?.overall?.score !== null &&
                    (i as any).finalEvaluation?.llmEvaluation?.overall?.score !== undefined) {
                    score = (i as any).finalEvaluation.llmEvaluation.overall.score;
                }
                // Check finalEvaluation totalScore
                else if ((i as any).finalEvaluation?.totalScore !== null &&
                    (i as any).finalEvaluation?.totalScore !== undefined) {
                    score = (i as any).finalEvaluation.totalScore;
                }
                // Check interview.score
                else if (i.score !== null && i.score !== undefined) {
                    score = i.score;
                }

                // Only add if we found a valid score (including 0 as valid)
                if (score !== null && score !== undefined) {
                    scores.push(score);
                    console.log(`[Average Score] Interview ${i.id}: score=${score} (from ${(i as any).finalEvaluation?.llmEvaluation ? 'llmEvaluation' : (i as any).finalEvaluation ? 'finalEvaluation.totalScore' : 'interview.score'})`);
                } else {
                    console.log(`[Average Score] Interview ${i.id}: No valid score found (end_time: ${i.end_time}, has finalEvaluation: ${!!(i as any).finalEvaluation})`);
                }
            });

            const averageScore = scores.length > 0
                ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
                : 0;

            console.log(`[Average Score] Total completed interviews: ${interviews.filter(i => i.end_time).length}, Interviews with scores: ${scores.length}, Average: ${averageScore}`);
            const completedInterviews = interviews.filter(i => i.end_time).length;

            // Calculate cheating detection statistics
            const cheatingDetectedCount = interviews.filter(i => i.cheating_detected).length;
            const securityAgentConnectedCount = interviews.filter(i => i.security_agent_connected).length;

            res.json({
                success: true,
                data: {
                    interviews,
                    statistics: {
                        totalInterviews,
                        totalCandidates,
                        averageScore,
                        completedInterviews,
                        cheatingDetectedCount,
                        securityAgentConnectedCount
                    }
                }
            });

        } catch (error) {
            console.error('Get dashboard error:', error);
            res.status(500).json({
                error: 'Failed to fetch dashboard data',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getInterviewDetails(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const { id } = req.params;
            const interviewId = parseInt(id as string);

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (isNaN(interviewId)) {
                res.status(400).json({ error: 'Invalid interview ID' });
                return;
            }

            const interview = await this.dbService.getInterviewById(interviewId);

            if (!interview) {
                res.status(404).json({ error: 'Interview not found' });
                return;
            }

            // Verify this interview belongs to the interviewer's link
            const hasAccess = await this.dbService.verifyInterviewerAccess(interviewId, interviewerId);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied to this interview' });
                return;
            }

            res.json({
                success: true,
                data: interview
            });

        } catch (error) {
            console.error('Get interview details error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview details',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async generateQuestions(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const { linkId } = req.params;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!linkId) {
                res.status(400).json({ error: 'Link ID is required' });
                return;
            }

            const linkIdNum = parseInt(linkId as string);
            if (isNaN(linkIdNum)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Get the interview link
            const interviewLink = await this.dbService.getInterviewLinkById(linkIdNum);
            if (!interviewLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            // Verify this link belongs to the interviewer
            if (interviewLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied to this interview link' });
                return;
            }

            // Generate questions using the question generation service
            const questions = await this.questionGenerationService.generateInterviewQuestions(interviewLink);

            res.json({
                success: true,
                data: {
                    questions,
                    linkId: linkIdNum,
                    totalQuestions: questions.length
                },
                message: 'Questions generated successfully'
            });

        } catch (error) {
            console.error('Generate questions error:', error);
            res.status(500).json({
                error: 'Failed to generate questions',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async approveQuestions(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const { linkId } = req.params;
            const { questions } = req.body;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!linkId || !questions) {
                res.status(400).json({ error: 'Link ID and questions are required' });
                return;
            }

            const linkIdNum = parseInt(linkId as string);
            if (isNaN(linkIdNum)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Verify this link belongs to the interviewer
            const interviewLink = await this.dbService.getInterviewLinkById(linkIdNum);
            if (!interviewLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (interviewLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied to this interview link' });
                return;
            }

            // Update the interview link with approved questions
            await this.dbService.updateInterviewLinkQuestions(linkIdNum, questions);

            res.json({
                success: true,
                message: 'Questions approved and saved successfully'
            });

        } catch (error) {
            console.error('Approve questions error:', error);
            res.status(500).json({
                error: 'Failed to approve questions',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getInterviewLinkDetails(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const { linkId } = req.params;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (!linkId) {
                res.status(400).json({ error: 'Link ID is required' });
                return;
            }

            const linkIdNum = parseInt(linkId as string);
            if (isNaN(linkIdNum)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Get the interview link
            const interviewLink = await this.dbService.getInterviewLinkById(linkIdNum);
            if (!interviewLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            // Verify this link belongs to the interviewer
            if (interviewLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied to this interview link' });
                return;
            }

            res.json({
                success: true,
                data: interviewLink
            });

        } catch (error) {
            console.error('Get interview link details error:', error);
            res.status(500).json({
                error: 'Failed to get interview link details',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}
