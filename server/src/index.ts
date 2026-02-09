import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST, before any other imports
dotenv.config({ path: path.join(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import routes
import interviewRoutes from './routes/interviewRoutes';
import uploadRoutes from './routes/uploadRoutes';
import interviewerDashboardRoutes from './routes/interviewerDashboardRoutes';
import authRoutes from './routes/authRoutes';
import interviewerRoutes from './routes/interviewerRoutes';
import llmRoutes from './routes/llmRoutes';
import configRoutes from './routes/configRoutes';
// Note: livekitRoutes removed - agent is now a separate process
// import livekitRoutes from './routes/livekitRoutes';

const app = express();
const PORT = process.env.PORT || 3001;

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://shakra.onrender.com',
      'https://www.shakraai.com',
      'https://www.shakra.io',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:42424', // Electron App
    ];
  },
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Clerk Authentication Middleware (Global - Loose)
// This attaches req.auth to requests if a session token is present, but doesn't block unauthenticated requests.
import { ClerkExpressWithAuth } from '@clerk/clerk-sdk-node';
app.use(ClerkExpressWithAuth());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interviewer', interviewerRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/interviewer-dashboard', interviewerDashboardRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/config', configRoutes);
// Note: /api/livekit routes removed - agent is now a separate process
// app.use('/api/livekit', livekitRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 OpenAI API Key loaded: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`💡 Run migrations separately: npm run db:migrate:deploy`);
});
