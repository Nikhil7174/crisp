import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth as useClerkAuth, useUser, useClerk } from '@clerk/clerk-react';
import { useAppSelector } from '../../store';
import { isWorkEmail } from '../../utils/workEmail';

/**
 * AuthCallback - Single loading screen that handles the entire auth flow
 * Prevents multiple screen flashes by keeping user here until backend sync is complete
 */
export const AuthCallback: React.FC = () => {
    const { isLoaded, isSignedIn } = useClerkAuth();
    const { user: clerkUser } = useUser();
    const { signOut } = useClerk();
    const { user: backendUser } = useAppSelector((state) => state.auth);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirect = searchParams.get('redirect');

    useEffect(() => {
        // Step 1: Wait for Clerk to load
        if (!isLoaded || !clerkUser) return;

        // Step 2: If not signed in at all, redirect to sign-in
        if (!isSignedIn) {
            navigate('/sign-in', { replace: true });
            return;
        }

        // Step 3: Determine role — prefer backendUser (most reliable after sync),
        // fall back to Clerk metadata (available immediately on sign-up before sync).
        const role: string | undefined =
            backendUser?.userType ||
            (clerkUser.publicMetadata?.userType as string | undefined) ||
            (clerkUser.unsafeMetadata?.role as string | undefined);

        // Step 4: If role isn't known yet, keep showing spinner until AuthInitializer syncs.
        // Exception: for brand-new sign-ups, unsafeMetadata.role is set immediately by
        // the <SignUp> component so we don't need to wait.
        if (!role) return;

        // Step 5: Enforce work email for interviewers.
        // Only runs once we have a confirmed role, so no false positives.
        if (role === 'interviewer') {
            const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress ?? null;
            if (primaryEmail !== null && !isWorkEmail(primaryEmail)) {
                console.warn('[AuthCallback] ⛔ Interviewer used a personal email, signing out:', primaryEmail);
                signOut().then(() => {
                    navigate('/sign-in?error=work_email_required', { replace: true });
                });
                return;
            }
            // Email is null — primaryEmailAddress not loaded yet, stay on spinner.
            if (primaryEmail === null) return;
        }

        // Step 6: All checks passed — redirect to appropriate dashboard or redirect URL.
        // For sign-up flow, backendUser may not exist yet — stay on spinner.
        if (backendUser) {
            if (redirect) {
                console.log(`[AuthCallback] ✅ Auth complete, redirecting to requested URL: ${redirect}`);
                navigate(redirect, { replace: true });
            } else if (backendUser.userType === 'interviewer') {
                console.log('[AuthCallback] ✅ Auth complete, redirecting to interviewer dashboard');
                navigate('/interviewer/dashboard', { replace: true });
            } else {
                console.log('[AuthCallback] ✅ Auth complete, redirecting to candidate dashboard');
                navigate('/candidate/dashboard', { replace: true });
            }
        }
        // Otherwise keep showing spinner while AuthInitializer syncs


    }, [isLoaded, isSignedIn, clerkUser, backendUser, navigate, signOut]);


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
