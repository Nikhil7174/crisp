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
            const averageScore = totalInterviews > 0
                ? Math.round(interviews.reduce((sum, i) => sum + (i.score || 0), 0) / totalInterviews)
                : 0;
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
            const interviewId = parseInt(id);

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

            const linkIdNum = parseInt(linkId);
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

            // Save the generated questions to the database
            await this.dbService.updateInterviewLinkQuestions(linkIdNum, questions);

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

            const linkIdNum = parseInt(linkId);
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

            const linkIdNum = parseInt(linkId);
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

    async createLink(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const { title, description, expiryDate, maxAttempts, jobTitle, jobId, role, yearsOfExperience, maxInterviewQuestions, maxMachineCodingQuestions, topics, machineQuestions } = req.body;

            if (!title) {
                res.status(400).json({ error: 'Title is required' });
                return;
            }

            // Generate unique link token
            const linkToken = this.generateLinkToken();

            const link = await this.dbService.createInterviewLink({
                createdBy: interviewerId,
                linkToken,
                title,
                description,
                expiryDate,
                maxAttempts,
                jobTitle,
                jobId,
                role,
                yearsOfExperience,
                maxInterviewQuestions,
                maxMachineCodingQuestions,
                topics,
                machineQuestions
            });

            // Auto-generate questions for the interview link
            try {
                console.log('🎯 Auto-generating questions for interview link ID:', link.id);
                const questions = await this.questionGenerationService.generateInterviewQuestions(link);
                
                // Save the generated questions to the database
                await this.dbService.updateInterviewLinkQuestions(link.id, questions);
                
                console.log(`✅ Auto-generated and saved ${questions.length} questions for interview link ${link.id}`);
            } catch (questionError) {
                console.error('❌ Error auto-generating questions:', questionError);
                // Don't fail the interview link creation if question generation fails
                // The user can still generate questions manually later
            }

            // Construct the interview link URL
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174';
            const linkUrl = `${baseUrl}/join?token=${link.link_token}`;

            res.status(201).json({
                success: true,
                data: {
                    ...link,
                    url: linkUrl,
                    token: link.link_token
                },
                message: 'Interview link created successfully with auto-generated questions'
            });

        } catch (error) {
            console.error('Create link error:', error);
            res.status(500).json({
                error: 'Failed to create interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getMyLinks(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const links = await this.dbService.getInterviewLinksByUser(interviewerId);

            res.json({
                success: true,
                links: links
            });

        } catch (error) {
            console.error('Get my links error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview links',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getLinkById(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const linkId = parseInt(req.params.id);

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            const link = await this.dbService.getInterviewLinkById(linkId);

            if (!link) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            // Check if the link belongs to this interviewer
            if (link.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            res.json({
                success: true,
                data: link
            });

        } catch (error) {
            console.error('Get link by ID error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async updateLink(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const linkId = parseInt(req.params.id);

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Check if the link exists and belongs to this interviewer
            const existingLink = await this.dbService.getInterviewLinkById(linkId);
            if (!existingLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (existingLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const { title, description, isActive, expiryDate, maxAttempts } = req.body;

            const updatedLink = await this.dbService.updateInterviewLink(linkId, {
                title,
                description,
                isActive,
                expiryDate,
                maxAttempts
            });

            res.json({
                success: true,
                data: updatedLink,
                message: 'Interview link updated successfully'
            });

        } catch (error) {
            console.error('Update link error:', error);
            res.status(500).json({
                error: 'Failed to update interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async deleteLink(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const linkId = parseInt(req.params.id);

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Check if the link exists and belongs to this interviewer
            const existingLink = await this.dbService.getInterviewLinkById(linkId);
            if (!existingLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (existingLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            await this.dbService.deleteInterviewLink(linkId);

            res.json({
                success: true,
                message: 'Interview link deleted successfully'
            });

        } catch (error) {
            console.error('Delete link error:', error);
            res.status(500).json({
                error: 'Failed to delete interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    async getCandidatesByLink(req: Request, res: Response): Promise<void> {
        try {
            const authReq = req as AuthRequest;
            const interviewerId = authReq.user?.userId;
            const linkId = parseInt(req.params.id);

            if (!interviewerId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Check if the link exists and belongs to this interviewer
            const existingLink = await this.dbService.getInterviewLinkById(linkId);
            if (!existingLink) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (existingLink.created_by !== interviewerId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const candidates = await this.dbService.getCandidatesByInterviewLink(linkId);

            // Format link info for frontend
            const linkInfo = {
                title: existingLink.title,
                description: existingLink.description,
            };

            res.json({
                success: true,
                candidates: candidates,
                link: linkInfo
            });

        } catch (error) {
            console.error('Get candidates by link error:', error);
            res.status(500).json({
                error: 'Failed to fetch candidates',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private generateLinkToken(): string {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
}
