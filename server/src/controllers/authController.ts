import { Request, Response } from 'express';
import { PrismaService } from '../services/prismaService';
import { AuthService } from '../services/authService';
import { clerkClient } from '@clerk/clerk-sdk-node';

export class AuthController {
    private dbService: PrismaService;
    private authService: AuthService;

    constructor() {
        this.dbService = PrismaService.getInstance();
        this.authService = AuthService.getInstance();
    }

    // Legacy methods removed: registerCandidate, registerInterviewer, login

    /**
     * Get current user profile
     */
    async getCurrentUser(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user;

            if (!user || !user.userId && !user.isNewUser) {
                // Check if it's just missing userId because of middleware fallback issues
                if (!user?.email) {
                    res.status(401).json({
                        error: 'Unauthorized',
                        message: 'User not authenticated'
                    });
                    return;
                }
            }

            // Handle New User Creation (from Clerk)
            if (user.isNewUser) {
                try {
                    let newUserResponse;

                    if (user.userType === 'interviewer') {
                        // Interviewers go into the Interviewer table
                        const newInterviewer = await this.dbService.createInterviewer({
                            email: user.email,
                            fullName: user.fullName || 'New User',
                        });
                        newUserResponse = {
                            id: newInterviewer.id,
                            email: newInterviewer.email,
                            fullName: newInterviewer.full_name,
                            userType: 'interviewer' as const,
                            phone: newInterviewer.phone,
                            company: newInterviewer.company,
                            jobRole: newInterviewer.job_role,
                            createdAt: newInterviewer.created_at,
                            lastLogin: newInterviewer.last_login,
                        };
                    } else {
                        // Candidates go into the User table
                        const newUser = await this.dbService.createUser({
                            email: user.email,
                            fullName: user.fullName || 'New User',
                            userType: user.userType || 'candidate',
                            phone: '',
                            company: ''
                        });
                        newUserResponse = {
                            id: newUser.id,
                            email: newUser.email,
                            fullName: newUser.full_name,
                            userType: newUser.user_type,
                            phone: newUser.phone,
                            company: newUser.company,
                            createdAt: newUser.created_at,
                            lastLogin: newUser.last_login,
                        };
                    }

                    res.json({ success: true, user: newUserResponse });
                    return;
                } catch (creationError) {
                    console.error('Failed to create new user from Clerk:', creationError);
                    res.status(500).json({
                        error: 'Account Creation Failed',
                        message: 'Could not create local user account.'
                    });
                    return;
                }
            }

            const userId = user.userId;
            const userType = user.userType;

            let dbUser;
            if (userType === 'interviewer') {
                dbUser = await this.dbService.getInterviewerById(userId);
                if (dbUser) {
                    await this.dbService.updateInterviewerLastLogin(userId);
                }
            } else {
                dbUser = await this.dbService.getUserById(userId);
                if (dbUser) {
                    await this.dbService.updateUserLastLogin(userId);
                }
            }

            if (!dbUser) {
                res.status(404).json({
                    error: 'User not found',
                    message: 'User account not found'
                });
                return;
            }

            res.json({
                success: true,
                user: {
                    id: dbUser.id,
                    email: dbUser.email,
                    fullName: dbUser.full_name,
                    userType: userType,
                    phone: dbUser.phone,
                    company: dbUser.company,
                    companyLogoUrl: (dbUser as any).company_logo_url ?? null,
                    jobRole: (dbUser as any).job_role ?? null,
                    createdAt: dbUser.created_at,
                    lastLogin: dbUser.last_login
                }
            });

        } catch (error) {
            console.error('Get current user error:', error);
            res.status(500).json({
                error: 'Failed to get user data',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update profile — for interviewers to set company, job role, and phone after sign-up
     */
    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const user = (req as any).user;
            if (!user || !user.userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            if (user.userType !== 'interviewer') {
                res.status(403).json({ error: 'Only interviewers can update profile via this endpoint' });
                return;
            }

            const { fullName, company, companyLogoUrl, jobRole, phone } = req.body;
            
            // At least one field must be provided
            if (!fullName && !company && !companyLogoUrl && !jobRole && !phone) {
                res.status(400).json({ error: 'At least one field (fullName, company, companyLogoUrl, jobRole, or phone) must be provided' });
                return;
            }

            await this.dbService.updateInterviewerProfile(user.userId, {
                fullName: fullName,
                company: company,
                companyLogoUrl: companyLogoUrl,
                jobRole: jobRole,
                phone: phone,
            });

            res.json({ success: true, message: 'Profile updated' });
        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                error: 'Failed to update profile',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Logout user (client-side token removal, but can log this event)
     */
    async logout(req: Request, res: Response): Promise<void> {
        try {
            // In a JWT-based system, logout is primarily handled client-side
            // We can log the logout event if needed
            const userId = (req as any).user?.userId;

            if (userId) {
                console.log(`User ${userId} logged out at ${new Date().toISOString()}`);
            }

            res.json({
                success: true,
                message: 'Logout successful'
            });

        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({
                error: 'Logout failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get user's resume data
     */
    async getUserResume(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const resumeData = await this.dbService.getUserResume(userId);

            res.json({
                success: true,
                resumeData
            });
        } catch (error) {
            console.error('Get user resume error:', error);
            res.status(500).json({
                error: 'Failed to fetch resume',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update user's resume data
     */
    async updateUserResume(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const { resumeData } = req.body;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!resumeData) {
                res.status(400).json({ error: 'Resume data is required' });
                return;
            }

            await this.dbService.updateUserResume(userId, resumeData);

            res.json({
                success: true,
                message: 'Resume updated successfully'
            });
        } catch (error) {
            console.error('Update user resume error:', error);
            res.status(500).json({
                error: 'Failed to update resume',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get candidate's interview history
     */
    async getCandidateInterviews(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;

            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const user = await this.dbService.getUserById(userId);

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            // Get all interviews for this candidate
            const interviews = await this.dbService.getInterviewsByCandidate(user.email);

            const formattedInterviews = interviews.map(interview => ({
                id: interview.id,
                sessionId: interview.session_id,
                title: interview.title || 'Interview',
                status: interview.end_time ? 'completed' : 'in_progress',
                score: interview.score,
                startTime: interview.start_time,
                endTime: interview.end_time,
                duration: interview.duration,
                totalQuestions: interview.total_questions,
                correctAnswers: interview.correct_answers,
                linkId: interview.interview_link_id,
                company: interview.company,
                companyId: interview.companyId,
                companyLogo: interview.companyLogo
            }));

            const response = {
                success: true,
                interviews: formattedInterviews
            };

            res.json(response);

        } catch (error) {
            console.error('Get candidate interviews error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview history',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Create a secure Sign-In Ticket for Electron app transfer
     */
    async createSignInTicket(req: Request, res: Response): Promise<void> {
        try {
            // We need the CLERK User ID (string), not the local DB ID (number)
            // authMiddleware populates req.auth with the raw Clerk session
            // Try req.auth.userId (direct Clerk) first, then fallback to req.user.clerkId
            const clerkUserId = (req as any).auth?.userId || (req as any).user?.clerkId;

            if (!clerkUserId || typeof clerkUserId !== 'string') {
                console.error(`❌ [Auth] Invalid/Missing Clerk User ID. Auth obj:`, (req as any).auth, `User obj:`, (req as any).user);
                res.status(401).json({ error: 'Unauthorized', details: 'Missing Clerk User ID' });
                return;
            }

            console.log(`🎟️ [Auth] Attempting to create ticket for Clerk user: ${clerkUserId}`);

            // Generate valid sign-in token using the correct Clerk User ID
            const signInToken = await clerkClient.signInTokens.createSignInToken({
                userId: clerkUserId,
                expiresInSeconds: 2592000 // 30 days
            });

            console.log(`✅ [Auth] Generated sign-in token for user ${clerkUserId}`);

            res.json({
                success: true,
                ticket: signInToken.token
            });

        } catch (error) {
            console.error('Create sign-in ticket error:', error);
            res.status(500).json({
                error: 'Failed to create sign-in ticket',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

