import { Router, Request, Response } from 'express';
import { InterviewController } from '../controllers/interviewController';

const router = Router();
const interviewController = new InterviewController();

// Start interview endpoint
router.post('/start', (req: Request, res: Response) => {
    interviewController.startInterview(req, res);
});

// Note: Removed /answer endpoint - answers are only stored locally until interview completion

// Get session status endpoint
router.get('/session/:sessionId', (req: Request, res: Response) => {
    interviewController.getSession(req, res);
});

// Get final results endpoint (comprehensive evaluation)
router.get('/results/:sessionId', (req: Request, res: Response) => {
    interviewController.getSessionResults(req, res);
});

// Save interview results endpoint
router.post('/save-results', (req: Request, res: Response) => {
    interviewController.saveResults(req, res);
});

export default router;
