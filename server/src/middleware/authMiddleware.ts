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
        company?: string;
        jobRole?: string;
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
        let clerkId = authReq.auth?.userId;

        // Fallback: If authReq.auth is empty but there's a Bearer token, try to verify it manually
        if (!clerkId && req.headers.authorization?.startsWith('Bearer ')) {
            const token = req.headers.authorization.split(' ')[1];
            try {
                const verified = await clerkClient.verifyToken(token);
                clerkId = verified.sub;
            } catch (err) {
                console.warn('Manual Clerk token verification failed:', err);
            }
        }

        if (clerkId) {
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

                let userId = 0;
                let userType: 'candidate' | 'interviewer' = clerkRole === 'interviewer' ? 'interviewer' : 'candidate';
                let isNewUser = false;

                if (userType === 'interviewer') {
                    // Clerk says this user is logging in as an interviewer
                    const interviewer = await dbService.getInterviewerByEmail(email);
                    if (interviewer) {
                        userId = interviewer.id;
                    } else {
                        isNewUser = true;
                    }
                } else {
                    // Clerk says this user is logging in as a candidate
                    const user = await dbService.getUserByEmail(email);
                    if (user) {
                        userId = user.id;
                    } else {
                        isNewUser = true;
                    }
                }

                if (isNewUser) {
                    // User doesn't exist in the requested table yet
                    authReq.user = {
                        userId: 0, // Placeholder mapping it to new
                        email,
                        userType,
                        type: 'user',
                        clerkId,
                        isNewUser: true,
                        fullName: clerkUser.firstName ? `${clerkUser.firstName} ${clerkUser.lastName || ''}`.trim() : 'New User'
                    };
                    next();
                    return;
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
