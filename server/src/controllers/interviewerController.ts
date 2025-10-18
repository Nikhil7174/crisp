import { Request, Response } from 'express';
import { PrismaService } from '../services/prismaService';
import { AuthService } from '../services/authService';

export class InterviewerController {
    private dbService: PrismaService;
    private authService: AuthService;

    constructor() {
        this.dbService = PrismaService.getInstance();
        this.authService = AuthService.getInstance();
    }

    /**
     * Create a new interview link
     */
    async createLink(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const { title, description, expiryDate, maxAttempts } = req.body;

            // Validation
            if (!title) {
                res.status(400).json({
                    error: 'Missing required fields',
                    message: 'Title is required'
                });
                return;
            }

            // Generate unique link token
            const linkToken = this.authService.generateLinkToken();

            // Create interview link
            const link = await this.dbService.createInterviewLink({
                createdBy: userId,
                linkToken,
                title,
                description,
                expiryDate,
                maxAttempts: maxAttempts || 0 // 0 means unlimited
            });

            res.status(201).json({
                success: true,
                message: 'Interview link created successfully',
                link: {
                    id: link.id,
                    token: link.link_token,
                    title: link.title,
                    description: link.description,
                    expiryDate: link.expiry_date,
                    maxAttempts: link.max_attempts,
                    isActive: link.is_active,
                    createdAt: link.created_at,
                    // Generate full URL (you can customize the base URL)
                    url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/join?token=${link.link_token}`
                }
            });

        } catch (error) {
            console.error('Create link error:', error);
            res.status(500).json({
                error: 'Failed to create interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get all links created by the interviewer
     */
    async getMyLinks(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;

            const links = await this.dbService.getInterviewLinksByUser(userId);

            // Add full URL to each link
            const linksWithUrls = links.map(link => ({
                id: link.id,
                token: link.link_token,
                title: link.title,
                description: link.description,
                expiryDate: link.expiry_date,
                maxAttempts: link.max_attempts,
                isActive: link.is_active,
                createdAt: link.created_at,
                updatedAt: link.updated_at,
                totalAttempts: link.total_attempts || 0,
                url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/join?token=${link.link_token}`
            }));

            res.json({
                success: true,
                links: linksWithUrls
            });

        } catch (error) {
            console.error('Get links error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview links',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get a specific link by ID
     */
    async getLinkById(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const linkId = parseInt(req.params.id);

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            const link = await this.dbService.getInterviewLinkById(linkId);

            if (!link) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            // Verify ownership
            if (link.created_by !== userId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            res.json({
                success: true,
                link: {
                    id: link.id,
                    token: link.link_token,
                    title: link.title,
                    description: link.description,
                    expiryDate: link.expiry_date,
                    maxAttempts: link.max_attempts,
                    isActive: link.is_active,
                    createdAt: link.created_at,
                    updatedAt: link.updated_at,
                    url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/join?token=${link.link_token}`
                }
            });

        } catch (error) {
            console.error('Get link error:', error);
            res.status(500).json({
                error: 'Failed to fetch interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Update an interview link
     */
    async updateLink(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const linkId = parseInt(req.params.id);
            const { title, description, isActive, expiryDate, maxAttempts } = req.body;

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Verify link exists and ownership
            const link = await this.dbService.getInterviewLinkById(linkId);

            if (!link) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (link.created_by !== userId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Update link
            await this.dbService.updateInterviewLink(linkId, {
                title,
                description,
                isActive,
                expiryDate,
                maxAttempts
            });

            // Get updated link
            const updatedLink = await this.dbService.getInterviewLinkById(linkId);

            if (!updatedLink) {
                res.status(500).json({ error: 'Failed to retrieve updated link' });
                return;
            }

            res.json({
                success: true,
                message: 'Interview link updated successfully',
                link: {
                    id: updatedLink.id,
                    token: updatedLink.link_token,
                    title: updatedLink.title,
                    description: updatedLink.description,
                    expiryDate: updatedLink.expiry_date,
                    maxAttempts: updatedLink.max_attempts,
                    isActive: updatedLink.is_active,
                    createdAt: updatedLink.created_at,
                    updatedAt: updatedLink.updated_at
                }
            });

        } catch (error) {
            console.error('Update link error:', error);
            res.status(500).json({
                error: 'Failed to update interview link',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Delete an interview link
     */
    async deleteLink(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const linkId = parseInt(req.params.id);

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Verify link exists and ownership
            const link = await this.dbService.getInterviewLinkById(linkId);

            if (!link) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (link.created_by !== userId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Delete link
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

    /**
     * Get all candidates who took interviews via a specific link
     */
    async getCandidatesByLink(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;
            const linkId = parseInt(req.params.id);

            if (isNaN(linkId)) {
                res.status(400).json({ error: 'Invalid link ID' });
                return;
            }

            // Verify link exists and ownership
            const link = await this.dbService.getInterviewLinkById(linkId);

            if (!link) {
                res.status(404).json({ error: 'Interview link not found' });
                return;
            }

            if (link.created_by !== userId) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get candidates
            const candidates = await this.dbService.getCandidatesByInterviewLink(linkId);

            res.json({
                success: true,
                link: {
                    title: link.title,
                    description: link.description
                },
                candidates
            });

        } catch (error) {
            console.error('Get candidates error:', error);
            res.status(500).json({
                error: 'Failed to fetch candidates',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    /**
     * Get interviewer dashboard statistics
     */
    async getDashboard(req: Request, res: Response): Promise<void> {
        try {
            const userId = (req as any).user?.userId;

            // Get all links
            const links = await this.dbService.getInterviewLinksByUser(userId);

            // Calculate statistics
            const totalLinks = links.length;
            const activeLinks = links.filter(l => l.is_active).length;
            const totalCandidates = links.reduce((sum, l) => sum + (l.total_attempts || 0), 0);

            res.json({
                success: true,
                statistics: {
                    totalLinks,
                    activeLinks,
                    totalCandidates
                },
                recentLinks: links.slice(0, 5) // Get 5 most recent links
            });

        } catch (error) {
            console.error('Get dashboard error:', error);
            res.status(500).json({
                error: 'Failed to fetch dashboard data',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
}

