import React, { useState } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Upload,
  message,
  Form,
  Input,
  Row,
  Col
} from 'antd';
import {
  UploadOutlined,
  UserOutlined,
  RobotOutlined
} from '@ant-design/icons';
import { colors, spacing } from '../styles';

const { Title, Text, Paragraph } = Typography;

export const InterviewChat: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'upload' | 'info' | 'interview'>('upload');
  const [resumeData, setResumeData] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('resume', file);

    try {
      const response = await fetch('http://localhost:3001/api/upload/resume', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setResumeData(result.data);
        if (result.missingFields.length > 0) {
          setCurrentStep('info');
          message.warning(result.message);
        } else {
          setCurrentStep('interview');
          message.success('Resume parsed successfully!');
        }
      } else {
        message.error(result.error || 'Failed to upload resume');
      }
    } catch (error) {
      message.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const handleCollectInfo = async (values: any) => {
    try {
      const response = await fetch('http://localhost:3001/api/upload/collect-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...values,
          resumeData: resumeData
        }),
      });

      const result = await response.json();

      if (result.success) {
        setResumeData(result.data);
        setCurrentStep('interview');
        message.success('Information collected successfully!');
      } else {
        message.error(result.error || 'Failed to collect information');
      }
    } catch (error) {
      message.error('Failed to collect information');
    }
  };

  const renderUploadStep = () => (
    <Card style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>Upload Your Resume</Title>
          <Paragraph>
            Upload your resume (PDF or DOCX) to get started with your AI interview practice.
          </Paragraph>
        </div>

        <Upload.Dragger
          name="resume"
          accept=".pdf,.docx"
          beforeUpload={(file) => {
            handleFileUpload(file);
            return false;
          }}
          showUploadList={false}
          disabled={uploading}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: colors.primary.main }} />
          </p>
          <p className="ant-upload-text">
            {uploading ? 'Processing...' : 'Click or drag file to this area to upload'}
          </p>
          <p className="ant-upload-hint">
            Support for PDF and DOCX files only
          </p>
        </Upload.Dragger>
      </Space>
    </Card>
  );

  const renderInfoStep = () => (
    <Card style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>Complete Your Information</Title>
          <Paragraph>
            We found some information in your resume. Please complete the missing details below.
          </Paragraph>
        </div>

        <Form
          onFinish={handleCollectInfo}
          layout="vertical"
          initialValues={{
            name: resumeData?.name || '',
            email: resumeData?.email || '',
            phone: resumeData?.phone || ''
          }}
        >
          <Form.Item
            name="name"
            label="Full Name"
            rules={[{ required: true, message: 'Please enter your name' }]}
          >
            <Input
              placeholder="Enter your full name"
              disabled={!!resumeData?.name}
              style={{
                backgroundColor: resumeData?.name ? '#f5f5f5' : 'white',
                color: resumeData?.name ? '#666' : 'black'
              }}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' }
            ]}
          >
            <Input
              placeholder="Enter your email"
              disabled={!!resumeData?.email}
              style={{
                backgroundColor: resumeData?.email ? '#f5f5f5' : 'white',
                color: resumeData?.email ? '#666' : 'black'
              }}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone Number"
            rules={[{ required: true, message: 'Please enter your phone number' }]}
          >
            <Input
              placeholder="Enter your phone number"
              disabled={!!resumeData?.phone}
              style={{
                backgroundColor: resumeData?.phone ? '#f5f5f5' : 'white',
                color: resumeData?.phone ? '#666' : 'black'
              }}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              style={{ width: '100%' }}
            >
              Continue to Interview
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );

  const renderInterviewStep = () => (
    <Card style={{ maxWidth: 800, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <Title level={3}>AI Interview Session</Title>
          <Paragraph>
            Your interview will start soon. The AI will ask you questions based on your resume.
          </Paragraph>
        </div>

        <div style={{
          height: 400,
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: 8,
          padding: spacing.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <RobotOutlined style={{ fontSize: 64, color: colors.primary.main, marginBottom: spacing.md }} />
          <Text>Interview interface will be implemented here</Text>
          <Text type="secondary">This is a placeholder for the chat interface</Text>
        </div>

        <Button
          type="primary"
          size="large"
          onClick={() => setCurrentStep('upload')}
          style={{ width: '100%' }}
        >
          Start New Interview
        </Button>
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: spacing.lg, minHeight: '100vh', background: colors.background.primary }}>
      {currentStep === 'upload' && renderUploadStep()}
      {currentStep === 'info' && renderInfoStep()}
      {currentStep === 'interview' && renderInterviewStep()}
    </div>
  );
};

export default InterviewChat;
