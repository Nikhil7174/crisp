import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Table,
  Modal,
  message,
  Typography,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
} from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants/api';
import type { InterviewLink } from '../types';
import { colors, spacing } from '../styles';
import { ViewQuestionsModal } from '../components/admin/ViewQuestionsModal';

const { Title, Text } = Typography;

export const InterviewerDashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [links, setLinks] = useState<InterviewLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<InterviewLink | null>(null);
  const [viewQuestionsModalVisible, setViewQuestionsModalVisible] = useState(false);
  const [selectedLinkForViewing, setSelectedLinkForViewing] = useState<InterviewLink | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

  // Memoized fetch function - React will handle when to call this
  const fetchLinks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/interviewer/links`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.success) {
        setLinks(response.data.links);
        setLastFetched(new Date());
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to fetch links');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  // Optional: Refetch on window focus (if data is very stale - 5 minutes)
  useEffect(() => {
    const handleFocus = () => {
      if (lastFetched && Date.now() - lastFetched.getTime() > 600000) {
        fetchLinks();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchLinks, lastFetched]);


  const handleDeleteLink = (link: InterviewLink) => {
    setLinkToDelete(link);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!linkToDelete) return;
    
    try {
      setLoading(true);
      const response = await axios.delete(
        `${API_BASE_URL}/interviewer/links/${linkToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (response.data.success) {
        message.success('Link deleted successfully!');
        fetchLinks();
      } else {
        message.error(response.data.message || 'Failed to delete link');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.message || 'Failed to delete link');
    } finally {
      setLoading(false);
      setDeleteModalVisible(false);
      setLinkToDelete(null);
    }
  };

  const handleEditLink = (link: InterviewLink) => {
    navigate(`/interviewer/create-interview?linkId=${link.id}`);
  };

  const handleCopyLink = (url: string, linkId: number) => {
    navigator.clipboard.writeText(url);
    message.success('Link copied to clipboard!');
    setCopiedLinkId(linkId);
    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedLinkId(null);
    }, 2000);
  };

  const handleViewQuestions = (link: InterviewLink) => {
    setSelectedLinkForViewing(link);
    setViewQuestionsModalVisible(true);
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
      render: (isActive: boolean, record: InterviewLink) => {
        // Check if link has expired
        const isExpired = record.expiryDate && dayjs(record.expiryDate).isBefore(dayjs());
        
        if (isExpired) {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              Expired
            </Tag>
          );
        }
        
        return isActive ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Active
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Inactive
          </Tag>
        );
      },
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
      title: 'Candidates',
      key: 'viewCandidates',
      render: (_: any, record: InterviewLink) => (
        <Button
          type="primary"
          size="small"
          onClick={() => navigate(`/interviewer/link/${record.id}/candidates`)}
          style={{ 
            background: colors.info.main,
            border: 'none'
          }}
        >
          View Candidates ({record.totalAttempts || 0})
        </Button>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: InterviewLink) => {
        // Check if link is active and not expired
        const isExpired = record.expiryDate && dayjs(record.expiryDate).isBefore(dayjs());
        const isActive = record.isActive && !isExpired;
        
        return (
          <Space>
            <Tooltip title="View Questions">
              <Button
                icon={<QuestionCircleOutlined />}
                onClick={() => handleViewQuestions(record)}
                size="small"
              />
            </Tooltip>
            <Tooltip title={copiedLinkId === record.id ? "Copied!" : (isActive ? "Copy Link" : "Link is inactive or expired")}>
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopyLink(record.url, record.id)}
                disabled={!isActive}
                size="small"
              />
            </Tooltip>
            <Tooltip title={isActive ? "Edit Link" : "Link is inactive or expired"}>
              <Button
                icon={<EditOutlined />}
                onClick={() => handleEditLink(record)}
                disabled={!isActive}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Delete">
              <Button
                icon={<DeleteOutlined />}
                onClick={() => handleDeleteLink(record)}
                danger
                size="small"
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  // Memoized computed values
  const activeLinks = useMemo(() => {
    return (links || []).filter((link) => {
      const isExpired = link.expiryDate && dayjs(link.expiryDate).isBefore(dayjs());
      return link.isActive && !isExpired;
    });
  }, [links]);

  const totalAttempts = useMemo(() => {
    return (links || []).reduce((sum, link) => sum + (link.totalAttempts || 0), 0);
  }, [links]);

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
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={fetchLinks}
                  loading={loading}
                  size="large"
                  style={{
                    background: colors.success.main,
                    border: 'none',
                    color: 'white',
                  }}
                >
                  Refresh
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/interviewer/create-interview')}
                  size="large"
                  style={{
                    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                    border: 'none',
                  }}
                >
                  Create New Interview
                </Button>
              </Space>
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


        {/* Delete Confirmation Modal */}
        <Modal
          title="Delete Interview Link"
          open={deleteModalVisible}
          onOk={confirmDelete}
          onCancel={() => {
            setDeleteModalVisible(false);
            setLinkToDelete(null);
          }}
          okText="Delete"
          cancelText="Cancel"
          okType="danger"
          confirmLoading={loading}
        >
          <p>
            Are you sure you want to delete the interview link{' '}
            <strong>"{linkToDelete?.title}"</strong>?
          </p>
          <p style={{ color: '#ff4d4f', marginBottom: 0 }}>
            This action cannot be undone and will remove all associated data.
          </p>
        </Modal>

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
    </div>
  );
};

