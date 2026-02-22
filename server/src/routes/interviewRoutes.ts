import { Router, Request, Response } from 'express';
import { InterviewController } from '../controllers/interviewController';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();
const interviewController = new InterviewController();

// Public endpoint - validate interview link
router.get('/link/:token', (req: Request, res: Response) => {
    interviewController.validateLink(req, res);
});

// Public endpoint - get interview details without auth
router.get('/public/:id', (req: Request, res: Response) => {
    interviewController.getPublicInterviewDetails(req, res);
});

// Start interview endpoint - requires authentication and link token
router.post('/start', authMiddleware as any, (req: Request, res: Response) => {
    interviewController.startInterview(req as AuthRequest, res);
});

// Start demo interview endpoint - public, no auth required
router.post('/demo-start', (req: Request, res: Response) => {
    interviewController.startDemoInterview(req, res);
});

// End interview - called by frontend when user ends the call.
// This is the authoritative signal; it doesn't depend on the agent.
router.post('/end/:sessionId', (req: Request, res: Response) => {
    interviewController.endInterview(req, res);
});

// Get interview questions endpoint - public (used by agent process)
// The agent will authenticate using a shared secret or API key if needed
router.get('/questions', (req: Request, res: Response) => {
    interviewController.getInterviewQuestions(req, res);
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
        (authMiddleware as any)(req, res, () => {
            interviewController.saveResults(req as AuthRequest, res);
        });
    } else {
        interviewController.saveResults(req, res);
    }
});

// Update cheating detection endpoint - requires authentication
router.put('/:sessionId/cheating-detection', authMiddleware as any, (req: Request, res: Response) => {
    interviewController.updateCheatingDetection(req as AuthRequest, res);
});

// Update vision security endpoint - requires authentication
router.put('/:sessionId/vision-security', authMiddleware as any, (req: Request, res: Response) => {
    interviewController.updateVisionSecurity(req as AuthRequest, res);
});

// Final evaluation endpoint - optional authentication (same pattern as save-results)
router.post('/final-evaluation', (req: Request, res: Response, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        (authMiddleware as any)(req, res, () => {
            interviewController.saveFinalEvaluation(req as AuthRequest, res);
        });
    } else {
        interviewController.saveFinalEvaluation(req, res);
    }
});

// Candidate feedback endpoint - optional authentication
router.post('/feedback', (req: Request, res: Response, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        (authMiddleware as any)(req, res, () => {
            interviewController.saveCandidateFeedback(req as AuthRequest, res);
        });
    } else {
        interviewController.saveCandidateFeedback(req, res);
    }
});

export default router;
