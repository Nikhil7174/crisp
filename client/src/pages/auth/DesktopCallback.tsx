import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { CheckCircleOutlined } from "@ant-design/icons";

export default function DesktopCallback() {
    const { getToken, isLoaded } = useAuth();

    useEffect(() => {
        if (!isLoaded) return;

        const syncToDesktop = async () => {
            try {
                const token = await getToken();
                if (token) {
                    // Redirect the browser to open your app
                    window.location.href = `shakra-app://auth/callback?token=${token}`;

                    // Optional: Close the tab after a few seconds or show a "Success" message
                }
            } catch (err) {
                console.error("Failed to get token for desktop sync", err);
            }
        };

        syncToDesktop();
    }, [isLoaded, getToken]);

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
                    <CheckCircleOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '12px', color: '#111827' }}>Authentication Successful</h1>
                <p style={{ color: '#64748b', marginBottom: '32px', lineHeight: '1.5' }}>
                    We are verifying your session. <br />
                    Please click <strong>Open Shakra AI</strong> in the browser prompt to complete the login in your desktop app.
                </p>


                <button
                    onClick={() => window.location.reload()}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#000',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '14px',
                        boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                    }}>
                    Launch App Manually
                </button>
            </div>
        </div>
    );
}
