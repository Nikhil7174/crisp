import { Router, Request, Response } from 'express';
import { AdminController } from '../controllers/adminController';
import { authMiddleware, interviewerOnly } from '../middleware/authMiddleware';

const router = Router();
const adminController = new AdminController();

// Public routes
router.post('/login', (req: Request, res: Response) => {
    adminController.login(req, res);
});

// Protected routes - only for interviewers
router.get('/dashboard', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    adminController.getDashboard(req, res);
});

router.get('/interview/:id', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    adminController.getInterviewDetails(req, res);
});

export default router;
