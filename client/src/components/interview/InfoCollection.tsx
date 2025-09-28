// src/components/interview/InfoCollection.tsx
import React from 'react';
import { Card, Typography, Space, Form, Input, Button } from 'antd';
import { CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';

const { Title, Paragraph, Text } = Typography;

interface InfoCollectionProps {
  resumeData: any;
  onCollectInfo: (values: any) => void;
  loading: boolean;
}

export const InfoCollection: React.FC<InfoCollectionProps> = ({ 
  resumeData, 
  onCollectInfo, 
  loading 
}) => {
  return (
    <Card style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>Complete Your Information</Title>
          <Paragraph>
            We found some information in your resume. You can review and edit the details below.
          </Paragraph>
        </div>
        
        <Form 
          onFinish={onCollectInfo} 
          layout="vertical"
          initialValues={{
            name: resumeData?.name || '',
            email: resumeData?.email || '',
            phone: resumeData?.phone || ''
          }}
        >
          <Form.Item
            name="name"
            label={
              <Space>
                <span>Full Name</span>
                {resumeData?.name && (
                  <CheckCircleOutlined 
                    style={{ color: colors.success.main, fontSize: 12 }} 
                  />
                )}
              </Space>
            }
            rules={[{ required: true, message: 'Please enter your name' }]}
          >
            <Input 
              placeholder="Enter your full name"
              prefix={resumeData?.name ? <EditOutlined style={{ color: colors.primary.main }} /> : null}
              style={{ 
                borderColor: resumeData?.name ? colors.success.main : colors.neutral[300],
                backgroundColor: resumeData?.name ? colors.success.light + '20' : colors.background.primary
              }}
            />
          </Form.Item>
          
          <Form.Item
            name="email"
            label={
              <Space>
                <span>Email</span>
                {resumeData?.email && (
                  <CheckCircleOutlined 
                    style={{ color: colors.success.main, fontSize: 12 }} 
                  />
                )}
              </Space>
            }
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input 
              placeholder="Enter your email"
              prefix={resumeData?.email ? <EditOutlined style={{ color: colors.primary.main }} /> : null}
              style={{ 
                borderColor: resumeData?.email ? colors.success.main : colors.neutral[300],
                backgroundColor: resumeData?.email ? colors.success.light + '20' : colors.background.primary
              }}
            />
          </Form.Item>
          
          <Form.Item
            name="phone"
            label={
              <Space>
                <span>Phone Number</span>
                {resumeData?.phone && (
                  <CheckCircleOutlined 
                    style={{ color: colors.success.main, fontSize: 12 }} 
                  />
                )}
              </Space>
            }
            rules={[{ required: true, message: 'Please enter your phone number' }]}
          >
            <Input 
              placeholder="Enter your phone number"
              prefix={resumeData?.phone ? <EditOutlined style={{ color: colors.primary.main }} /> : null}
              style={{ 
                borderColor: resumeData?.phone ? colors.success.main : colors.neutral[300],
                backgroundColor: resumeData?.phone ? colors.success.light + '20' : colors.background.primary
              }}
            />
          </Form.Item>
          
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              size="large"
              loading={loading}
              style={{ width: '100%' }}
            >
              Continue to Interview
            </Button>
          </Form.Item>
        </Form>
        
        {resumeData && (
          <div style={{ 
            marginTop: spacing.md, 
            padding: spacing.md, 
            backgroundColor: colors.info.light + '20', 
            borderRadius: 8,
            border: `1px solid ${colors.info.light}`
          }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text strong style={{ color: colors.info.dark }}>
                 Extracted from your resume:
              </Text>
              <div style={{ marginTop: spacing.xs }}>
                {resumeData.name && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xs }}>
                    <CheckCircleOutlined style={{ color: colors.success.main, marginRight: spacing.xs }} />
                    <Text>Name: {resumeData.name}</Text>
                  </div>
                )}
                {resumeData.email && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xs }}>
                    <CheckCircleOutlined style={{ color: colors.success.main, marginRight: spacing.xs }} />
                    <Text>Email: {resumeData.email}</Text>
                  </div>
                )}
                {resumeData.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.xs }}>
                    <CheckCircleOutlined style={{ color: colors.success.main, marginRight: spacing.xs }} />
                    <Text>Phone: {resumeData.phone}</Text>
                  </div>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
                 You can edit any of these fields above if needed
              </Text>
            </Space>
          </div>
        )}
      </Space>
    </Card>
  );
};

export default InfoCollection;
