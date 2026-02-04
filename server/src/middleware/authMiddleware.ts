import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthService } from '../services/authService';
import { PrismaService } from '../services/prismaService';
// @ts-ignore
import { clerkClient } from '@clerk/clerk-sdk-node';

export interface AuthRequest extends Request {
    auth: any;
    user?: {
        userId: number;
        email: string;
        userType: 'candidate' | 'interviewer';
        type: string;
        clerkId?: string;
        isNewUser?: boolean;
        fullName?: string;
    };
}

/**
 * Middleware to authenticate users (candidates and interviewers)
 */
export const authMiddleware: RequestHandler = async (req, res, next) => {
    const authReq = req as AuthRequest;
    try {
        // Debug logging
        console.log('Auth Middleware - Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Auth Middleware - authReq.auth:', JSON.stringify(authReq.auth, null, 2));

        // 1. Check for Clerk Authentication
        if (authReq.auth && authReq.auth.userId) {
            const clerkId = authReq.auth.userId;

            try {
                // Fetch user details from Clerk
                const clerkUser = await clerkClient.users.getUser(clerkId);
                const email = clerkUser.emailAddresses[0]?.emailAddress;
                // Capture role from unsafeMetadata
                const clerkRole = clerkUser.unsafeMetadata?.role as string;

                if (!email) {
                    res.status(400).json({ error: 'Email required in Clerk profile' });
                    return;
                }

                const dbService = PrismaService.getInstance();

                // Check if user exists in DB
                let user = await dbService.getUserByEmail(email);
                let userType: 'candidate' | 'interviewer' = 'candidate'; // Default
                let userId = 0;

                // Check interviewer table if not in user table
                if (!user) {
                    const interviewer = await dbService.getInterviewerByEmail(email);
                    if (interviewer) {
                        // Map interviewer to user format
                        userId = interviewer.id;
                        userType = 'interviewer';
                    } else {
                        // User doesn't exist in DB yet
                        authReq.user = {
                            userId: 0, // Placeholder
                            email,
                            userType: (clerkRole === 'interviewer' ? 'interviewer' : 'candidate'),
                            type: 'user',
                            clerkId,
                            isNewUser: true,
                            fullName: clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 'New User'
                        };
                        next();
                        return;
                    }
                } else {
                    userId = user.id;
                    userType = user.user_type as any;
                }

                // Existing user
                authReq.user = {
                    userId,
                    email,
                    userType,
                    type: 'user',
                    clerkId
                };
                next();
                return;

            } catch (err) {
                console.error("Clerk user fetch error:", err);
                res.status(500).json({ error: 'Authentication service error' });
                return;
            }
        } else {
            // No Clerk token found
            res.status(401).json({ error: 'Authentication required', message: 'No valid authentication token found' });
            return;
        }

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Middleware to check if user is an interviewer
 */
export const interviewerOnly: RequestHandler = (req, res, next) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    if (authReq.user.userType !== 'interviewer') {
        res.status(403).json({ error: 'Interviewer access required' });
        return;
    }

    next();
};

/**
 * Middleware to check if user is a candidate
 */
export const candidateOnly: RequestHandler = (req, res, next) => {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    if (authReq.user.userType !== 'candidate') {
        res.status(403).json({ error: 'Candidate access required' });
        return;
    }

    next();
};
