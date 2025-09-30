// src/components/layout/Header.tsx
import React from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import { RocketOutlined, DashboardOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, spacing } from '../../styles';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate('/admin');
  };

  const handleTitleClick = () => {
    navigate('/');
  };

  return (
    <AntHeader
      style={{
        background: colors.background.primary,
        boxShadow: colors.shadows.sm,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: `0 ${spacing.lg}px`,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1200,
        margin: '0 auto',
        height: '100%',
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            cursor: 'pointer'
          }}
          onClick={handleTitleClick}
        >
          <RocketOutlined style={{
            fontSize: 24,
            color: colors.primary.main
          }} />
          <span style={{
            fontSize: 20,
            fontWeight: 600,
            color: colors.neutral[900]
          }}>
            Crisp
          </span>
        </div>

        <Space>
          <Button
            type="text"
            icon={<DashboardOutlined />}
            onClick={handleAdminClick}
            style={{ color: colors.info.main }}
          >
            View Dashboard
          </Button>
        </Space>
      </div>
    </AntHeader>
  );
};
