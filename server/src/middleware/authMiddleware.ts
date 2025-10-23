import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';

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
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
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

