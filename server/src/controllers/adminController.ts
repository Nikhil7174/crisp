import { Request, Response } from 'express';
import { PrismaService } from '../services/prismaService';
import { AuthService } from '../services/authService';

interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
        userType: 'candidate' | 'interviewer';
        type: string;
    };
}

export class AdminController {
    private dbService: PrismaService;
    private authService: AuthService;

    constructor() {
        this.dbService = PrismaService.getInstance();
        this.authService = AuthService.getInstance();
    }

    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }

            // Get user by email
            const user = await this.dbService.getUserByEmail(email);
            if (!user) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Check if user is active
            if (!user.is_active) {
                res.status(403).json({
                    error: 'Account disabled',
                    message: 'Your account has been disabled'
                });
                return;
            }

            // Check if user is an interviewer
            if (user.user_type !== 'interviewer') {
                res.status(403).json({ error: 'Only interviewers can access the admin panel' });
                return;
            }

            // Verify password
            const isPasswordValid = await this.authService.comparePassword(password, user.password_hash);
            if (!isPasswordValid) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Update last login
            await this.dbService.updateUserLastLogin(user.id);

            // Generate token
            const token = this.authService.generateToken({
                userId: user.id,
                email: user.email,
                userType: user.user_type
            });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    userType: user.user_type,
                    phone: user.phone,
                    company: user.company
                },
                message: 'Login successful'
            });

        } catch (error) {
            console.error('Admin login error:', error);
            res.status(500).json({
                error: 'Login failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
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
}
