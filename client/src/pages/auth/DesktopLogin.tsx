import React, { useEffect } from 'react';
import { SignIn, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const DesktopLogin: React.FC = () => {
    const { isSignedIn, isLoaded } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoaded && isSignedIn) {
            // If already signed in, go straight to callback to trigger deep link
            navigate('/auth/desktop-callback');
        }
    }, [isLoaded, isSignedIn, navigate]);

    if (!isLoaded) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#ffffff', color: '#000000' }}>Loading...</div>;
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#ffffff',
            color: '#000000',
            padding: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Log in to Shakra AI Desktop</h1>
                <p style={{ color: '#64748b' }}>Please sign in to continue using the desktop application.</p>
            </div>

            <SignIn
                path="/auth/desktop-login"
                routing="path"
                // Enforce candidate role for desktop app
                signUpUrl="/sign-up?role=candidate"
                forceRedirectUrl="/auth/desktop-callback"
            />
        </div>
    );
};

export default DesktopLogin;
