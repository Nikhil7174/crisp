// src/components/layout/Layout.tsx
import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Header } from './Header';
import { colors, spacing, typography } from '../../styles';

const { Content, Footer } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <AntLayout style={{ 
      minHeight: '100vh', 
      background: colors.background.primary 
    }}>
      <Header />
      <Content>{children}</Content>
      <Footer style={{ 
        textAlign: 'center', 
        background: colors.background.secondary,
        padding: `${spacing.xxl}px ${spacing.lg}px`,
        marginTop: spacing.xxxl,
        borderTop: `1px solid ${colors.divider}`,
      }}>
        <div style={{ 
          color: colors.neutral[500],
          fontSize: typography.fontSize.sm,
        }}>
          © 2024 AI Interview. All rights reserved.
        </div>
      </Footer>
    </AntLayout>
  );
};