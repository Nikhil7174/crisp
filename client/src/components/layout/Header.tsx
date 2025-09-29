// src/components/layout/Header.tsx
import React from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useResponsive } from '../../hooks/useResponsive';
import { colors, spacing } from '../../styles';

const { Header: AntHeader } = Layout;

export const Header: React.FC = () => {
  const { isMobile } = useResponsive();

  const menuItems = [
    { key: 'features', label: 'Features' },
    { key: 'pricing', label: 'Pricing' },
    { key: 'about', label: 'About' }
  ];

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
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: spacing.sm 
        }}>
          <RocketOutlined style={{ 
            fontSize: 24, 
            color: colors.primary.main 
          }} />
          <span style={{ 
            fontSize: 20, 
            fontWeight: 600,
            color: colors.neutral[900]
          }}>
            AI Interview
          </span>
        </div>
        
        {!isMobile && (
          <Menu 
            mode="horizontal" 
            items={menuItems}
            style={{ 
              border: 'none', 
              flex: 1, 
              justifyContent: 'center' 
            }}
          />
        )}
        
        <Space>
          <Button type="text">Sign In</Button>
          <Button type="primary">Get Started</Button>
        </Space>
      </div>
    </AntHeader>
  );
};
