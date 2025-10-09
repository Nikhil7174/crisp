import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  message,
  Spin,
  Space,
  Tooltip,
  Modal,
  Form,
  Input,
  DatePicker,
  InputNumber,
  Switch,
} from 'antd';
import {
  EyeOutlined,
  LinkOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { colors, spacing } from '../../styles';
import { API_BASE_URL } from '../../constants/api';
import type { InterviewLink } from '../../types';

const { Title, Text } = Typography;

export const InterviewResults: React.FC = () => {
  const navigate = useNavigate();
  const [links, setLinks] = useState<InterviewLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<InterviewLink | null>(null);
  const [form] = Form.useForm();
  const [statistics, setStatistics] = useState({
    totalLinks: 0,
    activeLinks: 0,
    totalCandidates: 0,
  });

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await axios.get(`${API_BASE_URL}/interviewer/links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        const fetchedLinks = response.data.links;
        setLinks(fetchedLinks);
        
        // Calculate statistics
        const activeLinks = fetchedLinks.filter((link: InterviewLink) => link.isActive);
        const totalCandidates = fetchedLinks.reduce(
          (sum: number, link: InterviewLink) => sum + (link.totalAttempts || 0),
          0
        );
        
        setStatistics({
          totalLinks: fetchedLinks.length,
          activeLinks: activeLinks.length,
          totalCandidates,
        });
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch interview links');
    } finally {
      setLoading(false);
    }
  };

  const handleViewLinkResults = (linkId: number) => {
    navigate(`/admin/link-results/${linkId}`);
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

  const handleDeleteLink = async (id: number) => {
    Modal.confirm({
      title: 'Delete Interview Link',
      content: 'Are you sure you want to delete this link? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const token = localStorage.getItem('adminToken');
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

  const columns = [
    {
      title: 'Interview Link',
      key: 'link',
      render: (record: InterviewLink) => (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{record.title}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean) =>
        isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Active
          </Tag>
        ) : (
          <Tag color="default">Inactive</Tag>
        ),
    },
    {
      title: 'Candidates',
      key: 'candidates',
      width: 120,
      render: (record: InterviewLink) => (
        <Text strong style={{ color: colors.primary.main }}>
          {record.totalAttempts || 0}
        </Text>
      ),
      sorter: (a: InterviewLink, b: InterviewLink) => 
        (a.totalAttempts || 0) - (b.totalAttempts || 0),
    },
    {
      title: 'Expiry',
      key: 'expiry',
      width: 150,
      render: (record: InterviewLink) => {
        if (!record.expiryDate) {
          return (
            <Tag color="blue" style={{ borderRadius: 6 }}>
              No Expiry
            </Tag>
          );
        }

        const expiryDate = dayjs(record.expiryDate);
        const now = dayjs();
        const isExpired = expiryDate.isBefore(now);
        const daysDiff = Math.abs(expiryDate.diff(now, 'day'));

        if (isExpired) {
          return (
            <div>
              <Tag color="red" style={{ borderRadius: 6, marginBottom: 4 }}>
                Expired
              </Tag>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {expiryDate.format('MMM D, YYYY')}
                </Text>
              </div>
            </div>
          );
        } else {
          return (
            <Tag color="green" style={{ borderRadius: 6 }}>
              {daysDiff === 0 ? 'Expires Today' : `${daysDiff} day${daysDiff > 1 ? 's' : ''} left`}
            </Tag>
          );
        }
      },
    },
    {
      title: 'Interview Details',
      key: 'interviewDetails',
      width: 180,
      render: (record: InterviewLink) => {
        const hasCandidates = record.totalAttempts && record.totalAttempts > 0;
        
        return (
          <div style={{ textAlign: 'center' }}>
            {hasCandidates ? (
              <div>
                <div style={{ marginBottom: 4 }}>
                  <Text strong style={{ color: colors.primary.main, fontSize: 16 }}>
                    {record.totalAttempts || 0} Candidate{(record.totalAttempts || 0) > 1 ? 's' : ''}
                  </Text>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {(record.totalAttempts || 0) === 1 ? '1 interview completed' : `${record.totalAttempts || 0} interviews completed`}
                  </Text>
                </div>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => handleViewLinkResults(record.id)}
                  size="small"
                  style={{ borderRadius: 6 }}
                >
                  View Results
                </Button>
              </div>
            ) : (
              <div>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  No candidates yet
                </Text>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (record: InterviewLink) => {
        const isExpired = record.expiryDate && dayjs(record.expiryDate).isBefore(dayjs());
        const isInactive = !record.isActive;
        const showCopyEdit = !isExpired && !isInactive;

        return (
          <Space>
            {showCopyEdit && (
              <>
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
              </>
            )}
            <Tooltip title="Delete">
              <Button
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteLink(record.id)}
                danger
                size="small"
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.xl }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Interview Links"
              value={statistics.totalLinks}
              prefix={<LinkOutlined />}
              valueStyle={{ color: colors.primary.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Links"
              value={statistics.activeLinks}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: colors.success.main }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Candidates"
              value={statistics.totalCandidates}
              prefix={<UserOutlined />}
              valueStyle={{ color: colors.info.main }}
            />
          </Card>
        </Col>
      </Row>

      {/* Interview Links Table */}
      <Card
        title={
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Interview Links & Results
            </Title>
            <Text type="secondary">Click on any link to view candidate results</Text>
          </div>
        }
        style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Table
          columns={columns}
          dataSource={links}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} links`,
          }}
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

