import { Router, Request, Response } from 'express';
import { InterviewController } from '../controllers/interviewController';

const router = Router();
const interviewController = new InterviewController();

// Start interview endpoint
router.post('/start', (req: Request, res: Response) => {
    interviewController.startInterview(req, res);
});

// Submit answer endpoint (no feedback, just move to next question)
router.post('/answer', (req: Request, res: Response) => {
    interviewController.submitAnswer(req, res);
});

// Get session status endpoint
router.get('/session/:sessionId', (req: Request, res: Response) => {
    interviewController.getSession(req, res);
});

// Get final results endpoint (comprehensive evaluation)
router.get('/results/:sessionId', (req: Request, res: Response) => {
    interviewController.getSessionResults(req, res);
});

export default router;
