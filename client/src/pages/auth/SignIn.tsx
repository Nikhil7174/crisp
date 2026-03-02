import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Spin } from 'antd';
import { Header } from '../../components/layout/Header';

export const SignInPage = () => {
    const { isLoaded, signIn, setActive } = useSignIn();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const role = searchParams.get('role') === 'candidate' ? 'candidate' : 'interviewer';
    const isDesktop = searchParams.get('source') === 'desktop';
    const redirect = searchParams.get('redirect');
    const reason = searchParams.get('reason');
    const initialError = searchParams.get('error');

    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [pendingVerification, setPendingVerification] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        if (!searchParams.get('role') && !isDesktop) {
            setSearchParams({ role: 'interviewer' }, { replace: true });
        }
    }, [searchParams, setSearchParams, isDesktop]);

    const handleRoleSwitch = (e: React.MouseEvent) => {
        e.preventDefault();
        setSearchParams({
            role: role === 'candidate' ? 'interviewer' : 'candidate',
            ...(isDesktop ? { source: 'desktop' } : {}),
            ...(redirect ? { redirect } : {}),
            ...(reason ? { reason } : {})
        });
        setError('');
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setLoading(true);
        setError('');

        try {
            const { supportedFirstFactors } = await signIn.create({
                identifier: email,
            });

            const emailFactor = supportedFirstFactors?.find(
                (factor) => factor.strategy === 'email_code'
            );

            if (emailFactor && emailFactor.strategy === 'email_code') {
                await signIn.prepareFirstFactor({
                    strategy: 'email_code',
                    emailAddressId: emailFactor.emailAddressId,
                });
                setPendingVerification(true);
            } else {
                setError('Email verification is not supported for this account.');
            }
        } catch (err: any) {
            console.error('SignIn error:', err);
            setError(err.errors?.[0]?.message || 'An error occurred during sign in.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyClick = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setLoading(true);
        setError('');

        try {
            const result = await signIn.attemptFirstFactor({
                strategy: 'email_code',
                code,
            });

            if (result.status === "complete") {
                await setActive({ session: result.createdSessionId });
                const baseRoute = isDesktop ? '/auth/desktop-callback' : '/auth/callback';
                const params = new URLSearchParams();
                if (redirect) params.set('redirect', redirect);
                if (reason) params.set('reason', reason);
                const queryString = params.toString();
                navigate(`${baseRoute}${queryString ? `?${queryString}` : ''}`);
            } else {
                console.log(result);
                setError('Additional steps required to complete sign in.');
            }
        } catch (err: any) {
            console.error('SignIn verification error:', err);
            setError(err.errors?.[0]?.message || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '10px 14px',
        fontSize: '14px',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        outline: 'none',
        boxSizing: 'border-box' as const,
        marginBottom: '16px',
        color: '#111827',
    };

    const labelStyle = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 500,
        color: '#374151',
        marginBottom: '6px'
    };

    return (
        <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
            <style>
                {`
                    input::placeholder {
                        color: #cbd5e1 !important;
                        opacity: 1;
                    }
                `}
            </style>
            <Header />
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px'
            }}>
                {initialError === 'work_email_required' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        background: '#FFF7ED',
                        border: '1px solid #FDBA74',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        marginBottom: '20px',
                        maxWidth: '420px',
                        width: '100%',
                    }}>
                        <span style={{ fontSize: '20px', lineHeight: 1 }}>⚠️</span>
                        <div>
                            <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#9A3412' }}>
                                Work email required
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#C2410C', lineHeight: 1.5 }}>
                                Interviewers must sign in with a company email address. Personal emails are not allowed.
                            </p>
                        </div>
                    </div>
                )}

                <div style={{
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
                    padding: '40px',
                    width: '100%',
                    maxWidth: '420px',
                    border: '1px solid #f3f4f6'
                }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#111827' }}>
                            Welcome back
                        </h1>
                        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b7280' }}>
                            {reason === 'demo'
                                ? 'Kindly sign in to continue to the demo interview'
                                : role === 'interviewer'
                                    ? 'Sign in to access your dashboard'
                                    : 'Sign in to review your interviews'}
                        </p>
                    </div>

                    {error && (
                        <div style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '20px',
                            fontSize: '13px',
                            color: '#dc2626',
                        }}>
                            {error}
                        </div>
                    )}

                    {!pendingVerification ? (
                        <form onSubmit={handleSignIn}>
                            <label style={labelStyle}>
                                {role === 'interviewer' ? 'Work email' : 'Email address'}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={inputStyle}
                                placeholder={role === 'interviewer' ? 'name@company.com' : 'you@example.com'}
                                required
                                disabled={loading}
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#fff',
                                    background: loading ? '#9ca3af' : '#000000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s',
                                    marginTop: '8px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {loading ? <Spin size="small" /> : 'Continue'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyClick}>
                            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '20px', textAlign: 'center' }}>
                                We sent a verification code to <strong>{email}</strong>
                            </p>

                            <label style={labelStyle}>Verification code</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                style={{ ...inputStyle, textAlign: 'center', fontSize: '18px', letterSpacing: '2px' }}
                                required
                                disabled={loading}
                                placeholder="123456"
                            />

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#fff',
                                    background: loading ? '#9ca3af' : '#000000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    transition: 'background-color 0.2s',
                                    marginTop: '8px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {loading ? <Spin size="small" /> : 'Verify & Log In'}
                            </button>
                        </form>
                    )}

                    <div style={{ marginTop: '24px', textAlign: 'center' }}>
                        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                            Don't have an account?{' '}
                            <Link
                                to={`/sign-up?role=${role}${isDesktop ? '&source=desktop' : ''}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}${reason ? `&reason=${reason}` : ''}`}
                                style={{ color: '#000000', fontWeight: 500, textDecoration: 'none' }}
                            >
                                Sign up
                            </Link>
                        </p>

                        <a
                            href={`/sign-in?role=${role === 'candidate' ? 'interviewer' : 'candidate'}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}${reason ? `&reason=${reason}` : ''}`}
                            onClick={handleRoleSwitch}
                            style={{
                                color: '#64748b',
                                textDecoration: 'none',
                                fontSize: '13px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#000000'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#64748b'}
                        >
                            {role === 'interviewer'
                                ? "Not a company? Log in as a Candidate"
                                : "Not a candidate? Log in as a Company"}
                            <span>→</span>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
