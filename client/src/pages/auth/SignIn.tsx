import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';

export const SignInPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const role = searchParams.get('role') === 'interviewer' ? 'interviewer' : 'candidate';

    // Check if this is a desktop auth request
    const isDesktop = searchParams.get('source') === 'desktop';

    React.useEffect(() => {
        // Only enforce role default if not in desktop mode (desktop mode has its own flow)
        if (!searchParams.get('role') && !isDesktop) {
            setSearchParams({ role: 'candidate' }, { replace: true });
        }
    }, [searchParams, setSearchParams, isDesktop]);

    const handleRoleSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setSearchParams({
            role: role === 'candidate' ? 'interviewer' : 'candidate',
            ...(isDesktop ? { source: 'desktop' } : {})
        });
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            background: '#ffffff',
            padding: '20px'
        }}>
            {/* Wrapper to prevent layout jump during re-render */}
            <div style={{ minHeight: '400px', display: 'flex', alignItems: 'center' }}>
                <SignIn
                    path="/sign-in"
                    routing="path"
                    signUpUrl={`/sign-up?role=${role}${isDesktop ? '&source=desktop' : ''}`}
                    forceRedirectUrl={isDesktop ? "/auth/desktop-callback" : undefined}
                />
            </div>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <a
                    href={`/sign-in?role=${role === 'candidate' ? 'interviewer' : 'candidate'}`}
                    onClick={handleRoleSwitch}
                    style={{
                        color: '#64748b',
                        textDecoration: 'none',
                        fontSize: '14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#0958d9'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                >
                    {role === 'candidate'
                        ? "Not a candidate? Log in as a Company"
                        : "Not a company? Log in as a Candidate"}
                    <span>→</span>
                </a>
            </div>
        </div>
    );
};
