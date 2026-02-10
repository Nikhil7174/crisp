import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute - Simplified version that just checks if user is signed in
 * If signed in, redirect to auth callback to handle the sync
 */
export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isLoaded, isSignedIn } = useClerkAuth();

  // Wait for Clerk to load
  if (!isLoaded) {
    return null; // Don't show anything while loading
  }

  // If signed in, redirect to auth callback which will handle the rest
  if (isSignedIn) {
    return <Navigate to="/auth/callback" replace />;
  }

  return <>{children}</>;
};