// src/components/landing/DualColumnSection.tsx
import React, { useCallback, useState } from 'react';
import { Row, Col } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { UserTypeCard } from './UserTypeCard';
import { useUserSelection } from '../../hooks/useUserSelection';
import { useNavigate } from 'react-router-dom';
import { DownloadModal } from '../DownloadModal';

const intervieweeFeatures = [
  'Join interview sessions',
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
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const handleJoinInterview = useCallback(() => {
    // Show download modal instead of navigating to interview
    setShowDownloadModal(true);
  }, []);

  const handleCreateInterview = useCallback(() => {
    // Navigate to login with interviewer context
    navigate('/login', { state: { userType: 'interviewer', returnTo: '/interviewer/dashboard' } });
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
            title="Join & Practice"
            subtitle="Join interview sessions, get instant feedback, and improve your skills"
            features={intervieweeFeatures}
            ctaText="Join Interview"
            isActive={activeUserType === 'interviewee'}
            onSelect={() => selectUserType('interviewee')}
            onCtaClick={handleJoinInterview}
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
      
      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </div>
  );
};
