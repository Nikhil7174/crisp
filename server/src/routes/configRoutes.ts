import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * GET /api/config/keys
 *
 * Returns API keys and server URL for the desktop app.
 * Requires a valid Bearer token (handled by authMiddleware).
 */
router.get('/keys', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const assemblyaiApiKey = process.env.ASSEMBLYAI_API_KEY || '';
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const serverUrl = process.env.SERVER_URL || 'https://crisp-server-n0r1.onrender.com';

    res.json({
      success: true,
      config: {
        assemblyaiApiKey,
        openaiApiKey,
        serverUrl,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/config/keys:', error);
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to load config keys',
    });
  }
});

export default router;


