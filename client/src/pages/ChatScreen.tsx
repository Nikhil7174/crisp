// src/components/interview/InterviewChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Button, 
  Input, 
  Upload, 
  message, 
  Typography, 
  Space, 
  Avatar,
  Divider,
  Progress,
  Row,
  Col,
  Modal
} from 'antd';
import { 
  PaperClipOutlined, 
  SendOutlined, 
  RobotOutlined, 
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { colors, spacing, borderRadius } from '../styles';
import { useAppDispatch, useAppSelector } from '../store/index';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Message {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
}

interface CandidateInfo {
  name?: string;
  email?: string;
  phone?: string;
  resumeFile?: UploadFile;
}

interface InterviewState {
  phase: 'upload' | 'info_collection' | 'interview' | 'completed';
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  isActive: boolean;
}

export const InterviewChatScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'Welcome! Please upload your resume to begin the interview process.',
      timestamp: new Date()
    }
  ]);
  
  const [candidateInfo, setCandidateInfo] = useState<CandidateInfo>({});
  const [interviewState, setInterviewState] = useState<InterviewState>({
    phase: 'upload',
    currentQuestion: 0,
    totalQuestions: 5,
    timeRemaining: 1800, // 30 minutes
    isActive: false
  });
  
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Timer effect
  useEffect(() => {
    if (interviewState.isActive && interviewState.timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setInterviewState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1
        }));
      }, 1000);
    } else if (interviewState.timeRemaining === 0) {
      handleInterviewComplete();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [interviewState.isActive, interviewState.timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('resume', file as File);
      
      // Call your backend API
      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      
      // Update candidate info with extracted data
      setCandidateInfo({
        ...candidateInfo,
        name: data.name,
        email: data.email,
        phone: data.phone,
        resumeFile: file as UploadFile
      });
      
      // Add AI response
      addMessage({
        type: 'ai',
        content: `Great! I've extracted the following information from your resume:
        ${data.name ? `Name: ${data.name}` : ''}
        ${data.email ? `Email: ${data.email}` : ''}
        ${data.phone ? `Phone: ${data.phone}` : ''}
        
        ${!data.name || !data.email || !data.phone ? 
          'I need to collect some missing information before we begin.' : 
          'Perfect! We have all the information needed. Ready to start your interview?'
        }`
      });
      
      // Move to appropriate phase
      if (!data.name || !data.email || !data.phone) {
        setInterviewState(prev => ({ ...prev, phase: 'info_collection' }));
        collectMissingInfo(data);
      } else {
        offerInterviewStart();
      }
      
      onSuccess?.(data);
      message.success('Resume uploaded successfully!');
      
    } catch (error) {
      onError?.(error as Error);
      message.error('Failed to upload resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const collectMissingInfo = (extractedData: any) => {
    const missing = [];
    if (!extractedData.name) missing.push('name');
    if (!extractedData.email) missing.push('email');
    if (!extractedData.phone) missing.push('phone number');
    
    addMessage({
      type: 'ai',
      content: `I need your ${missing.join(', ')} to proceed. Please provide the missing information.`
    });
  };

  const offerInterviewStart = () => {
    addMessage({
      type: 'ai',
      content: `Perfect! I have all your information. This interview will consist of ${interviewState.totalQuestions} questions and will take approximately 30 minutes. Are you ready to begin?`
    });
  };

  const addMessage = (messageData: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...messageData
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;
    
    // Add user message
    addMessage({
      type: 'user',
      content: currentMessage
    });
    
    const userMessage = currentMessage;
    setCurrentMessage('');
    setIsLoading(true);
    
    try {
      // Handle different phases
      if (interviewState.phase === 'info_collection') {
        await handleInfoCollection(userMessage);
      } else if (interviewState.phase === 'interview') {
        await handleInterviewResponse(userMessage);
      } else {
        await handleGeneralResponse(userMessage);
      }
    } catch (error) {
      message.error('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInfoCollection = async (userMessage: string) => {
    // Call API to process the information
    const response = await fetch('/api/process-info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: userMessage, 
        currentInfo: candidateInfo 
      }),
    });
    
    const data = await response.json();
    
    // Update candidate info
    setCandidateInfo(prev => ({ ...prev, ...data.extractedInfo }));
    
    addMessage({
      type: 'ai',
      content: data.response
    });
    
    if (data.allInfoCollected) {
      offerInterviewStart();
    }
  };

  const handleInterviewResponse = async (userMessage: string) => {
    // Send answer to AI for evaluation and get next question
    const response = await fetch('/api/interview-response', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        answer: userMessage,
        questionNumber: interviewState.currentQuestion,
        candidateInfo
      }),
    });
    
    const data = await response.json();
    
    addMessage({
      type: 'ai',
      content: data.response
    });
    
    if (data.nextQuestion) {
      setInterviewState(prev => ({
        ...prev,
        currentQuestion: prev.currentQuestion + 1
      }));
      
      setTimeout(() => {
        addMessage({
          type: 'ai',
          content: data.nextQuestion
        });
      }, 2000);
    } else {
      handleInterviewComplete();
    }
  };

  const handleGeneralResponse = async (userMessage: string) => {
    if (userMessage.toLowerCase().includes('ready') || userMessage.toLowerCase().includes('start')) {
      startInterview();
    } else {
      // General AI response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });
      
      const data = await response.json();
      
      addMessage({
        type: 'ai',
        content: data.response
      });
    }
  };

  const startInterview = async () => {
    setInterviewState(prev => ({
      ...prev,
      phase: 'interview',
      isActive: true,
      currentQuestion: 1
    }));
    
    addMessage({
      type: 'system',
      content: 'Interview started! Timer is now active.'
    });
    
    // Get first question
    const response = await fetch('/api/start-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateInfo }),
    });
    
    const data = await response.json();
    
    setTimeout(() => {
      addMessage({
        type: 'ai',
        content: data.firstQuestion
      });
    }, 1000);
  };

  const handleInterviewComplete = () => {
    setInterviewState(prev => ({
      ...prev,
      phase: 'completed',
      isActive: false
    }));
    
    addMessage({
      type: 'system',
      content: 'Interview completed! Thank you for your time.'
    });
  };

  const uploadProps: UploadProps = {
    fileList,
    accept: '.pdf,.docx',
    maxCount: 1,
    customRequest: handleFileUpload,
    onChange: ({ fileList }) => setFileList(fileList),
    beforeUpload: (file) => {
      const isPDF = file.type === 'application/pdf';
      const isDOCX = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      
      if (!isPDF && !isDOCX) {
        message.error('Please upload a PDF or DOCX file!');
        return false;
      }
      
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('File must be smaller than 10MB!');
        return false;
      }
      
      return true;
    },
  };

  return (
    <Layout style={{ minHeight: '100vh', background: colors.background.secondary }}>
      <Content style={{ padding: spacing.xl, maxWidth: 1200, margin: '0 auto' }}>
        <Row gutter={24}>
          {/* Main Chat Area */}
          <Col xs={24} lg={16}>
            <Card
              style={{
                height: '80vh',
                borderRadius: borderRadius.lg,
                boxShadow: colors.shadows.lg,
                display: 'flex',
                flexDirection: 'column',
              }}
              bodyStyle={{ 
                padding: 0, 
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Chat Header */}
              <div style={{
                padding: spacing.lg,
                borderBottom: `1px solid ${colors.divider}`,
                background: colors.background.primary,
                borderRadius: `${borderRadius.lg} ${borderRadius.lg} 0 0`,
              }}>
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space>
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: colors.primary.main }} />
                      <div>
                        <Title level={4} style={{ margin: 0 }}>AI Interview Assistant</Title>
                        <Text type="secondary">
                          {interviewState.phase === 'upload' && 'Waiting for resume...'}
                          {interviewState.phase === 'info_collection' && 'Collecting information...'}
                          {interviewState.phase === 'interview' && `Question ${interviewState.currentQuestion}/${interviewState.totalQuestions}`}
                          {interviewState.phase === 'completed' && 'Interview completed'}
                        </Text>
                      </div>
                    </Space>
                  </Col>
                  {interviewState.isActive && (
                    <Col>
                      <Space>
                        <ClockCircleOutlined style={{ color: colors.primary.main }} />
                        <Text strong style={{ 
                          color: interviewState.timeRemaining < 300 ? colors.error.main : colors.neutral[900]
                        }}>
                          {formatTime(interviewState.timeRemaining)}
                        </Text>
                      </Space>
                    </Col>
                  )}
                </Row>
              </div>

              {/* Messages Area */}
              <div style={{
                flex: 1,
                overflow: 'auto',
                padding: spacing.lg,
                background: colors.background.secondary,
              }}>
                <AnimatePresence>
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ marginBottom: spacing.lg }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                        alignItems: 'flex-start',
                        gap: spacing.sm,
                      }}>
                        {message.type !== 'user' && (
                          <Avatar 
                            icon={message.type === 'system' ? <FileTextOutlined /> : <RobotOutlined />}
                            style={{ 
                              backgroundColor: message.type === 'system' ? colors.info.main : colors.primary.main 
                            }}
                          />
                        )}
                        
                        <div style={{
                          maxWidth: '70%',
                          background: message.type === 'user' 
                            ? colors.primary.main 
                            : colors.background.primary,
                          color: message.type === 'user' 
                            ? colors.primary.contrast 
                            : colors.neutral[900],
                          padding: spacing.md,
                          borderRadius: borderRadius.md,
                          boxShadow: colors.shadows.sm,
                          border: message.type !== 'user' ? `1px solid ${colors.divider}` : 'none',
                        }}>
                          <Paragraph 
                            style={{ 
                              margin: 0,
                              color: 'inherit',
                              whiteSpace: 'pre-line'
                            }}
                          >
                            {message.content}
                          </Paragraph>
                          <Text 
                            type="secondary" 
                            style={{ 
                              fontSize: '0.75rem',
                              opacity: 0.7,
                              color: message.type === 'user' ? 'rgba(255,255,255,0.7)' : undefined
                            }}
                          >
                            {message.timestamp.toLocaleTimeString()}
                          </Text>
                        </div>
                        
                        {message.type === 'user' && (
                          <Avatar 
                            icon={<UserOutlined />}
                            style={{ backgroundColor: colors.neutral[600] }}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div style={{
                padding: spacing.lg,
                borderTop: `1px solid ${colors.divider}`,
                background: colors.background.primary,
                borderRadius: `0 0 ${borderRadius.lg} ${borderRadius.lg}`,
              }}>
                {interviewState.phase === 'upload' && (
                  <Upload.Dragger {...uploadProps} style={{ marginBottom: spacing.md }}>
                    <div style={{ padding: spacing.lg }}>
                      <PaperClipOutlined style={{ fontSize: 48, color: colors.primary.main }} />
                      <Title level={4}>Upload your resume</Title>
                      <Paragraph type="secondary">
                        Drag and drop or click to upload (PDF required, DOCX optional)
                      </Paragraph>
                    </div>
                  </Upload.Dragger>
                )}
                
                <Row gutter={8}>
                  <Col flex={1}>
                    <TextArea
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      placeholder={
                        interviewState.phase === 'upload' 
                          ? 'Upload your resume to begin...'
                          : interviewState.phase === 'info_collection'
                          ? 'Please provide the requested information...'
                          : 'Type your answer...'
                      }
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      onPressEnter={(e) => {
                        if (!e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoading || interviewState.phase === 'upload'}
                      style={{ borderRadius: borderRadius.md }}
                    />
                  </Col>
                  <Col>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSendMessage}
                      loading={isLoading}
                      disabled={!currentMessage.trim() || interviewState.phase === 'upload'}
                      style={{ 
                        height: 'auto',
                        minHeight: 40,
                        borderRadius: borderRadius.md 
                      }}
                    />
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          {/* Sidebar */}
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* Progress Card */}
              <Card 
                title="Interview Progress" 
                style={{ borderRadius: borderRadius.lg }}
              >
                <Progress
                  percent={interviewState.phase === 'completed' ? 100 : 
                           (interviewState.currentQuestion / interviewState.totalQuestions) * 100}
                  strokeColor={colors.primary.main}
                  style={{ marginBottom: spacing.md }}
                />
                <Text type="secondary">
                  {interviewState.phase === 'upload' && 'Upload resume to start'}
                  {interviewState.phase === 'info_collection' && 'Collecting information'}
                  {interviewState.phase === 'interview' && 
                    `Question ${interviewState.currentQuestion} of ${interviewState.totalQuestions}`}
                  {interviewState.phase === 'completed' && 'Interview completed!'}
                </Text>
              </Card>

              {/* Candidate Info Card */}
              {(candidateInfo.name || candidateInfo.email || candidateInfo.phone) && (
                <Card 
                  title="Candidate Information" 
                  style={{ borderRadius: borderRadius.lg }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    {candidateInfo.name && (
                      <div>
                        <Text strong>Name: </Text>
                        <Text>{candidateInfo.name}</Text>
                      </div>
                    )}
                    {candidateInfo.email && (
                      <div>
                        <Text strong>Email: </Text>
                        <Text>{candidateInfo.email}</Text>
                      </div>
                    )}
                    {candidateInfo.phone && (
                      <div>
                        <Text strong>Phone: </Text>
                        <Text>{candidateInfo.phone}</Text>
                      </div>
                    )}
                  </Space>
                </Card>
              )}

              {/* Instructions Card */}
              <Card 
                title="Instructions" 
                style={{ borderRadius: borderRadius.lg }}
              >
                <Space direction="vertical" size="small">
                  <Text>• Upload your resume (PDF/DOCX)</Text>
                  <Text>• Provide any missing contact information</Text>
                  <Text>• Answer interview questions thoughtfully</Text>
                  <Text>• You have 30 minutes for the interview</Text>
                  <Text>• Press Enter to send, Shift+Enter for new line</Text>
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>
      </Content>
    </Layout>
  );
};