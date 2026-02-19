import React, { useState, useEffect, useCallback, useRef } from 'react'
import { AudioOutlined, AudioMutedOutlined, PhoneOutlined } from '@ant-design/icons'
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from '@livekit/components-react'
import { RoomEvent, LogLevel, setLogLevel } from 'livekit-client'
import { InterviewCodeEditor } from './InterviewCodeEditor'
import { AudioVisualizer } from './AudioVisualizer'
import { QuestionDisplay } from './QuestionDisplay'
import { ConfirmationModal } from '../common/ConfirmationModal'
import { useVisionSecurity } from '../../hooks/useVisionSecurity'
import type { Question, CodingProblem } from '../../types/interview'

interface WebInterviewSessionProps {
    interviewId: string
    questions: Question[]
    codingProblems: CodingProblem[]
    livekitToken: string
    livekitUrl: string
    roomName: string
    onComplete?: () => void
}

export const WebInterviewSession: React.FC<WebInterviewSessionProps> = ({
    interviewId: _interviewId,
    questions,
    codingProblems: _codingProblems,
    livekitToken: tokenFromProps,
    livekitUrl: urlFromProps,
    roomName: _roomNameFromProps,
    onComplete,
}) => {
    useEffect(() => { setLogLevel(LogLevel.error) }, [])

    const [currentState, setCurrentState] = useState<string>('connecting')
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
    const [followUpQuestionText, setFollowUpQuestionText] = useState<string | null>(null)
    const [currentCodingProblem, setCurrentCodingProblem] = useState<CodingProblem | null>(null)
    const [isListening, setIsListening] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isUserSpeaking, setIsUserSpeaking] = useState(false)
    const isListeningRef = useRef(false)
    const [progress, setProgress] = useState({ current: 0, total: questions.length })
    const [isFollowUp, setIsFollowUp] = useState(false)
    const [isHint, setIsHint] = useState(false)
    const [isClarification, setIsClarification] = useState(false)
    const [currentCode, setCurrentCode] = useState('')
    const currentCodeRef = useRef('')
    const [currentNotepad, setCurrentNotepad] = useState('')
    const currentNotepadRef = useRef('')
    const [isMicMuted, setIsMicMuted] = useState(false)
    const livekitRoomRef = useRef<any>(null)
    const broadcastDataRef = useRef<((data: any) => void) | null>(null)
    const agentSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const userSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isSubmittingTimeoutRef = useRef<boolean>(false)
    const hasCompletedRef = useRef(false)

    // Vision security
    const hiddenVideoRef = useRef<HTMLVideoElement | null>(null)
    const [hiddenVideoElement, setHiddenVideoElement] = useState<HTMLVideoElement | null>(null)
    const cameraStreamRef = useRef<MediaStream | null>(null)
    const [complexityNotes] = useState<Record<string, { time: string; space: string }>>({})
    const [confirmationModal, setConfirmationModal] = useState<{
        visible: boolean
        message: string
        okText: string
        onConfirm: () => void
        okButtonProps?: any
    }>({
        visible: false,
        message: '',
        okText: '',
        onConfirm: () => { },
    })

    // Determine if we are in a coding section for vision security
    const isCodingSection = currentState === 'coding_problem' || currentState === 'coding'

    // Open a dedicated camera stream for vision security (separate from LiveKit video track)
    useEffect(() => {
        if (currentState === 'connecting' || currentState === 'completed') return

        let mounted = true
        const openCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true })
                if (!mounted) { stream.getTracks().forEach(t => t.stop()); return }
                cameraStreamRef.current = stream
                if (hiddenVideoRef.current) {
                    hiddenVideoRef.current.srcObject = stream
                    hiddenVideoRef.current.play().catch(() => { })
                    setHiddenVideoElement(hiddenVideoRef.current)
                }
            } catch (err) {
                console.warn('[VisionSecurity] Camera access failed:', err)
            }
        }
        openCamera()

        return () => {
            mounted = false
            if (cameraStreamRef.current) {
                cameraStreamRef.current.getTracks().forEach(t => t.stop())
                cameraStreamRef.current = null
            }
            setHiddenVideoElement(null)
        }
    }, [currentState === 'connecting'])

    // Send security warnings to the agent via LiveKit data channel
    const handleSecurityWarning = useCallback((message: string) => {
        if (broadcastDataRef.current) {
            broadcastDataRef.current({
                type: 'security_warning',
                message,
                timestamp: Date.now(),
            })
            console.log('📤 [VisionSecurity] Sent security warning to agent:', message)
        }
    }, [])

    // Vision security hook
    const { endAllActiveWarnings } = useVisionSecurity({
        videoElement: hiddenVideoElement,
        enabled: hiddenVideoElement !== null && currentState !== 'connecting' && currentState !== 'completed',
        isSpeaking,
        isEvaluating: false,
        isListening,
        isCodingSection,
        onWarning: handleSecurityWarning,
    })

    // Clean up active warnings when interview completes
    useEffect(() => {
        if (currentState === 'completed') {
            endAllActiveWarnings()
        }
    }, [currentState, endAllActiveWarnings])

    // Compute livekitUrl with wss://
    const serverUrl = (() => {
        let url = urlFromProps
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
            url = `wss://${url.replace(/^(https?):\/\//, '')}`
        } else if (url.startsWith('https://')) {
            url = url.replace('https://', 'wss://')
        } else if (url.startsWith('http://')) {
            url = url.replace('http://', 'ws://')
        }
        return url
    })()

    // Mic toggle
    const handleMicToggle = useCallback(async () => {
        const newMuted = !isMicMuted
        setIsMicMuted(newMuted)
        if (livekitRoomRef.current?.localParticipant) {
            try {
                await livekitRoomRef.current.localParticipant.setMicrophoneEnabled(!newMuted)
            } catch (err) {
                console.error('Failed to toggle mic:', err)
                setIsMicMuted(!newMuted)
            }
        }
    }, [isMicMuted])

    // LiveKit Event Bridge (must be inside LiveKitRoom)
    const LiveKitRoomEventBridge: React.FC = () => {
        const room = useRoomContext()

        useEffect(() => {
            if (room && room.localParticipant) {
                livekitRoomRef.current = room
                broadcastDataRef.current = (data: any) => {
                    const encoded = new TextEncoder().encode(JSON.stringify(data))
                    room.localParticipant.publishData(encoded, { reliable: true })
                }
            } else {
                broadcastDataRef.current = null
            }
            return () => { broadcastDataRef.current = null }
        }, [room])

        // Broadcast code snapshots
        useEffect(() => {
            if (!room) return
            const isCodingState = currentState === 'coding_problem' || currentState === 'coding'
            if (isCodingState && currentCode) {
                const timeoutId = setTimeout(() => {
                    if (room.localParticipant) {
                        const data = new TextEncoder().encode(JSON.stringify({
                            type: 'code_snapshot',
                            code: currentCode,
                            notepad: currentNotepadRef.current || '',
                            timestamp: Date.now(),
                        }))
                        room.localParticipant.publishData(data, { reliable: true })
                    }
                }, 2000)
                return () => clearTimeout(timeoutId)
            }
            return
        }, [currentCode, room, currentState])

        useEffect(() => { currentCodeRef.current = currentCode }, [currentCode])
        useEffect(() => { currentNotepadRef.current = currentNotepad }, [currentNotepad])

        useEffect(() => {
            if (!room) return

            const checkForAgent = () => {
                const remotes = Array.from(room.remoteParticipants.values())
                if (remotes.length > 0) {
                    isListeningRef.current = true
                    setIsListening(true)
                    setCurrentState((prev) => (prev === 'connecting' ? 'intro' : prev))
                    return true
                }
                return false
            }

            const isAgentParticipant = (p: any) =>
                !!p?.isAgent || p?.identity?.toLowerCase().includes('agent') || p?.identity?.startsWith('agent-')

            if (checkForAgent()) {
                const req = new TextEncoder().encode(JSON.stringify({ type: 'request-state' }))
                room.localParticipant.publishData(req, { reliable: true })
            }

            const handleParticipantConnected = () => {
                if (checkForAgent()) {
                    const req = new TextEncoder().encode(JSON.stringify({ type: 'request-state' }))
                    room.localParticipant.publishData(req, { reliable: true })
                }
            }

            const handleDataReceived = (payload: Uint8Array) => {
                try {
                    if (hasCompletedRef.current) return
                    const msg = JSON.parse(new TextDecoder().decode(payload))

                    if (msg.type === 'question-changed' && msg.question) {
                        const isDiff = currentQuestion?.id !== msg.question.id
                        setCurrentQuestion(msg.question)
                        setFollowUpQuestionText(null)
                        if (isDiff) { setIsFollowUp(false); setIsHint(false); setIsClarification(false) }
                        setCurrentState('theoretical_question')
                        setIsListening(true)
                        isListeningRef.current = true
                        if (msg.questionIndex !== undefined) setProgress({ current: msg.questionIndex + 1, total: questions.length })
                    }

                    if (msg.type === 'coding-problem-changed' && msg.codingProblem) {
                        const isDiff = currentCodingProblem?.id !== msg.codingProblem.id
                        setCurrentCodingProblem(msg.codingProblem)
                        if (isDiff) { setCurrentCode(''); setIsFollowUp(false); setIsHint(false); setIsClarification(false) }
                        isSubmittingTimeoutRef.current = false
                        const isAlreadyCoding = currentState === 'coding' || currentState === 'coding_problem' || currentState === 'coding_intro'
                        if (isAlreadyCoding) {
                            setCurrentState('coding_problem')
                        } else {
                            setCurrentState('coding_intro')
                            setTimeout(() => setCurrentState('coding_problem'), 4000)
                        }
                    }

                    if (msg.type === 'interview-state-change' && msg.state) {
                        setCurrentState(msg.state)
                    }

                    if (msg.type === 'follow_up') { setIsHint(false); setIsClarification(false); setIsFollowUp(true) }
                    if (msg.type === 'hint') { setIsFollowUp(false); setIsClarification(false); setIsHint(true) }
                    if (msg.type === 'clarification') { setIsFollowUp(false); setIsHint(false); setIsClarification(true) }
                    if (msg.type === 'clear_badges') { setIsFollowUp(false); setIsHint(false); setIsClarification(false) }

                    if (msg.type === 'show_confirmation_modal') {
                        setConfirmationModal({
                            visible: true,
                            message: msg.message || 'Are you sure you want to move to the next question?',
                            okText: 'Yes, move on',
                            okButtonProps: { type: 'primary' },
                            onConfirm: () => {
                                if (broadcastDataRef.current) {
                                    broadcastDataRef.current({ type: 'confirm_next_question' })
                                }
                                setConfirmationModal((prev) => ({ ...prev, visible: false }))
                            }
                        })
                    }

                    if (msg.type === 'interview_completed') {
                        if (!hasCompletedRef.current) {
                            hasCompletedRef.current = true
                            setCurrentState('completed')
                            // Ensure any open confirmation modal is closed
                            setConfirmationModal((prev) => ({ ...prev, visible: false }))
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse data channel message:', e)
                }
            }

            const handleActiveSpeakersChanged = (speakers: any[]) => {
                const agentSpeaking = speakers.some(isAgentParticipant)
                const userSpeaking = speakers.some(
                    (s) => s?.identity && s.identity === room.localParticipant?.identity,
                )

                if (agentSpeaking) {
                    if (agentSpeakingTimeoutRef.current) { clearTimeout(agentSpeakingTimeoutRef.current); agentSpeakingTimeoutRef.current = null }
                    setIsSpeaking(true); isListeningRef.current = false; setIsListening(false)
                } else if (!agentSpeakingTimeoutRef.current && isSpeaking) {
                    agentSpeakingTimeoutRef.current = setTimeout(() => {
                        setIsSpeaking(false)
                        if (!isUserSpeaking) { isListeningRef.current = true; setIsListening(true) }
                        agentSpeakingTimeoutRef.current = null
                    }, 500)
                }

                if (userSpeaking) {
                    if (userSpeakingTimeoutRef.current) { clearTimeout(userSpeakingTimeoutRef.current); userSpeakingTimeoutRef.current = null }
                    setIsUserSpeaking(true); setIsListening(false); isListeningRef.current = false
                    // Immediate code sync
                    const isCodingState = currentState === 'coding_problem' || currentState === 'coding'
                    if (isCodingState && (currentCodeRef.current || currentNotepadRef.current) && room.localParticipant) {
                        const data = new TextEncoder().encode(JSON.stringify({
                            type: 'code_snapshot', code: currentCodeRef.current || '', notepad: currentNotepadRef.current || '',
                            timestamp: Date.now(), trigger: 'user_speaking',
                        }))
                        room.localParticipant.publishData(data, { reliable: true })
                    }
                } else if (!userSpeakingTimeoutRef.current && isUserSpeaking) {
                    userSpeakingTimeoutRef.current = setTimeout(() => {
                        setIsUserSpeaking(false)
                        if (!isSpeaking) { isListeningRef.current = true; setIsListening(true) }
                        userSpeakingTimeoutRef.current = null
                    }, 300)
                }
            }

            room.on(RoomEvent.ParticipantConnected, handleParticipantConnected)
            room.on(RoomEvent.DataReceived, handleDataReceived)
            room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged)

            const fallback = setTimeout(() => {
                if (!isListeningRef.current) { isListeningRef.current = true; setIsListening(true) }
            }, 3000)

            return () => {
                room.off(RoomEvent.ParticipantConnected, handleParticipantConnected)
                room.off(RoomEvent.DataReceived, handleDataReceived)
                room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakersChanged)
                clearTimeout(fallback)
            }
        }, [room, questions.length])

        return null
    }

    // End call
    const handleEndCall = useCallback(() => {
        if (hasCompletedRef.current) return

        setConfirmationModal({
            visible: true,
            message: 'Are you sure you want to quit the interview? This action cannot be undone.',
            okText: 'End Interview',
            okButtonProps: { danger: true },
            onConfirm: async () => {
                // Close modal immediately
                setConfirmationModal((prev) => ({ ...prev, visible: false }))

                hasCompletedRef.current = true
                // Tell agent
                if (broadcastDataRef.current) {
                    broadcastDataRef.current({ type: 'user_quit', timestamp: Date.now() })
                    await new Promise((r) => setTimeout(r, 500))
                }
                setCurrentState('completed')
                if (livekitRoomRef.current) {
                    await livekitRoomRef.current.disconnect()
                    livekitRoomRef.current = null
                }
            }
        })
    }, [onComplete])

    const handleCodeChange = useCallback((code: string) => { setCurrentCode(code) }, [])


    const handleSubmit = useCallback(async (code: string, tc?: string, sc?: string) => {
        setConfirmationModal({
            visible: true,
            message: 'Are you sure you want to submit your solution? You can\'t edit it afterwards.',
            okText: 'Submit Solution',
            okButtonProps: { type: 'primary' },
            onConfirm: () => {
                if (broadcastDataRef.current) {
                    broadcastDataRef.current({ type: 'code_snapshot', code, complexity: { time: tc, space: sc }, timestamp: Date.now() })
                    broadcastDataRef.current({ type: 'confirm_next_question', metadata: { forced: true, submission: true, complexity: { time: tc, space: sc } } })
                    setCurrentCode('')
                }
                setConfirmationModal((prev) => ({ ...prev, visible: false }))
            }
        })
    }, [])

    const handleTimerExpire = useCallback(async () => {
        if (!currentCodingProblem || isSubmittingTimeoutRef.current) return
        isSubmittingTimeoutRef.current = true
        const code = currentCode.trim() || '// Timeout - no code submitted'
        const cmplx = currentCodingProblem && complexityNotes[currentCodingProblem.id] ? complexityNotes[currentCodingProblem.id] : { time: '', space: '' }
        if (broadcastDataRef.current) {
            broadcastDataRef.current({ type: 'code_snapshot', code, complexity: cmplx, timestamp: Date.now() })
            broadcastDataRef.current({ type: 'confirm_next_question', metadata: { forced: true, timeout: true } })
            setCurrentCode('')
        }
        setTimeout(() => { isSubmittingTimeoutRef.current = false }, 2000)
    }, [currentCodingProblem, currentCode, complexityNotes])



    const renderCodingWorkspace = () => (
        <div className="web-coding-section">
            {currentCodingProblem && (
                <InterviewCodeEditor
                    problem={currentCodingProblem}
                    onCodeChange={handleCodeChange}
                    onNotepadChange={(np) => { setCurrentNotepad(np); currentNotepadRef.current = np }}
                    onSubmit={handleSubmit}
                    onTimerExpire={handleTimerExpire}
                    isMonitoring={true}
                />
            )}
        </div>
    )

    const renderCurrentSection = () => {
        switch (currentState) {
            case 'connecting':
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
            case 'intro':
                return (
                    <div className="web-theoretical-section">
                        <QuestionDisplay
                            question={currentQuestion}
                            followUpQuestionText={followUpQuestionText}
                            introMessage="I'm ready when you are. Just say hello to begin."
                            introMeta="Waiting for you to start..."
                            isListening={isListening}
                            isSpeaking={isSpeaking}
                            isUserSpeaking={isUserSpeaking}
                            progress={progress}
                            isHint={isHint}
                            isClarification={isClarification}
                            isFollowUp={isFollowUp}
                        />
                    </div>
                )
            case 'theoretical_question':
            case 'waiting_for_answer':
            case 'evaluating_answer':
            case 'follow_up':
            case 'handling_theoretical_hint':
            case 'handling_clarification':
                return (
                    <div className="web-theoretical-section">
                        <QuestionDisplay
                            question={currentQuestion}
                            followUpQuestionText={followUpQuestionText}
                            isListening={isListening}
                            isSpeaking={isSpeaking}
                            isUserSpeaking={isUserSpeaking}
                            progress={progress}
                            isHint={isHint}
                            isClarification={isClarification}
                            isFollowUp={isFollowUp}
                        />
                    </div>
                )
            case 'coding_intro':
                return (
                    <div className="web-coding-intro-section">
                        <h2>Moving to Coding Section</h2>
                        <p>Now we'll work on a programming problem. Take your time and think through the solution step by step.</p>
                    </div>
                )
            case 'coding_problem':
            case 'coding_approach':
            case 'waiting_for_approach':
            case 'evaluating_approach':
            case 'monitoring_code':
            case 'providing_hint':
                return renderCodingWorkspace()
            case 'wrap_up':
            case 'completed':
                return (
                    <div className="web-loading-section">
                        <div className="web-glassmorphic-card web-wrap-up-card">
                            <div className="web-wrap-up-icon">
                                <div className="web-wrap-up-center"><span>✓</span></div>
                            </div>
                            <h2 className="web-loading-title">Interview Complete</h2>
                            <p className="web-loading-subtitle">Thanks for the great conversation! This was a demo interview.</p>
                            {onComplete && (
                                <button onClick={onComplete} style={{
                                    marginTop: 16, padding: '10px 24px', background: 'rgba(9, 88, 217, 0.15)',
                                    border: '1px solid rgba(9, 88, 217, 0.4)', borderRadius: 8, color: '#2196f3',
                                    cursor: 'pointer', fontSize: 14, fontWeight: 600,
                                }}>Back to Home</button>
                            )}
                        </div>
                    </div>
                )
            default:
                return (
                    <div className="web-loading-section">
                        <div className="web-glassmorphic-card">
                            <div className="web-loading-content">
                                <div className="web-spinner-container">
                                    <div className="web-spinner-ring"></div><div className="web-spinner-ring"></div><div className="web-spinner-ring"></div>
                                    <div className="web-spinner-center"><div className="web-spinner-dot"></div></div>
                                </div>
                                <h2 className="web-loading-title">Preparing Interview</h2>
                                <p className="web-loading-subtitle">Please wait...</p>
                            </div>
                        </div>
                    </div>
                )
        }
    }

    return (
        <LiveKitRoom
            video={true}
            audio={true}
            connect={true}
            token={tokenFromProps}
            serverUrl={serverUrl}
            options={{ adaptiveStream: true, dynacast: true }}
            onDisconnected={() => setIsListening(false)}
            onError={(error) => console.error('[LiveKit] Error:', error)}
        >
            {/* Hidden video element for vision security — camera stream captured separately */}
            <video
                ref={hiddenVideoRef}
                style={{ display: 'none' }}
                muted
                playsInline
                autoPlay
            />
            <LiveKitRoomEventBridge />
            <div className="web-voice-interview-session">
                <div className="web-interview-content">
                    {renderCurrentSection()}
                </div>

                <div className="web-audio-visualizer-pos">
                    <AudioVisualizer isListening={isListening} isSpeaking={isSpeaking} isMuted={isMicMuted} />
                </div>

                {currentState !== 'connecting' && currentState !== 'completed' && (
                    <div className="web-call-controls">
                        <button className={`web-control-btn web-mic-btn ${isMicMuted ? 'muted' : ''}`} onClick={handleMicToggle} data-tooltip={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}>
                            {isMicMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
                        </button>
                        <button className="web-control-btn web-end-call-btn" onClick={handleEndCall} data-tooltip="End interview">
                            <PhoneOutlined />
                        </button>
                    </div>
                )}
            </div>
            <RoomAudioRenderer />
            <ConfirmationModal
                visible={confirmationModal.visible}
                message={confirmationModal.message}
                okText={confirmationModal.okText}
                okButtonProps={confirmationModal.okButtonProps}
                onConfirm={confirmationModal.onConfirm}
                onCancel={() => setConfirmationModal((prev) => ({ ...prev, visible: false }))}
            />

            <style>{`
        .web-voice-interview-session {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #1a1a1a;
          color: #ffffff;
          overflow: hidden;
          margin: 0;
          padding: 0;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .web-voice-interview-session::-webkit-scrollbar {
          display: none;
        }

        .web-interview-content {
          flex: 1;
          padding: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .web-theoretical-section {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }

        .web-coding-section {
          margin: 0 auto;
          padding: 60px 0px 80px 0px;
          max-width: 1400px;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }

        .web-coding-intro-section,
        .web-wrap-up-section {
          text-align: center;
          padding: 40px 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .web-coding-intro-section h2,
        .web-wrap-up-section h2 {
          margin-bottom: 16px;
          color: #ffffff;
        }

        .web-coding-intro-section p,
        .web-wrap-up-section p {
          margin-bottom: 12px;
          color: #cccccc;
          line-height: 1.5;
        }

        .web-loading-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          position: relative;
          overflow: hidden;
        }

        .web-loading-section::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(33, 150, 243, 0.1) 0%, transparent 70%);
          animation: web-rotate 20s linear infinite;
        }

        @keyframes web-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .web-glassmorphic-card {
          position: relative;
          z-index: 1;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 60px 40px;
          box-shadow:
            0 8px 32px 0 rgba(0, 0, 0, 0.37),
            inset 0 1px 0 0 rgba(255, 255, 255, 0.1);
          max-width: 500px;
          width: 100%;
          animation: web-fadeInUp 0.6s ease-out;
        }

        @keyframes web-fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .web-loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .web-spinner-container {
          position: relative;
          width: 120px;
          height: 120px;
          margin-bottom: 8px;
        }

        .web-spinner-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid transparent;
          border-top-color: #2196f3;
          border-radius: 50%;
          animation: web-spin 1.5s linear infinite;
        }

        .web-spinner-ring:nth-child(1) {
          animation-delay: 0s;
          border-top-color: #2196f3;
        }

        .web-spinner-ring:nth-child(2) {
          animation-delay: 0.3s;
          border-top-color: #4caf50;
          width: 85%;
          height: 85%;
          top: 7.5%;
          left: 7.5%;
        }

        .web-spinner-ring:nth-child(3) {
          animation-delay: 0.6s;
          border-top-color: #ab47bc;
          width: 70%;
          height: 70%;
          top: 15%;
          left: 15%;
        }

        @keyframes web-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .web-spinner-center {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(33, 150, 243, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .web-spinner-dot {
          width: 12px;
          height: 12px;
          background: #2196f3;
          border-radius: 50%;
          animation: web-spin-pulse 1.5s ease-in-out infinite;
        }

        @keyframes web-spin-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }

        .web-loading-title {
          font-size: 28px;
          font-weight: 600;
          color: #ffffff;
          margin: 0;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #ffffff 0%, #b0b0b0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .web-loading-subtitle {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          font-weight: 400;
          letter-spacing: 0.3px;
        }

        .web-wrap-up-card {
          text-align: center;
          gap: 24px;
        }

        .web-wrap-up-icon {
          width: 110px;
          height: 110px;
          margin: 0 auto 8px auto;
          border-radius: 50%;
          background: radial-gradient(circle at top, rgba(76, 175, 80, 0.4), rgba(76, 175, 80, 0.15));
          border: 1px solid rgba(76, 175, 80, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(76, 175, 80, 0.25), inset 0 0 30px rgba(76, 175, 80, 0.15);
        }

        .web-wrap-up-center {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(76, 175, 80, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4caf50;
          font-size: 32px;
          font-weight: 600;
          border: 1px solid rgba(76, 175, 80, 0.4);
        }

        .web-audio-visualizer-pos {
          position: fixed;
          bottom: 8px;
          right: 20px;
          z-index: 1000;
        }

        /* Call Controls - Bottom Center */
        .web-call-controls {
          position: fixed;
          bottom: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 16px;
          z-index: 1000;
          align-items: center;
        }

        .web-control-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          position: relative;
        }

        .web-control-btn svg {
          width: 20px;
          height: 20px;
        }

        .web-control-btn .anticon {
          font-size: 24px;
        }

        .web-mic-btn {
          background: rgba(45, 45, 48, 0.95);
          color: #ffffff;
          backdrop-filter: blur(10px);
        }

        .web-mic-btn:hover {
          background: rgba(60, 60, 65, 0.95);
        }

        .web-mic-btn.muted {
          background: rgba(197, 36, 36, 0.95);
          color: #ffffff;
        }

        .web-mic-btn.muted:hover {
          background: rgba(185, 28, 28, 0.95);
        }

        .web-end-call-btn {
          background: rgba(197, 36, 36, 0.95);
          color: #ffffff;
        }

        .web-end-call-btn:hover {
          background: rgba(185, 28, 28, 0.95);
        }

        .web-end-call-btn .anticon {
          transform: rotate(225deg);
        }

        /* Tooltip styling for call control buttons */
        .web-control-btn[data-tooltip]:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 4px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.85);
          color: white;
          padding: 6px 12px;
          border-radius: 8px;
          font-size: 12px;
          white-space: nowrap;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          border: none;
        }

        .web-control-btn[data-tooltip]:hover::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 2px);
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.85);
          pointer-events: none;
        }
      `}</style>
        </LiveKitRoom >
    )
}
