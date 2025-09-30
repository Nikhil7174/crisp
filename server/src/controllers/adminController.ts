import { Request, Response } from 'express';
import { DatabaseService } from '../services/databaseService';
import jwt from 'jsonwebtoken';

export class AdminController {
    private dbService: DatabaseService;
    private jwtSecret: string;

    constructor() {
        this.dbService = DatabaseService.getInstance();
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
    }

    async login(req: Request, res: Response): Promise<void> {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                res.status(400).json({ error: 'Username and password are required' });
                return;
            }

            const isValid = await this.dbService.authenticateAdmin(username, password);

            if (!isValid) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Generate JWT token
            const token = jwt.sign(
                { username, type: 'admin' },
                this.jwtSecret,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
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
            const interviews = await this.dbService.getAllInterviews();

            // Calculate summary statistics
            const totalInterviews = interviews.length;
            const totalCandidates = new Set(interviews.map(i => i.candidate_email)).size;
            const averageScore = totalInterviews > 0
                ? Math.round(interviews.reduce((sum, i) => sum + (i.score || 0), 0) / totalInterviews)
                : 0;
            const completedInterviews = interviews.filter(i => i.end_time).length;

            res.json({
                success: true,
                data: {
                    interviews,
                    statistics: {
                        totalInterviews,
                        totalCandidates,
                        averageScore,
                        completedInterviews
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
            const { id } = req.params;
            const interviewId = parseInt(id);

            if (isNaN(interviewId)) {
                res.status(400).json({ error: 'Invalid interview ID' });
                return;
            }

            const interview = await this.dbService.getInterviewById(interviewId);

            if (!interview) {
                res.status(404).json({ error: 'Interview not found' });
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
