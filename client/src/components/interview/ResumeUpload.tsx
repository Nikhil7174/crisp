import React from 'react';
import { Card, Typography, Space, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../styles';

const { Title, Paragraph } = Typography;

interface ResumeUploadProps {
  onFileUpload: (file: File) => void;
  uploading: boolean;
}

export const ResumeUpload: React.FC<ResumeUploadProps> = ({ onFileUpload, uploading }) => {
  return (
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
            onFileUpload(file);
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
};
