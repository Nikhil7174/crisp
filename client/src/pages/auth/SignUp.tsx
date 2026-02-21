import React, { useState } from 'react';
import { useSignUp } from '@clerk/clerk-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Spin } from 'antd';
import { Header } from '../../components/layout/Header';
import { Eye, EyeOff } from 'lucide-react';

export const SignUpPage = () => {
    const { isLoaded, signUp, setActive } = useSignUp();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Get role and source from URL
    const role = searchParams.get('role') === 'candidate' ? 'candidate' : 'interviewer';
    const isDesktop = searchParams.get('source') === 'desktop';
    const redirect = searchParams.get('redirect');
    const reason = searchParams.get('reason');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [pendingVerification, setPendingVerification] = useState(false);
    const [code, setCode] = useState('');
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

    const isWorkEmail = (email: string) => {
        const personalDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com'];
        const domain = email.split('@')[1];
        return domain && !personalDomains.includes(domain.toLowerCase());
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        if (role === 'interviewer' && !isWorkEmail(email)) {
            setError('Please use your company work email (e.g. name@yourcompany.com).');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const createPayload: any = {
                emailAddress: email,
                password: password,
                unsafeMetadata: {
                    role
                }
            };

            if (role === 'candidate') {
                createPayload.firstName = firstName;
                createPayload.lastName = lastName;
            }

            await signUp.create(createPayload);

            await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
            setPendingVerification(true);
        } catch (err: any) {
            console.error('Signup error:', err);
            setError(err.errors?.[0]?.message || 'An error occurred during sign up.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLoaded) return;

        setLoading(true);
        setError('');

        try {
            const completeSignUp = await signUp.attemptEmailAddressVerification({
                code
            });

            if (completeSignUp.status === 'complete') {
                await setActive({ session: completeSignUp.createdSessionId });
                const baseRoute = isDesktop ? '/auth/desktop-callback' : '/auth/callback';
                navigate(`${baseRoute}${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`);
            } else {
                console.log('Verification incomplete:', completeSignUp);
                setError('Verification incomplete. Please try again.');
            }
        } catch (err: any) {
            console.error('Verification error:', err);
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
                        color: #cbd5e1 !important; /* Lighter shade for placeholders */
                        opacity: 1; /* Firefox */
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
                            Create your account
                        </h1>
                        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b7280' }}>
                            {reason === 'demo'
                                ? 'Kindly sign up to continue to the demo interview'
                                : role === 'interviewer'
                                    ? 'Sign up to start conducting interviews'
                                    : 'Sign up to take your interview'}
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
                        <form onSubmit={handleSignUp}>
                            {role === 'candidate' && (
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>First name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            style={inputStyle}
                                            placeholder="John"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <label style={labelStyle}>Last name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            style={inputStyle}
                                            placeholder="Doe"
                                            required
                                            disabled={loading}
                                        />
                                    </div>
                                </div>
                            )}

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

                            <label style={labelStyle}>Password</label>
                            <div style={{ position: 'relative', marginBottom: '16px' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    style={{ ...inputStyle, marginBottom: 0, paddingRight: '40px' }}
                                    placeholder="Create a strong password"
                                    required
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        cursor: 'pointer',
                                        color: '#6b7280',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

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
                        <form onSubmit={handleVerify}>
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
                                    marginTop: '8px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                {loading ? <Spin size="small" /> : 'Verify Email'}
                            </button>
                        </form>
                    )}

                    {!pendingVerification && (
                        <div style={{ marginTop: '24px', textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                                Already have an account?{' '}
                                <a
                                    href={`/sign-in?role=${role}${isDesktop ? '&source=desktop' : ''}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}${reason ? `&reason=${reason}` : ''}`}
                                    style={{ color: '#000', textDecoration: 'none', fontWeight: 500 }}
                                >
                                    Sign in
                                </a>
                            </div>
                            <a
                                href={`/sign-up?role=${role === 'candidate' ? 'interviewer' : 'candidate'}${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ''}${reason ? `&reason=${reason}` : ''}`}
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
                                    ? "Not a company? Sign up as a Candidate"
                                    : "Not a candidate? Sign up as a Company"}
                                <span>→</span>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
