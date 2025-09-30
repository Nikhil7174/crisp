import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthRequest extends Request {
    admin?: {
        username: string;
        type: string;
    };
}

export const adminAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        const jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

        const decoded = jwt.verify(token, jwtSecret) as any;

        if (decoded.type !== 'admin') {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }

        req.admin = {
            username: decoded.username,
            type: decoded.type
        };

        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};
