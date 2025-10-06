import { Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';
import { AuthService } from '../services/authService';

export class AuthController {
    private dbService: DatabaseService;
    private authService: AuthService;

    constructor() {
        this.dbService = DatabaseService.getInstance();
        this.authService = AuthService.getInstance();
    }

    /**
     * Register a new user (candidate or interviewer)
     */
    async register(req: Request, res: Response): Promise<void> {
        try {
            const { email, password, fullName, userType, phone, company } = req.body;

            // Validation
            if (!email || !password || !fullName || !userType) {
                res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Email, password, full name, and user type are required'
                });
                return;
            }

            // Validate user type
            if (userType !== 'candidate' && userType !== 'interviewer') {
                res.status(400).json({
                    error: 'Invalid user type',
                    message: 'User type must be either "candidate" or "interviewer"'
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
            const userId = await this.dbService.createUser({
                email,
                passwordHash,
                fullName,
                userType,
                phone,
                company
            });

            // Generate token
            const token = this.authService.generateToken({
                userId,
                email,
                userType
            });

            // Get user data (without password)
            const user = await this.dbService.getUserById(userId);

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
     * Login user
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

            // Get user by email
            const user = await this.dbService.getUserByEmail(email);
            if (!user) {
                res.status(401).json({
                    error: 'Invalid credentials',
                    message: 'Email or password is incorrect'
                });
                return;
            }

            // Check if user is active
            if (!user.is_active) {
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
            await this.dbService.updateUserLastLogin(user.id);

            // Generate token
            const token = this.authService.generateToken({
                userId: user.id,
                email: user.email,
                userType: user.user_type
            });

            res.json({
                success: true,
                message: 'Login successful',
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

            if (!userId) {
                res.status(401).json({
                    error: 'Unauthorized',
                    message: 'User not authenticated'
                });
                return;
            }

            const user = await this.dbService.getUserById(userId);

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
                    userType: user.user_type,
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
}

