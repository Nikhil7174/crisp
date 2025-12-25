// src/pages/Contact.tsx
import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography, Space, Row, Col, Alert } from 'antd';
import { UserOutlined, MailOutlined, PhoneOutlined, BuildOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import emailjs from '@emailjs/browser';
import { colors, spacing, typography, borderRadius } from '../styles';
import { motion } from 'framer-motion';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// EmailJS configuration
// Get these from your EmailJS account: https://www.emailjs.com/
// You can use environment variables or replace these values
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY';

// Check if EmailJS is configured
const isEmailJSConfigured = 
  EMAILJS_SERVICE_ID !== 'YOUR_SERVICE_ID' && 
  EMAILJS_TEMPLATE_ID !== 'YOUR_TEMPLATE_ID' && 
  EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY';

export const Contact: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (values: {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    message: string;
  }) => {
    setLoading(true);
    setShowSuccess(false); // Hide any previous success message
    try {
      if (!isEmailJSConfigured) {
        // Fallback: Create mailto link with form data
        const subject = encodeURIComponent('Contact Form Submission - Shakra AI');
        const body = encodeURIComponent(
          `Name: ${values.name}\n` +
          `Email: ${values.email}\n` +
          `Phone: ${values.phone || 'Not provided'}\n` +
          `Company: ${values.company || 'Not provided'}\n\n` +
          `Message:\n${values.message}`
        );
        window.location.href = `mailto:contact@shakra.ai?subject=${subject}&body=${body}`;
        message.info('Opening your email client. Please send the email to complete your submission.');
        form.resetFields();
        setLoading(false);
        return;
      }

      // Initialize EmailJS with public key
      emailjs.init(EMAILJS_PUBLIC_KEY);

      // Send email using EmailJS
      const templateParams = {
        from_name: values.name,
        from_email: values.email,
        phone: values.phone || 'Not provided',
        company: values.company || 'Not provided',
        message: values.message,
        to_name: 'Shakra AI Team',
      };

      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      message.success({
        content: 'Message sent successfully! We\'ll get back to you soon.',
        duration: 5,
      });
      form.resetFields();
      setShowSuccess(true);
      // Hide success message after 8 seconds
      setTimeout(() => setShowSuccess(false), 8000);
    } catch (error) {
      console.error('EmailJS error:', error);
      message.error('Failed to send message. Please try again or email us directly at contact@shakra.ai');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      background: colors.background.primary,
      padding: `${spacing.xxxl}px ${spacing.lg}px`,
    }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center', marginBottom: spacing.xxxl }}>
            <Title level={1} style={{ 
              margin: 0,
              color: colors.neutral[900],
              fontSize: typography.fontSize['4xl'],
              fontWeight: typography.fontWeight.bold,
            }}>
              Get in Touch
            </Title>
            <Paragraph style={{
              fontSize: typography.fontSize.lg,
              color: colors.neutral[600],
              maxWidth: 600,
              margin: '0 auto',
            }}>
              Fill out the form below and we'll get back to you as soon as possible.
            </Paragraph>
          </Space>

          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ marginBottom: spacing.lg }}
            >
              <Alert
                message="Message Sent Successfully!"
                description="Thank you for contacting us. We've received your message and will get back to you as soon as possible."
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
                closable
                onClose={() => setShowSuccess(false)}
                style={{
                  borderRadius: borderRadius.md,
                  maxWidth: 900,
                  margin: '0 auto',
                }}
              />
            </motion.div>
          )}

          <Card
            style={{
              borderRadius: borderRadius.xl,
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
              border: `1px solid ${colors.divider}`,
            }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              size="large"
            >
              <Row gutter={[spacing.lg, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="name"
                    label={<Text strong style={{ color: colors.neutral[900] }}>Full Name</Text>}
                    rules={[
                      { required: true, message: 'Please enter your name' },
                      { min: 2, message: 'Name must be at least 2 characters' },
                    ]}
                  >
                    <Input
                      prefix={<UserOutlined style={{ color: colors.neutral[200] }} />}
                      placeholder="John Doe"
                      style={{
                        borderRadius: borderRadius.md,
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label={<Text strong style={{ color: colors.neutral[900] }}>Email Address</Text>}
                    rules={[
                      { required: true, message: 'Please enter your email' },
                      { type: 'email', message: 'Please enter a valid email address' },
                    ]}
                  >
                    <Input
                      prefix={<MailOutlined style={{ color: colors.neutral[200] }} />}
                      placeholder="john@example.com"
                      type="email"
                      style={{
                        borderRadius: borderRadius.md,
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={[spacing.lg, 0]}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="phone"
                    label={<Text strong style={{ color: colors.neutral[900] }}>Phone Number (Optional)</Text>}
                    rules={[
                      { pattern: /^[\d\s\-\+\(\)]+$/, message: 'Please enter a valid phone number' },
                    ]}
                  >
                    <Input
                      prefix={<PhoneOutlined style={{ color: colors.neutral[200] }} />}
                      placeholder="+1 (555) 123-4567"
                      style={{
                        borderRadius: borderRadius.md,
                      }}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="company"
                    label={<Text strong style={{ color: colors.neutral[900] }}>Company (Optional)</Text>}
                  >
                    <Input
                      prefix={<BuildOutlined style={{ color: colors.neutral[200] }} />}
                      placeholder="Your Company"
                      style={{
                        borderRadius: borderRadius.md,
                      }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="message"
                label={<Text strong style={{ color: colors.neutral[900] }}>Message</Text>}
                rules={[
                  { required: true, message: 'Please enter your message' },
                  { min: 10, message: 'Message must be at least 10 characters' },
                ]}
              >
                <TextArea
                  rows={6}
                  placeholder="Tell us about your needs and how we can help..."
                  style={{
                    borderRadius: borderRadius.md,
                  }}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <Space size="middle" style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Button
                    type="default"
                    size="large"
                    onClick={() => navigate(-1)}
                    style={{
                      borderRadius: borderRadius.md,
                      minWidth: 120,
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    size="large"
                    loading={loading}
                    style={{
                      background: colors.primary.main,
                      borderColor: colors.primary.main,
                      borderRadius: borderRadius.md,
                      minWidth: 160,
                      fontWeight: typography.fontWeight.medium,
                    }}
                  >
                    Send Message
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {/* <div style={{
            marginTop: spacing.xl,
            textAlign: 'center',
          }}>
            <Text style={{ color: colors.neutral[500], fontSize: typography.fontSize.sm }}>
              Or email us directly at{' '}
              <a
                href="mailto:contact@shakra.ai"
                style={{
                  color: colors.primary.main,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                shakra7174@gmail.com
              </a>
            </Text>
          </div> */}
        </motion.div>
      </div>
    </div>
  );
};

