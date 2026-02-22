// src/components/layout/Header.tsx
import React from 'react';
import { Layout, Button, Space, Grid, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePostHog } from '@posthog/react';
import { colors, spacing } from '../../styles';
import shakraLogo from '../../assets/images/shakra.png';
import { useAuth } from '../../hooks/useAuth';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, logout } = useAuth();
  const posthog = usePostHog();
  const screens = Grid.useBreakpoint();
  const [drawerVisible, setDrawerVisible] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  // Handle scroll to hide/show Shakra text
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 50); // Hide text after scrolling 50px
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTitleClick = () => {
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setDrawerVisible(false);
  };

  const handleFeaturesClick = () => {
    posthog?.capture('features_clicked');
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
    posthog?.capture('login_clicked');
    if (location.pathname.startsWith('/try-interview')) {
      navigate(`/sign-in?role=candidate&redirect=${encodeURIComponent(location.pathname)}`);
    } else {
      navigate('/sign-in?role=interviewer');
    }
    setDrawerVisible(false);
  };

  const handleDashboardClick = () => {
    posthog?.capture('dashboard_clicked');
    if (user?.userType === 'candidate') {
      navigate('/candidate/dashboard');
    } else {
      navigate('/interviewer/dashboard');
    }
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
        <>
          <Button
            type="text"
            onClick={handleLogoutClick}
            block
            style={{
              color: colors.neutral[900],
              height: 40,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Logout
          </Button>
          <Button
            type="primary"
            onClick={handleDashboardClick}
            block
            style={{
              background: colors.neutral[900],
              borderColor: colors.neutral[900],
              height: 40,
              fontSize: 16,
              fontWeight: 500,
              borderRadius: 8,
              marginBottom: spacing.sm,
            }}
          >
            Dashboard
          </Button>
        </>
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
            onClick={() => posthog?.capture('book_demo_clicked', { source: 'header_mobile' })}
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
        maxWidth: 1250,
        margin: '0 auto',
        height: '100%',
      }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            cursor: 'pointer',
            justifyContent: 'center',
            position: 'relative',
          }}
          onClick={handleTitleClick}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <img
            src={shakraLogo}
            alt="Shakra Logo"
            style={{
              height: 28,
              width: 'auto'
            }}
          />
          </span>
          {screens.md && (
            <span style={{
              fontSize: 20,
              fontWeight: 600,
              fontFamily: '"Varela Round", sans-serif',
              color: colors.neutral[900],
              opacity: isScrolled ? 0 : 1,
              transform: isScrolled ? 'translateX(-40px) scale(0.5)' : 'translateX(0) scale(1)',
              maxWidth: isScrolled ? 0 : '200px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              pointerEvents: isScrolled ? 'none' : 'auto',
              transformOrigin: 'left center',
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
                fontSize: 16,
                fontWeight: 500,
              }}
            >
              Features
            </Button>
            {isAuthenticated ? (
              <Space size="middle">
                <Button
                  type="text"
                  onClick={handleLogoutClick}
                  style={{
                    color: colors.neutral[900],
                    height: 32,
                    fontSize: 16,
                    fontWeight: 500,
                  }}
                >
                  Logout
                </Button>
                <Button
                  type="primary"
                  onClick={handleDashboardClick}
                  style={{
                    background: colors.neutral[900],
                    borderColor: colors.neutral[900],
                    height: 32,
                    fontSize: 16,
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
                  Dashboard
                </Button>
              </Space>
            ) : (
              <Space size="middle">
                <Button
                  type="text"
                  onClick={handleLoginClick}
                  style={{
                    color: colors.neutral[900],
                    height: 32,
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
                  onClick={() => posthog?.capture('book_demo_clicked', { source: 'header_desktop' })}
                  style={{
                    background: colors.neutral[900],
                    borderColor: colors.neutral[900],
                    height: 32,
                    fontSize: 16,
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
