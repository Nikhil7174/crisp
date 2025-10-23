import { Router, Request, Response } from 'express';
import { InterviewerController } from '../controllers/interviewerController';
import { authMiddleware, interviewerOnly } from '../middleware/authMiddleware';

const router = Router();
const interviewerController = new InterviewerController();

// Protected routes - only for interviewers
router.get('/dashboard', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    interviewerController.getDashboard(req, res);
});

router.get('/interview/:id', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    interviewerController.getInterviewDetails(req, res);
});

// Question generation endpoints
router.post('/generate-questions/:linkId', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    interviewerController.generateQuestions(req, res);
});

router.post('/approve-questions/:linkId', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    interviewerController.approveQuestions(req, res);
});

// Get interview link details with questions
router.get('/interview-link/:linkId', authMiddleware, interviewerOnly, (req: Request, res: Response) => {
    interviewerController.getInterviewLinkDetails(req, res);
});

export default router;
