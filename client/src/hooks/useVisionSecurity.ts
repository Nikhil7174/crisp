import { useEffect, useRef, useState, useCallback } from 'react'
import { VisionSecurityService, type VisionSecurityStatus } from '../services/visionSecurityService'

interface UseVisionSecurityOptions {
    videoElement: HTMLVideoElement | null
    enabled?: boolean
    onSecurityAlert?: (status: VisionSecurityStatus) => void
    isSpeaking?: boolean
    isEvaluating?: boolean
    isListening?: boolean
    isCodingSection?: boolean
    onWarning?: (message: string) => void
}

const WARNING_MESSAGES: Record<string, string[]> = {
    gaze_away: [
        'Please maintain focus on the screen',
        "I notice you're looking away. Let's stay focused on the interview",
        'Your attention seems to be drifting. Please focus on the questions',
    ],
    face_absent: [
        'Please ensure your face is visible to the camera',
        "I can't see you clearly. Please position yourself in front of the camera",
        'Your face is not visible. Please adjust your camera',
    ],
    multiple_faces: [
        'Multiple faces detected. Please ensure you are alone during the interview',
        'I see multiple people. This should be a solo interview',
        'Please ensure only you are visible during the interview',
    ],
}

export const useVisionSecurity = ({
    videoElement,
    enabled = true,
    onSecurityAlert,
    isSpeaking = false,
    isEvaluating = false,
    isListening = false,
    isCodingSection = false,
    onWarning,
}: UseVisionSecurityOptions) => {
    const [status, setStatus] = useState<VisionSecurityStatus | null>(null)
    const [isInitialized, setIsInitialized] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [warningStats, setWarningStats] = useState<any>({})

    const serviceRef = useRef<VisionSecurityService | null>(null)
    const animationFrameRef = useRef<number | null>(null)
    const lastEmitTime = useRef<number>(0)
    const warningOccurrenceCountRef = useRef<Record<string, number>>({})
    const lastSpokenOccurrenceRef = useRef<Record<string, number>>({})
    const isWarningTTSActiveRef = useRef<boolean>(false)
    const pushedOccurrencesRef = useRef<Record<string, Set<number>>>({})
    const incrementedWarningsRef = useRef<Record<string, Set<string>>>({})
    const stackProcessTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

    // Stack-based warning queue: one stack per warning type (LIFO - latest on top)
    interface WarningStackItem {
        type: string
        message: string
        occurrenceCount: number
        timestamp: number
    }
    const warningStacksRef = useRef<Record<string, WarningStackItem[]>>({})

    const EMIT_INTERVAL = 1000 // Emit security data every 1 second
    const STACK_PROCESS_DEBOUNCE_MS = 300 // Wait 300ms after pushing to stack before processing

    // Initialize service
    useEffect(() => {
        if (!enabled) {
            setIsInitialized(false)
            return
        }

        let isMounted = true

        const initService = async () => {
            try {
                const service = new VisionSecurityService((warning) => {
                    console.log(`📊 Warning completed: ${warning.type} - ${Math.round(warning.duration / 1000)}s`)

                    const thresholds: Record<string, number> = {
                        gaze_away: 5000,
                        face_absent: 5000,
                        multiple_faces: 500,
                    }
                    const threshold = thresholds[warning.type] || 0

                    if (warning.duration >= threshold) {
                        const warningKey = `${warning.type}-${warning.startTime}`
                        if (!incrementedWarningsRef.current[warning.type]) {
                            incrementedWarningsRef.current[warning.type] = new Set()
                        }
                        if (!incrementedWarningsRef.current[warning.type].has(warningKey)) {
                            const currentCount = warningOccurrenceCountRef.current[warning.type] || 0
                            warningOccurrenceCountRef.current[warning.type] = currentCount + 1
                            incrementedWarningsRef.current[warning.type].add(warningKey)
                        }
                    }

                    // Update warning stats when a warning completes
                    if (serviceRef.current) {
                        setWarningStats(serviceRef.current.getWarningStats())
                    }
                })
                await service.initialize()

                if (isMounted) {
                    serviceRef.current = service
                    setIsInitialized(true)
                    setError(null)
                } else {
                    service.cleanup()
                }
            } catch (err: any) {
                console.error('Failed to initialize vision security:', err)
                if (isMounted) {
                    setError(err.message || 'Failed to initialize vision security')
                    setIsInitialized(false)
                }
            }
        }

        initService()

        return () => {
            isMounted = false
            if (serviceRef.current) {
                serviceRef.current.cleanup()
                serviceRef.current = null
            }
            setIsInitialized(false)
        }
    }, [enabled])

    useEffect(() => {
        if (serviceRef.current) {
            serviceRef.current.setCodingSection(isCodingSection)
        }
    }, [isCodingSection])

    // Process warning stack: pop latest warning and speak it, then clear ALL stacks
    const processWarningStack = useCallback(() => {
        if (isSpeaking || isEvaluating || !isListening || isWarningTTSActiveRef.current) {
            return
        }

        let latestType: string | null = null
        let latestTimestamp = 0

        Object.keys(warningStacksRef.current).forEach((type) => {
            const stack = warningStacksRef.current[type]
            if (stack.length > 0) {
                const latest = stack[stack.length - 1]
                if (latest.timestamp > latestTimestamp) {
                    latestTimestamp = latest.timestamp
                    latestType = type
                }
            }
        })

        if (latestType) {
            const stack = warningStacksRef.current[latestType]
            const stackSizeBefore = stack.length

            // Clear ALL pending timers for ALL types
            Object.keys(stackProcessTimersRef.current).forEach((type) => {
                clearTimeout(stackProcessTimersRef.current[type])
                delete stackProcessTimersRef.current[type]
            })

            // Pop latest warning (LIFO)
            const latestWarning = stack.pop()!

            // Clear ALL stacks for ALL types to prevent multiple TTS calls
            Object.keys(warningStacksRef.current).forEach((type) => {
                warningStacksRef.current[type] = []
            })

            lastSpokenOccurrenceRef.current[latestType] = latestWarning.occurrenceCount

            if (pushedOccurrencesRef.current[latestType]) {
                pushedOccurrencesRef.current[latestType].delete(latestWarning.occurrenceCount)
            }

            isWarningTTSActiveRef.current = true

            const clearedCount = stackSizeBefore - 1
            console.log(
                `🔊 [STACK→TTS] Speaking latest warning for ${latestType} (occurrence ${latestWarning.occurrenceCount})${clearedCount > 0 ? `, cleared ${clearedCount} other warning(s)` : ''}, cleared all stacks`,
            )

            if (onWarning) {
                onWarning(latestWarning.message)

                // Reset after TTS completes (simulated delay since we don't know duration)
                setTimeout(() => {
                    isWarningTTSActiveRef.current = false
                    processWarningStack()
                }, 3000) // 3s delay
            } else {
                isWarningTTSActiveRef.current = false
            }
        }
    }, [isSpeaking, isEvaluating, isListening, onWarning])

    // Process frames
    useEffect(() => {
        if (!enabled || !isInitialized || !videoElement || !serviceRef.current) {
            return
        }

        const processFrame = async () => {
            try {
                const securityStatus = await serviceRef.current!.processFrame(videoElement)

                if (securityStatus) {
                    setStatus(securityStatus)

                    const now = Date.now()
                    if (now - lastEmitTime.current >= EMIT_INTERVAL) {
                        lastEmitTime.current = now

                        // Update warning stats periodically
                        if (serviceRef.current) {
                            setWarningStats(serviceRef.current.getWarningStats())
                        }

                        // Check active warnings and add to stack when threshold exceeded
                        if (serviceRef.current) {
                            const activeWarnings = serviceRef.current.getActiveWarnings()
                            const thresholds: Record<string, number> = {
                                gaze_away: 5000,
                                face_absent: 5000,
                                multiple_faces: 500,
                            }

                            activeWarnings.forEach((warning: any) => {
                                const duration = now - warning.startTime
                                const threshold = thresholds[warning.type] || 0

                                if (duration < threshold) return

                                if (
                                    serviceRef.current &&
                                    !serviceRef.current.isWarningStillActive(warning.type, warning.startTime)
                                ) {
                                    return
                                }

                                const warningKey = `${warning.type}-${warning.startTime}`

                                if (!incrementedWarningsRef.current[warning.type]) {
                                    incrementedWarningsRef.current[warning.type] = new Set()
                                }

                                if (!incrementedWarningsRef.current[warning.type].has(warningKey)) {
                                    const currentCount = warningOccurrenceCountRef.current[warning.type] || 0
                                    warningOccurrenceCountRef.current[warning.type] = currentCount + 1
                                    incrementedWarningsRef.current[warning.type].add(warningKey)
                                }

                                const occurrenceCount = warningOccurrenceCountRef.current[warning.type] || 0
                                const lastSpoken = lastSpokenOccurrenceRef.current[warning.type] || 0

                                // Only speak on every 3rd occurrence (1st, 4th, 7th, ...)
                                const shouldSpeak = occurrenceCount % 3 === 1 && occurrenceCount > lastSpoken

                                if (shouldSpeak) {
                                    if (!pushedOccurrencesRef.current[warning.type]) {
                                        pushedOccurrencesRef.current[warning.type] = new Set()
                                    }

                                    if (pushedOccurrencesRef.current[warning.type].has(occurrenceCount)) {
                                        return
                                    }

                                    const messages = WARNING_MESSAGES[warning.type] || []
                                    const message =
                                        messages[Math.floor(Math.random() * messages.length)] ||
                                        `Security alert: ${warning.type}`

                                    if (!warningStacksRef.current[warning.type]) {
                                        warningStacksRef.current[warning.type] = []
                                    }

                                    pushedOccurrencesRef.current[warning.type].add(occurrenceCount)

                                    warningStacksRef.current[warning.type].push({
                                        type: warning.type,
                                        message,
                                        occurrenceCount,
                                        timestamp: now,
                                    })

                                    console.log(
                                        `📥 [STACK] Pushed warning for ${warning.type} (occurrence ${occurrenceCount}), stack size: ${warningStacksRef.current[warning.type].length}`,
                                    )

                                    if (stackProcessTimersRef.current[warning.type]) {
                                        clearTimeout(stackProcessTimersRef.current[warning.type])
                                    }

                                    stackProcessTimersRef.current[warning.type] = setTimeout(() => {
                                        processWarningStack()
                                        delete stackProcessTimersRef.current[warning.type]
                                    }, STACK_PROCESS_DEBOUNCE_MS)
                                }
                            })

                            // Also try to process stack in case TTS just became available
                            processWarningStack()

                            // Trigger alert callback for UI updates
                            if (
                                onSecurityAlert &&
                                activeWarnings.some((w: any) => {
                                    const duration = now - w.startTime
                                    return duration >= (thresholds[w.type] || 0)
                                })
                            ) {
                                onSecurityAlert(securityStatus)
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Error processing vision frame:', err)
            }

            // Continue processing
            animationFrameRef.current = requestAnimationFrame(processFrame)
        }

        animationFrameRef.current = requestAnimationFrame(processFrame)

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
                animationFrameRef.current = null
            }

            Object.values(stackProcessTimersRef.current).forEach((timer) => {
                clearTimeout(timer)
            })
            stackProcessTimersRef.current = {}
        }
    }, [enabled, isInitialized, videoElement, onSecurityAlert, isSpeaking, isEvaluating, isListening, processWarningStack])

    const endAllActiveWarnings = useCallback(() => {
        if (serviceRef.current) {
            serviceRef.current.endAllActiveWarnings()
            const stats = serviceRef.current.getWarningStats()
            setWarningStats(stats)
            return stats
        }
        return {}
    }, [])

    const getWarningStats = useCallback(() => {
        if (serviceRef.current) {
            return serviceRef.current.getWarningStats()
        }
        return {}
    }, [])

    return {
        status,
        isInitialized,
        error,
        warningStats,
        endAllActiveWarnings,
        getWarningStats,
    }
}
