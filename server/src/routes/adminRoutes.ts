import { Router, Request, Response } from 'express';
import { AdminController } from '../controllers/adminController';
import { adminAuthMiddleware } from '../middleware/adminAuthMiddleware';

const router = Router();
const adminController = new AdminController();

// Public routes
router.post('/login', (req: Request, res: Response) => {
    adminController.login(req, res);
});

// Protected routes
router.get('/dashboard', adminAuthMiddleware, (req: Request, res: Response) => {
    adminController.getDashboard(req, res);
});

router.get('/interview/:id', adminAuthMiddleware, (req: Request, res: Response) => {
    adminController.getInterviewDetails(req, res);
});

export default router;
