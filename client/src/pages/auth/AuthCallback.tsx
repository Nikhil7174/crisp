import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useAppSelector } from '../../store';

/**
 * AuthCallback - Single loading screen that handles the entire auth flow
 * Prevents multiple screen flashes by keeping user here until backend sync is complete
 */
export const AuthCallback: React.FC = () => {
    const { isLoaded, isSignedIn } = useClerkAuth();
    const { user: backendUser } = useAppSelector((state) => state.auth);
    const navigate = useNavigate();

    useEffect(() => {
        // Wait for everything to be ready
        if (!isLoaded) return;

        // Not signed in - redirect to sign-in
        if (!isSignedIn) {
            navigate('/sign-in', { replace: true });
            return;
        }

        // Signed in and backend user synced - redirect to dashboard
        if (isSignedIn && backendUser) {
            const redirectTo = backendUser.userType === 'interviewer'
                ? '/interviewer/dashboard'
                : '/candidate/dashboard';

            console.log('[AuthCallback] ✅ Auth complete, redirecting to:', redirectTo);
            navigate(redirectTo, { replace: true });
        }

        // Otherwise, keep showing loading while AuthInitializer syncs the user
    }, [isLoaded, isSignedIn, backendUser, navigate]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                background: '#F9FAFB',
                gap: 24
            }}
        >
            <Spin size="large" />
            <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#111827', fontSize: 16, fontWeight: 500, margin: 0 }}>
                    Setting up your account
                </p>
                <p style={{ color: '#6B7280', fontSize: 14, marginTop: 8 }}>
                    This will only take a moment...
                </p>
            </div>
        </div>
    );
};
