// src/App.tsx
import React, { useEffect } from 'react';
import { ConfigProvider, App as AntApp } from 'antd';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { ClerkProvider } from '@clerk/clerk-react';
import { store, persistor } from './store';
import { theme } from './styles/theme';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthInitializer } from './components/AuthInitializer';
import Home from './pages/Home';
import { InterviewerDashboard } from './pages/InterviewerDashboard';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { Profile } from './pages/Profile';
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
import { AuthCallback } from './pages/auth/AuthCallback';
import DesktopCallback from './pages/auth/DesktopCallback';
import DesktopLogin from './pages/auth/DesktopLogin';
import TryInterview from './pages/TryInterview';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

// Fires a $pageview event whenever the URL changes
const PostHogPageView = () => {
  const posthog = usePostHog();
  const location = useLocation();

  useEffect(() => {
    if (posthog) {
      posthog.capture('$pageview', { $current_url: window.location.href });
    }
  }, [location, posthog]);

  return null;
};

const ClerkProviderWithRoutes = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Read role from URL so we can conditionally apply work-email localization
  const searchParams = new URLSearchParams(location.search);
  const isInterviewerRoute =
    searchParams.get('role') !== 'candidate' &&
    (location.pathname.startsWith('/sign-in') || location.pathname.startsWith('/sign-up'));

  const interviewerLocalization = {
    formFieldLabel__emailAddress: 'Work email address',
    formFieldInputPlaceholder__emailAddress: 'name@company.com',
    unstable__errors: {
      not_allowed_access:
        'Please use your company work email (e.g. name@yourcompany.com).',
      form_identifier_not_found:
        'No account found. Please check your work email or sign up.',
    },
  };

  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignInUrl="/auth/callback"
      afterSignUpUrl="/auth/callback"
      afterSignOutUrl="/"
      localization={isInterviewerRoute ? interviewerLocalization : undefined}
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
        <Route index element={<Home />} />
        <Route path="contact" element={<Contact />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
      </Route>

      {/* Auth Routes */}
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/desktop-callback" element={<DesktopCallback />} />
      <Route path="/auth/desktop-login/*" element={<DesktopLogin />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      <Route path="/register" element={<Navigate to="/sign-up" replace />} />

      {/* Join Interview - Public but requires validation */}
      <Route path="/join" element={<JoinInterview />} />

      {/* Try Interview - Protected demo route */}
      <Route
        path="/try-interview/:type"
        element={
          <ProtectedRoute>
            <TryInterview />
          </ProtectedRoute>
        }
      />

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
      <Route
        path="/interviewer/profile"
        element={
          <ProtectedRoute allowedUserTypes={['interviewer']}>
            <Profile />
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
              <PostHogPageView />
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
