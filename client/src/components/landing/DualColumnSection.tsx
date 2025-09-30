// src/components/landing/DualColumnSection.tsx
import React, { useCallback } from 'react';
import { Row, Col } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { UserTypeCard } from './UserTypeCard';
import { useUserSelection } from '../../hooks/useUserSelection';
import { useNavigate } from 'react-router-dom';

const intervieweeFeatures = [
  'AI-powered mock interviews',
  'Real-time performance analysis',
  'Industry-specific questions',
  'Confidence building exercises',
];

const interviewerFeatures = [
  'Custom interview templates',
  'Candidate evaluation tools',
  'Bias-free assessment',
  'Team collaboration features',
];

export const DualColumnSection: React.FC = () => {
  const { activeUserType, selectUserType } = useUserSelection();
  const navigate = useNavigate();

  const handleStartPracticing = useCallback(() => {
    navigate('/interview');
  }, [navigate]);

  const handleCreateInterview = useCallback(() => {
    navigate('/admin');
  }, [navigate]);

  return (
    <div style={{
      padding: '60px 24px',
      maxWidth: 1200,
      margin: '0 auto',
    }}>
      <Row gutter={[32, 32]}>
        <Col xs={24} md={12}>
          <UserTypeCard
            type="interviewee"
            title="Practice & Perfect"
            subtitle="Get personalized mock interviews, instant feedback, and skill improvement tips"
            features={intervieweeFeatures}
            ctaText="Start Practicing"
            isActive={activeUserType === 'interviewee'}
            onSelect={() => selectUserType('interviewee')}
            onCtaClick={handleStartPracticing}
            icon={<UserOutlined />}
          />
        </Col>

        <Col xs={24} md={12}>
          <UserTypeCard
            type="interviewer"
            title="Hire with Confidence"
            subtitle="Create structured interviews, evaluate candidates objectively, make better hiring decisions"
            features={interviewerFeatures}
            ctaText="Create Interview"
            isActive={activeUserType === 'interviewer'}
            onSelect={() => selectUserType('interviewer')}
            onCtaClick={handleCreateInterview}
            icon={<TeamOutlined />}
          />
        </Col>
      </Row>
    </div>
  );
};
