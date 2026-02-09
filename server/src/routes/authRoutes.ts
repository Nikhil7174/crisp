import { Router, Request, Response } from 'express';
import { AuthController } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const authController = new AuthController();

// Public routes - None (All handled by Clerk)

// Protected routes
router.get('/me', authMiddleware, (req: Request, res: Response) => {
    authController.getCurrentUser(req, res);
});

router.post('/logout', authMiddleware, (req: Request, res: Response) => {
    authController.logout(req, res);
});

// Resume management routes
router.get('/resume', authMiddleware, (req: Request, res: Response) => {
    authController.getUserResume(req, res);
});

router.post('/resume', authMiddleware, (req: Request, res: Response) => {
    authController.updateUserResume(req, res);
});

// Candidate interview history route
router.get('/interviews', authMiddleware, (req: Request, res: Response) => {
    authController.getCandidateInterviews(req, res);
});

// Ticket generation for Electron app
router.post('/ticket', authMiddleware, (req: Request, res: Response) => {
    authController.createSignInTicket(req, res);
});

export default router;

