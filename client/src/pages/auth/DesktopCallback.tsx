import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { CheckCircleOutlined } from "@ant-design/icons";

export default function DesktopCallback() {
    const { getToken, isLoaded } = useAuth();
    const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const hasFetched = useRef(false);

    useEffect(() => {
        if (!isLoaded || hasFetched.current) return;

        const syncToDesktop = async () => {
            hasFetched.current = true; // Mark as fetched immediately
            try {
                const token = await getToken();
                if (token) {
                    console.log("🎟️ [DesktopCallback] Requesting sign-in ticket from backend...");

                    // Call backend to generate a secure sign-in ticket
                    // Use configured API URL or fallback to localhost
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

                    const response = await fetch(`${apiUrl}/api/auth/ticket`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Backend ticket generation failed: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data.success && data.ticket) {
                        console.log("✅ [DesktopCallback] Ticket received");
                        const url = `shakra-app://auth/callback?ticket=${data.ticket}`;
                        setDeepLinkUrl(url);
                        setStatus('ready');

                        // Small delay to ensure state updates before redirect
                        setTimeout(() => {
                            window.location.href = url;
                        }, 100);
                    } else {
                        throw new Error("Invalid response from ticket endpoint");
                    }
                }
            } catch (err) {
                console.error("❌ [DesktopCallback] Failed to sync to desktop:", err);
                setStatus('error');
            }
        };

        syncToDesktop();
    }, [isLoaded, getToken]);

    const handleManualLaunch = () => {
        if (deepLinkUrl) {
            window.location.href = deepLinkUrl;
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            color: '#111827',
            textAlign: 'center',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ maxWidth: '400px' }}>
                <div style={{ marginBottom: '24px' }}>
                    <CheckCircleOutlined style={{ fontSize: '48px', color: status === 'ready' ? '#52c41a' : '#1890ff' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#111827' }}>
                    {status === 'loading' ? 'Verifying Session...' : 'Authentication Successful'}
                </h1>
                <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: '1.5' }}>
                    {status === 'loading'
                        ? 'Please wait while we secure your connection.'
                        : 'We are redirecting you to the desktop app.'}
                    <br />
                    {status === 'ready' && "Click the button below if the app doesn't open automatically."}
                </p>


                <button
                    onClick={handleManualLaunch}
                    disabled={!deepLinkUrl}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: deepLinkUrl ? 'pointer' : 'not-allowed',
                        fontWeight: '500',
                        fontSize: '14px',
                        opacity: deepLinkUrl ? 1 : 0.7,
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                    {status === 'loading' ? 'Loading...' : 'Launch App Manually'}
                </button>
            </div>
        </div>
    );
}
