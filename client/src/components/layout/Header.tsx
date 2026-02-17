// src/components/layout/Header.tsx
import React from 'react';
import { Layout, Button, Space, Grid, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '../../styles';
import shakraLogo from '../../assets/images/shakra.png';
import { useAuth } from '../../hooks/useAuth';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const screens = Grid.useBreakpoint();
  const [drawerVisible, setDrawerVisible] = React.useState(false);

  const handleTitleClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDrawerVisible(false);
  };

  const handleFeaturesClick = () => {
    const featuresSection = document.getElementById('features-section');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      // Wait for navigation then scroll
      setTimeout(() => {
        const section = document.getElementById('features-section');
        section?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
    setDrawerVisible(false);
  };

  const handleLoginClick = () => {
    navigate('/sign-in?role=interviewer');
    setDrawerVisible(false);
  };

  const handleLogoutClick = async () => {
    await logout();
    navigate('/');
    setDrawerVisible(false);
  };

  const showDrawer = () => {
    setDrawerVisible(true);
  };

  const onClose = () => {
    setDrawerVisible(false);
  };

  const MobileMenu = () => (
    <Space direction="vertical" size="large" style={{ width: '100%', marginTop: spacing.lg }}>
      <Button
        type="text"
        onClick={handleFeaturesClick}
        block
        style={{
          color: colors.neutral[900],
          height: 40,
          fontSize: 16,
          fontWeight: 500,
          textAlign: 'left',
          paddingLeft: 0,
        }}
      >
        Features
      </Button>
      {isAuthenticated ? (
        <Button
          type="primary"
          onClick={handleLogoutClick}
          block
          style={{
            background: '#e63946',
            borderColor: '#e63946',
            height: 40,
            fontSize: 16,
          }}
        >
          Logout
        </Button>
      ) : (
        <>
          <Button
            type="text"
            onClick={handleLoginClick}
            block
            style={{
              color: colors.neutral[900],
              height: 40,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Log in
          </Button>
          <Button
            type="primary"
            href="https://cal.com/nikhil-singh/shakra-ai-interview-demo"
            target="_blank"
            block
            style={{
              background: colors.neutral[900],
              borderColor: colors.neutral[900],
              height: 40,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
            }}
          >
            Book a Demo
          </Button>
        </>
      )}
    </Space>
  );

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
          {screens.md && (
            <span style={{
              fontSize: 20,
              fontWeight: 600,
              fontFamily: '"Varela Round", sans-serif',
              color: colors.neutral[900],
            }}>
              Shakra
            </span>
          )}
        </div>

        {screens.md ? (
          <Space>
            <Button
              type="text"
              onClick={handleFeaturesClick}
              style={{
                color: colors.neutral[900],
                height: 32,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Features
            </Button>
            {isAuthenticated ? (
              <Button
                type="primary"
                onClick={handleLogoutClick}
                style={{
                  background: '#e63946',
                  borderColor: '#e63946',
                  height: 36,
                  fontSize: 14,
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
              <Space size="middle">
                <Button
                  type="text"
                  onClick={handleLoginClick}
                  style={{
                    color: colors.neutral[900],
                    height: 32,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Log in
                </Button>
                <Button
                  type="primary"
                  href="https://cal.com/nikhil-singh/shakra-ai-interview-demo"
                  target="_blank"
                  style={{
                    background: colors.neutral[900],
                    borderColor: colors.neutral[900],
                    height: 32,
                    fontSize: 14,
                    fontWeight: 500,
                    borderRadius: 8,
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
                  Book a Demo
                </Button>
              </Space>
            )}
          </Space>
        ) : (
          <>
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 20, color: colors.neutral[900] }} />}
              onClick={showDrawer}
              style={{ padding: 0, height: 'auto' }}
            />
            <Drawer
              title="Menu"
              placement="right"
              onClose={onClose}
              open={drawerVisible}
              width={280}
              bodyStyle={{ padding: spacing.lg }}
            >
              <MobileMenu />
            </Drawer>
          </>
        )}
      </div>
    </AntHeader>
  );
};
