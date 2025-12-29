import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Tag,
  message,
  Spin,
  Descriptions,
  Empty,
  Tabs,
  Collapse,
  Rate,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  MessageOutlined,
  SettingOutlined,
  RobotOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../constants/api';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing } from '../styles';
import { DetailedFeedbackSheet } from '../components/DetailedFeedbackSheet';
import { generateFeedbackPDF } from '../utils/pdfGenerator';

const { Title, Text, Paragraph } = Typography;

type ConversationRole = 'user' | 'assistant' | 'system';

interface ConversationMetadata {
  type?: string;
  section?: 'theoretical' | 'coding';
  questionId?: string;
  codingProblemId?: string;
  hintLevel?: number;
  evaluation?: {
    score: number;
    keyPointsCovered?: string[];
  };
}

interface ConversationMessage {
  role: ConversationRole;
  content: string;
  timestamp?: number;
  metadata?: ConversationMetadata;
}

interface FinalEvaluationSummary {
  fullConversationHistory: ConversationMessage[];
  theoreticalSection: any;
  codingSection: any;
  totalScore: number;
  strengths: string[];
  areasForImprovement: string[];
  overallFeedback: string;
  hintRequestCount: number;
  clarificationRequestCount: number;
  followUpCount: number;
  averageTimePerQuestion?: number;
  averageTimePerCodingProblem?: number;
  llmEvaluation?: {
    theoreticalSection: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
    };
    codingSection: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
    };
    overall: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
    };
  } | null;
}

interface SecurityEvent {
  id: number;
  event_type: string;
  source: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  metadata?: any;
  created_at: string;
}

interface InterviewDetails {
  id: number;
  session_id: string;
  candidate_name: string;
  candidate_email: string;
  candidate_phone: string;
  start_time: string;
  end_time: string;
  duration: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  time_spent: number;
  strengths: string[];
  areasForImprovement: string[];
  overall_feedback: string;
  detailed_answers: any[];
  question_analysis: any;
  cheating_detected?: boolean;
  cheating_incidents?: any[];
  security_agent_connected?: boolean;
  security_events?: SecurityEvent[];
  candidate_feedback?: {
    id: number;
    rating: number;
    overall_experience?: string;
    technical_questions_quality?: string;
    interview_platform_rating?: number;
    suggestions?: string;
    would_recommend?: boolean;
    created_at: string;
    updated_at: string;
  } | null;
  created_at: string;
  finalEvaluation?: FinalEvaluationSummary | null;
}

export const InterviewDetails: React.FC = () => {
  const { linkId, id } = useParams<{ linkId: string; id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [interview, setInterview] = useState<InterviewDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [llmEvaluation, setLlmEvaluation] = useState<{
    theoreticalSection?: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
      questionBreakdown?: Array<{
        questionId: string;
        question: string;
        score: number;
        feedback: string;
        keyPointsCovered: string[];
        timeTaken?: number;
        hintsUsed?: number;
      }>;
    };
    codingSection?: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
      problemBreakdown?: Array<{
        problemId: string;
        problem: string;
        score: number;
        feedback: string;
        codeReview?: {
          strengths: string[];
          weaknesses: string[];
          suggestions: string[];
        };
        testResults?: Array<{
          passed: boolean;
          input: string;
          expectedOutput: string;
          actualOutput: string;
        }>;
        timeComplexity?: string;
        spaceComplexity?: string;
        timeTaken?: number;
        hintsUsed?: number;
      }>;
    };
    overall: {
      score: number;
      feedback: string;
      strengths: string[];
      areasForImprovement: string[];
      learningRecommendations?: string[];
    };
    summaryStatistics?: {
      totalQuestions: number;
      totalProblems: number;
      averageScore: number;
      totalHints: number;
      totalClarifications: number;
      totalFollowUps: number;
      averageTimePerQuestion: number;
      averageTimePerProblem: number;
    };
  } | null>(null);
  const [generatingEvaluation, setGeneratingEvaluation] = useState(false);

  useEffect(() => {
    if (id) {
      fetchInterviewDetails();
    }
  }, [id]);

  // Check for existing LLM evaluation or generate it when interview data is loaded
  useEffect(() => {
    if (interview?.finalEvaluation) {
      // First check if LLM evaluation already exists in finalEvaluation
      if (interview.finalEvaluation.llmEvaluation) {
        setLlmEvaluation(interview.finalEvaluation.llmEvaluation);
        return;
      }

      // If no LLM evaluation exists and we have conversation history, generate it
      if (
        interview.finalEvaluation.fullConversationHistory &&
        interview.finalEvaluation.fullConversationHistory.length > 0 &&
        !llmEvaluation &&
        !generatingEvaluation
      ) {
        generateLLMEvaluation();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview]);

  const fetchInterviewDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/interviewer/interview/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success && data.data) {
        setInterview(data.data);
      } else {
        message.error(data.message || 'Failed to fetch interview details');
        // Navigate back to candidates list for this link
        if (linkId) {
          navigate(`/interviewer/link/${linkId}/candidates`);
        } else {
          navigate('/interviewer/dashboard');
        }
      }
    } catch (error) {
      console.error('Error fetching interview details:', error);
      message.error('Failed to fetch interview details');
      // Navigate back to candidates list for this link
      if (linkId) {
        navigate(`/interviewer/link/${linkId}/candidates`);
      } else {
        navigate('/interviewer/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div style={{ padding: spacing.xl }}>
        <Empty description="Interview not found" />
      </div>
    );
  }

  const conversationHistory = interview.finalEvaluation?.fullConversationHistory || [];

  const conversationData = conversationHistory.map((message, index) => ({
    key: index,
    ...message,
    section: message.metadata?.section,
    type: message.metadata?.type,
    reference: message.metadata?.questionId || message.metadata?.codingProblemId || '',
  }));

  const formatTimestamp = (timestamp?: number) =>
    timestamp ? dayjs(timestamp).format('MMM D, YYYY HH:mm:ss') : 'Time not recorded';

  const generateLLMEvaluation = async () => {
    if (!interview?.finalEvaluation?.fullConversationHistory || !interview?.id) {
      return;
    }

    try {
      setGeneratingEvaluation(true);
      
      // Try to send full evaluation payload if available, otherwise fall back to conversation history
      const payload: any = {
        interviewId: interview.id,
      };

      // Check if we have the full evaluation structure to send
      if (interview.finalEvaluation && 
          interview.finalEvaluation.theoreticalSection && 
          interview.finalEvaluation.codingSection) {
        // Send full evaluation payload for enhanced evaluation
        payload.fullEvaluationPayload = {
          sessionId: interview.session_id,
          candidateId: interview.candidate_email,
          interviewLinkId: (interview as any).interview_link_id,
          startTime: interview.start_time,
          endTime: interview.end_time || new Date().toISOString(),
          duration: interview.duration || 0,
          fullConversationHistory: interview.finalEvaluation.fullConversationHistory,
          theoreticalSection: interview.finalEvaluation.theoreticalSection,
          codingSection: interview.finalEvaluation.codingSection,
          totalScore: interview.finalEvaluation.totalScore || 0,
          strengths: interview.finalEvaluation.strengths || [],
          areasForImprovement: interview.finalEvaluation.areasForImprovement || [],
          overallFeedback: interview.finalEvaluation.overallFeedback || '',
          hintRequestCount: interview.finalEvaluation.hintRequestCount || 0,
          clarificationRequestCount: interview.finalEvaluation.clarificationRequestCount || 0,
          followUpCount: interview.finalEvaluation.followUpCount || 0,
          averageTimePerQuestion: interview.finalEvaluation.averageTimePerQuestion || 0,
          averageTimePerCodingProblem: interview.finalEvaluation.averageTimePerCodingProblem || 0,
        };
      } else {
        // Fall back to conversation history only (backward compatibility)
        payload.conversationHistory = interview.finalEvaluation.fullConversationHistory;
      }

      const response = await fetch(`${API_BASE_URL}/llm/generate-comprehensive-evaluation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success && data.evaluation) {
        setLlmEvaluation(data.evaluation);
        if (data.cached) {
          console.log('✅ Loaded cached LLM evaluation from database');
        } else {
          console.log('✅ Generated and stored new LLM evaluation');
        }
      } else {
        console.error('Failed to generate evaluation:', data.error);
      }
    } catch (error) {
      console.error('Error generating LLM evaluation:', error);
    } finally {
      setGeneratingEvaluation(false);
    }
  };

  return (
    <div style={{ padding: spacing.xl, background: '#fafafa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: spacing.xl }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => {
            // Navigate back to candidates list for this link
            if (linkId) {
              navigate(`/interviewer/link/${linkId}/candidates`);
            } else {
              navigate(-1);
            }
          }}
          style={{ marginBottom: spacing.md }}
        >
          Back to Candidates
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Interview Details
        </Title>
      </div>

      <Tabs
        className="candidate-details-tabs"
        defaultActiveKey="candidateDetails"
        items={[
          {
            key: 'candidateDetails',
            label: 'Candidate Details',
            children: (
              <>

      {/* Candidate Information */}
                <Card
                  title="Candidate Information"
                  style={{ marginBottom: spacing.xl }}
                >
        <Descriptions column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Name">
                      {interview.candidate_name}
                    </Descriptions.Item>
                    <Descriptions.Item label="Email">
                      {interview.candidate_email}
                    </Descriptions.Item>
                    <Descriptions.Item label="Phone">
                      {interview.candidate_phone || 'N/A'}
                    </Descriptions.Item>
          <Descriptions.Item label="Session ID">
            <Text code>{interview.session_id}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Start Time">
                      {dayjs(interview.start_time).format(
                        'MMM D, YYYY HH:mm:ss',
                      )}
          </Descriptions.Item>
          <Descriptions.Item label="End Time">
                      {interview.end_time
                        ? dayjs(interview.end_time).format(
                            'MMM D, YYYY HH:mm:ss',
                          )
                        : 'N/A'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Detailed Evaluation */}
      {llmEvaluation ? (
        <>
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                generateFeedbackPDF(
                  llmEvaluation,
                  interview.candidate_name,
                  dayjs(interview.start_time).format('YYYY-MM-DD')
                );
              }}
            >
              Download PDF
            </Button>
          </div>
          <DetailedFeedbackSheet
            evaluation={llmEvaluation}
            candidateName={interview.candidate_name}
            interviewDate={dayjs(interview.start_time).format('MMM D, YYYY')}
          />
        </>
      ) : generatingEvaluation ? (
        <Card style={{ marginBottom: spacing.xl }}>
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <Spin size="large" />
            <Paragraph type="secondary" style={{ marginTop: spacing.md }}>
              Generating detailed evaluation from conversation history...
            </Paragraph>
          </div>
        </Card>
      ) : (
        <Card style={{ marginBottom: spacing.xl }}>
          <div style={{ textAlign: 'center', padding: spacing.xl }}>
            <RobotOutlined
              style={{ fontSize: 48, color: colors.neutral[400], marginBottom: spacing.md }}
            />
            <Paragraph type="secondary">
              {interview?.finalEvaluation?.fullConversationHistory
                ? 'Evaluation will be generated automatically...'
                : 'No conversation history available for evaluation'}
            </Paragraph>
          </div>
        </Card>
      )}
              </>
            ),
          },
          {
            key: 'detailedAnswers',
            label: 'Detailed Answers',
            children: (
              <Card
                title="Conversation History"
                style={{ marginTop: spacing.xl }}
                bodyStyle={{ paddingLeft: 60, paddingRight: 60 }}
              >
        {conversationData.length > 0 ? (
          <>
                    <Text
                      type="secondary"
                      style={{ display: 'block', marginBottom: spacing.md }}
                    >
                      Full transcript captured during the interview, including
                      theoretical and coding sections.
            </Text>
                    <div
                      style={{
                        border: `1px solid ${colors.neutral[200]}`,
                        borderRadius: 12,
                        maxHeight: 700,
                        overflowY: 'auto',
                        padding: spacing.xl,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: spacing.lg,
                        background: colors.background.primary,
                      }}
                    >
                      {conversationData.map((message) => {
                        const isCandidate = message.role === 'user';
                        const isAI = message.role === 'assistant';
                        const roleLabel = isCandidate
                          ? 'Candidate'
                          : isAI
                          ? 'AI Interviewer'
                          : 'System';
                        const RoleIcon = isCandidate
                          ? UserOutlined
                          : isAI
                          ? MessageOutlined
                          : SettingOutlined;
                        const bubbleColor = isCandidate
                          ? colors.background.primary
                          : isAI
                          ? '#f8f9fa'
                          : colors.neutral[100];
                        const borderColor = isCandidate
                          ? colors.neutral[200]
                          : isAI
                          ? colors.neutral[300]
                          : colors.neutral[300];
                        const boxShadow = isCandidate
                          ? '0 0 0 3px #f0fff4, 0 2px 12px rgba(240, 255, 244, 0.4)'
                          : colors.shadows.xs;
                        const textColor = colors.neutral[800];
                        const iconColor = isCandidate
                          ? colors.primary.main
                          : isAI
                          ? colors.neutral[600]
                          : colors.neutral[500];
                        const alignment = isCandidate
                          ? 'flex-end'
                          : 'flex-start';

                        return (
                          <div
                            key={message.key}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems:
                                alignment as 'flex-start' | 'flex-end',
                              width: '100%',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: spacing.sm,
                                marginBottom: spacing.xs,
                                justifyContent:
                                  isCandidate ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <RoleIcon
                                style={{
                                  fontSize: 16,
                                  color: iconColor,
                                }}
                              />
                              <Text
                                strong
                                style={{
                                  fontSize: 13,
                                  color: colors.neutral[700],
                                  fontWeight: 600,
                                  letterSpacing: '0.01em',
                                }}
                              >
                                {roleLabel}
                              </Text>
                              <Text
                                type="secondary"
                                style={{
                                  fontSize: 11,
                                  color: colors.neutral[500],
                                  marginLeft: spacing.xs,
                                }}
                              >
                                {formatTimestamp(message.timestamp)}
                              </Text>
                            </div>
                            <div
                              style={{
                                background: bubbleColor,
                                border: `1px solid ${borderColor}`,
                                borderRadius: 12,
                                padding: spacing.md,
                                maxWidth: '75%',
                                boxShadow: boxShadow,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              {message.type && (
                                <Tag
                                  style={{
                                    marginBottom: spacing.xs,
                                    fontSize: 11,
                                    padding: '2px 8px',
                                    border: 'none',
                                    background:
                                      message.type === 'question'
                                        ? '#e6f4ff'
                                        : message.type === 'answer'
                                        ? '#f6ffed'
                                        : '#fff7e6',
                                    color:
                                      message.type === 'question'
                                        ? colors.primary.dark
                                        : message.type === 'answer'
                                        ? colors.success.dark
                                        : colors.warning.dark,
                                  }}
                                >
                                  {message.type.charAt(0).toUpperCase() +
                                    message.type.slice(1)}
                                </Tag>
                              )}
                              <Text
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  display: 'block',
                                  fontSize: 14,
                                  lineHeight: 1.6,
                                  color: textColor,
                                  wordBreak: 'break-word',
                                }}
                              >
                                {message.content}
                              </Text>
                              {/* Display code for code submissions */}
                              {message.type === 'code_submission' && (message.metadata as any)?.code && (
                                <div
                                  style={{
                                    marginTop: spacing.md,
                                    padding: spacing.md,
                                    background: '#f5f5f5',
                                    borderRadius: 8,
                                    border: `1px solid ${colors.neutral[300]}`,
                                  }}
                                >
                                  <Text
                                    strong
                                    style={{
                                      display: 'block',
                                      marginBottom: spacing.xs,
                                      fontSize: 12,
                                      color: colors.neutral[700],
                                    }}
                                  >
                                    Submitted Code:
                                  </Text>
                                  <pre
                                    style={{
                                      margin: 0,
                                      padding: spacing.sm,
                                      background: '#ffffff',
                                      borderRadius: 4,
                                      border: `1px solid ${colors.neutral[200]}`,
                                      fontSize: 12,
                                      fontFamily: 'monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word',
                                      overflowX: 'auto',
                                      maxHeight: 400,
                                      overflowY: 'auto',
                                    }}
                                  >
                                    <code>{(message.metadata as any).code}</code>
                                  </pre>
                                </div>
                              )}
                              {(message.section ||
                                message.reference ||
                                message.metadata?.hintLevel ||
                                message.metadata?.evaluation?.score ||
                                (message.type === 'code_submission' && ((message.metadata as any)?.timeComplexity || (message.metadata as any)?.spaceComplexity))) && (
                                <div
                                  style={{
                                    marginTop: spacing.sm,
                                    paddingTop: spacing.sm,
                                    borderTop: `1px solid ${colors.neutral[200]}`,
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: spacing.xs,
                                  }}
                                >
                                  {message.section && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background:
                                          message.section === 'coding'
                                            ? '#fff2e8'
                                            : '#f9f0ff',
                                        color:
                                          message.section === 'coding'
                                            ? '#d46b08'
                                            : '#722ed1',
                                      }}
                                    >
                                      {message.section.charAt(0).toUpperCase() +
                                        message.section.slice(1)}
                                    </Tag>
                                  )}
                                  {message.reference && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background: '#e6fffb',
                                        color: '#13c2c2',
                                      }}
                                    >
                                      {message.metadata?.questionId
                                        ? `Q: ${message.reference}`
                                        : `P: ${message.reference}`}
                                    </Tag>
                                  )}
                                  {message.metadata?.hintLevel && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background: '#fff7e6',
                                        color: '#d48806',
                                      }}
                                    >
                                      Hint L{message.metadata.hintLevel}
                                    </Tag>
                                  )}
                                  {message.metadata?.evaluation?.score && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background: '#f6ffed',
                                        color: '#389e0d',
                                      }}
                                    >
                                      Score: {message.metadata.evaluation.score}%
                                    </Tag>
                                  )}
                                  {/* Display time and space complexity for code submissions */}
                                  {message.type === 'code_submission' && (message.metadata as any)?.timeComplexity && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background: '#e6f7ff',
                                        color: '#1890ff',
                                      }}
                                    >
                                      TC: {(message.metadata as any).timeComplexity}
                                    </Tag>
                                  )}
                                  {message.type === 'code_submission' && (message.metadata as any)?.spaceComplexity && (
                                    <Tag
                                      style={{
                                        fontSize: 11,
                                        padding: '2px 8px',
                                        border: 'none',
                                        background: '#e6f7ff',
                                        color: '#1890ff',
                                      }}
                                    >
                                      SC: {(message.metadata as any).spaceComplexity}
                                    </Tag>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
          </>
        ) : (
          <Empty description="Conversation history not available" />
        )}
      </Card>
            ),
          },
          {
            key: 'securityEvents',
            label: 'Security Events',
            children: (
              <Card
                title="Security Events"
                style={{ marginTop: spacing.xl }}
              >
                {interview.security_events && interview.security_events.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                    {(() => {
                      // Find any screenshot from all events
                      const eventWithScreenshot = interview.security_events.find(e => e.metadata?.screenshot);
                      
                      // Group events by type
                      const eventsByType = interview.security_events.reduce((acc, event) => {
                        if (!acc[event.event_type]) {
                          acc[event.event_type] = []
                        }
                        acc[event.event_type].push(event)
                        return acc
                      }, {} as Record<string, SecurityEvent[]>)

                      return (
                        <>
                          {/* Display screenshot at the very top if available - collapsible, open by default */}
                          {eventWithScreenshot?.metadata?.screenshot && (
                            <Collapse
                              defaultActiveKey={['screenshot']}
                              style={{ marginBottom: spacing.md }}
                              items={[{
                                key: 'screenshot',
                                label: (
                                  <Text strong style={{ fontSize: 14 }}>
                                    📸 Security Screenshot Evidence
                                  </Text>
                                ),
                                children: (
                                  <img
                                    src={eventWithScreenshot.metadata.screenshot}
                                    alt="Security violation screenshot"
                                    style={{
                                      maxWidth: '100%',
                                      maxHeight: '400px',
                                      borderRadius: 8,
                                      border: `1px solid ${colors.neutral[300]}`,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                    }}
                                    onClick={() => {
                                      // Open in new window for full size
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`
                                          <html>
                                            <head><title>Security Screenshot</title></head>
                                            <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                                              <img src="${eventWithScreenshot.metadata.screenshot}" style="max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);" />
                                            </body>
                                          </html>
                                        `);
                                      }
                                    }}
                                  />
                                )
                              }]}
                            />
                          )}
                          
                          {/* Display all warnings grouped by type */}
                          <Collapse
                            items={Object.entries(eventsByType).map(([type, events]) => {
                              const severity = events[0].severity
                              const source = events[0].source
                              const totalCount = events.length
                              
                              // Calculate total duration for this warning type
                              const totalDuration = events.reduce((sum, event) => {
                                return sum + (event.metadata?.duration || 0)
                              }, 0)
                              const totalDurationSec = Math.round(totalDuration / 1000)
                              
                              return {
                                key: type,
                                label: (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                    <Tag color={severity === 'high' ? 'red' : severity === 'medium' ? 'orange' : 'blue'}>
                                      {severity.toUpperCase()}
                                    </Tag>
                                    <Tag>{source === 'desktop_security_agent' ? 'Desktop Agent' : 'Vision Security'}</Tag>
                                    <Text strong>{type.replace(/_/g, ' ')}</Text>
                                    <Tag color="default">{totalCount} event{totalCount !== 1 ? 's' : ''}</Tag>
                                    {totalDurationSec > 0 && (
                                      <Tag color="orange">Total: {totalDurationSec}s</Tag>
                                    )}
                                  </div>
                                ),
                                children: (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                                    {/* Display all events */}
                                    {events.map((event, idx) => (
                                      <Card
                                        key={event.id}
                                        size="small"
                                        style={{
                                          borderLeft: `3px solid ${
                                            event.severity === 'high' ? colors.error.main :
                                            event.severity === 'medium' ? colors.warning.main :
                                            colors.info.main
                                          }`
                                        }}
                                      >
                                        <div>
                                          <Text strong style={{ fontSize: 13 }}>Event #{idx + 1}</Text>
                                          <div style={{ marginTop: spacing.xs }}>
                                            <Text style={{ display: 'block' }}>
                                              {event.metadata?.description || event.message}
                                            </Text>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: spacing.xs }}>
                                              {dayjs(event.created_at).format('MMM D, YYYY HH:mm:ss')}
                                            </Text>
                                            {event.metadata?.duration !== undefined && event.metadata?.duration !== null && (
                                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                                Duration: {Math.round(event.metadata.duration / 1000)}s
                                              </Text>
                                            )}
                                            {event.metadata?.firstOccurrence && event.metadata?.lastOccurrence && (
                                              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                                Time: {dayjs(event.metadata.firstOccurrence).format('HH:mm:ss')} - {dayjs(event.metadata.lastOccurrence).format('HH:mm:ss')}
                                              </Text>
                                            )}
                                          </div>
                                        </div>
                                      </Card>
                                    ))}
                                  </div>
                                )
                              }
                            })}
                          />
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <Empty description="No security events recorded" />
                )}
                {interview.cheating_incidents && interview.cheating_incidents.length > 0 && (
                  <div style={{ marginTop: spacing.xl }}>
                    <Title level={4}>Desktop Security Incidents</Title>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md }}>
                      {interview.cheating_incidents.map((incident: any, index: number) => (
                        <Card
                          key={index}
                          size="small"
                          style={{
                            borderLeft: `4px solid ${colors.error.main}`
                          }}
                        >
                          <Tag color="red">BLOCKED</Tag>
                          <Text strong style={{ display: 'block', marginTop: spacing.xs }}>
                            {incident.processName || 'Unknown Process'}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: spacing.xs }}>
                            Reason: {incident.reason || 'Suspicious activity detected'}
                          </Text>
                          {incident.timestamp && (
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: spacing.xs }}>
                              {dayjs(incident.timestamp).format('MMM D, YYYY HH:mm:ss')}
                            </Text>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ),
          },
          {
            key: 'candidateFeedback',
            label: 'Candidate Feedback',
            children: (
              <Card
                title="Candidate Feedback"
                style={{ marginTop: spacing.xl }}
              >
                {interview.candidate_feedback ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg }}>
                    {/* Overall Rating */}
                    <div>
                      <Text strong style={{ fontSize: 16, display: 'block', marginBottom: spacing.sm }}>
                        Overall Interview Experience
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                        <Rate
                          value={interview.candidate_feedback.rating}
                          disabled
                          style={{ fontSize: 24 }}
                        />
                        <Text style={{ fontSize: 16 }}>
                          {interview.candidate_feedback.rating} out of 5
                        </Text>
                      </div>
                    </div>

                    {/* Overall Experience */}
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                        Overall Experience
                      </Text>
                      <Paragraph style={{
                        background: colors.background.secondary,
                        padding: spacing.md,
                        borderRadius: 8,
                        border: `1px solid ${colors.neutral[200]}`,
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {interview.candidate_feedback.overall_experience || ''}
                      </Paragraph>
                    </div>

                    {/* Technical Questions Quality */}
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                        Technical Questions Quality
                      </Text>
                      <Paragraph style={{
                        background: colors.background.secondary,
                        padding: spacing.md,
                        borderRadius: 8,
                        border: `1px solid ${colors.neutral[200]}`,
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {interview.candidate_feedback.technical_questions_quality || ''}
                      </Paragraph>
                    </div>

                    {/* Platform Rating */}
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                        Interview Platform Rating
                      </Text>
                      {interview.candidate_feedback.interview_platform_rating ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
                          <Rate
                            value={interview.candidate_feedback.interview_platform_rating}
                            disabled
                            style={{ fontSize: 20 }}
                          />
                          <Text>
                            {interview.candidate_feedback.interview_platform_rating} out of 5
                          </Text>
                        </div>
                      ) : null}
                    </div>

                    {/* Would Recommend */}
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                        Would Recommend Platform
                      </Text>
                      {interview.candidate_feedback.would_recommend !== undefined && interview.candidate_feedback.would_recommend !== null ? (
                        <Tag color={interview.candidate_feedback.would_recommend ? 'green' : 'red'} style={{ fontSize: 14, padding: '4px 12px' }}>
                          {interview.candidate_feedback.would_recommend ? 'Yes, would recommend' : 'No, would not recommend'}
                        </Tag>
                      ) : null}
                    </div>

                    {/* Suggestions */}
                    <div>
                      <Text strong style={{ fontSize: 14, display: 'block', marginBottom: spacing.sm }}>
                        Suggestions for Improvement
                      </Text>
                      <Paragraph style={{
                        background: colors.background.secondary,
                        padding: spacing.md,
                        borderRadius: 8,
                        border: `1px solid ${colors.neutral[200]}`,
                        margin: 0,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {interview.candidate_feedback.suggestions || ''}
                      </Paragraph>
                    </div>

                    {/* Timestamp */}
                    <div style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTop: `1px solid ${colors.neutral[200]}` }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Submitted on {dayjs(interview.candidate_feedback.created_at).format('MMM D, YYYY HH:mm:ss')}
                      </Text>
                    </div>
                  </div>
                ) : (
                  <Empty
                    description="No feedback submitted"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  >
                    <Text type="secondary">
                      The candidate has not submitted feedback for this interview.
                    </Text>
                  </Empty>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

