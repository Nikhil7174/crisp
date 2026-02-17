import React from 'react';
import { SignUp } from '@clerk/clerk-react';
import { useSearchParams } from 'react-router-dom';

export const SignUpPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();

    // Get the role from the URL (default to 'interviewer' if missing)
    const role = searchParams.get('role') === 'candidate' ? 'candidate' : 'interviewer';

    React.useEffect(() => {
        if (!searchParams.get('role')) {
            setSearchParams({ role: 'interviewer' }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const handleRoleSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setSearchParams({ role: role === 'candidate' ? 'interviewer' : 'candidate' });
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
                <SignUp
                    path="/sign-up"
                    routing="path"
                    signInUrl="/sign-in"
                    unsafeMetadata={{ role }}
                />
            </div>

            <div style={{ marginTop: '24px', textAlign: 'center' }}>
                <a
                    href={`/sign-up?role=${role === 'candidate' ? 'interviewer' : 'candidate'}`}
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
                    onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                >
                    {role === 'interviewer'
                        ? "Not a company? Sign up as a Candidate"
                        : "Not a candidate? Sign up as a Company"}
                    <span>→</span>
                </a>
            </div>
        </div>
    );
};
