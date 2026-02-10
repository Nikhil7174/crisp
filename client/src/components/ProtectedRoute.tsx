import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useAppSelector } from '../store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedUserTypes?: Array<'candidate' | 'interviewer'>;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedUserTypes
}) => {
  const { isLoaded, isSignedIn } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { user: backendUser } = useAppSelector((state) => state.auth);
  const location = useLocation();

  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh'
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Not signed in - redirect to login
  if (!isSignedIn) {
    return <Navigate to="/sign-in" state={{ from: location.pathname }} replace />;
  }

  // Signed in to Clerk but backend user not synced yet
  if (isSignedIn && clerkUser && !backendUser) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 16
        }}
      >
        <Spin size="large" />
        <p style={{ color: '#6B7280', fontSize: 14 }}>Syncing your profile...</p>
      </div>
    );
  }

  // Get user type from backend user (most reliable) or fallback to Clerk metadata
  const userType = backendUser?.userType ||
    (clerkUser?.unsafeMetadata?.role as 'candidate' | 'interviewer' | undefined) ||
    (clerkUser?.publicMetadata?.userType as 'candidate' | 'interviewer' | undefined);

  // Check if user type is allowed
  if (allowedUserTypes && userType && !allowedUserTypes.includes(userType)) {
    // Redirect to their appropriate dashboard
    const redirectTo = userType === 'interviewer'
      ? '/interviewer/dashboard'
      : '/candidate/dashboard';
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};


