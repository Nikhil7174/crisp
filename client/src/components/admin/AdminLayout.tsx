import React, { useState } from 'react';
import { Layout, Menu, Button, Typography, Avatar } from 'antd';
import {
  DashboardOutlined,
  LinkOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { colors, spacing } from '../../styles';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

interface AdminLayoutProps {
  children: React.ReactNode;
  user?: {
    fullName: string;
    email: string;
  };
  onLogout: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/admin/links',
      icon: <LinkOutlined />,
      label: 'Interview Links',
      onClick: () => navigate('/admin/links'),
    },
    {
      key: '/admin/dashboard',
      icon: <DashboardOutlined />,
      label: 'Interview Results',
      onClick: () => navigate('/admin/dashboard'),
    },
  ];

  const selectedKey = location.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={250}
        style={{
          background: colors.background.primary,
          boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.md,
            borderBottom: `1px solid ${colors.neutral[200]}`,
          }}
        >
          {!collapsed && (
            <Text
              strong
              style={{
                fontSize: 20,
                background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Shakra Admin
            </Text>
          )}
          {collapsed && (
            <Text
              strong
              style={{
                fontSize: 24,
                background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              S
            </Text>
          )}
        </div>

        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          style={{
            border: 'none',
            marginTop: spacing.md,
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: colors.background.primary,
            padding: `0 ${spacing.xl}px`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: 16,
              width: 48,
              height: 48,
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md }}>
            {user && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginRight: spacing.md,
                }}
              >
                <Avatar
                  icon={<UserOutlined />}
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Text strong>{user.fullName}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {user.email}
                  </Text>
                </div>
              </div>
            )}
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={onLogout}
              style={{ color: colors.error.main }}
            >
              Logout
            </Button>
          </div>
        </Header>

        <Content
          style={{
            margin: spacing.xl,
            padding: spacing.xl,
            background: colors.neutral[50],
            minHeight: 280,
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};










