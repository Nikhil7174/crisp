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
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  LinkOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  QuestionCircleOutlined,
  EyeOutlined,
  CopyOutlined,
  EditOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import dayjs from 'dayjs';
import { API_BASE_URL } from '../../constants/api';
import type { InterviewLink } from '../../types';
import { colors, spacing } from '../../styles';
import { QuestionGenerationModal } from '../../components/admin/QuestionGenerationModal';
import { ViewQuestionsModal } from '../../components/admin/ViewQuestionsModal';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

export const InterviewLinks: React.FC = () => {
  const [links, setLinks] = useState<InterviewLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLink, setEditingLink] = useState<InterviewLink | null>(null);
  const [form] = Form.useForm();
  const [questionModalVisible, setQuestionModalVisible] = useState(false);
  const [selectedLinkForQuestions, setSelectedLinkForQuestions] = useState<InterviewLink | null>(null);
  const [viewQuestionsModalVisible, setViewQuestionsModalVisible] = useState(false);
  const [selectedLinkForViewing, setSelectedLinkForViewing] = useState<InterviewLink | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);
  const navigate = useNavigate();

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

  const handleGenerateQuestions = (link: InterviewLink) => {
    setSelectedLinkForQuestions(link);
    setQuestionModalVisible(true);
  };

  const handleViewQuestions = (link: InterviewLink) => {
    setSelectedLinkForViewing(link);
    setViewQuestionsModalVisible(true);
  };

  const handleQuestionsApproved = () => {
    fetchLinks(); // Refresh the links to show updated status
  };

  const copyToClipboard = (text: string, linkId: number) => {
    navigator.clipboard.writeText(text);
    message.success('Link copied to clipboard!');
    setCopiedLinkId(linkId);
    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedLinkId(null);
    }, 2000);
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


      {/* Links Table */}
      <Card>
        <Table
          dataSource={links}
          loading={loading}
          rowKey="id"
          columns={[
            {
              title: 'Title',
              dataIndex: 'title',
              key: 'title',
              render: (text, record) => (
                <div>
                  <Text strong>{text}</Text>
                  {record.description && (
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {record.description}
                      </Text>
                    </div>
                  )}
                </div>
              ),
            },
            {
              title: 'Status',
              dataIndex: 'isActive',
              key: 'isActive',
              render: (isActive) => (
                <Tag color={isActive ? 'green' : 'red'}>
                  {isActive ? 'Active' : 'Inactive'}
                </Tag>
              ),
            },
            {
              title: 'Attempts',
              key: 'attempts',
              render: (_, record) => (
                <div>
                  <Text>{record.totalAttempts || 0} total</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {record.completedInterviews || 0} completed
                  </Text>
                </div>
              ),
            },
            {
              title: 'Expiry',
              dataIndex: 'expiryDate',
              key: 'expiryDate',
              render: (date) => (
                date ? dayjs(date).format('MMM DD, YYYY') : 'No expiry'
              ),
            },
            {
              title: 'Questions',
              key: 'questions',
              render: (_, record) => (
                <Tag color={record.questionsApproved ? 'green' : 'orange'}>
                  {record.questionsApproved ? 'Approved' : 'Pending'}
                </Tag>
              ),
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_, record) => (
                <Space>
                  <Tooltip title="Edit Interview Setup">
                    <Button
                      icon={<EditOutlined />}
                      onClick={() => navigate(`/interviewer/create-interview?linkId=${record.id}`)}
                      size="small"
                    >
                      Edit
                    </Button>
                  </Tooltip>
                  <Tooltip title="View Questions">
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => handleViewQuestions(record)}
                      size="small"
                    >
                      View Questions
                    </Button>
                  </Tooltip>
                  <Tooltip title="Generate Questions">
                    <Button
                      type="primary"
                      icon={<QuestionCircleOutlined />}
                      onClick={() => handleGenerateQuestions(record)}
                      size="small"
                    >
                      Generate Questions
                    </Button>
                  </Tooltip>
                  <Tooltip title={copiedLinkId === record.id ? "Copied!" : "Copy Link"}>
                    <Button
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(`${window.location.origin}/join/${record.token}`, record.id)}
                      size="small"
                    >
                      Copy
                    </Button>
                  </Tooltip>
                  <Tooltip title="View Results">
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => window.open(`/admin/link-results/${record.id}`, '_blank')}
                      size="small"
                    >
                      Results
                    </Button>
                  </Tooltip>
                </Space>
              ),
            },
          ]}
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

      {/* Question Generation Modal */}
      {selectedLinkForQuestions && (
        <QuestionGenerationModal
          visible={questionModalVisible}
          onClose={() => {
            setQuestionModalVisible(false);
            setSelectedLinkForQuestions(null);
          }}
          linkId={selectedLinkForQuestions.id}
          linkTitle={selectedLinkForQuestions.title}
          onQuestionsApproved={handleQuestionsApproved}
        />
      )}

      {/* View Questions Modal */}
      {selectedLinkForViewing && (
        <ViewQuestionsModal
          visible={viewQuestionsModalVisible}
          onClose={() => {
            setViewQuestionsModalVisible(false);
            setSelectedLinkForViewing(null);
          }}
          linkId={selectedLinkForViewing.id}
          linkTitle={selectedLinkForViewing.title}
        />
      )}
    </div>
  );
};

