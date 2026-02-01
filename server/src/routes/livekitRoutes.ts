import express from 'express';

const router = express.Router();

// Note: All worker management routes removed - agent is now a separate process
// The LiveKit agent process handles all agent operations directly

/**
 * Get agent/worker status for an interview
 * Note: Disabled - agent is now a separate process
 */
router.get('/agent-status/:interviewId', async (req, res) => {
  res.json({
    success: false,
    message: 'Agent status endpoint disabled - agent is now a separate process',
    note: 'The interview agent runs as a separate LiveKit Agents process',
  });
});

/**
 * Get all active workers
 * Note: Disabled - agent is now a separate process
 */
router.get('/workers', async (req, res) => {
  res.json({
    success: false,
    message: 'Workers endpoint disabled - agent is now a separate process',
    note: 'The interview agent runs as a separate LiveKit Agents process',
  });
});

/**
 * Send message to agent worker
 * Note: Disabled - agent is now a separate process
 */
router.post('/send-to-agent/:interviewId', async (req, res) => {
  res.json({
    success: false,
    message: 'Send to agent endpoint disabled - agent is now a separate process',
    note: 'Communication happens via LiveKit data channels',
  });
});

/**
 * Terminate agent worker for an interview
 * Note: Disabled - agent is now a separate process
 */
router.post('/terminate-agent/:interviewId', async (req, res) => {
  res.json({
    success: false,
    message: 'Terminate agent endpoint disabled - agent is now a separate process',
    note: 'The agent process manages its own lifecycle',
  });
});

export default router;
