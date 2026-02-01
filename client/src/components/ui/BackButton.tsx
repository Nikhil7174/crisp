import React from 'react';
import { Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

interface BackButtonProps {
  label: string;
  onClick: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ label, onClick, style, className }) => (
  <Button
    type="text"
    icon={<ArrowLeftOutlined />}
    onClick={onClick}
    className={className}
    style={{
      padding: '0 10px',
      height: 32,
      borderRadius: 6,
      background: '#F3F4F6',
      border: '1px solid #E5E7EB',
      ...style,
    }}
  >
    {label}
  </Button>
);

