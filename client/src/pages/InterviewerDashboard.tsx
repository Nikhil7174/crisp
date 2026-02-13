import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Input,
  Table,
  Modal,
  message,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Dropdown,
} from 'antd';
import dayjs from 'dayjs';
import {
  PlusOutlined,
  CopyOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  IdcardOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  EllipsisOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchDashboardData, removeLink } from '../store/slices/dashboardSlice';

import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants/api';
import type { InterviewLink } from '../types';
import { colors } from '../styles';
import { ViewQuestionsModal } from '../components/admin/ViewQuestionsModal';
import './InterviewerDashboard.css';

const { Title, Text } = Typography;

export const InterviewerDashboard: React.FC = () => {
  const { user, logout, getFreshToken } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // Redux state
  const { links, loading } = useAppSelector((state) => state.dashboard);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<InterviewLink | null>(null);
  const [viewQuestionsModalVisible, setViewQuestionsModalVisible] = useState(false);
  const [selectedLinkForViewing, setSelectedLinkForViewing] = useState<InterviewLink | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<number | null>(null);

  // Search state
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const freshToken = await getFreshToken();
        if (freshToken) {
          dispatch(fetchDashboardData({ token: freshToken }));
        }
      } catch (error) {
        console.error('Error fetching fresh token:', error);
      }
    };
    loadData();
  }, [dispatch, getFreshToken]);

  // Refetch on window focus
  useEffect(() => {
    const handleFocus = async () => {
      try {
        const freshToken = await getFreshToken();
        if (freshToken) {
          dispatch(fetchDashboardData({ token: freshToken }));
        }
      } catch (error) {
        console.error('Error fetching fresh token on focus:', error);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [dispatch, getFreshToken]);

  // Manual refresh function
  const handleRefresh = async () => {
    try {
      const freshToken = await getFreshToken();
      if (freshToken) {
        dispatch(fetchDashboardData({ token: freshToken, force: true }));
      }
    } catch (error) {
      console.error('Error fetching fresh token for refresh:', error);
    }
  };


  const handleDeleteLink = (link: InterviewLink) => {
    setLinkToDelete(link);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!linkToDelete) return;

    try {
      const freshToken = await getFreshToken();
      // We still use axios directly for delete, but update redux state on success
      const response = await axios.delete(
        `${API_BASE_URL}/interviewer/links/${linkToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${freshToken}` },
        }
      );

      if (response.data.success) {
        message.success('Link deleted successfully!');
        // Update Redux state
        dispatch(removeLink(linkToDelete.id));
      } else {
        message.error(response.data.message || 'Failed to delete link');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.message || 'Failed to delete link');
    } finally {
      setDeleteModalVisible(false);
      setLinkToDelete(null);
    }
  };

  const handleEditLink = (link: InterviewLink) => {
    navigate(`/interviewer/create-interview?linkId=${link.id}`);
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
      title: (
        <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {searchVisible ? (
            <Input
              placeholder="Search title..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onBlur={() => {
                if (!searchText) setSearchVisible(false);
              }}
              autoFocus
              prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
              onClick={(e) => e.stopPropagation()}
              style={{ width: '100%', fontSize: 13 }}
            />
          ) : (
            <div
              onClick={() => setSearchVisible(true)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: '100%'
              }}
            >
              Title <SearchOutlined style={{ fontSize: 12, color: '#9CA3AF' }} />
            </div>
          )}
        </div>
      ),
      dataIndex: 'title',
      key: 'title',
      width: 350,
      onHeaderCell: () => ({ style: { textAlign: 'center' as const } }),
      render: (title: string) => (
        <Text style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.6, color: '#111827' }}>
          {title}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      align: 'center' as const,
      render: (isActive: boolean, record: InterviewLink) => {
        // Check if link has expired
        const isExpired = Boolean(record.expiryDate) && dayjs(record.expiryDate).isBefore(dayjs());

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
      align: 'center' as const,
      render: (date: string) =>
        date ? (
          <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
            {dayjs(date).format('MMM D, YYYY')}
          </Text>
        ) : (
          <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
            No expiry
          </Text>
        ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      align: 'center' as const,
      render: (date: string) => (
        <Text style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.6, color: '#6B7280' }}>
          {dayjs(date).format('MMM D, YYYY')}
        </Text>
      ),
    },
    {
      title: 'Candidates',
      key: 'viewCandidates',
      align: 'center' as const,
      render: (_: any, record: InterviewLink) => (
        <Button
          size="small"
          icon={<UserOutlined style={{ fontSize: 14 }} />}
          disabled={!record.totalAttempts}
          onClick={() => navigate(`/interviewer/link/${record.id}/candidates`)}
          className="view-candidates-btn"
          style={{
            color: colors.primary.main,
            borderColor: colors.primary.main,
            background: 'transparent',
            fontWeight: 500,
            fontSize: 13,
            height: 28,
            width: 110,
            padding: 0,
            ['--primary-color' as any]: colors.primary.main
          }}
        >
          View ({record.totalAttempts || 0})
        </Button>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      render: (_: any, record: InterviewLink) => {
        // Check if link is active and not expired
        const isExpired = Boolean(record.expiryDate) && dayjs(record.expiryDate).isBefore(dayjs());

        return (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'view',
                  label: 'View Questions',
                  icon: <QuestionCircleOutlined />,
                  onClick: () => handleViewQuestions(record),
                },
                {
                  key: 'copyToken',
                  label: copiedLinkId === record.id * 1000 ? 'Copied Token!' : 'Copy Token',
                  icon: <CopyOutlined />,
                  disabled: isExpired,
                  onClick: () => {
                    navigator.clipboard.writeText(record.token);
                    message.success('Token copied to clipboard!');
                    setCopiedLinkId(record.id * 1000);
                    setTimeout(() => setCopiedLinkId(null), 2000);
                  },
                },
                {
                  key: 'edit',
                  label: 'Edit Link',
                  icon: <EditOutlined />,
                  onClick: () => handleEditLink(record),
                },
                {
                  key: 'delete',
                  label: 'Delete',
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => handleDeleteLink(record),
                },
              ],
            }}
            trigger={['click']}
          >
            <Button
              size="small"
              icon={<EllipsisOutlined />}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                borderRadius: 6,
                border: '1px solid #E5E7EB',
                color: '#6B7280',
                background: '#FFFFFF',
              }}
            />
          </Dropdown>
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

  const filteredLinks = useMemo(() => {
    let result = links || [];
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(link => link.title.toLowerCase().includes(lower));
    }
    return result;
  }, [links, searchText]);

  const totalAttempts = useMemo(() => {
    return (links || []).reduce((sum, link) => sum + (link.totalAttempts || 0), 0);
  }, [links]);

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '32px 0' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px' }}>
        {/* Header */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '24px 32px',
            marginBottom: 32,
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0, marginBottom: 4, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                Your Interviews
              </Title>
              <Text style={{ color: '#6B7280', fontSize: 14, lineHeight: 1.6 }}>
                Welcome back, {user?.fullName}
              </Text>
            </Col>
            <Col>
              <Space size={12}>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  loading={loading}
                  size="large"
                  type="text"
                  style={{
                    color: '#6B7280',
                    border: 'none',
                    height: 36,
                    fontSize: 16,
                    padding: '0 12px',
                  }}
                >
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/interviewer/create-interview')}
                  size="large"
                  className="primary-cta-btn"
                  style={{
                    background: colors.primary.main,
                    border: 'none',
                    fontWeight: 500,
                    boxShadow: 'none',
                    height: 36,
                    fontSize: 16,
                    padding: '0 12px',
                  }}
                >
                  Create New Interview
                </Button>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  size="large"
                  type="text"
                  className="ghost-logout-btn"
                  style={{
                    color: '#6B7280',
                    border: '1px solid #E5E7EB',
                    background: '#F3F4F6',
                    borderRadius: 6,
                    height: 36,
                    fontSize: 16,
                    padding: '0 12px',
                  }}
                >
                  Logout
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Summary Bar */}
        <Card
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            boxShadow: 'none',
            borderRadius: 8,
            marginBottom: 32,
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#EFF6FF',
                border: '1px solid #DBEAFE',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <LinkOutlined style={{ color: colors.primary.main, fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Total Interviews:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : links.length}
                </Text>
              </Text>
            </div>

            <Text style={{ color: '#9CA3AF' }}>|</Text>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#D1FAE5',
                border: '1px solid #A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <CheckCircleOutlined style={{ color: '#10B981', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Active Interviews:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : activeLinks.length}
                </Text>
              </Text>
            </div>

            <Text style={{ color: '#9CA3AF' }}>|</Text>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#E0F2FE',
                border: '1px solid #BAE6FD',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <IdcardOutlined style={{ color: '#0284C7', fontSize: 20 }} />
              </span>
              <Text style={{ color: '#374151', fontSize: 14 }}>
                <Text style={{ color: '#6B7280', fontWeight: 500 }}>Total Candidates:</Text>{' '}
                <Text strong style={{ color: '#111827', fontWeight: 800 }}>
                  {loading ? '—' : totalAttempts}
                </Text>
              </Text>
            </div>
          </div>
        </Card>

        {/* Main Content */}
        <Card
          title={
            <Title level={4} style={{ margin: 0, fontWeight: 600, fontSize: 18, lineHeight: 1.5 }}>
              Scheduled Interviews
            </Title>
          }
          style={{ borderRadius: 8, boxShadow: 'none', border: '1px solid #E5E7EB', background: '#FFFFFF' }}
          bodyStyle={{ padding: 24 }}
        >
          <Table
            columns={columns}
            dataSource={filteredLinks}
            rowKey="id"
            loading={loading}
            className="premium-table"
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
