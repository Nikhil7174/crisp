// src/App.tsx
import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { store, persistor } from './store';
import { theme } from './styles/theme';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import InterviewChat from './pages/InterviewChat';
// import { Admin } from './pages/Admin'; // Removed - using unified auth system
import { PublicRoute } from './components/PublicRoute';
import { Login } from './pages/auth/Login';
import { Register } from './pages/auth/Register';
import { InterviewerDashboard } from './pages/InterviewerDashboard';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { JoinInterview } from './pages/JoinInterview';
import { LinkCandidates } from './pages/LinkCandidates';
import { InterviewDetails } from './pages/InterviewDetails';
import { SessionCleanup } from './components/SessionCleanup';

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={theme}>
          <AntApp>
            <Router>
              <SessionCleanup />
              <Routes>
                {/* Public Routes */}
                {/* Public Routes */}
<Route path="/" element={<Layout />}>
  <Route index element={
    <PublicRoute>
      <Home />
    </PublicRoute>
  } />
</Route>

                {/* Auth Routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Join Interview - Public but requires validation */}
                <Route path="/join" element={<JoinInterview />} />

                {/* Interviewer Routes */}
                <Route
                  path="/interviewer/dashboard"
                  element={
                    <ProtectedRoute allowedUserTypes={['interviewer']}>
                      <InterviewerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/interviewer/link/:linkId/candidates"
                  element={
                    <ProtectedRoute allowedUserTypes={['interviewer']}>
                      <LinkCandidates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/interviewer/interview/:id"
                  element={
                    <ProtectedRoute allowedUserTypes={['interviewer']}>
                      <InterviewDetails />
                    </ProtectedRoute>
                  }
                />

                {/* Candidate Routes */}
                <Route
                  path="/candidate/dashboard"
                  element={
                    <ProtectedRoute allowedUserTypes={['candidate']}>
                      <CandidateDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Interview Routes - Protected (Only for link-based interviews) */}
                <Route
                  path="/interview/:sessionId"
                  element={
                    <ProtectedRoute allowedUserTypes={['candidate']}>
                      <InterviewChat />
                    </ProtectedRoute>
                  }
                />

                {/* Admin Routes - Removed in favor of unified auth system */}

                {/* 404 Redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Router>
          </AntApp>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
