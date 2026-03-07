import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { WebInterviewSession } from '../components/interview/WebInterviewSession'
import { API_BASE_URL } from '../constants/api'

// Frontend demo route types (URL segments for /try-interview/:type)
// These now directly match the backend semantic types
const VALID_TYPES = ['backend', 'fullstack', 'swe1'] as const
type DemoType = (typeof VALID_TYPES)[number]

interface DemoSession {
    sessionId: string
    token: string
    wsUrl: string
    roomName: string
    theoreticalQuestions: any[]
    codingQuestions: any[]
    questions: any[]
}

const TryInterview: React.FC = () => {
    const { type } = useParams<{ type: string }>()
    const navigate = useNavigate()
    const { getToken } = useAuth()

    const [session, setSession] = useState<DemoSession | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!type || !VALID_TYPES.includes(type as DemoType)) {
            setLoading(false)
            setError('Invalid interview type')
            return
        }

        // React Strict-Mode double-mount guard: the first mount's effect is
        // cleaned up (ignore = true) so its response never reaches state.
        // Only the second (surviving) mount's fetch will update the component.
        // Note: the server still receives both POSTs, but the server-side
        // fallback-lookup + sibling-merge in saveFinalEvaluation /
        // getPublicInterviewDetails handles the resulting duplicate gracefully.
        let ignore = false

        const startDemo = async () => {
            try {
                setLoading(true)
                setError(null)

                const token = await getToken()
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                }
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`
                }

                const response = await fetch(`${API_BASE_URL}/interview/demo-start`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ type }),
                })

                if (ignore) return

                const data = await response.json()

                if (!response.ok || !data.success) {
                    throw new Error(data.error || data.message || 'Failed to start demo interview')
                }

                setSession({
                    sessionId: data.sessionId,
                    token: data.token,
                    wsUrl: data.wsUrl,
                    roomName: data.roomName,
                    theoreticalQuestions: data.theoreticalQuestions || [],
                    codingQuestions: data.codingQuestions || [],
                    questions: data.questions || [],
                })
            } catch (err) {
                if (ignore) return
                console.error('[TryInterview] Error starting demo:', err)
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                if (!ignore) setLoading(false)
            }
        }

        startDemo()

        return () => { ignore = true }
    }, [type])

    // --- Invalid type ---
    if (!type || !VALID_TYPES.includes(type as DemoType)) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100vh', background: '#1a1a1a',
                color: '#fff', gap: 16,
            }}>
                <h2>Invalid Interview Type</h2>
                <p style={{ color: '#888' }}>
                    Please choose a valid interview type: <strong>Backend</strong>, <strong>Full Stack</strong>, or <strong>SWE-1</strong>.
                </p>
                <button onClick={() => navigate('/')} style={btnStyle}>Go Home</button>
            </div>
        )
    }

    // --- Loading ---
    if (loading) {
        return (
            <div className="web-loading-section">
                <div className="web-glassmorphic-card">
                    <div className="web-loading-content">
                        <div className="web-spinner-container">
                            <div className="web-spinner-ring"></div>
                            <div className="web-spinner-ring"></div>
                            <div className="web-spinner-ring"></div>
                            <div className="web-spinner-center"><div className="web-spinner-dot"></div></div>
                        </div>
                        <h2 className="web-loading-title">Preparing Interview</h2>
                        <p className="web-loading-subtitle">Connecting audio and AI services</p>
                    </div>
                </div>
            </div>
        )
    }

    // --- Error ---
    if (error) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100vh', background: '#1a1a1a',
                color: '#fff', gap: 16,
            }}>
                <h2>Something went wrong</h2>
                <p style={{ color: '#f44336' }}>{error}</p>
                <button onClick={() => navigate('/')} style={btnStyle}>Go Home</button>
            </div>
        )
    }

    // --- Session ready ---
    if (!session) return null

    // Hard cap for demo interviews so they don't run indefinitely (in seconds)
    const DEMO_MAX_DURATION_SECONDS = 15 * 60 // 15 minutes

    return (
        <WebInterviewSession
            interviewId={session.sessionId}
            questions={session.questions}
            codingProblems={session.codingQuestions}
            livekitToken={session.token}
            livekitUrl={session.wsUrl}
            roomName={session.roomName}
            maxDurationSeconds={DEMO_MAX_DURATION_SECONDS}
            onComplete={() => navigate('/')}
        />
    )
}

const btnStyle: React.CSSProperties = {
    padding: '10px 24px',
    background: '#0958d9',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
}

export default TryInterview
