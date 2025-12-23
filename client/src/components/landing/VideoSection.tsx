// src/components/landing/VideoSection.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'antd';
import { PlayCircleOutlined, EditOutlined } from '@ant-design/icons';
import { colors, spacing, borderRadius } from '../../styles';
import { useNavigate } from 'react-router-dom';
import { DownloadModal } from '../DownloadModal';

export const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  useEffect(() => {
    // Auto-play video on mount (muted)
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Handle autoplay restrictions gracefully
      });
    }
  }, []);

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
      padding: `${spacing.xxl}px ${spacing.lg}px ${spacing.xxxl * 2.2}px ${spacing.lg}px`,
      maxWidth: 1200,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        style={{
          marginBottom: spacing.xxl,
          display: 'flex',
          justifyContent: 'center',
          gap: spacing.xl,
          flexWrap: 'wrap',
        }}
      >
        <Button
          type="primary"
          size="large"
          icon={<PlayCircleOutlined />}
          onClick={handleJoinInterview}
          style={{
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            border: 'none',
            borderRadius: borderRadius.xl,
            padding: `0 ${spacing.lg}px`,
            height: 44,
            fontSize: 16,
            fontWeight: 600,
            boxShadow: `0 4px 12px rgba(9, 88, 217, 0.3)`,
          }}
        >
          Join Interview
        </Button>
        <Button
          type="default"
          size="large"
          icon={<EditOutlined />}
          onClick={handleCreateInterview}
          style={{
            background: colors.neutral[800],
            border: `1px solid ${colors.neutral[700]}`,
            borderRadius: borderRadius.xl,
            padding: `0 ${spacing.md}px`,
            height: 44,
            fontSize: 16,
            fontWeight: 600,
            color: colors.neutral[100],
            boxShadow: `0 4px 12px rgba(0, 0, 0, 0.2)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = colors.neutral[700];
            e.currentTarget.style.borderColor = colors.neutral[600];
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.neutral[800];
            e.currentTarget.style.borderColor = colors.neutral[700];
          }}
        >
          Create Interview
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 900,
          position: 'relative',
        }}
      >
        {/* Glow background effect */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '110%',
            height: '110%',
            background: `radial-gradient(circle, rgba(9, 88, 217, 0.3) 0%, rgba(64, 150, 255, 0.2) 50%, transparent 70%)`,
            filter: 'blur(40px)',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            borderRadius: borderRadius.xl,
            overflow: 'hidden',
            boxShadow: `
              0 0 60px rgba(9, 88, 217, 0.4),
              0 0 100px rgba(64, 150, 255, 0.3),
              0 0 140px rgba(64, 150, 255, 0.2),
              ${colors.shadows.xl}
            `,
            backgroundColor: colors.neutral[900],
            aspectRatio: '16/9',
            zIndex: 1,
          }}
        >
          <video
            ref={videoRef}
            src="https://ik.imagekit.io/uv3iwfy9e/ShakraProduct.mp4"
            poster="https://ik.imagekit.io/uv3iwfy9e/Screenshot_20251223_201318.png"
            controls
            loop
            muted
            playsInline
            autoPlay
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
      </motion.div>

      <DownloadModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
      />
    </div>
  );
};

