// src/components/ErrorBoundary.tsx
import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Alert, Button, Card, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '../styles';

const { Title, Paragraph } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ 
          padding: spacing.xl, 
          minHeight: '100vh', 
          backgroundColor: colors.background.secondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card style={{ maxWidth: 600, width: '100%' }}>
            <Alert
              message="Something went wrong"
              description="An unexpected error occurred. Please try refreshing the page or contact support if the problem persists."
              type="error"
              showIcon
              style={{ marginBottom: spacing.lg }}
            />
            
            <Title level={4}>Error Details</Title>
            <Paragraph code style={{ 
              backgroundColor: colors.neutral[50], 
              padding: spacing.md,
              borderRadius: 4,
              fontSize: 12,
              maxHeight: 200,
              overflow: 'auto'
            }}>
              {this.state.error?.message || 'Unknown error'}
            </Paragraph>

            <div style={{ 
              display: 'flex', 
              gap: spacing.md, 
              marginTop: spacing.lg 
            }}>
              <Button 
                type="primary" 
                icon={<ReloadOutlined />} 
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
              <Button onClick={this.handleReset}>
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
