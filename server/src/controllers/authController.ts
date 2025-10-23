import { Request, Response } from 'express';
import { PrismaService } from '../services/prismaService';
import { AuthService } from '../services/authService';

export class AuthController {
    private dbService: PrismaService;
    private authService: AuthService;

    constructor() {
        this.dbService = PrismaService.getInstance();
        this.authService = AuthService.getInstance();
    }

    /**
     * Register a new candidate
     */
    async registerCandidate(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, fullName, phone, company } = req.body;

            // Validation
            if (!email || !password || !fullName) {
                res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email, password, and full name are required'
                });
                return;
            }

            // Validate email format
            if (!this.authService.validateEmail(email)) {
                res.status(400).json({
                    error: 'Invalid email',
                    message: 'Please provide a valid email address'
                });
                return;
            }

            // Validate password strength
            const passwordValidation = this.authService.validatePassword(password);
            if (!passwordValidation.valid) {
                res.status(400).json({
                    error: 'Weak password',
                    message: passwordValidation.message
                });
                return;
            }

            // Check if user already exists
            const existingUser = await this.dbService.getUserByEmail(email);
            if (existingUser) {
                res.status(409).json({
                    error: 'User already exists',
                    message: 'An account with this email already exists'
                });
                return;
            }

            // Hash password
            const passwordHash = await this.authService.hashPassword(password);

            // Create user
            const user = await this.dbService.createUser({
                email,
                passwordHash,
                fullName,
                userType: 'candidate' as any,
                phone,
                company
            });

            // Generate token
            const token = this.authService.generateToken({
                userId: user.id,
                email,
                userType: 'candidate'
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    userType: user.user_type,
                    phone: user.phone,
                    company: user.company
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                error: 'Registration failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Register a new interviewer
     */
    async registerInterviewer(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, fullName, phone, company } = req.body;

            // Validation
            if (!email || !password || !fullName) {
                res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email, password, and full name are required'
                });
                return;
            }

            // Validate email format
            if (!this.authService.validateEmail(email)) {
                res.status(400).json({
                    error: 'Invalid email',
                    message: 'Please provide a valid email address'
                });
                return;
            }

            // Validate password strength
            const passwordValidation = this.authService.validatePassword(password);
            if (!passwordValidation.valid) {
                res.status(400).json({
                    error: 'Weak password',
                    message: passwordValidation.message
                });
                return;
            }

            // Check if interviewer already exists
            const existingInterviewer = await this.dbService.getInterviewerByEmail(email);
            if (existingInterviewer) {
                res.status(409).json({
                    error: 'Interviewer already exists',
                    message: 'An account with this email already exists'
                });
                return;
            }

            // Hash password
            const passwordHash = await this.authService.hashPassword(password);

            // Create interviewer
            const interviewer = await this.dbService.createInterviewer({
                email,
                passwordHash,
                fullName,
                phone,
                company
            });

            // Generate token
            const token = this.authService.generateToken({
                userId: interviewer.id,
                email,
                userType: 'interviewer'
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                token,
                user: {
                    id: interviewer.id,
                    email: interviewer.email,
                    fullName: interviewer.full_name,
                    userType: 'interviewer',
                    phone: interviewer.phone,
                    company: interviewer.company
                }
            });

        } catch (error) {
            console.error('Interviewer registration error:', error);
            res.status(500).json({
                error: 'Registration failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Login user (candidate or interviewer)
     */
    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;

            // Validation
            if (!email || !password) {
                res.status(400).json({
                    error: 'Missing credentials',
                    message: 'Email and password are required'
                });
                return;
            }

            // Try to find user as candidate first
            let user = await this.dbService.getUserByEmail(email);
            let userType = 'candidate';
            let isActive = true;

            if (user) {
                isActive = user.is_active;
            } else {
                // Try to find as interviewer
                const interviewer = await this.dbService.getInterviewerByEmail(email);
                if (interviewer) {
                    user = {
                        id: interviewer.id,
                        email: interviewer.email,
                        password_hash: interviewer.password_hash,
                        full_name: interviewer.full_name,
                        user_type: 'interviewer' as any,
                        phone: interviewer.phone,
                        company: interviewer.company,
                        resume_data: null,
                        created_at: interviewer.created_at,
                        last_login: interviewer.last_login,
                        is_active: interviewer.is_active
                    };
                    userType = 'interviewer';
                    isActive = interviewer.is_active;
                }
            }

            if (!user) {
                res.status(401).json({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
                return;
            }

            // Check if user is active
            if (!isActive) {
                res.status(403).json({
                    error: 'Account disabled',
                    message: 'Your account has been disabled. Please contact support.'
                });
                return;
            }

            // Verify password
            const isPasswordValid = await this.authService.comparePassword(password, user.password_hash);
            if (!isPasswordValid) {
                res.status(401).json({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
                return;
            }

            // Update last login
            if (userType === 'candidate') {
                await this.dbService.updateUserLastLogin(user.id);
            } else {
                await this.dbService.updateInterviewerLastLogin(user.id);
            }

            // Generate token
            const token = this.authService.generateToken({
                userId: user.id,
                email: user.email,
                userType: userType as 'candidate' | 'interviewer'
            });

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    userType: userType,
                    phone: user.phone,
                    company: user.company
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'Login failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get current user profile
     */
    async getCurrentUser(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const userType = (req as any).user?.userType;

            if (!userId) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not authenticated'
                });
                return;
            }

            let user;
            if (userType === 'interviewer') {
                user = await this.dbService.getInterviewerById(userId);
            } else {
                user = await this.dbService.getUserById(userId);
            }

            if (!user) {
                res.status(404).json({
                    error: 'User not found',
                    message: 'User account not found'
                });
                return;
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    fullName: user.full_name,
                    userType: userType,
                    phone: user.phone,
                    company: user.company,
                    createdAt: user.created_at,
                    lastLogin: user.last_login
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
            console.log('=== GET CANDIDATE INTERVIEWS DEBUG ===');
            console.log('Request received at:', new Date().toISOString());
            console.log('Request headers:', req.headers);
            
            const userId = (req as any).user?.userId;
            console.log('User ID from token:', userId);

            if (!userId) {
                console.log('No user ID found - unauthorized');
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }

            const user = await this.dbService.getUserById(userId);
            console.log('User found:', user ? { id: user.id, email: user.email, name: user.full_name } : 'null');

            if (!user) {
                console.log('User not found in database');
                res.status(404).json({ error: 'User not found' });
                return;
            }

            // Get all interviews for this candidate
            console.log('Fetching interviews for email:', user.email);
            const interviews = await this.dbService.getInterviewsByCandidate(user.email);
            console.log('Raw interviews from DB:', interviews.length, 'interviews found');
            console.log('Sample interview data:', interviews.slice(0, 2));

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
                linkId: interview.interview_link_id
            }));

            console.log('Formatted interviews:', formattedInterviews.length, 'interviews');
            console.log('Sample formatted interview:', formattedInterviews.slice(0, 1));

            const response = {
                success: true,
                interviews: formattedInterviews
            };

            console.log('Sending response:', response);
            res.json(response);

        } catch (error) {
            console.error('Get candidate interviews error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview history',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

