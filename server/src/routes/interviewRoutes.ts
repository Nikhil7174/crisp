import { Router, Request, Response } from 'express';
import { InterviewController } from '../controllers/interviewController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const interviewController = new InterviewController();

// Public endpoint - validate interview link
router.get('/link/:token', (req: Request, res: Response) => {
    interviewController.validateLink(req, res);
});

// Start interview endpoint - requires authentication and link token
router.post('/start', authMiddleware, (req: Request, res: Response) => {
    interviewController.startInterview(req, res);
});

// Validate coding answer endpoint
router.post('/validate-code', (req: Request, res: Response) => {
    interviewController.validateCodeAnswer(req, res);
});

// Session endpoints removed - no longer needed without sessions table

// Save interview results endpoint - optional authentication
router.post('/save-results', (req: Request, res: Response, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authMiddleware(req, res, () => {
            interviewController.saveResults(req, res);
        });
    } else {
        interviewController.saveResults(req, res);
    }
});

// Update cheating detection endpoint - requires authentication
router.put('/:sessionId/cheating-detection', authMiddleware, (req: Request, res: Response) => {
    interviewController.updateCheatingDetection(req, res);
});

// Final evaluation endpoint - optional authentication (same pattern as save-results)
router.post('/final-evaluation', (req: Request, res: Response, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        authMiddleware(req, res, () => {
            interviewController.saveFinalEvaluation(req, res);
        });
    } else {
        interviewController.saveFinalEvaluation(req, res);
    }
});

export default router;
