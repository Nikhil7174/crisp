import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Switch,
  message,
  Typography,
  Space,
  Tag,
  Tooltip,
  Divider,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants/api';
import type { InterviewLink } from '../types';
import { colors, spacing } from '../styles';

const { Title, Text, Paragraph } = Typography;

export const InterviewerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
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

  const handleDeleteLink = async (id: number) => {
    Modal.confirm({
      title: 'Delete Interview Link',
      content: 'Are you sure you want to delete this link? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const response = await axios.delete(
            `${API_BASE_URL}/interviewer/links/${id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          if (response.data.success) {
            message.success('Link deleted successfully!');
            fetchLinks();
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || 'Failed to delete link');
        }
      },
    });
  };

  const handleEditLink = (link: InterviewLink) => {
    setEditingLink(link);
    form.setFieldsValue({
      title: link.title,
      description: link.description,
      expiryDate: link.expiryDate ? dayjs(link.expiryDate) : null,
      maxAttempts: link.maxAttempts,
      isActive: link.isActive,
    });
    setModalVisible(true);
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    message.success('Link copied to clipboard!');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (title: string) => <strong>{title}</strong>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Active
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Inactive
          </Tag>
        ),
    },
    {
      title: 'Candidates',
      key: 'candidates',
      render: (_: any, record: InterviewLink) => (
        <Text>
          {record.totalAttempts || 0}
        </Text>
      ),
    },
    {
      title: 'Expiry Date',
      dataIndex: 'expiryDate',
      key: 'expiryDate',
      render: (date: string) =>
        date ? (
          <Text type={dayjs(date).isBefore(dayjs()) ? 'danger' : undefined}>
            {dayjs(date).format('MMM D, YYYY')}
          </Text>
        ) : (
          <Text type="secondary">No expiry</Text>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM D, YYYY'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: InterviewLink) => (
        <Space>
          <Tooltip title="Copy Link">
            <Button
              icon={<CopyOutlined />}
              onClick={() => handleCopyLink(record.url)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              icon={<EditOutlined />}
              onClick={() => handleEditLink(record)}
              size="small"
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteLink(record.id)}
              danger
              size="small"
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const activeLinks = links.filter((link) => link.isActive);
  const totalAttempts = links.reduce((sum, link) => sum + (link.totalAttempts || 0), 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: spacing.xl }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
            borderRadius: 16,
            padding: spacing.xl,
            marginBottom: spacing.xl,
            color: 'white',
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ color: 'white', margin: 0 }}>
                Welcome back, {user?.fullName}!
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
                Manage your interview links and track candidate progress
              </Text>
            </Col>
            <Col>
              <Button
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                size="large"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                }}
              >
                Logout
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
                title="Total Candidates"
                value={totalAttempts}
                prefix={<CalendarOutlined />}
                valueStyle={{ color: colors.info.main }}
              />
            </Card>
          </Col>
        </Row>

        {/* Main Content */}
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={4} style={{ margin: 0 }}>
                Interview Links
              </Title>
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
                  background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                  border: 'none',
                }}
              >
                Create New Link
              </Button>
            </div>
          }
          style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
        >
          <Table
            columns={columns}
            dataSource={links}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

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
                <Button onClick={() => {
                  setModalVisible(false);
                  setEditingLink(null);
                  form.resetFields();
                }}>
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
    </div>
  );
};

