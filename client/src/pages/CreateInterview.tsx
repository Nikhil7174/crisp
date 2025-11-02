import React, { useState } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Typography,
  Space,
  Row,
  Col,
  Divider,
  Tooltip,
  DatePicker,
} from 'antd';
import {
  ArrowLeftOutlined,
  MinusCircleOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../constants/api';
import { INTERVIEW_ROLES, TECH_STACKS, DEFAULT_TOPICS, MACHINE_CODING_TOPICS, type TopicItem, type MachineQuestionItem } from '../constants/interview';
import { colors, spacing } from '../styles';
import axios from 'axios';
import dayjs from 'dayjs';

const { Title, Text } = Typography;


export const CreateInterview: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      // Extract topics data
      const topics = values.topics || DEFAULT_TOPICS;
      const enabledTopics = topics.filter((topic: TopicItem) => topic.enabled);
      const machineQuestions: MachineQuestionItem[] = values.machineQuestions || [];

      // DEBUG: Log all form values and topic details
      console.log('=== DEBUG: Form Submission ===');
      console.log('All form values:', values);
      console.log('All topics (raw):', topics);
      console.log('Topic details:', topics.map((t: TopicItem) => ({
        name: t.name,
        questionCount: t.questionCount,
        enabled: t.enabled,
        type: typeof t.questionCount
      })));
      console.log('Enabled topics (filtered):', enabledTopics);
      console.log('Enabled topics details:', enabledTopics.map((t: TopicItem) => ({
        name: t.name,
        questionCount: t.questionCount,
        enabled: t.enabled,
        type: typeof t.questionCount
      })));

      // Validate: At least one theoretical question OR at least one machine coding question is required
      const hasTheoreticalQuestions = enabledTopics.length > 0;
      const hasMachineCodingQuestions = machineQuestions && machineQuestions.length > 0;
      
      if (!hasTheoreticalQuestions && !hasMachineCodingQuestions) {
        message.error('Please select at least one theoretical question topic OR add at least one machine coding question');
        setLoading(false); // Clear loading state before returning
        return;
      }

      // Log additional fields for future backend integration
      console.log('Interview Metadata:', {
        jobTitle: values.jobTitle,
        jobId: values.jobId,
        role: values.role,
        yearsOfExperience: values.yearsOfExperience,
        maxInterviewQuestions: values.maxInterviewQuestions,
        maxMachineCodingQuestions: values.maxMachineCodingQuestions,
        topics: enabledTopics,
        machineQuestions,
      });

      // Prepare payload for API with all interview metadata
      const roleText = Array.isArray(values.role) ? values.role.join(', ') : values.role;
      
      // Build description with proper handling of empty topics
      const topicsDescription = enabledTopics.length > 0 
        ? `Topics: ${enabledTopics.map((t: TopicItem) => `${t.name} (${t.questionCount} questions)`).join(', ')}`
        : '';
      const machineCodingDescription = machineQuestions.length > 0
        ? `Machine Coding: ${machineQuestions.map((m) => m.topic).join(', ')}`
        : '';
      
      const descriptionParts = [
        `Interview for ${values.jobTitle} (${values.jobId}) - ${roleText} with ${values.yearsOfExperience} years experience.`,
        `Max Questions: ${values.maxInterviewQuestions}, Max Machine Coding: ${values.maxMachineCodingQuestions}.`,
        topicsDescription,
        machineCodingDescription
      ].filter(part => part.length > 0); // Remove empty parts
      
      const payload = {
        title: `${values.jobTitle} - ${roleText} Interview`,
        description: descriptionParts.join(' '),
        expiryDate: values.expiryDate ? values.expiryDate.toISOString() : undefined,
        maxAttempts: 999,
        isActive: true,
        // Interview metadata for question generation
        jobTitle: values.jobTitle,
        jobId: values.jobId,
        role: Array.isArray(values.role) ? values.role.join(', ') : values.role,
        yearsOfExperience: values.yearsOfExperience,
        maxInterviewQuestions: values.maxInterviewQuestions,
        maxMachineCodingQuestions: values.maxMachineCodingQuestions,
        topics: JSON.stringify(enabledTopics),
        machineQuestions: JSON.stringify(machineQuestions),
      };

      console.log('Final payload being sent:', payload);
      try {
        console.log('Topics in payload (parsed):', JSON.parse(payload.topics));
      } catch (e) {
        console.log('Topics in payload (raw):', payload.topics);
      }

      const response = await axios.post(
        `${API_BASE_URL}/interviewer/links`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        message.success('Interview created successfully!');
        navigate('/interviewer/dashboard');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to create interview');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/interviewer/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5', padding: spacing.xl }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
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
                Create a New Interview
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16 }}>
                Set up interview details and configure question topics
              </Text>
            </Col>
            <Col>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                size="large"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                }}
              >
                Back to Dashboard
              </Button>
            </Col>
          </Row>
        </div>

        {/* Main Form */}
        <Card style={{ borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              topics: DEFAULT_TOPICS,
              machineQuestions: [],
            }}
          >
            <Row gutter={[40, 32]}>
              {/* Left Section - Basic Details */}
              <Col xs={24} lg={12}>
                <Title level={4} style={{ marginBottom: spacing.lg }}>
                  Interview Details
                </Title>

                <Form.Item
                  name="jobTitle"
                  label="Job Title"
                  rules={[{ required: true, message: 'Please enter job title' }]}
                >
                  <Input placeholder="e.g., Senior Frontend Developer" size="large" />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="jobId"
                      label="Job ID"
                      rules={[{ required: true, message: 'Please enter job ID' }]}
                    >
                      <Input placeholder="e.g., JOB-2024-001" size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="yearsOfExperience"
                      label="Years of Experience"
                      rules={[{ required: true, message: 'Please enter years of experience' }]}
                    >
                      <InputNumber
                        placeholder="e.g., 3"
                        min={0}
                        max={20}
                        style={{ width: '100%' }}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  name="role"
                  label="Choose Role"
                  rules={[{ required: true, message: 'Please select a role' }]}
                >
                  <Select
                    placeholder="Search and select role"
                    size="large"
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={INTERVIEW_ROLES}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="maxInterviewQuestions"
                      label="Max Interview Questions"
                      rules={[{ required: true, message: 'Please enter max interview questions' }]}
                    >
                      <InputNumber
                        placeholder="e.g., 10"
                        min={1}
                        max={60}
                        style={{ width: '100%' }}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="maxMachineCodingQuestions"
                      label="Max Machine Coding Questions"
                      rules={[{ required: true, message: 'Please enter max machine coding questions' }]}
                    >
                      <InputNumber
                        placeholder="e.g., 2"
                        min={0}
                        max={6}
                        style={{ width: '100%' }}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Expiry Date Field */}
                <Form.Item
                  name="expiryDate"
                  label="Expiry Date (Optional)"
                >
                  <DatePicker
                    placeholder="Select expiry date"
                    size="large"
                    style={{ 
                      width: '100%',
                      borderRadius: 8,
                    }}
                    format="YYYY-MM-DD"
                    showTime={false}
                    allowClear
                    disabledDate={(current) => {
                      // Disable dates before today
                      return current && current < dayjs().startOf('day');
                    }}
                  />
                </Form.Item>
              </Col>

              {/* Right Section - Question Topics */}
              <Col xs={24} lg={12}>
                <Title level={4} style={{ marginBottom: spacing.md }}>
                  Interview Questions Topics:
                </Title>

                {/* Technology Search and Selection */}
                <div style={{ marginBottom: spacing.lg }}>
                  <Select
                    placeholder="Search and select technology"
                    showSearch
                    size="large"
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={TECH_STACKS}
                    onSelect={(value) => {
                      const currentTopics = form.getFieldValue('topics') || [];
                      const techExists = currentTopics.some((topic: any) => topic.name === value);
                      if (!techExists) {
                        form.setFieldsValue({
                          topics: [...currentTopics, { name: value, questionCount: 1, enabled: true }]
                        });
                      }
                    }}
                  />
                </div>

                {/* Selected Technologies Display */}
                <div style={{ marginBottom: spacing.lg }}>
                  <div style={{
                    minHeight: '120px',
                    border: '2px dashed #d9d9d9',
                    borderRadius: '8px',
                    padding: spacing.md,
                    background: '#fafafa',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: spacing.sm,
                    alignItems: 'flex-start',
                    alignContent: 'flex-start'
                  }}>
                    <Form.List name="topics">
                      {(fields, { remove }) => (
                        <>
                          {fields.filter(({ name }) => {
                            const techName = form.getFieldValue(['topics', name, 'name']);
                            return techName && techName.trim() !== '';
                          }).map(({ key, name, ...restField }) => (
                            <div
                              key={key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                background: 'white',
                                color: '#333',
                                padding: '4px 8px',
                                borderRadius: '20px',
                                border: '1px solid #d9d9d9',
                                minWidth: '160px',
                                justifyContent: 'space-between',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                gap: '12px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                                <Button
                                  type="text"
                                  size="small"
                                  icon={<MinusCircleOutlined />}
                                  onClick={() => remove(name)}
                                  style={{
                                    color: '#ff4d4f',
                                    padding: '0',
                                    minWidth: 'auto',
                                    height: 'auto',
                                    background: 'transparent',
                                    borderRadius: '50%',
                                    border: 'none',
                                  }}
                                />
                                <Form.Item
                                  {...restField}
                                  name={[name, 'name']}
                                  style={{ margin: 0, flex: 1 }}
                                >
                                  <span style={{
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#333',
                                    minWidth: '80px',
                                    textAlign: 'left'
                                  }}>
                                    {form.getFieldValue(['topics', name, 'name']) || ''}
                                  </span>
                                </Form.Item>
                              </div>
                              <Form.Item
                                {...restField}
                                name={[name, 'questionCount']}
                                style={{ margin: 0 }}
                                initialValue={1}
                              >
                                <Tooltip title="Number of questions for this topic">
                                  <InputNumber
                                    min={1}
                                    max={50}
                                    size="small"
                                    bordered={false}
                                    controls={true}
                                    value={form.getFieldValue(['topics', name, 'questionCount']) || 1}
                                    style={{
                                      width: '50px',
                                      textAlign: 'center',
                                      color: '#333',
                                      background: '#f5f5f5',
                                      borderRadius: '12px',
                                      fontWeight: 'bold',
                                      fontSize: '12px'
                                    }}
                                    onChange={(value) => {
                                      // Ensure value is properly set in form
                                      const newTopics = form.getFieldValue('topics');
                                      if (newTopics && newTopics[name]) {
                                        newTopics[name].questionCount = value || 1;
                                        form.setFieldValue('topics', newTopics);
                                      }
                                    }}
                                  />
                                </Tooltip>
                              </Form.Item>
                            </div>
                          ))}
                          {fields.length === 0 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '60px',
                              color: '#999',
                              fontSize: '14px'
                            }}>
                              No technologies selected. Use the search above to add some.
                            </div>
                          )}
                        </>
                      )}
                    </Form.List>
                  </div>
                </div>

                {/* Machine Coding Questions Section */}
                <Title level={4} style={{ marginBottom: spacing.md }}>
                  Machine Coding Questions:
                </Title>
                <div style={{ marginBottom: spacing.lg }}>
                  <Select
                    placeholder="Search and select machine coding topic"
                    showSearch
                    size="large"
                    style={{ width: '100%' }}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={MACHINE_CODING_TOPICS}
                    onSelect={(value) => {
                      const current = form.getFieldValue('machineQuestions') || [];
                      const topicCount = current.filter((q: MachineQuestionItem) => q.topic === value).length;
                      if (topicCount < 2) {
                        form.setFieldsValue({
                          machineQuestions: [...current, { topic: value, difficulty: 'easy' }],
                        });
                      } else {
                        message.warning('This topic can only be selected twice maximum');
                      }
                    }}
                  />
                </div>
                <div>
                  <div style={{
                    minHeight: '120px',
                    border: '2px dashed #d9d9d9',
                    borderRadius: '8px',
                    padding: spacing.md,
                    background: '#fafafa',
                  }}>
                    <Form.List name="machineQuestions">
                      {(fields, { remove }) => (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: spacing.md }}>
                          {fields.map(({ key, name, ...restField }) => {
                            const currentQuestions = form.getFieldValue('machineQuestions') || [];
                            const currentTopic = form.getFieldValue(['machineQuestions', name, 'topic']);
                            const topicCount = currentQuestions.filter((q: MachineQuestionItem) => q.topic === currentTopic).length;
                            const isDuplicate = currentQuestions.filter((q: MachineQuestionItem, index: number) =>
                              q.topic === currentTopic && index <= name
                            ).length > 1;

                            return (
                              <div key={key} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'white',
                                border: '1px solid #d9d9d9',
                                borderRadius: 8,
                                padding: '12px',
                                gap: '8px',
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-around',
                                  gap: '8px'
                                }}>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => remove(name)}
                                    style={{ color: '#ff4d4f' }}
                                  />
                                  <Form.Item
                                    {...restField}
                                    name={[name, 'topic']}
                                    style={{ margin: 0, flex: 1 }}
                                  >
                                    <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                                      {currentTopic || ''}
                                      {isDuplicate && (
                                        <span style={{
                                          marginLeft: 6,
                                          background: '#1890ff',
                                          color: 'white',
                                          borderRadius: '50%',
                                          width: 18,
                                          height: 18,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: 9,
                                          fontWeight: 'bold',
                                          lineHeight: 1,
                                          verticalAlign: 'middle'
                                        }}>
                                          {topicCount}
                                        </span>
                                      )}
                                    </span>
                                  </Form.Item>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Form.Item
                                      {...restField}
                                      name={[name, 'difficulty']}
                                      style={{ margin: 0, flex: 1 }}
                                    >
                                      <Select
                                        size="small"
                                        style={{ width: '100%', minWidth: '80px' }}
                                        dropdownStyle={{ minWidth: '92px' }}
                                        options={[
                                          { value: 'easy', label: 'Easy' },
                                          { value: 'medium', label: 'Medium' },
                                          { value: 'hard', label: 'Hard' },
                                        ]}
                                        optionRender={(option) => (
                                          <div style={{
                                            backgroundColor: option.value === 'easy' ? '#52c41a' :
                                              option.value === 'medium' ? '#faad14' : '#ff4d4f',
                                            color: 'white',
                                            borderRadius: '12px',
                                            padding: '2px 8px',
                                            fontSize: '11px',
                                            fontWeight: '500',
                                            display: 'inline-block',
                                            minWidth: '50px',
                                            textAlign: 'center'
                                          }}>
                                            {option.label}
                                          </div>
                                        )}
                                      />
                                    </Form.Item>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {fields.length === 0 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '100%',
                              height: '60px',
                              color: '#999',
                              fontSize: '14px',
                              gridColumn: '1 / -1'
                            }}>
                              No machine coding questions added. Use the search above to add some.
                            </div>
                          )}
                        </div>
                      )}
                    </Form.List>
                  </div>
                </div>
              </Col>
            </Row>

            <Divider />

            {/* Submit Section */}
            <Row justify="center" style={{ marginTop: spacing.xl }}>
              <Space size="large">
                <Button
                  size="large"
                  onClick={handleBack}
                  style={{ minWidth: 120 }}
                >
                  Cancel
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  icon={<CheckOutlined />}
                  style={{
                    minWidth: 200,
                    height: 48,
                    fontSize: 16,
                    background: `linear-gradient(135deg, ${colors.primary.main} 0%, ${colors.info.main} 100%)`,
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}
                >
                  Generate Interview
                </Button>
              </Space>
            </Row>
          </Form>
        </Card>
      </div>
    </div>
  );
};
