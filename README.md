# Crisp AI Interview Platform

A full-stack AI-powered interview platform that conducts automated technical interviews with real-time code execution, resume parsing, and comprehensive candidate evaluation.

## 🏗️ Architecture Overview

### System Design
```
┌─────────────────┐    HTTP/HTTPS     ┌─────────────────┐
│   React Client  │ ←─────────────────→ │ Express Server  │
│   (Vite + TS)   │                     │   (Node.js)     │
│                 │                     │                 │
│ • Redux Store   │                     │ • REST API      │
│ • Session Mgmt  │                     │ • SQLite DB     │
│ • Monaco Editor │                     │ • OpenAI API    │
│ • Real-time UI  │                     │ • Code Sandbox  │
└─────────────────┘                     └─────────────────┘
```

## 🚀 Tech Stack

### Frontend (Client)
- **React 19** - Modern React with concurrent features
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Redux Toolkit** - State management with persistence
- **Ant Design** - Enterprise UI components
- **Monaco Editor** - VS Code editor for code questions
- **React Router** - Client-side routing
- **Framer Motion** - Smooth animations
- **Tailwind CSS** - Utility-first styling

### Backend (Server)
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **TypeScript** - Type-safe server development
- **SQLite** - Lightweight database
- **OpenAI API** - AI-powered question generation
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Multer** - File upload handling

### Security & Code Execution
- **isolated-vm** - Secure JavaScript sandboxing
- **bcryptjs** - Password hashing
- **JWT** - Authentication tokens
- **Helmet** - Security headers

## 📁 Project Structure

```
crisp/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── admin/      # Admin dashboard components
│   │   │   ├── interview/  # Interview flow components
│   │   │   ├── landing/    # Landing page components
│   │   │   └── layout/     # Layout components
│   │   ├── hooks/          # Custom React hooks
│   │   │   ├── api/        # API integration hooks
│   │   │   └── useResponsive.ts
│   │   ├── pages/          # Route components
│   │   ├── services/       # Business logic services
│   │   ├── store/          # Redux store configuration
│   │   │   └── slices/     # Redux slices
│   │   ├── styles/         # Design system
│   │   ├── types/          # TypeScript definitions
│   │   └── constants/      # Application constants
│   └── public/             # Static assets
│
├── server/                  # Express backend
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Data models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   │   ├── codeExecutionService.ts    # Local code execution
│   │   │   ├── safeCodeExecutionService.ts # External API execution
│   │   │   ├── resumeParserService.ts     # Resume parsing
│   │   │   ├── openaiService.ts          # AI integration
│   │   │   └── databaseService.ts        # Database operations
│   │   └── utils/           # Utility functions
│   └── data/               # SQLite database files
│
└── ADMIN_SETUP.md          # Admin configuration guide
```

## 🔒 Security Implementation

### JavaScript Code Sandboxing
The platform implements multiple layers of security for code execution:

#### 1. Local Sandboxing (`isolated-vm`)
```typescript
// server/src/services/codeExecutionService.ts
import { Isolate } from 'isolated-vm';

class CodeExecutionService {
  async validateCode(userCode: string, testCases: TestCase[]): Promise<TestResult[]> {
    const isolate = new Isolate({ memoryLimit: 128 });
    const context = await isolate.createContext();
    
    // Execute user code in isolated context
    const result = await context.eval(userCode, { timeout: 5000 });
    // Test against predefined test cases
  }
}
```

**Security Features:**
- Memory limit enforcement (128MB)
- Execution timeout (5 seconds)
- Isolated execution context
- No access to Node.js APIs
- Restricted file system access

#### 2. External API Sandboxing (`SafeCodeExecutionService`)
```typescript
// Fallback to external code execution service
class SafeCodeExecutionService {
  async validateCode(userCode: string, testCases: TestCase[]): Promise<TestResult[]> {
    const response = await fetch('https://api.codex.jaagrav.in/', {
      method: 'POST',
      body: JSON.stringify({
        code: userCode,
        language: 'javascript',
        version: 'latest'
      })
    });
  }
}
```

### Authentication & Authorization
- **JWT-based authentication** for admin access
- **bcryptjs** for password hashing
- **Helmet** for security headers
- **CORS** configuration for cross-origin requests

### File Upload Security
- **Multer** for secure file handling
- **File type validation** (PDF, DOCX only)
- **Size limits** (10MB max)
- **Virus scanning** (via external services)

## 🧠 AI Integration

### OpenAI Service Architecture
```typescript
class OpenAIService {
  async generateInterviewQuestions(candidateData: DetailedResumeData): Promise<InterviewQuestion[]> {
    const prompt = `Generate 6 technical interview questions based on:
    - Skills: ${candidateData.technicalSkills}
    - Experience: ${candidateData.experience}
    - Education: ${candidateData.education}`;
    
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
  }
}
```

### Resume Parsing Pipeline
1. **File Upload** → PDF/DOCX parsing
2. **Text Extraction** → Raw text processing
3. **AI Analysis** → Structured data extraction
4. **Validation** → Data quality checks
5. **Storage** → SQLite database

## 📊 State Management

### Redux Architecture
```typescript
// Centralized state management with persistence
const store = configureStore({
  reducer: {
    ui: uiReducer,           // UI state
    user: userReducer,       // User preferences
    session: sessionReducer,  // Session tracking
    interview: interviewReducer // Interview data
  },
  middleware: [persistMiddleware]
});
```

### Session Management
```typescript
class SessionManager {
  static saveSession(sessionData: StoredSession): void {
    // Cached localStorage operations
    // Automatic session expiry
    // Cross-tab synchronization
  }
}
```

## 🎯 Key Features

### Interview Flow
1. **Resume Upload** → AI-powered parsing
2. **Question Generation** → Personalized questions
3. **Real-time Coding** → Monaco editor with syntax highlighting
4. **Code Execution** → Secure sandboxed execution
5. **Results Analysis** → Comprehensive evaluation

### Admin Dashboard
- **Candidate Search** → Real-time filtering
- **Interview Analytics** → Performance metrics
- **Detailed Reports** → Question-by-question analysis
- **Export Functionality** → PDF/CSV reports

### Code Execution Types
- **Multiple Choice** → Quick assessment
- **Coding Questions** → Algorithm implementation
- **System Design** → Architecture discussions
- **Debugging** → Error identification

## 🚀 Deployment

### Environment Configuration
```typescript
// client/src/constants/api.ts
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://crisp-3jy7.onrender.com/api',
  LOCAL_URL: import.meta.env.VITE_API_LOCAL_URL || 'http://localhost:3001/api',
} as const;
```

### Production Setup
1. **Frontend**: Deployed on Vercel
2. **Backend**: Deployed on Render
3. **Database**: SQLite with automated backups
4. **CDN**: Static assets via Vercel

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm/yarn
- OpenAI API key

### Local Development
```bash
# Install dependencies
npm install

# Start development servers
npm run dev  # Client (port 5173)
npm run dev  # Server (port 3001)
```

### Build Process
```bash
# Client build
npm run build  # TypeScript compilation + Vite bundling

# Server build
npm run build  # TypeScript compilation
npm start      # Production server
```

## 📈 Performance Optimizations

### Frontend
- **Code Splitting** → Dynamic imports
- **Lazy Loading** → Route-based splitting
- **Memoization** → React.memo, useMemo
- **Bundle Optimization** → Tree shaking
- **Caching** → Redux persistence

### Backend
- **Database Indexing** → Optimized queries
- **Connection Pooling** → SQLite optimization
- **Response Caching** → Redis integration
- **Rate Limiting** → API protection

## 🧪 Testing Strategy

### Code Execution Testing
```typescript
interface TestCase {
  input: string;
  expectedOutput: string;
}

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
  error?: string;
}
```

### Error Handling
- **Graceful Degradation** → Fallback mechanisms
- **User Feedback** → Clear error messages
- **Logging** → Comprehensive error tracking
- **Recovery** → Automatic retry logic

## 🔮 Future Enhancements

### Planned Features
- **Multi-language Support** → Python, Java, C++
- **Video Interviews** → WebRTC integration
- **Advanced Analytics** → ML-powered insights
- **Team Collaboration** → Multi-interviewer support
- **API Integration** → Third-party HR systems

### Scalability Considerations
- **Microservices** → Service decomposition
- **Containerization** → Docker deployment
- **Load Balancing** → Horizontal scaling
- **Database Migration** → PostgreSQL/MySQL
- **Caching Layer** → Redis implementation

## 📝 Best Practices Implemented

### Code Quality
- **TypeScript** → Type safety throughout
- **ESLint** → Code linting and formatting
- **Prettier** → Consistent code style
- **Git Hooks** → Pre-commit validation

### Security
- **Input Validation** → Sanitization and validation
- **SQL Injection Prevention** → Parameterized queries
- **XSS Protection** → Content Security Policy
- **CSRF Protection** → Token validation

### Performance
- **Lazy Loading** → Component-based splitting
- **Memoization** → Expensive computation caching
- **Debouncing** → User input optimization
- **Virtual Scrolling** → Large list rendering

---
