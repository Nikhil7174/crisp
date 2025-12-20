// src/components/layout/Layout.tsx
import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { colors } from '../../styles';

const { Content } = AntLayout;

export const Layout: React.FC = () => {
  return (
    <AntLayout style={{
      minHeight: '100vh',
      background: colors.background.primary
    }}>
      <Header />
      <Content>
        <Outlet />
      </Content>
      <Footer />
    </AntLayout>
  );
};