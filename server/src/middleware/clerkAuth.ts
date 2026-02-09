import { ClerkExpressRequireAuth } from '@clerk/clerk-sdk-node';
import { Request, Response, NextFunction } from 'express';

// Use strict middleware that requires authentication
// This will automatically handle the verification and attach the auth object to the request
// For looser authentication (optional user), use ClerkExpressWithAuth
export const requireAuth = ClerkExpressRequireAuth({
    // Optional: Add configuration options here if needed, 
    // but usually it picks up CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY from env
});

// Helper type for authenticated requests if component needs to access req.auth
declare global {
    namespace Express {
        interface Request {
            auth: {
                userId: string;
                sessionId: string;
                getToken: (options?: any) => Promise<string | null>;
                claims: any;
            };
        }
    }
}
