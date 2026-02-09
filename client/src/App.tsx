// src/App.tsx
import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { store, persistor } from './store';
import { theme } from './styles/theme';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthInitializer } from './components/AuthInitializer';
import Home from './pages/Home';
import { PublicRoute } from './components/PublicRoute';
import { InterviewerDashboard } from './pages/InterviewerDashboard';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { JoinInterview } from './pages/JoinInterview';
import { LinkCandidates } from './pages/LinkCandidates';
import { CreateInterview } from './pages/CreateInterview';
import { InterviewDetails } from './pages/InterviewDetails';
import { Contact } from './pages/Contact';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { Download } from './pages/Download';
import './utils/clearStorage'; // Clear old Redux state on startup
import { SignInPage } from './pages/auth/SignIn';
import { SignUpPage } from './pages/auth/SignUp';
import DesktopCallback from './pages/auth/DesktopCallback';
import DesktopLogin from './pages/auth/DesktopLogin';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const ClerkProviderWithRoutes = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
};

const AppContent = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={
          <PublicRoute>
            <Home />
          </PublicRoute>
        } />
        <Route path="contact" element={
          <PublicRoute>
            <Contact />
          </PublicRoute>
        } />
        <Route path="privacy-policy" element={
          <PublicRoute>
            <PrivacyPolicy />
          </PublicRoute>
        } />
      </Route>

      {/* Auth Routes */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/auth/desktop-callback" element={<DesktopCallback />} />
      <Route path="/auth/desktop-login/*" element={<DesktopLogin />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      <Route path="/register" element={<Navigate to="/sign-up" replace />} />

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
        path="/interviewer/link/:linkId/candidates/candidate/:id"
        element={
          <ProtectedRoute allowedUserTypes={['interviewer']}>
            <InterviewDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviewer/create-interview"
        element={
          <ProtectedRoute allowedUserTypes={['interviewer']}>
            <CreateInterview />
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
      <Route
        path="/download"
        element={
          <ProtectedRoute>
            <Download />
          </ProtectedRoute>
        }
      />

      {/* 404 Redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ConfigProvider theme={theme}>
          <AntApp>
            <Router>
              <ClerkProviderWithRoutes>
                <AuthInitializer />
                <AppContent />
              </ClerkProviderWithRoutes>
            </Router>
          </AntApp>
        </ConfigProvider>
      </PersistGate>
    </Provider>
  );
}

export default App;
