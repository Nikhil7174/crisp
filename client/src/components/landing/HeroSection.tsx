import React from 'react';
import { Typography, Space, Grid, Button, Dropdown, Tooltip, Row, Col } from 'antd';
import type { MenuProps } from 'antd';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { colors, typography, spacing } from '../../styles';
import { INTERVIEW_ROLES } from '../../constants/interview';
import { DetailedFeedbackSheet } from '../DetailedFeedbackSheet';
import shakraLogo from '../../assets/images/shakra.png';

const { Title, Paragraph } = Typography;
const { useBreakpoint } = Grid;

// Sample evaluation data for Alex Thompson
const sampleEvaluation = {
  theoreticalSection: {
    score: 81,
    feedback: 'Strong performance overall, but the last question showed some gaps in understanding database optimization and system design principles.',
    strengths: [
      'Excellent database design knowledge',
      'Strong API design understanding',
      'Good understanding of system architecture',
    ],
    areasForImprovement: [
      'Database optimization techniques need improvement',
      'Could provide more detailed explanations on scalability',
    ],
    questionBreakdown: [
      {
        questionId: 'q1',
        question: 'Explain the difference between SQL and NoSQL databases. When would you choose one over the other?',
        score: 95,
        feedback: 'Excellent answer! You covered all key points including ACID properties, scalability, and use cases for each database type.',
        keyPointsCovered: ['ACID properties', 'Scalability trade-offs', 'Use case scenarios'],
        timeTaken: 110, // 1:50
        hintsUsed: 0,
        clarificationsUsed: 0,
        followUpsUsed: 0,
      },
      {
        questionId: 'q2',
        question: 'What is database indexing and how does it improve query performance?',
        score: 90,
        feedback: 'Great explanation with practical examples! You understand indexing well and mentioned B-tree structures.',
        keyPointsCovered: ['B-tree indexing', 'Query optimization', 'Trade-offs'],
        timeTaken: 132, // 2:12
        hintsUsed: 0,
        clarificationsUsed: 0,
        followUpsUsed: 1,
      },
      {
        questionId: 'q3',
        question: 'Explain RESTful API design principles and best practices.',
        score: 85,
        feedback: 'Good understanding of REST principles! You mentioned HTTP methods, status codes, and resource naming conventions.',
        keyPointsCovered: ['HTTP methods', 'Status codes', 'Resource design'],
        timeTaken: 115, // 1:55
        hintsUsed: 1,
        clarificationsUsed: 0,
        followUpsUsed: 1,
      },
      {
        questionId: 'q4',
        question: 'What is database normalization and when might you denormalize?',
        score: 55,
        feedback: 'The answer showed some understanding but missed several key points about normalization forms and denormalization trade-offs.',
        keyPointsCovered: ['Basic normalization'],
        timeTaken: 46, // 0:46
        hintsUsed: 1,
        clarificationsUsed: 0,
        followUpsUsed: 0,
      },
    ],
  },
  codingSection: {
    score: 83,
    feedback: 'Strong coding skills demonstrated with good problem-solving approach.',
    strengths: [
      'Clean code structure',
      'Good algorithmic thinking',
      'Effective use of data structures',
    ],
    areasForImprovement: [
      'Could optimize time complexity further',
      'Edge case handling could be improved',
    ],
    problemBreakdown: [
      {
        problemId: 'p1',
        problem: 'Two Sum',
        score: 95,
        feedback: 'Excellent solution with optimal time complexity.',
        codeReview: {
          strengths: ['Optimal O(n) solution', 'Clean code structure'],
          weaknesses: [],
          suggestions: [],
        },
        testResults: [
          { passed: true, input: '[2,7,11,15]', expectedOutput: '[0,1]', actualOutput: '[0,1]' },
          { passed: true, input: '[3,2,4]', expectedOutput: '[1,2]', actualOutput: '[1,2]' },
        ],
        timeComplexity: 'O(n)',
        spaceComplexity: 'O(n)',
        timeTaken: 600, // 10 min
        hintsUsed: 0,
        clarificationsUsed: 1,
        followUpsUsed: 1,
      },
      {
        problemId: 'p2',
        problem: 'Binary Search',
        score: 70,
        feedback: 'Working solution but could be optimized.',
        codeReview: {
          strengths: ['Correct logic'],
          weaknesses: ['Suboptimal approach'],
          suggestions: ['Consider iterative approach'],
        },
        testResults: [
          { passed: true, input: '[1,2,3,4,5], 3', expectedOutput: '2', actualOutput: '2' },
          { passed: false, input: '[1,2,3,4,5], 6', expectedOutput: '-1', actualOutput: 'undefined' },
        ],
        timeComplexity: 'O(log n)',
        spaceComplexity: 'O(log n)',
        timeTaken: 720, // 12 min
        hintsUsed: 0,
        clarificationsUsed: 0,
        followUpsUsed: 0,
      },
    ],
  },
  overall: {
    score: 82,
    feedback: 'Strong overall performance with solid fundamentals and good problem-solving skills.',
    strengths: [
      'Excellent database and API design knowledge',
      'Good system architecture understanding',
      'Strong communication skills',
    ],
    areasForImprovement: [
      'Database optimization techniques',
      'Depth in scalability and distributed systems',
    ],
    learningRecommendations: [
      'Study advanced database optimization techniques',
      'Learn more about distributed systems and microservices',
    ],
  },
  summaryStatistics: {
    totalQuestions: 4,
    totalProblems: 2,
    averageScore: 82,
    totalHints: 2,
    totalClarifications: 1,
    totalFollowUps: 3,
    averageTimePerQuestion: 100.75,
    averageTimePerProblem: 660,
  },
};

// Demo companies for animation - First is Shakra AI (product brand), rest are generic
const DEMO_COMPANIES = [
  {
    name: 'Shakra AI',
    // If shakra.png is in the public/ folder, this path will work in Vite.
    // Otherwise, adjust the path/import as needed.
    logo: shakraLogo,
  },
  {
    name: 'Atlas Systems',
    logo: `https://ui-avatars.com/api/?name=Atlas+Systems&background=dc2626&color=fff&size=128&bold=true`,
  },
  {
    name: 'Orion Labs',
    logo: `https://ui-avatars.com/api/?name=Orion+Labs&background=059669&color=fff&size=128&bold=true`,
  },
  {
    name: 'Vertex AI',
    logo: `https://ui-avatars.com/api/?name=Vertex+AI&background=7c3aed&color=fff&size=128&bold=true`,
  },
  {
    name: 'BluePeak Technologies',
    logo: `https://ui-avatars.com/api/?name=BluePeak+Tech&background=0284c7&color=fff&size=128&bold=true`,
  },
];

export const HeroSection: React.FC = () => {
  const screens = useBreakpoint();
  const navigate = useNavigate();
  const posthog = usePostHog();
  const [windowWidth, setWindowWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  const [currentCompanyIndex, setCurrentCompanyIndex] = React.useState(0);

  React.useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cycle through companies every 4 seconds
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCompanyIndex((prev) => (prev + 1) % DEMO_COMPANIES.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Map dropdown roles to demo route types (URL segment for /try-interview/:type)
  // These are semantic keys; they are later mapped to backend demo roles.
  const DEMO_TYPE_BY_ROLE: Record<string, 'backend' | 'fullstack' | 'swe1'> = {
    'Backend Developer': 'backend',
    'Full Stack Developer': 'fullstack',
    'SDE-1': 'swe1',
  };

  // Try Interview dropdown:
  // Active demos: Backend, Full Stack, SDE-1
  // Disabled demo (CTA only): AI Engineer
  const visibleRolesList = [
    'Backend Developer',
    'Full Stack Developer',
    'SDE-1',
    'AI Engineer',
  ];

  const visibleItems = visibleRolesList
    .map(roleName => INTERVIEW_ROLES.find(r => r.value === roleName))
    .filter((r): r is typeof INTERVIEW_ROLES[0] => Boolean(r));

  const remainingCount = INTERVIEW_ROLES.length - visibleItems.length;

  const tryInterviewItems: MenuProps['items'] = visibleItems.map((role) => {
    const isDisabledDemo = role.value === 'AI Engineer';
    // Custom label for SDE-1 to show "SDE-1" instead of full name
    const displayLabel = role.value === 'SDE-1' ? 'SDE-1' : role.label;

    return {
      key: role.value,
      label: isDisabledDemo ? (
        <Tooltip title="Book a demo to try this interview" placement="right">
          <span
            style={{
              color: colors.neutral[400],
              cursor: 'default',
              display: 'flex',
              alignItems: 'center',
              height: '90%',
              fontFamily: '"Varela Round", sans-serif',
              fontSize: typography.fontSize.sm,
            }}
          >
            {displayLabel}
          </span>
        </Tooltip>
      ) : (
        <span
          style={{
            fontFamily: '"Varela Round", sans-serif',
            fontSize: typography.fontSize.sm,
            display: 'flex',
            alignItems: 'center',
            height: '90%',
            width: '100%',
          }}
        >
          {displayLabel}
        </span>
      ),
      disabled: isDisabledDemo,
      className: isDisabledDemo ? 'menu-item-disabled-simulated' : '',
      style: { height: 36, display: 'flex', alignItems: 'center' },
    };
  });

  if (remainingCount > 0) {
    tryInterviewItems.push({
      key: 'more',
      label: (
        <Tooltip title="Book a demo to try more interviews" placement="right">
          <span style={{ color: colors.neutral[400], fontStyle: 'italic', fontFamily: '"Varela Round", sans-serif', fontSize: typography.fontSize.sm, display: 'flex', alignItems: 'center', height: '90%', cursor: 'default' }}>and {remainingCount} more...</span>
        </Tooltip>
      ),
      disabled: false,
      style: { height: 36, display: 'flex', alignItems: 'center' },
    });
  }

  const handleTryInterview: MenuProps['onClick'] = ({ key }) => {
    const demoType = DEMO_TYPE_BY_ROLE[key as string];
    if (!demoType) return; // Ignore disabled / non-demo items

    posthog?.capture('try_interview_clicked', { role: demoType, labelKey: key });
    navigate(`/try-interview/${demoType}`);
  };

  return (
    <div style={{
      padding: `${screens.md ? spacing.xxxl * 2 : spacing.xxxl}px ${screens.md ? spacing.lg : spacing.md}px 0 ${screens.md ? spacing.lg : spacing.md}px`,
      background: '#fff', // Soft off-white background
      maxWidth: 1600,
      margin: '0 auto',
      minHeight: '100vh',
    }}>
      <Row gutter={[64, 48]} align="top" style={{ minHeight: 'calc(100vh - 200px)', alignItems: 'flex-start' }}>
        {/* Left Section: Left-aligned Heading and CTAs */}
        <Col xs={24} lg={11} style={{ display: 'flex', alignItems: 'flex-start' }}>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              width: '100%',
              // paddingTop: screens.lg ? '12px' : '0', // Match Mac window header top padding
              paddingLeft: screens.lg ? spacing.xxl : '0', // Add left padding
            }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: screens.lg ? 'flex-start' : 'center' }}>
                <Title level={1} style={{
                  fontSize: screens.lg
                    ? (windowWidth < 1400 ? '48px' : '56px')
                    : '42px',
                  fontWeight: 600,
                  color: '#111827', // Rich dark charcoal
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  marginBottom: spacing.md,
                  marginTop: 0,
                  paddingTop: 0,
                  maxWidth: 600,
                  fontFamily: typography.fontFamily.primary,
                  textAlign: screens.lg ? 'left' : 'center',
                }}>
                  Technical Interviews on{' '}
                  <span style={{
                    color: '#111827',
                    textDecoration: 'underline',
                    textDecorationColor: colors.primary.main,
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '4px',
                  }}>Autopilot</span>
                </Title>
              </span>

              <Paragraph style={{
                fontSize: typography.fontSize.base,
                color: '#4B5563', // Softer grey
                lineHeight: 1.4,
                fontWeight: typography.fontWeight.medium,
                marginBottom: spacing.xl,
                textAlign: screens.lg ? 'left' : 'center',
                maxWidth: screens.lg ? 'none' : '600px',
                marginLeft: screens.lg ? 0 : 'auto',
                marginRight: screens.lg ? 0 : 'auto',
              }}>
                Screen hundreds of candidates simultaneously with AI-driven technical rounds. Every result verified, every candidate evaluated fairly.
              </Paragraph>

              <Space direction="vertical" size="small" style={{ width: '100%', alignItems: screens.lg ? 'flex-start' : 'center' }}>
                <Space size="middle" wrap style={{ justifyContent: screens.lg ? 'flex-start' : 'center', width: '100%', marginTop: spacing.md }}>
                  <Button
                    type="primary"
                    size="large"
                    href="https://cal.com/nikhil-singh/shakra-ai-interview-demo"
                    target="_blank"
                    onClick={() => posthog?.capture('book_demo_clicked', { source: 'hero' })}
                    style={{
                      height: 40,
                      padding: '0 24px',
                      fontSize: 16,
                      fontWeight: 500,
                      borderRadius: 8,
                      background: '#111827',
                      borderColor: '#111827',
                      boxShadow: '0 4px 12px rgba(17, 24, 39, 0.15)',
                    }}
                  >
                    Book a Demo
                  </Button>

                  <Dropdown
                    menu={{
                      items: tryInterviewItems,
                      onClick: handleTryInterview,
                    }}
                    placement="bottomLeft"
                    align={{ offset: [0, 4] }}
                    trigger={['click', 'hover']}
                  >
                    <Button
                      size="large"
                      style={{
                        height: 40,
                        padding: '0 24px',
                        fontSize: 16,
                        fontWeight: 500,
                        borderRadius: 8,
                        background: '#FFFFFF',
                        borderColor: '#E5E7EB',
                        color: '#111827',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        pointerEvents: 'auto',
                      }}
                    >
                      <span>Try Interview</span>
                      <span style={{ fontSize: 10, opacity: 0.7 }}>⌄</span>
                    </Button>
                  </Dropdown>
                </Space>
                <span style={{
                  fontSize: 12,
                  color: '#6B7280',
                  fontStyle: 'italic',
                  marginTop: spacing.xs,
                  textAlign: screens.lg ? 'left' : 'center',
                }}>
                  *No card or payment required
                </span>
              </Space>
            </Space>
          </motion.div>
        </Col>

        {/* Right Section: Mac Window Frame with Detailed Report */}
        <Col xs={24} lg={13}>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              position: 'relative',
            }}
          >
            {/* Window Frame Container - Let it bleed off bottom */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(0, 0, 0, 0.06)',
              transform: screens.lg ? 'scale(0.9)' : 'scale(1)',
              transformOrigin: 'top center',
            }}>
              {/* Window Frame Header (macOS style) */}
              <div style={{
                background: '#F5F5F5',
                borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                padding: screens.md ? '12px 16px' : '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: screens.md ? 8 : 6,
              }}>
                {/* Window Controls */}
                <div style={{ display: 'flex', gap: screens.md ? 6 : 4 }}>
                  <div style={{
                    width: screens.md ? 12 : 10,
                    height: screens.md ? 12 : 10,
                    borderRadius: '50%',
                    background: '#FF5F57',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }} />
                  <div style={{
                    width: screens.md ? 12 : 10,
                    height: screens.md ? 12 : 10,
                    borderRadius: '50%',
                    background: '#FFBD2E',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }} />
                  <div style={{
                    width: screens.md ? 12 : 10,
                    height: screens.md ? 12 : 10,
                    borderRadius: '50%',
                    background: '#28CA42',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }} />
                </div>
                {/* Window Title */}
                <div style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: screens.md ? 13 : 11,
                  color: '#6B7280',
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {screens.md ? 'Sample Detailed Interview Feedback' : 'Detailed Interview Feedback'}
                </div>
                {/* Spacer for symmetry */}
                <div style={{ width: screens.md ? 60 : 42 }} />
              </div>

              {/* Content Area with Custom Scrollbar - No max-height, let it bleed */}
              <div style={{
                maxHeight: screens.lg ? '90vh' : 'none',
                overflowY: 'auto',
                background: '#FFFFFF',
                scrollbarWidth: 'thin',
                scrollbarColor: '#E5E7EB transparent',
              }}>
                <style>
                  {`
                    div::-webkit-scrollbar {
                      width: 6px;
                    }
                    div::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    div::-webkit-scrollbar-thumb {
                      background: #D1D5DB;
                      border-radius: 3px;
                    }
                    div::-webkit-scrollbar-thumb:hover {
                      background: #9CA3AF;
                    }
                  `}
                </style>
                <DetailedFeedbackSheet
                  evaluation={sampleEvaluation}
                  candidateName="Alex Thompson"
                  interviewDate="Feb 24, 2026"
                  role="Backend Developer"
                  companyName={DEMO_COMPANIES[currentCompanyIndex].name}
                  companyLogo={DEMO_COMPANIES[currentCompanyIndex].logo}
                />
              </div>
            </div>
          </motion.div>
        </Col>
      </Row>
    </div>
  );
};
