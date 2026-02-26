import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
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
  const [searchParams] = useSearchParams();

  // Wait for Clerk to load
  if (!isLoaded) {
    return null; // Don't show anything while loading
  }

  // If signed in, redirect based on user type or to auth callback
  if (isSignedIn) {
    const redirect = searchParams.get('redirect');
    const reason = searchParams.get('reason');

    // If we have backend user data, redirect to appropriate dashboard or redirect URL
    if (backendUser) {
      // If we have a redirect param, redirect directly to it
      if (redirect) {
        const target = redirect.startsWith('/') ? redirect : `/${redirect}`;
        return <Navigate to={target} replace />;
      }
      const redirectTo = backendUser.userType === 'interviewer' 
        ? '/interviewer/dashboard' 
        : '/candidate/dashboard';
      return <Navigate to={redirectTo} replace />;
    }
    
    // Otherwise, redirect to auth callback to sync user data
    // Preserve redirect and reason params if they exist
    const callbackUrl = redirect 
      ? `/auth/callback?redirect=${encodeURIComponent(redirect)}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`
      : '/auth/callback';
    return <Navigate to={callbackUrl} replace />;
  }

  return <>{children}</>;
};