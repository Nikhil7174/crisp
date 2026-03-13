import React from 'react';
import {
  Typography,
  Row,
  Col,
  Tag,
  Progress,
  Table,
  Collapse,
  Grid,
} from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import {
  User,
  Calendar,
  Lightbulb,
  HelpCircle,
  MessageSquare,
  Clock,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  BookOpen,
  Code2,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { spacing } from '../styles';
import { useAuth } from '../hooks/useAuth';
import shakraLogo from '../assets/images/shakra.png';

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
  clarificationsUsed?: number;
  followUpsUsed?: number;
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
  role?: string;
  companyName?: string;
  companyLogo?: string;
}

// Design tokens
const dt = {
  // Core palette
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',

  // Accent
  indigo600: '#4F46E5',
  indigo100: '#C7D2FE',
  indigo50: '#EEF2FF',

  // Semantic
  emerald700: '#047857',
  emerald600: '#059669',
  emerald100: '#D1FAE5',
  emerald50: '#ECFDF5',

  amber700: '#B45309',
  amber600: '#D97706',
  amber100: '#FEF3C7',
  amber50: '#FFFBEB',

  red700: '#B91C1C',
  red600: '#DC2626',
  red100: '#FEE2E2',
  red50: '#FEF2F2',

  blue700: '#1D4ED8',
  blue600: '#2563EB',
  blue100: '#DBEAFE',
  blue50: '#EFF6FF',

  // Border
  border: '#E2E8F0',
  borderLight: '#F1F5F9',

  // Typography
  fontMono: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`,
};

export const DetailedFeedbackSheet: React.FC<DetailedFeedbackSheetProps> = ({
  evaluation,
  candidateName,
  interviewDate,
  role,
  companyName: propCompanyName,
  companyLogo: propCompanyLogo,
}) => {
  const { user } = useAuth();
  const screens = useBreakpoint();
  const containerHorizontalPadding = screens.xl ? spacing.md : spacing.sm;
  const containerVerticalPadding = screens.xl ? spacing.sm : spacing.xs;

  // Label visibility state - controls which labels to show
  const [showHints, setShowHints] = React.useState(true);
  const [showClarifications, setShowClarifications] = React.useState(false);
  const [showFollowUps, setShowFollowUps] = React.useState(false);

  // Get company name and logo from props (for demo) or user profile, with fallback
  // Default brand: Shakra AI
  const companyName = propCompanyName || user?.company || 'Shakra AI';
  const companyLogo = propCompanyLogo || (user as any)?.company_logo_url || (user as any)?.companyLogoUrl || shakraLogo;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return dt.emerald600; // Green
    if (score >= 70) return dt.amber600; // Orange (changed from green to orange for better distinction)
    if (score >= 60) return dt.amber600; // Orange
    if (score >= 50) return '#ea580c'; // Orange/Red
    return dt.red600; // Red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return { label: 'Outstanding', bg: dt.emerald50, color: dt.emerald700, description: 'Top-tier performance. Clear hire signal.' };
    if (score >= 80) return { label: 'Strong Hire', bg: dt.emerald50, color: dt.emerald700, description: 'Solid performance with minor gaps.' };
    if (score >= 70) return { label: 'Competent', bg: dt.amber50, color: dt.amber700, description: 'Meets expectations but lacks depth.' };
    if (score >= 60) return { label: 'Developing', bg: dt.amber50, color: dt.amber700, description: 'Partial understanding; improvement needed.' };
    return { label: 'Insufficient', bg: dt.red50, color: dt.red700, description: '' };
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Compact circular score badge
  const ScoreCircle: React.FC<{ score: number; size?: number; showLabel?: boolean; noMargin?: boolean }> = ({
    score,
    size = 120,
    showLabel = true,
    noMargin = false,
  }) => {
    const roundedScore = Math.round(score); // Round score for display
    const strokeColor = getScoreColor(roundedScore);
    const { label, bg, color } = getScoreLabel(roundedScore);
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        margin: noMargin ? 0 : spacing.md,
      }}>
        <Progress
          type="circle"
          percent={roundedScore}
          size={size}
          strokeColor={strokeColor}
          trailColor={dt.slate200}
          format={(percent) => (
            <span style={{
              fontSize: size * 0.28,
              fontWeight: 700,
              color: strokeColor,
              lineHeight: 1,
              letterSpacing: '-0.5px',
            }}>
              {Math.round(percent || 0)}
            </span>
          )}
          strokeWidth={11}
        />
        {showLabel && (
          <span style={{
            display: 'inline-block',
            marginTop: 4,
            padding: '2px 8px',
            borderRadius: 20,
            background: bg,
            color,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.3px',
          }}>
            {label}
          </span>
        )}
      </div>
    );
  };

  // Reusable section card
  const SectionCard: React.FC<{
    title: string;
    icon: React.ReactNode;
    accentColor: string;
    score: number;
    feedback: string;
    strengths: string[];
    areasForImprovement: string[];
    children?: React.ReactNode;
  }> = ({ title, icon, accentColor, score, feedback, strengths, areasForImprovement, children }) => (
    <div style={{
      marginBottom: 12,
      borderRadius: 10,
      background: '#FFFFFF',
      border: `1px solid ${dt.border}`,
      boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: `1px solid ${dt.border}`,
        background: dt.slate50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 6,
            background: accentColor + '18',
            color: accentColor,
          }}>
            {icon}
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: dt.slate800, letterSpacing: '-0.2px' }}>
            {title}
          </span>
        </div>
        <ScoreCircle score={score} size={40} showLabel={false} noMargin />
      </div>

      {/* Card body */}
      <div style={{ padding: '14px 16px' }}>
        {/* Feedback block */}
        <div style={{
          marginBottom: 12,
          padding: '10px 14px',
          background: dt.slate50,
          borderRadius: 8,
          borderLeft: `3px solid ${dt.slate200}`,
        }}>
          <p style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.65,
            color: dt.slate700,
          }}>
            {feedback}
          </p>
        </div>

        {/* Strengths & Areas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {/* Strengths */}
          <div style={{
            padding: '10px 14px',
            background: dt.emerald50,
            borderRadius: 8,
            border: `1px solid ${dt.emerald100}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingUp size={13} color={dt.emerald700} strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: dt.emerald700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Strengths
              </span>
            </div>
            {strengths.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: dt.slate500, fontStyle: 'italic' }}>None noted</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {strengths.map((s, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <CheckCircle2 size={13} color={dt.emerald600} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, lineHeight: 1.55, color: dt.slate700 }}>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Areas for improvement */}
          <div style={{
            padding: '10px 14px',
            background: dt.amber50,
            borderRadius: 8,
            border: `1px solid ${dt.amber100}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <AlertTriangle size={13} color={dt.amber700} strokeWidth={2.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: dt.amber700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Areas for Improvement
              </span>
            </div>
            {areasForImprovement.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: dt.slate500, fontStyle: 'italic' }}>None noted</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {areasForImprovement.map((a, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                    <ArrowRight size={13} color={dt.amber600} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, lineHeight: 1.55, color: dt.slate700 }}>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {children}
      </div>
    </div>
  );

  const collapseExpandIcon = ({ isActive }: { isActive?: boolean }) => (
    <ChevronRight
      size={14}
      color={dt.slate500}
      strokeWidth={2}
      style={{
        transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease',
        flexShrink: 0,
      }}
    />
  );

  return (
    <div style={{
      maxWidth: 720,
      margin: '0 auto',
      paddingRight: containerHorizontalPadding,
      paddingLeft: containerHorizontalPadding,
      paddingTop: containerVerticalPadding,
      paddingBottom: containerVerticalPadding,
      background: 'transparent',
      minHeight: '100vh',
      fontFamily: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
    }}>

      {/* Global collapse overrides */}
      <style>{`
        .ef-collapse .ant-collapse-item {
          border-radius: 8px !important;
          border: 1px solid ${dt.border} !important;
          overflow: hidden;
          margin-bottom: 6px !important;
        }
        .ef-collapse .ant-collapse-item:last-child {
          margin-bottom: 0 !important;
        }
        .ef-collapse .ant-collapse-header {
          padding: 8px 12px !important;
          background: ${dt.slate50} !important;
          align-items: center !important;
        }
        .ef-collapse .ant-collapse-header:hover {
          background: ${dt.slate100} !important;
        }
        .ef-collapse .ant-collapse-content-box {
          padding: 12px 14px !important;
        }
        .ef-collapse .ant-collapse-expand-icon {
          display: flex;
          align-items: center;
          padding-inline-end: 4px !important;
        }
      `}</style>

      {/* ── Header Card ───────────────────────────────────────────── */}
      <div style={{
        marginBottom: 12,
        borderRadius: 10,
        background: '#FFFFFF',
        border: `1px solid ${dt.border}`,
        boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        overflow: 'hidden',
        alignItems: 'center',
      }}>
        {/* Top accent strip */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${dt.indigo600} 0%, #7C3AED 100%)` }} />

        <div style={{ padding: '14px 20px 12px', alignItems: 'center' }}>
          <Row gutter={[12, 8]} align="middle">
            {/* Left Side */}
            <Col flex="auto">
              {/* Left Side Layout */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Component 1: Logo and Company Name together */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={companyLogo}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        height: 40,
                        width: 40,
                        borderRadius: 6,
                        overflow: 'hidden',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f3f4f6',
                      }}
                    >
                      <img
                        src={companyLogo}
                        alt="Company Logo"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = shakraLogo;
                        }}
                      />
                    </motion.div>
                  </AnimatePresence>

                  <AnimatePresence mode="wait">
                    <motion.span
                      key={companyName}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: dt.slate700,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {companyName}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Component 2: Heading, Candidate Info */}
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 700,
                    color: dt.slate900,
                    letterSpacing: '-0.4px',
                    lineHeight: 1.2,
                    marginBottom: 4,
                  }}>
                    {role ? `${role} Interview` : 'Detailed Interview Feedback'}
                  </h2>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: screens.md ? 12 : 4, alignItems: 'center' }}>
                    {candidateName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <User size={12} color={dt.slate500} strokeWidth={2} />
                        <span style={{ fontSize: 12.5, color: dt.slate500 }}>
                          Candidate:{' '}
                          <span style={{ fontWeight: 600, color: dt.slate800 }}>{candidateName}</span>
                        </span>
                      </div>
                    )}
                    {interviewDate && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={12} color={dt.slate500} strokeWidth={2} />
                        <span style={{ fontSize: 12.5, color: dt.slate500 }}>
                          Interview Date:{' '}
                          <span style={{ fontWeight: 600, color: dt.slate800 }}>{interviewDate}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Col>

            {/* Right Side: Evaluation Score */}
            <Col>
              <ScoreCircle score={Math.round(evaluation.overall.score)} size={50} noMargin />
            </Col>
          </Row>
        </div>

        {/* Summary Statistics */}
        {evaluation.summaryStatistics && (
          <>
            <div style={{
              margin: '0 20px',
              borderTop: `1px solid ${dt.border}`,
            }} />
            <div style={{ padding: '12px 20px 14px' }}>
              {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: dt.slate500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.7px',
                }}>
                  Summary Statistics
                </span>
              </div> */}
              <Row gutter={[10, 8]}>
                {[
                  {
                    icon: <Lightbulb size={14} strokeWidth={2} />,
                    value: evaluation.summaryStatistics.totalHints,
                    label: 'Total Hints',
                    iconColor: dt.amber600,
                    iconBg: dt.amber50,
                    isClickable: true,
                    isSelected: showHints,
                    onClick: () => setShowHints(!showHints),
                  },
                  {
                    icon: <HelpCircle size={12} strokeWidth={2} />,
                    value: evaluation.summaryStatistics.totalClarifications,
                    label: 'Clarifications',
                    iconColor: dt.blue600,
                    iconBg: dt.blue50,
                    isClickable: true,
                    isSelected: showClarifications,
                    onClick: () => setShowClarifications(!showClarifications),
                  },
                  {
                    icon: <MessageSquare size={12} strokeWidth={2} />,
                    value: evaluation.summaryStatistics.totalFollowUps,
                    label: 'Follow-ups',
                    iconColor: dt.indigo600,
                    iconBg: dt.indigo50,
                    isClickable: true,
                    isSelected: showFollowUps,
                    onClick: () => setShowFollowUps(!showFollowUps),
                  },
                  {
                    icon: <Clock size={12} strokeWidth={2} />,
                    value: `${(evaluation.summaryStatistics.averageTimePerQuestion / 60).toFixed(1)}m`,
                    label: 'Avg Time/Question',
                    iconColor: dt.slate600,
                    iconBg: dt.slate100,
                    isClickable: false,
                    isSelected: false,
                    onClick: undefined,
                  },
                ].map(({ icon, value, label, iconColor, iconBg, isClickable, isSelected, onClick }) => (
                  <Col xs={12} sm={6} key={label}>
                    <div
                      onClick={isClickable ? onClick : undefined}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '10px 8px',
                        background: '#FFFFFF',
                        border: `1px solid ${dt.border}`,
                        borderRadius: 8,
                        gap: 4,
                        cursor: isClickable ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (isClickable) {
                          e.currentTarget.style.background = dt.slate50;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isClickable) {
                          e.currentTarget.style.background = '#FFFFFF';
                        }
                      }}
                    >
                      {isClickable && (
                        <div style={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <CheckCircle2
                            size={14}
                            color={isSelected ? dt.emerald600 : dt.slate200}
                            strokeWidth={2.5}
                            fill={isSelected ? dt.emerald50 : dt.slate50}
                          />
                        </div>
                      )}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: iconBg,
                          color: iconColor,
                          flexShrink: 0,
                          border: `1px solid ${iconColor}20`,
                        }}>
                          {icon}
                        </div>
                        <span style={{
                          fontSize: 20,
                          fontWeight: 700,
                          color: dt.slate900,
                          lineHeight: 1,
                          letterSpacing: '-0.5px',
                        }}>
                          {value}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 11,
                        color: dt.slate500,
                        fontWeight: 500,
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}>
                        {label}
                      </span>
                    </div>
                  </Col>
                ))}
              </Row>
            </div>
          </>
        )}
      </div>

      {/* ── Theoretical Section ───────────────────────────────────── */}
      {evaluation.theoreticalSection && (
        <SectionCard
          title="Theoretical Section"
          icon={<BookOpen size={15} strokeWidth={2} />}
          accentColor={dt.indigo600}
          score={Math.round(evaluation.theoreticalSection.score)}
          feedback={evaluation.theoreticalSection.feedback}
          strengths={evaluation.theoreticalSection.strengths}
          areasForImprovement={evaluation.theoreticalSection.areasForImprovement}
        >
          {evaluation.theoreticalSection.questionBreakdown &&
            evaluation.theoreticalSection.questionBreakdown.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: dt.slate500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}>
                    Per Question Breakdown
                  </span>
                </div>
                <Collapse
                  size="small"
                  className="ef-collapse"
                  style={{ background: 'transparent', border: 'none' }}
                  expandIconPosition="end"
                  expandIcon={collapseExpandIcon}
                >
                  {evaluation.theoreticalSection.questionBreakdown.map((q, idx) => (
                    <Panel
                      key={q.questionId || idx}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: dt.slate800 }}>
                            Question {idx + 1}
                          </span>
                          <ScoreCircle score={Math.round(q.score)} size={30} showLabel={false} noMargin />
                          {q.timeTaken !== undefined && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.slate100, border: `1px solid ${dt.slate200}`,
                              fontSize: 11, fontWeight: 500, color: dt.slate600,
                              minWidth: '68px',
                              justifyContent: 'center',
                            }}>
                              <Clock size={10} strokeWidth={2.5} />
                              {formatTime(q.timeTaken)}
                            </span>
                          )}
                          {showHints && q.hintsUsed !== undefined && q.hintsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.amber50, border: `1px solid ${dt.amber100}`,
                              fontSize: 11, fontWeight: 600, color: dt.amber700,
                            }}>
                              <Lightbulb size={10} strokeWidth={2.5} />
                              {q.hintsUsed}
                            </span>
                          )}
                          {showClarifications && q.clarificationsUsed !== undefined && q.clarificationsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.blue50, border: `1px solid ${dt.blue100}`,
                              fontSize: 11, fontWeight: 600, color: dt.blue700,
                            }}>
                              <HelpCircle size={10} strokeWidth={2.5} />
                              {q.clarificationsUsed}
                            </span>
                          )}
                          {showFollowUps && q.followUpsUsed !== undefined && q.followUpsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.indigo50, border: `1px solid ${dt.indigo100}`,
                              fontSize: 11, fontWeight: 600, color: dt.indigo600,
                            }}>
                              <MessageSquare size={10} strokeWidth={2.5} />
                              {q.followUpsUsed}
                            </span>
                          )}
                        </div>
                      }
                      style={{ background: 'transparent' }}
                    >
                      <QuestionContent
                        question={q.question}
                        feedback={q.feedback}
                        keyPointsCovered={q.keyPointsCovered}
                      />
                    </Panel>
                  ))}
                </Collapse>
              </div>
            )}
        </SectionCard>
      )}

      {/* ── Coding Section ────────────────────────────────────────── */}
      {evaluation.codingSection && (
        <SectionCard
          title="Coding Section"
          icon={<Code2 size={15} strokeWidth={2} />}
          accentColor={dt.blue600}
          score={Math.round(evaluation.codingSection.score)}
          feedback={evaluation.codingSection.feedback}
          strengths={evaluation.codingSection.strengths}
          areasForImprovement={evaluation.codingSection.areasForImprovement}
        >
          {evaluation.codingSection.problemBreakdown &&
            evaluation.codingSection.problemBreakdown.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: dt.slate500,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                  }}>
                    Problem-by-Problem Breakdown
                  </span>
                </div>
                <Collapse
                  size="small"
                  className="ef-collapse"
                  style={{ background: 'transparent', border: 'none' }}
                  expandIconPosition="end"
                  expandIcon={collapseExpandIcon}
                >
                  {evaluation.codingSection.problemBreakdown.map((p, idx) => (
                    <Panel
                      key={p.problemId || idx}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: dt.slate800 }}>
                            Problem {idx + 1}
                          </span>
                          <ScoreCircle score={Math.round(p.score)} size={30} showLabel={false} noMargin />
                          {p.timeTaken !== undefined && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.slate100, border: `1px solid ${dt.slate200}`,
                              fontSize: 11, fontWeight: 500, color: dt.slate600,
                              minWidth: '68px',
                              justifyContent: 'center',
                            }}>
                              <Clock size={10} strokeWidth={2.5} />
                              {formatTime(p.timeTaken)}
                            </span>
                          )}
                          {showHints && p.hintsUsed !== undefined && p.hintsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.amber50, border: `1px solid ${dt.amber100}`,
                              fontSize: 11, fontWeight: 600, color: dt.amber700,
                            }}>
                              <Lightbulb size={10} strokeWidth={2.5} />
                              {p.hintsUsed}
                            </span>
                          )}
                          {showClarifications && (p as any).clarificationsUsed !== undefined && (p as any).clarificationsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.blue50, border: `1px solid ${dt.blue100}`,
                              fontSize: 11, fontWeight: 600, color: dt.blue700,
                            }}>
                              <HelpCircle size={10} strokeWidth={2.5} />
                              {(p as any).clarificationsUsed}
                            </span>
                          )}
                          {showFollowUps && (p as any).followUpsUsed !== undefined && (p as any).followUpsUsed > 0 && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '2px 7px', borderRadius: 4,
                              background: dt.indigo50, border: `1px solid ${dt.indigo100}`,
                              fontSize: 11, fontWeight: 600, color: dt.indigo600,
                            }}>
                              <MessageSquare size={10} strokeWidth={2.5} />
                              {(p as any).followUpsUsed}
                            </span>
                          )}
                        </div>
                      }
                      style={{ background: 'transparent' }}
                    >
                      <ProblemContent problem={p} />
                    </Panel>
                  ))}
                </Collapse>
              </div>
            )}
        </SectionCard>
      )}
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────────── */

const dt2 = {
  slate900: '#0F172A', slate800: '#1E293B', slate700: '#334155',
  slate600: '#475569', slate500: '#64748B', slate400: '#94A3B8',
  slate200: '#E2E8F0', slate100: '#F1F5F9', slate50: '#F8FAFC',
  emerald700: '#047857', emerald600: '#059669', emerald100: '#D1FAE5', emerald50: '#ECFDF5',
  amber700: '#B45309', amber600: '#D97706', amber100: '#FEF3C7', amber50: '#FFFBEB',
  red700: '#B91C1C', red600: '#DC2626', red100: '#FEE2E2', red50: '#FEF2F2',
  blue700: '#1D4ED8', blue600: '#2563EB', blue100: '#DBEAFE', blue50: '#EFF6FF',
  indigo600: '#4F46E5', indigo50: '#EEF2FF',
  border: '#E2E8F0',
};

const QuestionContent: React.FC<{
  question: string;
  feedback: string;
  keyPointsCovered: string[];
}> = ({ question, feedback, keyPointsCovered }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div>
      <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 3 }}>
        Question
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: dt2.slate800 }}>{question}</p>
    </div>
    <div>
      <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 3 }}>
        Feedback
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: dt2.slate600 }}>{feedback}</p>
    </div>
    {keyPointsCovered && keyPointsCovered.length > 0 && (
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 5 }}>
          Key Points Covered
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {keyPointsCovered.map((point, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 9px', borderRadius: 4,
              background: dt2.emerald50, border: `1px solid ${dt2.emerald100}`,
              fontSize: 12, fontWeight: 500, color: dt2.emerald700,
            }}>
              <CheckCircle2 size={11} strokeWidth={2.5} />
              {point}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ProblemContent: React.FC<{ problem: ProblemBreakdown }> = ({ problem: p }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div>
      <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 3 }}>
        Problem
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: dt2.slate800 }}>{p.problem}</p>
    </div>
    <div>
      <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 3 }}>
        Feedback
      </span>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: dt2.slate600 }}>{p.feedback}</p>
    </div>

    {(p.timeComplexity || p.spaceComplexity) && (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {p.timeComplexity && (
          <span style={{
            padding: '3px 10px', borderRadius: 4,
            background: dt2.blue50, border: `1px solid ${dt2.blue100}`,
            fontSize: 12, fontWeight: 600, color: dt2.blue700,
          }}>
            Time: {p.timeComplexity}
          </span>
        )}
        {p.spaceComplexity && (
          <span style={{
            padding: '3px 10px', borderRadius: 4,
            background: dt2.indigo50, border: `1px solid #C7D2FE`,
            fontSize: 12, fontWeight: 600, color: dt2.indigo600,
          }}>
            Space: {p.spaceComplexity}
          </span>
        )}
      </div>
    )}

    {p.codeReview && (
      <div style={{
        padding: '12px 14px',
        background: dt2.slate50,
        borderRadius: 8,
        border: `1px solid ${dt2.border}`,
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: dt2.slate800 }}>Code Review</span>

        {p.codeReview.strengths && p.codeReview.strengths.length > 0 && (
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: dt2.emerald700, display: 'block', marginBottom: 4 }}>
              Strengths
            </span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {p.codeReview.strengths.map((s, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <CheckCircle2 size={12} color={dt2.emerald600} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, lineHeight: 1.55, color: dt2.slate700 }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.codeReview.weaknesses && p.codeReview.weaknesses.length > 0 && (
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: dt2.red700, display: 'block', marginBottom: 4 }}>
              Weaknesses
            </span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {p.codeReview.weaknesses.map((w, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <ArrowRight size={12} color={dt2.red600} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, lineHeight: 1.55, color: dt2.slate700 }}>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {p.codeReview.suggestions && p.codeReview.suggestions.length > 0 && (
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: dt2.blue700, display: 'block', marginBottom: 4 }}>
              Suggestions
            </span>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
              {p.codeReview.suggestions.map((s, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <ArrowRight size={12} color={dt2.blue600} strokeWidth={2.5} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, lineHeight: 1.55, color: dt2.slate700 }}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}

    {p.testResults && p.testResults.length > 0 && (
      <div>
        <span style={{ fontSize: 12, fontWeight: 700, color: dt2.slate700, display: 'block', marginBottom: 6 }}>
          Test Results
        </span>
        <Table
          dataSource={p.testResults.map((t, tIdx) => ({ ...t, key: tIdx }))}
          columns={[
            {
              title: 'Status',
              dataIndex: 'passed',
              key: 'passed',
              width: 120,
              align: 'center',
              render: (passed) =>
                passed ? (
                  <Tag
                    icon={<CheckCircleOutlined style={{ fontSize: 10 }} />}
                    color="success"
                    style={{
                      fontSize: 10,
                      padding: '1px 8px',
                      margin: 0,
                      minWidth: 70,
                      height: 20,
                      lineHeight: '18px',
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Passed
                  </Tag>
                ) : (
                  <Tag
                    icon={<CloseCircleOutlined style={{ fontSize: 10 }} />}
                    color="error"
                    style={{
                      fontSize: 10,
                      padding: '1px 8px',
                      margin: 0,
                      minWidth: 70,
                      height: 20,
                      lineHeight: '18px',
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Failed
                  </Tag>
                ),
            },
            {
              title: 'Input',
              dataIndex: 'input',
              key: 'input',
              align: 'center',
              render: (text) => (
                <Typography.Text style={{
                  background: 'transparent',
                  padding: 0,
                  fontSize: 11,
                  color: dt2.slate500,
                  fontFamily: dt.fontMono,
                  textAlign: 'center',
                  display: 'block',
                }}>
                  {text}
                </Typography.Text>
              ),
            },
            {
              title: 'Expected',
              dataIndex: 'expectedOutput',
              key: 'expectedOutput',
              align: 'center',
              render: (text) => (
                <Typography.Text style={{
                  background: 'transparent',
                  padding: 0,
                  fontSize: 11,
                  color: dt2.slate500,
                  fontFamily: dt.fontMono,
                  textAlign: 'center',
                  display: 'block',
                }}>
                  {text}
                </Typography.Text>
              ),
            },
            {
              title: 'Actual',
              dataIndex: 'actualOutput',
              key: 'actualOutput',
              align: 'center',
              render: (text) => (
                <Typography.Text style={{
                  background: 'transparent',
                  padding: 0,
                  fontSize: 11,
                  color: dt2.slate500,
                  fontFamily: dt.fontMono,
                  textAlign: 'center',
                  display: 'block',
                }}>
                  {text}
                </Typography.Text>
              ),
            },
          ]}
          pagination={false}
          size="small"
          rowClassName={() => 'test-result-row'}
          style={{ fontSize: 11 }}
        />
        <style>
          {`
            .test-result-row:hover {
              background: transparent !important;
            }
            .test-result-row td {
              background: transparent !important;
              padding: 8px 12px !important;
              font-size: 11px !important;
              text-align: center !important;
            }
            .test-result-row th {
              font-size: 11px !important;
              padding: 8px 12px !important;
              font-weight: 600 !important;
              color: ${dt2.slate600} !important;
              text-align: center !important;
            }
          `}
        </style>
      </div>
    )}
  </div>
);

interface ProblemBreakdown {
  problemId: string;
  problem: string;
  score: number;
  feedback: string;
  codeReview?: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  testResults?: {
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
  }[];
  timeComplexity?: string;
  spaceComplexity?: string;
  timeTaken?: number;
  hintsUsed?: number;
}
