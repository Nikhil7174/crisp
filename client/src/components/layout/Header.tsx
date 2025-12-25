// src/components/layout/Header.tsx
import React from 'react';
import { Layout, Button, Space } from 'antd';
import { LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '../../styles';
import shakraLogo from '../../assets/images/shakra.png';
import { useAuth } from '../../hooks/useAuth';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleTitleClick = () => {
    navigate('/');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  const handleLogoutClick = async () => {
    await logout();
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
        height: 60,
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
          <img
            src={shakraLogo}
            alt="Shakra Logo"
            style={{
              height: 32,
              width: 'auto'
            }}
          />
          <span style={{
            fontSize: 20,
            fontWeight: 600,
            fontFamily: '"Varela Round", sans-serif',
            color: colors.neutral[900],
          }}>
            Shakra
          </span>
        </div>

        <Space>
          {isAuthenticated ? (
            <Button
              type="primary"
              icon={<LogoutOutlined />}
              onClick={handleLogoutClick}
              style={{
                background: '#e63946',
                borderColor: '#e63946',
                height: 40,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#d62839';
                e.currentTarget.style.borderColor = '#d62839';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#e63946';
                e.currentTarget.style.borderColor = '#e63946';
              }}
            >
              Logout
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<LoginOutlined />}
              onClick={handleLoginClick}
              style={{
                background: colors.neutral[900],
                borderColor: colors.neutral[900],
                height: 40,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.neutral[800];
                e.currentTarget.style.borderColor = colors.neutral[800];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.neutral[900];
                e.currentTarget.style.borderColor = colors.neutral[900];
              }}
            >
              Login
            </Button>
          )}
        </Space>
      </div>
    </AntHeader>
  );
};
