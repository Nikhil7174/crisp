// src/pages/Download.tsx
import React from 'react';
import { Layout as AntLayout } from 'antd';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { DownloadSection } from '../components/landing/DownloadSection';
import { colors } from '../styles';

const { Content } = AntLayout;

export const Download: React.FC = () => {
  return (
    <AntLayout style={{
      minHeight: '100vh',
      background: colors.background.primary
    }}>
      <Header />
      <Content style={{ padding: 0 }}>
        <DownloadSection />
      </Content>
      <Footer />
    </AntLayout>
  );
};

