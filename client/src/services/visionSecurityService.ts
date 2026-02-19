import { FilesetResolver, FaceLandmarker, FaceDetector } from '@mediapipe/tasks-vision'
import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { WarningStateManager } from './warningStateManager'

export type GazeDirection = 'center' | 'left' | 'right' | 'up' | 'down' | 'away'

export interface VisionSecurityStatus {
    gazeDirection: GazeDirection
    blinkRate: number
    faceDetected: boolean
    multipleFacesDetected: boolean
    facePresenceConfidence: number
    gazeAwayDuration: number
    handsDetected: boolean
    handCount: number
    suspiciousHandPatterns: string[]
    handMovementIntensity: number
    suspiciousEvents: string[]
    timestamp: number
}

export class VisionSecurityService {
    private faceLandmarker: FaceLandmarker | null = null
    private faceDetector: FaceDetector | null = null
    private isInitialized = false
    private blinkHistory: number[] = []
    private lastBlinkTime = 0
    private lastProcessTime = 0
    private readonly PROCESS_INTERVAL = 100 // Process every 100ms (10 FPS)
    private warningManager: WarningStateManager
    private capturedScreenshot: string | null = null
    private isCodingSection: boolean = false

    // Thresholds
    private readonly GAZE_AWAY_THRESHOLD = 3000 // 3 seconds
    private readonly FACE_ABSENT_THRESHOLD = 5000 // 5 seconds
    private readonly BLINK_EAR_THRESHOLD = 0.25

    constructor(onWarningComplete?: (warning: any) => void) {
        const thresholds = {
            gaze_away: this.GAZE_AWAY_THRESHOLD,
            face_absent: this.FACE_ABSENT_THRESHOLD,
            multiple_faces: 0,
        }
        this.warningManager = new WarningStateManager(thresholds, onWarningComplete)
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) return

        try {
            console.log('🔧 Initializing MediaPipe Vision Security Service...')

            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
            )

            console.log('✅ MediaPipe FilesetResolver loaded successfully')

            // Initialize Face Landmarker
            this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU',
                },
                outputFaceBlendshapes: false,
                runningMode: 'IMAGE',
                numFaces: 2,
            })

            // Initialize Face Detector
            this.faceDetector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                    delegate: 'GPU',
                },
                runningMode: 'IMAGE',
            })

            this.isInitialized = true
            console.log('✅ Vision Security Service initialized successfully')
        } catch (error: any) {
            console.error('❌ Failed to initialize Vision Security Service:', error)
            throw error
        }
    }

    async processFrame(videoElement: HTMLVideoElement): Promise<VisionSecurityStatus | null> {
        if (!this.isInitialized || !videoElement || videoElement.readyState !== 4) {
            return null
        }

        const now = Date.now()
        if (now - this.lastProcessTime < this.PROCESS_INTERVAL) {
            return null // Throttle processing
        }
        this.lastProcessTime = now

        try {
            const canvas = document.createElement('canvas')
            canvas.width = videoElement.videoWidth
            canvas.height = videoElement.videoHeight
            const ctx = canvas.getContext('2d')
            if (!ctx) return null

            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

            const faceDetections = this.faceDetector?.detect(imageData)
            const faceLandmarks = this.faceLandmarker?.detect(imageData)

            const getScreenshot = () => canvas.toDataURL('image/jpeg', 0.5)

            return this.analyzeResults(faceDetections, faceLandmarks, getScreenshot)
        } catch (error) {
            console.error('Error processing frame:', error)
            return null
        }
    }

    private analyzeResults(
        faceDetections: any,
        faceLandmarks: any,
        getScreenshot?: () => string,
    ): VisionSecurityStatus {
        const now = Date.now()

        const faceDetected = (faceDetections?.detections?.length || 0) > 0
        const multipleFacesDetected = (faceDetections?.detections?.length || 0) > 1
        const facePresenceConfidence = faceDetected ? (faceDetections?.detections?.[0]?.score || 0) : 0

        // Multiple faces warning management
        if (multipleFacesDetected) {
            this.warningManager.startWarning('multiple_faces')
            if (!this.capturedScreenshot && getScreenshot) {
                this.capturedScreenshot = getScreenshot()
                console.log('📸 [VisionSecurity] Captured screenshot for multiple faces detected')
            }
        } else {
            this.warningManager.endWarning('multiple_faces')
        }

        // Face absent warning management
        if (!faceDetected) {
            this.warningManager.startWarning('face_absent')
        } else {
            this.warningManager.endWarning('face_absent')
        }

        // Eye tracking and gaze direction
        let gazeDirection: GazeDirection = 'center'
        let blinkRate = 0

        if (faceLandmarks?.faceLandmarks && faceLandmarks.faceLandmarks.length > 0) {
            const landmarks = faceLandmarks.faceLandmarks[0]
            gazeDirection = this.calculateGazeDirection(landmarks)
            blinkRate = this.detectBlink(landmarks, now)
        }

        // Gaze away detection (only when face is detected, excluding down which is mobile device)
        const gazeAway =
            faceDetected &&
            gazeDirection !== 'center' &&
            gazeDirection !== 'away' &&
            (!this.isCodingSection || gazeDirection !== 'down')

        if (gazeAway) {
            this.warningManager.startWarning('gaze_away')
        } else {
            this.warningManager.endWarning('gaze_away')
        }

        return {
            gazeDirection,
            blinkRate,
            faceDetected,
            multipleFacesDetected,
            facePresenceConfidence,
            gazeAwayDuration: 0,
            handsDetected: false,
            handCount: 0,
            suspiciousHandPatterns: [],
            handMovementIntensity: 0,
            suspiciousEvents: [],
            timestamp: now,
        }
    }

    private calculateGazeDirection(landmarks: NormalizedLandmark[]): GazeDirection {
        const leftEyeLeft = landmarks[33]
        const leftEyeRight = landmarks[133]
        const leftEyeTop = landmarks[159]
        const leftEyeBottom = landmarks[145]
        const rightEyeLeft = landmarks[362]
        const rightEyeRight = landmarks[263]
        const rightEyeTop = landmarks[386]
        const rightEyeBottom = landmarks[374]
        const noseTip = landmarks[4]
        const leftEyeCenter = landmarks[468] || null
        const rightEyeCenter = landmarks[473] || null

        if (!leftEyeLeft || !leftEyeRight || !rightEyeLeft || !rightEyeRight) {
            return 'away'
        }

        const leftEyeWidth = Math.abs(leftEyeRight.x - leftEyeLeft.x)
        const rightEyeWidth = Math.abs(rightEyeRight.x - rightEyeLeft.x)

        const leftOffsetX = leftEyeCenter
            ? (leftEyeCenter.x - (leftEyeLeft.x + leftEyeRight.x) / 2) / leftEyeWidth
            : 0
        const leftOffsetY =
            leftEyeCenter && leftEyeTop && leftEyeBottom
                ? (leftEyeCenter.y - (leftEyeTop.y + leftEyeBottom.y) / 2) / Math.abs(leftEyeTop.y - leftEyeBottom.y)
                : 0

        const rightOffsetX = rightEyeCenter
            ? (rightEyeCenter.x - (rightEyeLeft.x + rightEyeRight.x) / 2) / rightEyeWidth
            : 0
        const rightOffsetY =
            rightEyeCenter && rightEyeTop && rightEyeBottom
                ? (rightEyeCenter.y - (rightEyeTop.y + rightEyeBottom.y) / 2) / Math.abs(rightEyeTop.y - rightEyeBottom.y)
                : 0

        const avgOffsetX = (leftOffsetX + rightOffsetX) / 2
        const avgOffsetY = (leftOffsetY + rightOffsetY) / 2
        const noseOffsetX = noseTip ? noseTip.x - 0.5 : 0

        const threshold = 0.1
        const headPoseThreshold = 0.15

        if (!leftEyeCenter || !rightEyeCenter) {
            if (Math.abs(noseOffsetX) > headPoseThreshold) {
                return noseOffsetX > 0 ? 'right' : 'left'
            }
            return 'center'
        }

        const combinedOffsetX = avgOffsetX * 0.7 + noseOffsetX * 0.3
        const combinedOffsetY = avgOffsetY

        if (Math.abs(combinedOffsetX) < threshold && Math.abs(combinedOffsetY) < threshold) {
            return 'center'
        }

        if (Math.abs(combinedOffsetX) > Math.abs(combinedOffsetY)) {
            return combinedOffsetX > 0 ? 'right' : 'left'
        } else {
            return combinedOffsetY > 0 ? 'down' : 'up'
        }
    }

    private detectBlink(landmarks: NormalizedLandmark[], now: number): number {
        const leftEyeTop = landmarks[159]?.y || 0
        const leftEyeBottom = landmarks[145]?.y || 0
        const leftEyeLeft = landmarks[33]?.x || 0
        const leftEyeRight = landmarks[133]?.x || 0

        const rightEyeTop = landmarks[386]?.y || 0
        const rightEyeBottom = landmarks[374]?.y || 0
        const rightEyeLeft = landmarks[362]?.x || 0
        const rightEyeRight = landmarks[263]?.x || 0

        const leftEAR = Math.abs(leftEyeTop - leftEyeBottom) / Math.abs(leftEyeLeft - leftEyeRight)
        const rightEAR = Math.abs(rightEyeTop - rightEyeBottom) / Math.abs(rightEyeLeft - rightEyeRight)
        const avgEAR = (leftEAR + rightEAR) / 2

        if (avgEAR < this.BLINK_EAR_THRESHOLD && now - this.lastBlinkTime > 200) {
            this.blinkHistory.push(now)
            this.lastBlinkTime = now
            this.blinkHistory = this.blinkHistory.filter((time) => now - time < 60000)
        }

        const recentBlinks = this.blinkHistory.filter((time) => now - time < 60000)
        return recentBlinks.length
    }

    getWarningStats(): any {
        const stats = this.warningManager.getWarningStats()

        if (this.capturedScreenshot) {
            if (!stats['multiple_faces']) {
                stats['multiple_faces'] = { count: 0, totalDuration: 0, events: [] }
            }
            ; (stats['multiple_faces'] as any).screenshot = this.capturedScreenshot
        }

        return stats
    }

    getActiveWarnings(): any {
        return this.warningManager.getActiveWarnings()
    }

    isWarningStillActive(type: string, startTime: number): boolean {
        return this.warningManager.isWarningStillActive(type, startTime)
    }

    endAllActiveWarnings(): void {
        this.warningManager.endAllActiveWarnings()
    }

    setCodingSection(isCodingSection: boolean): void {
        this.isCodingSection = isCodingSection
        if (isCodingSection) {
            this.warningManager.endWarning('gaze_away')
        }
    }

    cleanup(): void {
        if (this.faceLandmarker) {
            this.faceLandmarker.close()
            this.faceLandmarker = null
        }
        if (this.faceDetector) {
            this.faceDetector.close()
            this.faceDetector = null
        }
        this.isInitialized = false
        this.blinkHistory = []
        this.warningManager.clear()
        this.capturedScreenshot = null
        this.isCodingSection = false
    }
}
