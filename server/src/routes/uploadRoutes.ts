import { Router, Request, Response } from 'express';
import { UploadController } from '../controllers/uploadController';
import { upload, handleUploadError } from '../middleware/uploadMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const uploadController = new UploadController();

// Upload resume endpoint
router.post('/resume', upload.single('resume'), handleUploadError, (req: Request, res: Response) => {
  uploadController.uploadResume(req, res);
});

// Collect missing information endpoint - requires authentication
router.post('/collect-info', authMiddleware, (req: Request, res: Response) => {
  uploadController.collectMissingInfo(req, res);
});

export default router;
