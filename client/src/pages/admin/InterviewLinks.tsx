import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Switch,
  message,
  Typography,
  Space,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../constants/api';
import type { InterviewLink } from '../../types';
import { colors, spacing } from '../../styles';

const { Title, Text, Paragraph } = Typography;

export const InterviewLinks: React.FC = () => {
  const [links, setLinks] = useState<InterviewLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<InterviewLink | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_BASE_URL}/interviewer/links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setLinks(response.data.links);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch links');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async (values: any) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      const payload = {
        title: values.title,
        description: values.description,
        expiryDate: values.expiryDate ? values.expiryDate.toISOString() : undefined,
        maxAttempts: values.maxAttempts || 999,
        isActive: values.isActive ?? true,
      };

      if (editingLink) {
        const response = await axios.put(
          `${API_BASE_URL}/interviewer/links/${editingLink.id}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.success) {
          message.success('Link updated successfully!');
          fetchLinks();
        }
      } else {
        const response = await axios.post(
          `${API_BASE_URL}/interviewer/links`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (response.data.success) {
          message.success('Link created successfully!');
          fetchLinks();
        }
      }

      setModalVisible(false);
      form.resetFields();
      setEditingLink(null);
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save link');
    } finally {
      setLoading(false);
    }
  };



  const activeLinks = links.filter((link) => link.isActive);
  const totalAttempts = links.reduce((sum, link) => sum + (link.totalAttempts || 0), 0);

  return (
    <div>
      {/* Hero Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
          borderRadius: 16,
          padding: spacing.xxl,
          marginBottom: spacing.xl,
          color: 'white',
        }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ color: 'white', margin: 0, marginBottom: spacing.sm }}>
              Interview Links
            </Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, margin: 0 }}>
              Create and manage interview links for your candidates
            </Paragraph>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingLink(null);
                form.resetFields();
                setModalVisible(true);
              }}
              size="large"
              style={{
                height: 48,
                fontSize: 16,
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              Create New Link
            </Button>
          </Col>
        </Row>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: spacing.xl }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Links"
              value={links.length}
              prefix={<LinkOutlined />}
              valueStyle={{ color: colors.primary.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Links"
              value={activeLinks.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Attempts"
              value={totalAttempts}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: colors.info.main }}
            />
          </Card>
        </Col>
      </Row>


      {/* Create/Edit Modal */}
      <Modal
        title={editingLink ? 'Edit Interview Link' : 'Create Interview Link'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingLink(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateLink}
          initialValues={{
            maxAttempts: 999,
            isActive: true,
          }}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="e.g., Senior Frontend Developer Interview" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={3}
              placeholder="Brief description of the interview (optional)"
            />
          </Form.Item>

          <Form.Item name="expiryDate" label="Expiry Date">
            <DatePicker
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>

          <Form.Item
            name="maxAttempts"
            label="Maximum Attempts"
            tooltip="Maximum number of candidates who can use this link"
          >
            <InputNumber
              min={1}
              max={9999}
              style={{ width: '100%' }}
              placeholder="999"
            />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: spacing.xl }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setEditingLink(null);
                  form.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {editingLink ? 'Update' : 'Create'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

