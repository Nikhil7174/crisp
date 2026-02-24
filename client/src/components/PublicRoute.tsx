import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAppSelector } from '../store';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute - Redirects signed-in users away from public pages like sign-in/sign-up
 * If signed in, redirect to auth callback which will handle the rest
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: backendUser } = useAppSelector((state: any) => state.auth);

  // Wait for Clerk to load
  if (!isLoaded) {
    return null; // Don't show anything while loading
  }

  // If signed in, redirect based on user type or to auth callback
  if (isSignedIn) {
    // If we have backend user data, redirect to appropriate dashboard
    if (backendUser) {
      const redirectTo = backendUser.userType === 'interviewer' 
        ? '/interviewer/dashboard' 
        : '/candidate/dashboard';
      return <Navigate to={redirectTo} replace />;
    }
    // Otherwise, redirect to auth callback to sync user data
    return <Navigate to="/auth/callback" replace />;
  }

  return <>{children}</>;
};