import React from 'react';
import {
  Card,
  Typography,
  Row,
  Col,
  Tag,
  Progress,
  Table,
  Collapse,
  Grid,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '../styles';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { useBreakpoint } = Grid;

interface QuestionBreakdown {
  questionId: string;
  question: string;
  score: number;
  feedback: string;
  keyPointsCovered: string[];
  timeTaken?: number;
  hintsUsed?: number;
}

interface CodeReview {
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface TestResult {
  passed: boolean;
  input: string;
  expectedOutput: string;
  actualOutput: string;
}

interface ProblemBreakdown {
  problemId: string;
  problem: string;
  score: number;
  feedback: string;
  codeReview?: CodeReview;
  testResults?: TestResult[];
  timeComplexity?: string;
  spaceComplexity?: string;
  timeTaken?: number;
  hintsUsed?: number;
}

interface DetailedEvaluation {
  theoreticalSection?: {
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    questionBreakdown?: QuestionBreakdown[];
  };
  codingSection?: {
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    problemBreakdown?: ProblemBreakdown[];
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
}

interface DetailedFeedbackSheetProps {
  evaluation: DetailedEvaluation;
  candidateName?: string;
  interviewDate?: string;
}

export const DetailedFeedbackSheet: React.FC<DetailedFeedbackSheetProps> = ({
  evaluation,
  candidateName,
  interviewDate,
}) => {
  const screens = useBreakpoint();
  // Use xxl padding for screens below 1200px, xxl * 2 for 1200px and above
  const containerPadding = screens.xl ? spacing.xxl * 2 : spacing.xxl;

  // Get color for score with gradient: red -> yellow -> green
  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#52c41a'; // Green
    if (score >= 70) return '#73d13d'; // Light green
    if (score >= 60) return '#faad14'; // Yellow/Orange
    if (score >= 50) return '#ff7a45'; // Orange
    return '#ff4d4f'; // Red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Acceptable';
    if (score >= 60) return 'Below Average';
    return 'Needs Improvement';
  };

  // Format seconds to minutes and seconds
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  // Circular progress component for scores
  const ScoreCircle: React.FC<{ score: number; size?: number; showLabel?: boolean; noMargin?: boolean }> = ({ 
    score, 
    size = 120,
    showLabel = true,
    noMargin = false
  }) => {
    const strokeColor = getScoreColor(score);
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        margin: noMargin ? 0 : spacing.md,
      }}>
        <Progress
          type="circle"
          percent={score}
          size={size}
          strokeColor={strokeColor}
          format={(percent) => (
            <div style={{ 
              fontSize: size * 0.3, 
              fontWeight: 600,
              color: strokeColor,
              lineHeight: 1
            }}>
              {percent}
            </div>
          )}
          strokeWidth={8}
        />
        {showLabel && (
          <Text 
            strong 
            style={{ 
              fontSize: 12, 
              color: strokeColor,
              textAlign: 'center',
              marginTop: spacing.xs
            }}
          >
            {getScoreLabel(score)}
          </Text>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: containerPadding, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: spacing.lg,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={16}>
            <Title level={2} style={{ margin: 0, marginBottom: spacing.sm, fontWeight: 600 }}>
              Detailed Interview Feedback
            </Title>
            {candidateName && (
              <div style={{ marginBottom: spacing.xs }}>
                <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>
                  Candidate: <Text strong style={{ color: colors.neutral[800] }}>{candidateName}</Text>
                </Text>
              </div>
            )}
            {interviewDate && (
              <div>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  Interview Date: <Text strong>{interviewDate}</Text>
                </Text>
              </div>
            )}
          </Col>
          <Col xs={24} md={8} style={{ display: 'flex', justifyContent: 'center' }}>
            <ScoreCircle score={evaluation.overall.score} size={100} />
          </Col>
        </Row>
      </Card>

      {/* Summary Statistics */}
      {evaluation.summaryStatistics && (
        <Card 
          title={<span style={{ fontSize: 18, fontWeight: 600 }}>Summary Statistics</span>}
          style={{ 
            marginBottom: spacing.lg,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center', padding: spacing.md, background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#faad14', marginBottom: spacing.xs }}>
                  <BulbOutlined style={{ marginRight: spacing.xs }} />
                  {evaluation.summaryStatistics.totalHints}
                </div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Total Hints</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center', padding: spacing.md, background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: colors.neutral[700], marginBottom: spacing.xs }}>
                  {evaluation.summaryStatistics.totalClarifications}
                </div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Clarifications</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center', padding: spacing.md, background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: colors.neutral[700], marginBottom: spacing.xs }}>
                  {evaluation.summaryStatistics.totalFollowUps}
                </div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Follow-ups</Text>
              </div>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center', padding: spacing.md, background: '#fafafa', borderRadius: 8 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: colors.neutral[700], marginBottom: spacing.xs }}>
                  <ClockCircleOutlined style={{ marginRight: spacing.xs }} />
                  {formatTime(evaluation.summaryStatistics.averageTimePerQuestion)}
                </div>
                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>Avg Time/Question</Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* Overall Assessment */}
      <Card 
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>Overall Assessment</span>}
        style={{ 
          marginBottom: spacing.lg,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
        }}
      >
        <Paragraph style={{ 
          fontSize: 15, 
          lineHeight: 1.8,
          color: colors.neutral[700],
          marginBottom: spacing.lg,
          padding: spacing.md,
          background: '#fafafa',
          borderRadius: 8
        }}>
          {evaluation.overall.feedback}
        </Paragraph>
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#f6ffed', 
              borderRadius: 8,
              border: `1px solid ${colors.success.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.success.dark, 
                marginBottom: spacing.sm,
                fontSize: 16,
                fontWeight: 600
              }}>
                Strengths
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.overall.strengths.map((strength, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.success.main,
                      fontWeight: 'bold'
                    }}>✓</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{strength}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#fff7e6', 
              borderRadius: 8,
              border: `1px solid ${colors.warning.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.warning.dark, 
                marginBottom: spacing.sm,
                fontSize: 16,
                fontWeight: 600
              }}>
                Areas for Improvement
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.overall.areasForImprovement.map((area, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.warning.main,
                      fontWeight: 'bold'
                    }}>→</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{area}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
        </Row>
        {evaluation.overall.learningRecommendations && evaluation.overall.learningRecommendations.length > 0 && (
          <div style={{ 
            marginTop: spacing.lg,
            padding: spacing.md,
            background: '#e6f7ff',
            borderRadius: 8,
            border: `1px solid ${colors.primary.light}`
          }}>
            <Title level={5} style={{ 
              color: colors.primary.dark, 
              marginBottom: spacing.sm,
              fontSize: 16,
              fontWeight: 600
            }}>
              Learning Recommendations
            </Title>
            <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
              {evaluation.overall.learningRecommendations.map((rec, idx) => (
                <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                  <span style={{ 
                    position: 'absolute', 
                    left: 0, 
                    color: colors.primary.main,
                    fontWeight: 'bold'
                  }}>•</span>
                  <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{rec}</Text>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Theoretical Section */}
      {evaluation.theoreticalSection && (
        <Card
          title={<span style={{ fontSize: 18, fontWeight: 600 }}>Theoretical Section</span>}
          style={{ 
            marginBottom: spacing.lg,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
          extra={
            <ScoreCircle score={evaluation.theoreticalSection.score} size={60}/>
          }
        >
        <Paragraph style={{ 
          fontSize: 15, 
          lineHeight: 1.8,
          color: colors.neutral[700],
          marginBottom: spacing.lg,
          padding: spacing.md,
          background: '#fafafa',
          borderRadius: 8
        }}>
          {evaluation.theoreticalSection.feedback}
        </Paragraph>
        <Row gutter={[24, 24]} style={{ marginBottom: spacing.lg }}>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#f6ffed', 
              borderRadius: 8,
              border: `1px solid ${colors.success.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.success.dark, 
                marginBottom: spacing.sm,
                fontSize: 15,
                fontWeight: 600
              }}>
                Strengths
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.theoreticalSection.strengths.map((strength, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.success.main,
                      fontWeight: 'bold'
                    }}>✓</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{strength}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#fff7e6', 
              borderRadius: 8,
              border: `1px solid ${colors.warning.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.warning.dark, 
                marginBottom: spacing.sm,
                fontSize: 15,
                fontWeight: 600
              }}>
                Areas for Improvement
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.theoreticalSection.areasForImprovement.map((area, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.warning.main,
                      fontWeight: 'bold'
                    }}>→</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{area}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
        </Row>

        {/* Question Breakdown */}
        {evaluation.theoreticalSection.questionBreakdown &&
          evaluation.theoreticalSection.questionBreakdown.length > 0 && (
            <div style={{ marginTop: spacing.xl }}>
              <style>{`
                .question-collapse .ant-collapse-expand-icon {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                }
                .question-collapse .ant-collapse-header {
                  padding: 6px 12px !important;
                  min-height: auto !important;
                  line-height: 1.2 !important;
                }
                .question-collapse .ant-collapse-header > div {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .problem-collapse .ant-collapse-expand-icon {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100%;
                }
                .problem-collapse .ant-collapse-header {
                  padding: 6px 12px !important;
                  min-height: auto !important;
                  line-height: 1.2 !important;
                }
                .problem-collapse .ant-collapse-header > div {
                  margin: 0 !important;
                  padding: 0 !important;
                }
              `}</style>
              <Title level={4} style={{ fontSize: 18, fontWeight: 600, marginBottom: spacing.md }}>
                Per Question Breakdown
              </Title>
              <Collapse
                size="small"
                className="question-collapse"
                style={{ background: 'transparent' }}
                expandIconPosition="end"
                expandIcon={({ isActive }) => (
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                      }}
                    >
                      <path
                        d="M4.5 3L7.5 6L4.5 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              >
                {evaluation.theoreticalSection.questionBreakdown.map((q, idx) => (
                  <Panel
                    key={q.questionId || idx}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', margin: 0, padding: 0 }}>
                        <Text strong style={{ fontSize: 14, lineHeight: 1.2 }}>Question {idx + 1}</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, margin: 0, marginLeft: spacing.md }}>
                          <ScoreCircle score={q.score} size={32} showLabel={false} noMargin={true} />
                        </div>
                        {q.hintsUsed !== undefined && q.hintsUsed > 0 && (
                          <Tag icon={<BulbOutlined />} color="warning" style={{ margin: 0, fontSize: 12, lineHeight: 1.2, padding: '2px 8px' }}>
                            {q.hintsUsed} hint{q.hintsUsed > 1 ? 's' : ''}
                          </Tag>
                        )}
                        {q.timeTaken !== undefined && (
                          <Tag icon={<ClockCircleOutlined />} style={{ margin: 0, fontSize: 12, lineHeight: 1.2, padding: '2px 8px' }}>
                            {formatTime(q.timeTaken)}
                          </Tag>
                        )}
                      </div>
                    }
                    style={{ 
                      borderRadius: 8,
                      border: '1px solid #e8e8e8'
                    }}
                  >
                    <div style={{ padding: spacing.sm }}>
                      <Paragraph style={{ marginBottom: spacing.md }}>
                        <Text strong style={{ fontSize: 14, color: colors.neutral[800] }}>Question: </Text>
                        <Text style={{ fontSize: 14, lineHeight: 1.7 }}>{q.question}</Text>
                      </Paragraph>
                      <Paragraph style={{ marginBottom: spacing.md }}>
                        <Text strong style={{ fontSize: 14, color: colors.neutral[800] }}>Feedback: </Text>
                        <Text style={{ fontSize: 14, lineHeight: 1.7, color: colors.neutral[700] }}>{q.feedback}</Text>
                      </Paragraph>
                      {q.keyPointsCovered && q.keyPointsCovered.length > 0 && (
                        <div style={{ marginTop: spacing.md }}>
                          <Text strong style={{ fontSize: 14, color: colors.neutral[800], display: 'block', marginBottom: spacing.xs }}>
                            Key Points Covered:
                          </Text>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
                            {q.keyPointsCovered.map((point, pIdx) => (
                              <Tag key={pIdx} color="success" style={{ margin: 0, fontSize: 13, padding: '4px 12px' }}>
                                {point}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Panel>
                ))}
              </Collapse>
            </div>
          )}
        </Card>
      )}

      {/* Coding Section */}
      {evaluation.codingSection && (
        <Card
          title={<span style={{ fontSize: 18, fontWeight: 600 }}>Coding Section</span>}
          style={{ 
            marginBottom: spacing.lg,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
          extra={
            <ScoreCircle score={evaluation.codingSection.score} size={60} />
          }
        >
        <Paragraph style={{ 
          fontSize: 15, 
          lineHeight: 1.8,
          color: colors.neutral[700],
          marginBottom: spacing.lg,
          padding: spacing.md,
          background: '#fafafa',
          borderRadius: 8
        }}>
          {evaluation.codingSection.feedback}
        </Paragraph>
        <Row gutter={[24, 24]} style={{ marginBottom: spacing.lg }}>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#f6ffed', 
              borderRadius: 8,
              border: `1px solid ${colors.success.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.success.dark, 
                marginBottom: spacing.sm,
                fontSize: 15,
                fontWeight: 600
              }}>
                Strengths
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.codingSection.strengths.map((strength, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.success.main,
                      fontWeight: 'bold'
                    }}>✓</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{strength}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
          <Col xs={24} md={12}>
            <div style={{ 
              padding: spacing.md, 
              background: '#fff7e6', 
              borderRadius: 8,
              border: `1px solid ${colors.warning.light}`
            }}>
              <Title level={5} style={{ 
                color: colors.warning.dark, 
                marginBottom: spacing.sm,
                fontSize: 15,
                fontWeight: 600
              }}>
                Areas for Improvement
              </Title>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: 'none' }}>
                {evaluation.codingSection.areasForImprovement.map((area, idx) => (
                  <li key={idx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                    <span style={{ 
                      position: 'absolute', 
                      left: 0, 
                      color: colors.warning.main,
                      fontWeight: 'bold'
                    }}>→</span>
                    <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{area}</Text>
                  </li>
                ))}
              </ul>
            </div>
          </Col>
        </Row>

        {/* Problem Breakdown */}
        {evaluation.codingSection.problemBreakdown &&
          evaluation.codingSection.problemBreakdown.length > 0 && (
            <div style={{ marginTop: spacing.xl }}>
              <Title level={4} style={{ fontSize: 18, fontWeight: 600, marginBottom: spacing.md }}>
                Problem-by-Problem Breakdown
              </Title>
              <Collapse
                size="small"
                className="problem-collapse"
                style={{ background: 'transparent' }}
                expandIconPosition="end"
                expandIcon={({ isActive }) => (
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%'
                  }}>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s',
                      }}
                    >
                      <path
                        d="M4.5 3L7.5 6L4.5 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                )}
              >
                {evaluation.codingSection.problemBreakdown.map((p, idx) => (
                  <Panel
                    key={p.problemId || idx}
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', margin: 0, padding: 0 }}>
                        <Text strong style={{ fontSize: 14, lineHeight: 1.2 }}>Problem {idx + 1}</Text>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, margin: 0, marginLeft: spacing.md }}>
                          <ScoreCircle score={p.score} size={32} showLabel={false} noMargin={true} />
                        </div>
                        {p.hintsUsed !== undefined && p.hintsUsed > 0 && (
                          <Tag icon={<BulbOutlined />} color="warning" style={{ margin: 0, fontSize: 12, lineHeight: 1.2, padding: '2px 8px' }}>
                            {p.hintsUsed} hint{p.hintsUsed > 1 ? 's' : ''}
                          </Tag>
                        )}
                        {p.timeTaken !== undefined && (
                          <Tag icon={<ClockCircleOutlined />} style={{ margin: 0, fontSize: 12, lineHeight: 1.2, padding: '2px 8px' }}>
                            {formatTime(p.timeTaken)}
                          </Tag>
                        )}
                      </div>
                    }
                    style={{ 
                      marginBottom: spacing.sm,
                      borderRadius: 8,
                      border: '1px solid #e8e8e8'
                    }}
                  >
                    <div style={{ padding: spacing.sm }}>
                      <Paragraph style={{ marginBottom: spacing.md }}>
                        <Text strong style={{ fontSize: 14, color: colors.neutral[800] }}>Problem: </Text>
                        <Text style={{ fontSize: 14, lineHeight: 1.7 }}>{p.problem}</Text>
                      </Paragraph>
                      <Paragraph style={{ marginBottom: spacing.md }}>
                        <Text strong style={{ fontSize: 14, color: colors.neutral[800] }}>Feedback: </Text>
                        <Text style={{ fontSize: 14, lineHeight: 1.7, color: colors.neutral[700] }}>{p.feedback}</Text>
                      </Paragraph>
                      {(p.timeComplexity || p.spaceComplexity) && (
                        <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.md, flexWrap: 'wrap' }}>
                          {p.timeComplexity && (
                            <div>
                              <Text strong style={{ fontSize: 13, color: colors.neutral[700] }}>Time: </Text>
                              <Tag color="blue" style={{ fontSize: 13 }}>{p.timeComplexity}</Tag>
                            </div>
                          )}
                          {p.spaceComplexity && (
                            <div>
                              <Text strong style={{ fontSize: 13, color: colors.neutral[700] }}>Space: </Text>
                              <Tag color="purple" style={{ fontSize: 13 }}>{p.spaceComplexity}</Tag>
                            </div>
                          )}
                        </div>
                      )}
                    {p.codeReview && (
                      <div style={{ 
                        marginTop: spacing.md,
                        padding: spacing.md,
                        background: '#fafafa',
                        borderRadius: 8
                      }}>
                        <Title level={5} style={{ fontSize: 15, fontWeight: 600, marginBottom: spacing.md }}>
                          Code Review
                        </Title>
                        {p.codeReview.strengths && p.codeReview.strengths.length > 0 && (
                          <div style={{ marginBottom: spacing.md }}>
                            <Text strong style={{ color: colors.success.dark, fontSize: 14 }}>Strengths: </Text>
                            <ul style={{ margin: spacing.xs, paddingLeft: 20, listStyle: 'none' }}>
                              {p.codeReview.strengths.map((s, sIdx) => (
                                <li key={sIdx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                                  <span style={{ 
                                    position: 'absolute', 
                                    left: 0, 
                                    color: colors.success.main,
                                    fontWeight: 'bold'
                                  }}>✓</span>
                                  <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{s}</Text>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {p.codeReview.weaknesses && p.codeReview.weaknesses.length > 0 && (
                          <div style={{ marginBottom: spacing.md }}>
                            <Text strong style={{ color: colors.error.dark, fontSize: 14 }}>Weaknesses: </Text>
                            <ul style={{ margin: spacing.xs, paddingLeft: 20, listStyle: 'none' }}>
                              {p.codeReview.weaknesses.map((w, wIdx) => (
                                <li key={wIdx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                                  <span style={{ 
                                    position: 'absolute', 
                                    left: 0, 
                                    color: colors.error.main,
                                    fontWeight: 'bold'
                                  }}>✗</span>
                                  <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{w}</Text>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {p.codeReview.suggestions && p.codeReview.suggestions.length > 0 && (
                          <div>
                            <Text strong style={{ fontSize: 14, color: colors.primary.dark }}>Suggestions: </Text>
                            <ul style={{ margin: spacing.xs, paddingLeft: 20, listStyle: 'none' }}>
                              {p.codeReview.suggestions.map((s, sIdx) => (
                                <li key={sIdx} style={{ marginBottom: spacing.xs, position: 'relative', paddingLeft: 20 }}>
                                  <span style={{ 
                                    position: 'absolute', 
                                    left: 0, 
                                    color: colors.primary.main,
                                    fontWeight: 'bold'
                                  }}>•</span>
                                  <Text style={{ fontSize: 14, lineHeight: 1.6 }}>{s}</Text>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                    {p.testResults && p.testResults.length > 0 && (
                      <div style={{ marginTop: spacing.md }}>
                        <Title level={5}>Test Results</Title>
                        <Table
                          dataSource={p.testResults.map((t, tIdx) => ({ ...t, key: tIdx }))}
                          columns={[
                            {
                              title: 'Status',
                              dataIndex: 'passed',
                              key: 'passed',
                              render: (passed) => (
                                passed ? (
                                  <Tag icon={<CheckCircleOutlined />} color="success">Passed</Tag>
                                ) : (
                                  <Tag icon={<CloseCircleOutlined />} color="error">Failed</Tag>
                                )
                              ),
                            },
                            {
                              title: 'Input',
                              dataIndex: 'input',
                              key: 'input',
                              render: (text) => <Text code>{text}</Text>,
                            },
                            {
                              title: 'Expected',
                              dataIndex: 'expectedOutput',
                              key: 'expectedOutput',
                              render: (text) => <Text code>{text}</Text>,
                            },
                            {
                              title: 'Actual',
                              dataIndex: 'actualOutput',
                              key: 'actualOutput',
                              render: (text) => <Text code>{text}</Text>,
                            },
                          ]}
                          pagination={false}
                          size="small"
                        />
                      </div>
                    )}
                    </div>
                  </Panel>
                ))}
              </Collapse>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

