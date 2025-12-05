import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

export class AuthService {
    private static instance: AuthService;
    private jwtSecret: string;
    private jwtExpiresIn: string | number;

    private constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    }

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    /**
     * Hash a password using bcrypt
     */
    public async hashPassword(password: string): Promise<string> {
        const saltRounds = 10;
        return bcrypt.hash(password, saltRounds);
    }

    /**
     * Compare a password with a hash
     */
    public async comparePassword(password: string, hash: string): Promise<boolean> {
        return bcrypt.compare(password, hash);
    }

    /**
     * Generate a JWT token for a user
     */

    public generateToken(payload: {
        userId: number;
        email: string;
        userType: 'candidate' | 'interviewer';
    }): string {
        const tokenPayload = {
            userId: payload.userId,
            email: payload.email,
            userType: payload.userType,
            type: 'user'
        };

        return jwt.sign(
            tokenPayload,
            this.jwtSecret,
            { expiresIn: this.jwtExpiresIn } as SignOptions
        );
    }

    /**
     * Verify a JWT token
     */
    public verifyToken(token: string): any {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    /**
     * Generate a random token for interview links
     */
    public generateLinkToken(): string {
        // Generate a URL-safe random string
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }

    /**
     * Validate password strength
     */
    public validatePassword(password: string): { valid: boolean; message?: string } {
        if (password.length < 8) {
            return { valid: false, message: 'Password must be at least 8 characters long' };
        }
        if (!/[A-Z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one uppercase letter' };
        }
        if (!/[a-z]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one lowercase letter' };
        }
        if (!/[0-9]/.test(password)) {
            return { valid: false, message: 'Password must contain at least one number' };
        }
        return { valid: true };
    }

    /**
     * Validate email format
     */
    public validateEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}