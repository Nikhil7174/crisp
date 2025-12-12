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

// Import database initialization
import { initializeDatabase } from './lib/databaseInit';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://crisp-beta.vercel.app', 'https://crisp-1.onrender.com', 'https://shakra.onrender.com']
    : ['http://localhost:5173','http://localhost:5174', 'http://localhost:3000', 'https://crisp-beta.vercel.app', 'https://crisp-7l8d2q9ft-nikhil7174s-projects.vercel.app', 'https://crisp-1.onrender.com', 'https://shakra.onrender.com'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/interviewer', interviewerRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/interviewer-dashboard', interviewerDashboardRoutes);
app.use('/api/llm', llmRoutes);

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

// Initialize database and start server
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔑 OpenAI API Key loaded: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
    });
  })
  .catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
