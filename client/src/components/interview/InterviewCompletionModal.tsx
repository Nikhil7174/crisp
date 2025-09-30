// src/components/interview/InterviewCompletionModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal, Typography, Space, Button, Progress, notification } from 'antd';
import { CheckCircleOutlined, TrophyOutlined, LoadingOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';
import type { InterviewSession } from '../../types';
import SessionManager from '../../services/SessionManager';

const { Title, Paragraph } = Typography;

interface InterviewCompletionModalProps {
    visible: boolean;
    session: InterviewSession;
    onComplete: () => void;
    onSaveResults: (summary: any) => Promise<void>;
}

export const InterviewCompletionModal: React.FC<InterviewCompletionModalProps> = ({
    visible,
    session,
    onComplete,
    onSaveResults
}) => {
    const [isSaving, setIsSaving] = useState(false);
    const [saveProgress, setSaveProgress] = useState(0);

    useEffect(() => {
        if (visible) {
            handleSaveAndComplete();
        }
    }, [visible]);

    const createCompleteSummary = () => {
        if (!session) return null;

        const answers = session.answers || [];
        const totalQuestions = session.questions?.length || 0;

        // Calculate correct answers by comparing selectedOptionId with correctAnswerId
        const correctAnswers = answers.filter(answer => {
            const question = session.questions?.find(q => q.id === answer.questionId);
            return question && answer.selectedOptionId === question.correctAnswerId;
        }).length;

        const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        const totalTimeSpent = answers.reduce((total, answer) => total + (answer.timeTaken || 0), 0);
        const averageTimePerQuestion = answers.length > 0 ? Math.round(totalTimeSpent / answers.length) : 0;

        // Generate feedback
        const strengths = score >= 80 ? ['Excellent technical knowledge', 'Strong problem-solving skills'] :
            score >= 60 ? ['Good understanding of core concepts', 'Solid technical foundation'] :
                ['Willingness to learn and improve'];

        const areasForImprovement = score < 60 ? ['Review fundamental concepts', 'Practice more technical questions'] :
            score < 80 ? ['Focus on advanced topics', 'Improve time management'] :
                ['Continue practicing to maintain skills'];

        const overallFeedback = score >= 90 ?
            `Outstanding performance! You answered ${correctAnswers} out of ${totalQuestions} questions correctly, demonstrating excellent technical knowledge.` :
            score >= 80 ?
                `Great job! You scored ${score}% with ${correctAnswers} correct answers out of ${totalQuestions}.` :
                score >= 60 ?
                    `Good effort! You scored ${score}% with ${correctAnswers} correct answers out of ${totalQuestions}.` :
                    `You completed the interview with ${correctAnswers} correct answers out of ${totalQuestions} (${score}%).`;

        // Create detailed answers array
        const detailedAnswers = session.questions?.map((question, index) => {
            const answer = answers[index];
            const isCorrect = answer?.selectedOptionId === question.correctAnswerId;

            return {
                questionId: question.id,
                question: question.question,
                userAnswer: answer?.answer || 'No answer',
                correctAnswer: question.correctAnswerId || 'Not specified',
                isCorrect: isCorrect,
                timeTaken: answer?.timeTaken || 0
            };
        }) || [];

        const summary = {
            // Session Information
            sessionId: session.sessionId,
            candidateId: session.candidateId,
            completedAt: new Date().toISOString(),
            startTime: session.startTime,
            endTime: new Date(),
            duration: Date.now() - new Date(session.startTime).getTime(),

            // Performance Metrics
            totalQuestions: totalQuestions,
            correctAnswers: correctAnswers,
            incorrectAnswers: totalQuestions - correctAnswers,
            score: score,
            timeSpent: totalTimeSpent,
            averageTimePerQuestion: averageTimePerQuestion,

            // Analysis
            strengths: strengths,
            areasForImprovement: areasForImprovement,
            overallFeedback: overallFeedback,

            // Detailed Results
            detailedAnswers: detailedAnswers,

            // Question Analysis
            questionAnalysis: {
                easyQuestions: session.questions?.filter(q => q.difficulty === 'easy').length || 0,
                mediumQuestions: session.questions?.filter(q => q.difficulty === 'medium').length || 0,
                hardQuestions: session.questions?.filter(q => q.difficulty === 'hard').length || 0,
                correctByDifficulty: {
                    easy: detailedAnswers.filter(a => {
                        const q = session.questions?.find(q => q.id === a.questionId);
                        return q?.difficulty === 'easy' && a.isCorrect;
                    }).length,
                    medium: detailedAnswers.filter(a => {
                        const q = session.questions?.find(q => q.id === a.questionId);
                        return q?.difficulty === 'medium' && a.isCorrect;
                    }).length,
                    hard: detailedAnswers.filter(a => {
                        const q = session.questions?.find(q => q.id === a.questionId);
                        return q?.difficulty === 'hard' && a.isCorrect;
                    }).length
                }
            },

            // Candidate Information
            candidateInfo: {
                name: session.candidateId || 'Unknown',
                email: session.candidateId || 'Unknown'
            }
        };

        return summary;
    };

    const handleSaveAndComplete = async () => {
        setIsSaving(true);
        setSaveProgress(0);

        try {
            // Simulate progress
            const progressInterval = setInterval(() => {
                setSaveProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 200);

            // Create and save summary
            const summary = createCompleteSummary();
            if (summary) {
                await onSaveResults(summary);

                // Complete progress
                setSaveProgress(100);
                clearInterval(progressInterval);

                // Show success notification
                notification.success({
                    message: 'Interview Completed!',
                    description: 'Your results have been saved successfully. Thank you for taking the interview!'
                });

                // Mark interview as inactive
                SessionManager.setInterviewActive(false);

                // Don't auto-close - wait for user to click button
            }
        } catch (error) {
            console.error('Error saving results:', error);
            notification.error({
                message: 'Save Failed',
                description: 'Failed to save your interview results. Please try again.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
    };

    return (
        <Modal
            open={visible}
            closable={false}
            maskClosable={false}
            footer={null}
            centered
            width={600}
            style={{ textAlign: 'center' }}
        >
            <Space direction="vertical" size="large" style={{ width: '100%', padding: spacing.lg }}>
                {/* Success Icon */}
                <div style={{ fontSize: 64, color: colors.success.main }}>
                    {isSaving ? <LoadingOutlined spin /> : <CheckCircleOutlined />}
                </div>

                {/* Title */}
                <Title level={2} style={{ margin: 0, color: colors.success.main }}>
                    {isSaving ? 'Saving Your Results...' : 'Interview Completed!'}
                </Title>

                {/* Message */}
                <Paragraph style={{ fontSize: 16, margin: 0 }}>
                    {isSaving ?
                        'Thank you for completing the interview. We are saving your results...' :
                        'Thank you for completing the interview! Your results have been saved successfully. Click the button below to return to the home page.'
                    }
                </Paragraph>

                {/* Progress Bar */}
                {isSaving && (
                    <div style={{ width: '100%' }}>
                        <Progress
                            percent={saveProgress}
                            strokeColor={colors.success.main}
                            showInfo={true}
                            format={(percent) => `${percent}%`}
                        />
                        <Paragraph type="secondary" style={{ marginTop: spacing.sm }}>
                            Saving your interview results...
                        </Paragraph>
                    </div>
                )}

                {/* Quick Stats */}
                {!isSaving && session && (
                    <div style={{
                        backgroundColor: colors.background.secondary,
                        padding: spacing.md,
                        borderRadius: 8,
                        border: `1px solid ${colors.neutral[200]}`
                    }}>
                        <Space direction="vertical" size="small">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
                                <TrophyOutlined style={{ color: colors.warning.main }} />
                                <span style={{ fontWeight: 'bold' }}>
                                    Score: {(() => {
                                        const answers = session.answers || [];
                                        const correctAnswers = answers.filter(answer => {
                                            const question = session.questions?.find(q => q.id === answer.questionId);
                                            return question && answer.selectedOptionId === question.correctAnswerId;
                                        }).length;
                                        const totalQuestions = session.questions?.length || 0;
                                        return totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
                                    })()}%
                                </span>
                            </div>
                            <div style={{ fontSize: 14, color: colors.neutral[600] }}>
                                {(() => {
                                    const answers = session.answers || [];
                                    const correctAnswers = answers.filter(answer => {
                                        const question = session.questions?.find(q => q.id === answer.questionId);
                                        return question && answer.selectedOptionId === question.correctAnswerId;
                                    }).length;
                                    const totalQuestions = session.questions?.length || 0;
                                    return `${correctAnswers} out of ${totalQuestions} questions correct`;
                                })()}
                            </div>
                        </Space>
                    </div>
                )}

                {/* Action Button */}
                <Button
                    type="primary"
                    size="large"
                    onClick={onComplete}
                    style={{ minWidth: 200 }}
                    disabled={isSaving}
                >
                    {isSaving ? 'Saving...' : 'Return to Home'}
                </Button>
            </Space>
        </Modal>
    );
};

export default InterviewCompletionModal;
