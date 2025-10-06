import { Router, Request, Response } from 'express';
import { InterviewerController } from '../controllers/interviewerController';
import { authMiddleware, interviewerOnly } from '../middleware/authMiddleware';

const router = Router();
const interviewerController = new InterviewerController();

// All routes require authentication and interviewer role
router.use(authMiddleware);
router.use(interviewerOnly);

// Dashboard
router.get('/dashboard', (req: Request, res: Response) => {
    interviewerController.getDashboard(req, res);
});

// Interview link CRUD
router.post('/links', (req: Request, res: Response) => {
    interviewerController.createLink(req, res);
});

router.get('/links', (req: Request, res: Response) => {
    interviewerController.getMyLinks(req, res);
});

router.get('/links/:id', (req: Request, res: Response) => {
    interviewerController.getLinkById(req, res);
});

router.put('/links/:id', (req: Request, res: Response) => {
    interviewerController.updateLink(req, res);
});

router.delete('/links/:id', (req: Request, res: Response) => {
    interviewerController.deleteLink(req, res);
});

// Get candidates by link
router.get('/links/:id/candidates', (req: Request, res: Response) => {
    interviewerController.getCandidatesByLink(req, res);
});

export default router;

