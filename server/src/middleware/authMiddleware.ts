import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { PrismaService } from '../services/prismaService';

interface AuthRequest extends Request {
    user?: {
        userId: number;
        email: string;
        userType: 'candidate' | 'interviewer';
        type: string;
    };
}

/**
 * Middleware to authenticate users (candidates and interviewers)
 */
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const authService = AuthService.getInstance();

        const decoded = authService.verifyToken(token) as any;

        // Ensure this is a user token (candidate or interviewer)
        if (decoded.type !== 'user') {
            res.status(403).json({ error: 'Invalid token type' });
            return;
        }

        // Check if user still exists in database
        const dbService = PrismaService.getInstance();
        let user = await dbService.getUserById(decoded.userId);
        
        // If not found in users table, check interviewers table
        if (!user && decoded.userType === 'interviewer') {
            const interviewer = await dbService.getInterviewerById(decoded.userId);
            if (interviewer) {
                // Convert interviewer to user format for consistency
                user = {
                    id: interviewer.id,
                    email: interviewer.email,
                    full_name: interviewer.full_name,
                    user_type: 'interviewer' as any,
                    phone: interviewer.phone,
                    company: interviewer.company,
                    created_at: interviewer.created_at,
                    last_login: interviewer.last_login,
                    is_active: interviewer.is_active
                };
            }
        }
        
        if (!user) {
            res.status(401).json({ 
                error: 'User not found', 
                message: 'User account no longer exists. Please log in again.' 
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

        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            userType: decoded.userType,
            type: decoded.type
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware to check if user is an interviewer
 */
export const interviewerOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    if (req.user.userType !== 'interviewer') {
        res.status(403).json({ error: 'Interviewer access required' });
        return;
    }

    next();
};

/**
 * Middleware to check if user is a candidate
 */
export const candidateOnly = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    if (req.user.userType !== 'candidate') {
        res.status(403).json({ error: 'Candidate access required' });
        return;
    }

    next();
};

