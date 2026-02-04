import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { colors, spacing, borderRadius } from '../../styles';

export const VideoSection: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Auto-play video on mount (muted)
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Handle autoplay restrictions gracefully
      });
    }
  }, []);

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
    </div>
  );
};

