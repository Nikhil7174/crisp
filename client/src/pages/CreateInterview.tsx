import React, { useState, useEffect } from 'react';
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
  Radio,
  Upload,
  Table,
  Alert,
  Checkbox,
  Modal,
  Empty,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  MinusCircleOutlined,
  CheckOutlined,
  UploadOutlined,
  PlusOutlined,
  CaretRightOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { API_BASE_URL } from '../constants/api';
import { INTERVIEW_ROLES, TECH_STACKS, DEFAULT_TOPICS, MACHINE_CODING_TOPICS, type TopicItem, type MachineQuestionItem } from '../constants/interview';
import { colors, spacing } from '../styles';
import axios from 'axios';
import dayjs from 'dayjs';
import type { RcFile } from 'antd/es/upload';
import { parseTheoreticalQuestionCsv, type ManualTheoreticalQuestion } from '../utils/csvParser';

const { Title, Text } = Typography;

type CodingExample = {
  input?: string;
  output?: string;
  explanation?: string;
};

type CodingTestCase = {
  input?: string;
  expectedOutput?: string;
  isHidden?: boolean;
};

interface ManualCodingQuestionFormValues {
  title?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  problemStatement?: string;
  constraints?: string;
  timeLimit?: number;
  hints?: string;
  examples?: CodingExample[];
  testCases?: CodingTestCase[];
  starterCodes?: Record<string, string>;
}

interface ManualCodingQuestionPayload {
  id: string;
  type: 'machine_coding';
  question: string;
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  problemStatement: string;
  constraints?: string[];
  timeLimit: number;
  starterCode?: string;
  starterCodes?: Record<string, string>;
  hints?: string[];
  examples?: CodingExample[];
  testCases: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
}

const SUPPORTED_STARTER_LANGUAGES = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'Python', value: 'python' },
  { label: 'C++', value: 'cpp' },
  { label: 'Java', value: 'java' },
];

const defaultCodingQuestionValues: ManualCodingQuestionFormValues = {
  title: '',
  topic: '',
  difficulty: 'medium',
  timeLimit: 1200,
  problemStatement: '',
  constraints: '',
  hints: '',
  examples: [],
  testCases: [{ input: '', expectedOutput: '', isHidden: false }],
  starterCodes: {},
};

export const CreateInterview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getFreshToken } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const isEditMode = Boolean(editingLinkId);
  const questionSource = Form.useWatch('questionSource', form) || 'auto';
  const isManualSource = questionSource === 'manual';
  const [manualTheoreticalQuestions, setManualTheoreticalQuestions] = useState<ManualTheoreticalQuestion[]>([]);
  const [manualCodingQuestions, setManualCodingQuestions] = useState<ManualCodingQuestionFormValues[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [codingModalVisible, setCodingModalVisible] = useState(false);
  const [editingCodingQuestionIndex, setEditingCodingQuestionIndex] = useState<number | null>(null);
  const [codingForm] = Form.useForm<ManualCodingQuestionFormValues>();
  const [selectedStarterLanguage, setSelectedStarterLanguage] = useState<string>(SUPPORTED_STARTER_LANGUAGES[0].value);
  const [questionPanelOpen, setQuestionPanelOpen] = useState(false);
  const jobTitle = Form.useWatch('jobTitle', form);
  const jobId = Form.useWatch('jobId', form);
  const yearsOfExperience = Form.useWatch('yearsOfExperience', form);
  const roleValue = Form.useWatch('role', form);
  const maxInterviewQuestions = 30;
  const maxMachineCodingQuestions = 5;
  const hasFilledInterviewDetails =
    Boolean(jobTitle) &&
    Boolean(jobId) &&
    (yearsOfExperience || yearsOfExperience === 0) &&
    Boolean(roleValue);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkIdParam = params.get('linkId');
    setEditingLinkId(linkIdParam);
  }, [location.search]);

  useEffect(() => {
    if (hasFilledInterviewDetails) {
      setQuestionPanelOpen(true);
    }
  }, [hasFilledInterviewDetails]);

  useEffect(() => {
    codingForm.setFieldsValue(defaultCodingQuestionValues);
  }, [codingForm]);

  useEffect(() => {
    if (!editingLinkId) {
      return;
    }
    const fetchInterviewDetails = async () => {
      setPrefillLoading(true);
      try {
        const token = await getFreshToken();
        if (!token) {
          message.error('Authentication token missing. Please log in again.');
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/interviewer/interview-link/${editingLinkId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.data?.success) {
          const data = response.data.data;
          const parsedTopics = Array.isArray(data.topics) && data.topics.length > 0 ? data.topics : DEFAULT_TOPICS;
          const parsedMachineQuestions = Array.isArray(data.machineQuestions) ? data.machineQuestions : [];

          setManualTheoreticalQuestions(data.manualTheoreticalQuestions || []);
          const convertedManualCoding = (data.manualCodingQuestions || []).map(convertManualCodingPayloadToFormValues);
          setManualCodingQuestions(convertedManualCoding);

          form.setFieldsValue({
            jobTitle: data.jobTitle || '',
            jobId: data.jobId || '',
            yearsOfExperience: data.yearsOfExperience ?? null,
            role: data.role || undefined,
            maxInterviewQuestions: data.maxInterviewQuestions ?? undefined,
            maxMachineCodingQuestions: data.maxMachineCodingQuestions ?? undefined,
            expiryDate: data.expiryDate ? dayjs(data.expiryDate) : null,
            topics: parsedTopics,
            machineQuestions: parsedMachineQuestions,
            questionSource: data.questionSource || 'auto',
          });
          setQuestionPanelOpen(true);
        }
      } catch (error: any) {
        console.error('Failed to load interview details', error);
        message.error(error.response?.data?.error || 'Failed to load interview details');
      } finally {
        setPrefillLoading(false);
      }
    };

    fetchInterviewDetails();
  }, [editingLinkId, form, getFreshToken]);

  const splitMultiline = (value?: string): string[] =>
    value
      ? value
        .split('\n')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
      : [];

  const normalizeManualCodingQuestions = (questions: ManualCodingQuestionFormValues[]): ManualCodingQuestionPayload[] =>
    questions.map((question, idx) => {
      const examples = (question.examples || []).map((example) => ({
        input: example?.input?.trim(),
        output: example?.output?.trim(),
        explanation: example?.explanation?.trim(),
      }));

      const testCases = (question.testCases || []).map((testCase) => ({
        input: (testCase?.input || '').trim(),
        expectedOutput: (testCase?.expectedOutput || '').trim(),
        isHidden: Boolean(testCase?.isHidden),
      }));

      const rawStarterCodes = question.starterCodes || {};
      const starterCodes = Object.entries(rawStarterCodes).reduce<Record<string, string>>((acc, [language, code]) => {
        if (language && code && code.trim()) {
          acc[language] = code.trim();
        }
        return acc;
      }, {});

      return {
        id: `manual-coding-${Date.now()}-${idx}`,
        type: 'machine_coding',
        question: question.title?.trim() || 'Untitled Coding Question',
        topic: question.topic?.trim() || 'Custom',
        difficulty: question.difficulty || 'medium',
        problemStatement: question.problemStatement || '',
        constraints: splitMultiline(question.constraints),
        timeLimit: question.timeLimit || 1200,
        starterCodes: Object.keys(starterCodes).length > 0 ? starterCodes : undefined,
        hints: splitMultiline(question.hints),
        examples,
        testCases: testCases.length > 0 ? testCases : [{ input: '', expectedOutput: '', isHidden: false }],
      };
    });

  const convertManualCodingPayloadToFormValues = (question: ManualCodingQuestionPayload): ManualCodingQuestionFormValues => ({
    title: question.question,
    topic: question.topic,
    difficulty: question.difficulty,
    problemStatement: question.problemStatement,
    constraints: Array.isArray(question.constraints) ? question.constraints.join('\n') : question.constraints || '',
    timeLimit: question.timeLimit,
    hints: Array.isArray(question.hints) ? question.hints.join('\n') : question.hints || '',
    examples: question.examples || [],
    testCases: question.testCases || [],
    starterCodes: question.starterCodes ? { ...question.starterCodes } : {},
  });

  const handleCsvUpload = async (file: RcFile) => {
    try {
      const text = await file.text();
      const result = parseTheoreticalQuestionCsv(text);

      let validQuestions = result.questions;
      if (validQuestions.length > 30) {
        validQuestions = validQuestions.slice(0, 30);
        message.warning(`CSV contained more than 30 questions. Truncated to first 30.`);
      }

      setManualTheoreticalQuestions(validQuestions);
      setCsvErrors(result.errors);

      if (validQuestions.length > 0) {
        message.success(`Parsed ${validQuestions.length} theoretical questions`);
      } else if (result.errors.length > 0) {
        message.error(result.errors[0]);
      }
    } catch (error) {
      console.error('CSV parse error:', error);
      message.error('Failed to parse CSV file');
    }
    return false;
  };

  const openCodingModal = (question?: ManualCodingQuestionFormValues, index: number | null = null) => {
    setEditingCodingQuestionIndex(index);
    codingForm.setFieldsValue({
      ...defaultCodingQuestionValues,
      ...question,
      examples: question?.examples && question.examples.length > 0 ? question.examples : [],
      testCases:
        question?.testCases && question.testCases.length > 0
          ? question.testCases
          : [{ input: '', expectedOutput: '', isHidden: false }],
      starterCodes: question?.starterCodes || {},
    });
    const starterCodeKeys = question?.starterCodes ? Object.keys(question.starterCodes) : [];
    if (starterCodeKeys.length > 0) {
      setSelectedStarterLanguage(starterCodeKeys[0]);
    } else {
      setSelectedStarterLanguage(SUPPORTED_STARTER_LANGUAGES[0].value);
    }
    setCodingModalVisible(true);
  };

  const handleCodingModalOk = async () => {
    try {
      const values = await codingForm.validateFields();
      if (!values.starterCodes) {
        values.starterCodes = {};
      }
      setManualCodingQuestions((prev) => {
        if (editingCodingQuestionIndex !== null) {
          const updated = [...prev];
          updated[editingCodingQuestionIndex] = values;
          return updated;
        }

        if (prev.length >= 5) {
          message.warning('Maximum of 5 manual coding questions allowed.');
          return prev;
        }

        return [...prev, values];
      });
      setCodingModalVisible(false);
      setEditingCodingQuestionIndex(null);
      codingForm.resetFields();
      codingForm.setFieldsValue(defaultCodingQuestionValues);
      setSelectedStarterLanguage(SUPPORTED_STARTER_LANGUAGES[0].value);
    } catch (error) {
      // validation handled by form
    }
  };

  const handleCodingModalCancel = () => {
    setCodingModalVisible(false);
    setEditingCodingQuestionIndex(null);
    codingForm.resetFields();
    codingForm.setFieldsValue(defaultCodingQuestionValues);
    setSelectedStarterLanguage(SUPPORTED_STARTER_LANGUAGES[0].value);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);

      const token = await getFreshToken();
      if (!token) {
        message.error('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }

      // Extract form data
      const selectedSource = values.questionSource || questionSource;
      const topics = values.topics || DEFAULT_TOPICS;
      const enabledTopics = topics.filter((topic: TopicItem) => topic.enabled);
      const machineQuestions: MachineQuestionItem[] = values.machineQuestions || [];
      const manualCodingFormValues: ManualCodingQuestionFormValues[] = manualCodingQuestions;
      const isManual = selectedSource === 'manual';

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

      // Validate question selection based on source
      const hasTheoreticalQuestions = enabledTopics.length > 0;
      const hasMachineCodingQuestions = machineQuestions && machineQuestions.length > 0;

      if (!isManual) {
        if (!hasTheoreticalQuestions && !hasMachineCodingQuestions) {
          message.error('Please select at least one theoretical question topic OR add at least one machine coding question');
          setLoading(false);
          return;
        }
      } else {
        if (manualTheoreticalQuestions.length === 0 && manualCodingFormValues.length === 0) {
          message.error('Please upload at least one theoretical question or add a coding question');
          setLoading(false);
          return;
        }

        const missingRequiredCodingFields = manualCodingFormValues.some(
          (question) =>
            !question?.title ||
            !question?.topic ||
            !question?.problemStatement ||
            !question?.difficulty,
        );

        if (missingRequiredCodingFields) {
          message.error('Please fill all required fields for each manual coding question');
          setLoading(false);
          return;
        }
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
        topicsDescription,
        machineCodingDescription
      ].filter(part => part.length > 0); // Remove empty parts

      const normalizedManualCodingQuestions = isManual ? normalizeManualCodingQuestions(manualCodingFormValues) : [];

      const payload: Record<string, any> = {
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
        maxInterviewQuestions: 30,
        maxMachineCodingQuestions: 5,
        topics: JSON.stringify(enabledTopics),
        machineQuestions: JSON.stringify(machineQuestions),
        questionSource: selectedSource,
      };

      if (isManual) {
        payload.manualTheoreticalQuestions = manualTheoreticalQuestions;
        payload.manualCodingQuestions = normalizedManualCodingQuestions;
      }

      console.log('Final payload being sent:', payload);
      try {
        console.log('Topics in payload (parsed):', JSON.parse(payload.topics));
      } catch (e) {
        console.log('Topics in payload (raw):', payload.topics);
      }

      const endpoint = editingLinkId
        ? `${API_BASE_URL}/interviewer/links/${editingLinkId}`
        : `${API_BASE_URL}/interviewer/links`;
      const request = editingLinkId ? axios.put : axios.post;

      const response = await request(
        endpoint,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        message.success(editingLinkId ? 'Interview updated successfully!' : 'Interview created successfully!');
        navigate('/interviewer/dashboard');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Failed to save interview');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/interviewer/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', padding: '32px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        {/* Header */}
        <div
          style={{
            background: colors.primary.main,
            borderRadius: 8,
            padding: '24px 32px',
            marginBottom: 32,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ margin: 0, marginBottom: 4, fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#FFFFFF' }}>
                {isEditMode ? 'Edit Interview' : 'Create a New Interview'}
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: 14, lineHeight: 1.6 }}>
                {isEditMode
                  ? 'Update interview details and adjust question configuration.'
                  : 'Set up interview details and configure question topics'}
              </Text>
            </Col>
            <Col>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleBack}
                size="large"
                type="text"
                style={{
                  color: '#FFFFFF',
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: 6,
                  height: 36,
                  fontSize: 14,
                  padding: '0 16px',
                }}
              >
                Back to Dashboard
              </Button>
            </Col>
          </Row>
        </div>

        {/* Main Form */}
        <Card
          style={{
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            boxShadow: 'none',
            background: '#FFFFFF',
          }}
          bodyStyle={{ padding: 32 }}
        >
          <Spin spinning={prefillLoading}>
            <div style={{ maxWidth: 900, margin: '0 auto' }}>
              <Form
                form={form}
                layout="vertical"
                style={{ width: '100%' }}
                onFinish={handleSubmit}
                initialValues={{
                  topics: DEFAULT_TOPICS,
                  machineQuestions: [],
                  questionSource: 'auto',
                  manualCodingQuestions: [],
                }}
              >
                <Row gutter={[60, 32]}>
                  {/* Left Section - Basic Details */}
                  <Col xs={24} lg={24} style={{ marginBottom: spacing.xl }}>
                    <Title level={4} style={{ marginBottom: spacing.lg }}>
                      Interview Details
                    </Title>

                    <Form.Item
                      name="jobTitle"
                      label="Job Title"
                      rules={[{ required: true, message: 'Please enter job title' }]}
                    >
                      <Input placeholder="e.g., Senior Java Developer - Payments Team" size="large" />
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

                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
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
                      </Col>
                      <Col xs={24} sm={12}>
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
                    </Row>
                  </Col>

                  {/* Right Section - Question Topics */}

                  <Col xs={24} lg={24}>
                    <div
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: 12,
                        background: '#fff',
                        marginBottom: spacing.lg,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: spacing.md,
                          cursor: 'pointer',
                        }}
                        onClick={() => setQuestionPanelOpen((prev) => !prev)}
                      >
                        <Title level={5} style={{ margin: 0 }}>
                          Question Source & Topics
                        </Title>
                        <CaretRightOutlined rotate={questionPanelOpen ? 90 : 0} />
                      </div>
                      {questionPanelOpen && (
                        <div style={{ padding: spacing.md, paddingTop: spacing.md }}>
                          <Form.Item name="questionSource" style={{ marginBottom: spacing.xl }}>
                            <Radio.Group style={{ display: 'flex', width: '100%' }}>
                              <Radio.Button value="auto" style={{ flex: 1, textAlign: 'center' }}>Shakra's Question Bank</Radio.Button>
                              <Radio.Button value="manual" style={{ flex: 1, textAlign: 'center' }}>Upload Your Own Questions</Radio.Button>
                            </Radio.Group>
                          </Form.Item>
                          {!isManualSource ? (
                            <>
                              <Title level={5} style={{ marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: 8 }}>
                                Theoretical Questions Topics:
                                <Tooltip title="Max questions: 30">
                                  <InfoCircleOutlined style={{ color: '#9CA3AF', fontSize: 14, cursor: 'pointer' }} />
                                </Tooltip>
                              </Title>
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

                                    // Check global limit
                                    const currentTotal = currentTopics.reduce((sum: number, t: TopicItem) => sum + (t.questionCount || 0), 0);
                                    if (currentTotal >= maxInterviewQuestions) {
                                      message.warning(`Maximum total of ${maxInterviewQuestions} theoretical questions reached.`);
                                      return;
                                    }

                                    if (!techExists) {
                                      form.setFieldsValue({
                                        topics: [...currentTopics, { name: value, questionCount: 1, enabled: true }],
                                      });
                                    }
                                  }}
                                />
                              </div>
                              <div style={{ marginBottom: spacing.lg }}>
                                <div
                                  style={{
                                    minHeight: '120px',
                                    border: '2px dashed #d9d9d9',
                                    borderRadius: '8px',
                                    padding: spacing.md,
                                    background: '#fafafa',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: spacing.sm,
                                    alignItems: 'flex-start',
                                    alignContent: 'flex-start',
                                  }}
                                >
                                  <Form.List name="topics">
                                    {(fields, { remove }) => (
                                      <>
                                        {fields
                                          .filter(({ name }) => {
                                            const techName = form.getFieldValue(['topics', name, 'name']);
                                            return techName && techName.trim() !== '';
                                          })
                                          .map(({ key, name, ...restField }) => (
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
                                                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
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
                                                <Form.Item {...restField} name={[name, 'name']} style={{ margin: 0, flex: 1 }}>
                                                  <span
                                                    style={{
                                                      fontSize: '14px',
                                                      fontWeight: 500,
                                                      color: '#333',
                                                      minWidth: '80px',
                                                      textAlign: 'left',
                                                    }}
                                                  >
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
                                                    size="small"
                                                    bordered={false}
                                                    controls
                                                    value={form.getFieldValue(['topics', name, 'questionCount']) || 1}
                                                    style={{
                                                      width: '50px',
                                                      textAlign: 'center',
                                                      color: '#333',
                                                      background: '#fafafa',
                                                      borderRadius: '12px',
                                                      fontWeight: 'bold',
                                                      fontSize: '12px',
                                                    }}
                                                    onChange={(value) => {
                                                      const newTopics = form.getFieldValue('topics');
                                                      if (newTopics && newTopics[name]) {
                                                        // Calculate potential new total
                                                        const otherTopicsTotal = newTopics.reduce((sum: number, t: TopicItem, idx: number) => {
                                                          return idx === name ? sum : sum + (t.questionCount || 0);
                                                        }, 0);

                                                        if (otherTopicsTotal + (value || 0) > maxInterviewQuestions) {
                                                          message.warning(`Total questions cannot exceed ${maxInterviewQuestions}`);
                                                          // Reset to max possible for this field or keep old value
                                                          // For now just don't update if it exceeds
                                                          return;
                                                        }

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
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              width: '100%',
                                              height: '60px',
                                              color: '#999',
                                              fontSize: '14px',
                                            }}
                                          >
                                            No technologies selected. Use the search above to add some.
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </Form.List>
                                </div>
                              </div>

                              <Title level={5} style={{ marginBottom: spacing.md, display: 'flex', alignItems: 'center', gap: 8 }}>
                                Coding Questions:
                                <Tooltip title="Max questions: 5">
                                  <InfoCircleOutlined style={{ color: '#9CA3AF', fontSize: 14, cursor: 'pointer' }} />
                                </Tooltip>
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

                                    // Check global limit
                                    if (current.length >= maxMachineCodingQuestions) {
                                      message.warning(`Maximum of ${maxMachineCodingQuestions} machine coding questions reached.`);
                                      return;
                                    }

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
                                <div
                                  style={{
                                    minHeight: '120px',
                                    border: '2px dashed #d9d9d9',
                                    borderRadius: '8px',
                                    padding: spacing.md,
                                    background: '#fafafa',
                                  }}
                                >
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
                                            <div
                                              key={key}
                                              style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                background: 'white',
                                                border: '1px solid #d9d9d9',
                                                borderRadius: 8,
                                                padding: '12px',
                                                gap: '8px',
                                              }}
                                            >
                                              <div
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  justifyContent: 'space-around',
                                                  gap: '8px',
                                                }}
                                              >
                                                <Button
                                                  type="text"
                                                  size="small"
                                                  icon={<MinusCircleOutlined />}
                                                  onClick={() => remove(name)}
                                                  style={{ color: '#ff4d4f' }}
                                                />
                                                <Form.Item {...restField} name={[name, 'topic']} style={{ margin: 0, flex: 1 }}>
                                                  <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>
                                                    {currentTopic || ''}
                                                    {isDuplicate && (
                                                      <span
                                                        style={{
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
                                                          verticalAlign: 'middle',
                                                        }}
                                                      >
                                                        {topicCount}
                                                      </span>
                                                    )}
                                                  </span>
                                                </Form.Item>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <Form.Item {...restField} name={[name, 'difficulty']} style={{ margin: 0, flex: 1 }}>
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
                                                        <div
                                                          style={{
                                                            backgroundColor: option.value === 'easy' ? '#52c41a' : option.value === 'medium' ? '#faad14' : '#ff4d4f',
                                                            color: 'white',
                                                            borderRadius: '12px',
                                                            padding: '2px 8px',
                                                            fontSize: '11px',
                                                            fontWeight: '500',
                                                            display: 'inline-block',
                                                            minWidth: '50px',
                                                            textAlign: 'center',
                                                          }}
                                                        >
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
                                          <div
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              width: '100%',
                                              height: '60px',
                                              color: '#999',
                                              fontSize: '14px',
                                              gridColumn: '1 / -1',
                                            }}
                                          >
                                            No machine coding questions added. Use the search above to add some.
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </Form.List>
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <Card style={{ borderRadius: 12, marginBottom: spacing.lg }} bodyStyle={{ padding: spacing.md }}>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: spacing.md,
                                    marginBottom: spacing.sm,
                                  }}
                                >
                                  <Title level={5} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    Theoretical Questions (CSV Upload)
                                    <Tooltip title="Maximum 30 theoretical questions allowed in total">
                                      <InfoCircleOutlined style={{ color: '#9CA3AF', fontSize: 14, cursor: 'pointer' }} />
                                    </Tooltip>
                                  </Title>
                                  <Button
                                    type="link"
                                    icon={<DownloadOutlined />}
                                    href="/manual-theoretical-sample.csv"
                                    download
                                    style={{ paddingRight: 0 }}
                                  >
                                    Download sample CSV
                                  </Button>
                                </div>
                                <Upload.Dragger
                                  accept=".csv"
                                  multiple={false}
                                  showUploadList={false}
                                  beforeUpload={handleCsvUpload}
                                  style={{ background: '#fafafa', borderRadius: 12 }}
                                >
                                  <div style={{ padding: spacing.lg }}>
                                    <p className="ant-upload-drag-icon" style={{ marginBottom: spacing.sm }}>
                                      <UploadOutlined />
                                    </p>
                                    <p className="ant-upload-text" style={{ fontSize: 13 }}>
                                      Click or drag CSV file with theoretical questions
                                    </p>
                                    <p className="ant-upload-hint" style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
                                      Required columns (marked *): question*, topic*, difficulty*, expectedAnswer*. Optional: explanation, keyPoints.
                                    </p>
                                  </div>
                                </Upload.Dragger>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: spacing.xs }}>
                                  Sample file includes * on compulsory headers; uploads will accept those markers automatically.
                                </Text>
                                {csvErrors.length > 0 && (
                                  <div style={{ marginTop: spacing.md }}>
                                    {csvErrors.map((error, idx) => (
                                      <Alert key={idx} message={error} type="warning" showIcon style={{ marginBottom: spacing.xs }} />
                                    ))}
                                  </div>
                                )}
                                {manualTheoreticalQuestions.length > 0 && (
                                  <div style={{ marginTop: spacing.md }}>
                                    <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                                      <Table
                                        size="small"
                                        pagination={false}
                                        rowKey="id"
                                        dataSource={manualTheoreticalQuestions}
                                        columns={[
                                          { title: 'Question', dataIndex: 'question', ellipsis: true },
                                          { title: 'Topic', dataIndex: 'topic' },
                                          { title: 'Difficulty', dataIndex: 'difficulty' },
                                          {
                                            title: 'Key Points',
                                            dataIndex: 'keyPoints',
                                            render: (value?: string[]) => value?.join(', ') || '-',
                                          },
                                        ]}
                                      />
                                    </div>
                                    <Button
                                      type="link"
                                      danger
                                      style={{ paddingLeft: 0, marginTop: spacing.sm }}
                                      onClick={() => {
                                        setManualTheoreticalQuestions([]);
                                        setCsvErrors([]);
                                      }}
                                    >
                                      Clear uploaded questions
                                    </Button>
                                  </div>
                                )}
                              </Card>

                              <Card
                                style={{ borderRadius: 12 }}
                                title={
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    Manual Coding Questions
                                    <Tooltip title="Maximum 5 machine coding questions allowed">
                                      <InfoCircleOutlined style={{ color: '#9CA3AF', fontSize: 14, cursor: 'pointer' }} />
                                    </Tooltip>
                                  </div>
                                }
                                extra={
                                  <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => openCodingModal()}
                                    style={{
                                      height: 32,
                                      padding: '0 14px',
                                      fontSize: 13,
                                      borderRadius: 8,
                                    }}
                                  >
                                    Add Coding Question
                                  </Button>
                                }
                              >
                                {manualCodingQuestions.length === 0 ? (
                                  <Empty description="No coding questions added yet" />
                                ) : (
                                  <Space direction="vertical" style={{ width: '100%' }}>
                                    {manualCodingQuestions.map((question, idx) => (
                                      <Card
                                        key={`manual-coding-${idx}`}
                                        type="inner"
                                        title={question.title || 'Untitled'}
                                        extra={
                                          <Space size="small">
                                            <Button type="link" onClick={() => openCodingModal(question, idx)}>
                                              Edit
                                            </Button>
                                            <Button
                                              type="link"
                                              danger
                                              onClick={() =>
                                                setManualCodingQuestions((prev) => prev.filter((_, questionIdx) => questionIdx !== idx))
                                              }
                                            >
                                              Remove
                                            </Button>
                                          </Space>
                                        }
                                      >
                                        <Row gutter={16}>
                                          <Col xs={24} md={12}>
                                            <Text strong>Topic:</Text> <Text>{question.topic || '—'}</Text>
                                          </Col>
                                          <Col xs={24} md={12}>
                                            <Text strong>Difficulty:</Text> <Text>{question.difficulty || '—'}</Text>
                                          </Col>
                                        </Row>
                                        <Row gutter={16} style={{ marginTop: spacing.sm }}>
                                          <Col xs={24} md={12}>
                                            <Text strong>Time Limit:</Text> <Text>{question.timeLimit ? `${Math.round(question.timeLimit / 60)} min` : '—'}</Text>
                                          </Col>
                                          <Col xs={24} md={12}>
                                            <Text strong>Test Cases:</Text> <Text>{question.testCases?.length || 0}</Text>
                                          </Col>
                                        </Row>
                                        {question.starterCodes && Object.keys(question.starterCodes).length > 0 && (
                                          <Row gutter={16} style={{ marginTop: spacing.sm }}>
                                            <Col xs={24}>
                                              <Text strong>Starter Code:</Text>{' '}
                                              <Text>
                                                {Object.keys(question.starterCodes || {}).join(', ')}
                                              </Text>
                                            </Col>
                                          </Row>
                                        )}
                                      </Card>
                                    ))}
                                  </Space>
                                )}
                              </Card>
                            </>
                          )}
                        </div>
                      )}
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
                      style={{ minWidth: 120, height: 44, borderRadius: 6 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={loading || prefillLoading}
                      size="large"
                      icon={<CheckOutlined />}
                      style={{
                        minWidth: 200,
                        height: 44,
                        fontSize: 16,
                        background: colors.primary.main,
                        border: 'none',
                        borderRadius: 6,
                        boxShadow: 'none',
                      }}
                    >
                      {isEditMode ? 'Update Interview' : 'Generate Interview'}
                    </Button>
                  </Space>
                </Row>
              </Form>
            </div>
          </Spin>
        </Card>
        <Modal
          title={editingCodingQuestionIndex !== null ? 'Edit Coding Question' : 'Add Coding Question'}
          open={codingModalVisible}
          onOk={handleCodingModalOk}
          onCancel={handleCodingModalCancel}
          width={800}
        >
          <Form form={codingForm} layout="vertical">
            <Form.Item name="starterCodes" hidden initialValue={{}}>
              <Input type="hidden" />
            </Form.Item>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="title"
                  label="Title"
                  rules={[{ required: true, message: 'Please enter a title' }]}
                >
                  <Input placeholder="e.g., Valid Parentheses" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="topic"
                  label="Topic"
                  rules={[{ required: true, message: 'Please enter topic' }]}
                >
                  <Input placeholder="e.g., Stack" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="difficulty"
                  label="Difficulty"
                  rules={[{ required: true, message: 'Please select difficulty' }]}
                >
                  <Select
                    options={[
                      { label: 'Easy', value: 'easy' },
                      { label: 'Medium', value: 'medium' },
                      { label: 'Hard', value: 'hard' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="constraints" label="Constraints (one per line)">
                  <Input.TextArea rows={1} placeholder="1 <= n <= 10^5" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="problemStatement"
              label="Problem Statement"
              rules={[{ required: true, message: 'Please enter the problem statement' }]}
            >
              <Input.TextArea rows={4} placeholder="Describe the problem..." />
            </Form.Item>
            <Divider />
            <Title level={5}>Starter Code</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item label="Language" style={{ marginBottom: spacing.sm }}>
                <Select
                  value={selectedStarterLanguage}
                  onChange={(value) => setSelectedStarterLanguage(value)}
                  options={SUPPORTED_STARTER_LANGUAGES}
                  style={{ width: '100%' }}
                />
              </Form.Item>
              <Form.Item label="Code" style={{ marginBottom: 0 }}>
                <Form.Item noStyle shouldUpdate={(prev, cur) => prev.starterCodes !== cur.starterCodes}>
                  {() => {
                    const starterCodes = codingForm.getFieldValue('starterCodes') || {};
                    const currentValue = starterCodes[selectedStarterLanguage] || '';
                    return (
                      <Input.TextArea
                        rows={4}
                        placeholder="Provide starter code snippet for selected language"
                        value={currentValue}
                        onChange={(e) => {
                          const existing = codingForm.getFieldValue('starterCodes') || {};
                          codingForm.setFieldsValue({
                            starterCodes: {
                              ...existing,
                              [selectedStarterLanguage]: e.target.value,
                            },
                          });
                        }}
                      />
                    );
                  }}
                </Form.Item>
              </Form.Item>
            </Space>
            <Form.Item name="hints" label="Hints (one per line) (optional)">
              <Input.TextArea rows={3} placeholder="Hint 1&#10;Hint 2" />
            </Form.Item>
            <Divider />
            <Title level={5}>Examples</Title>
            <Form.List name="examples">
              {(exampleFields, { add, remove }) => (
                <>
                  {exampleFields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: spacing.sm }}
                      type="inner"
                      title={`Example ${field.name + 1}`}
                      extra={
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      }
                    >
                      <Form.Item name={[field.name, 'input']} label="Input">
                        <Input.TextArea rows={2} placeholder="Example input" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'output']} label="Output">
                        <Input.TextArea rows={2} placeholder="Expected output" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'explanation']} label="Explanation">
                        <Input.TextArea rows={2} placeholder="Explanation (optional)" />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button icon={<PlusOutlined />} type="dashed" block onClick={() => add({})}>
                    Add Example
                  </Button>
                </>
              )}
            </Form.List>
            <Divider />
            <Title level={5}>Test Cases</Title>
            <Form.List name="testCases">
              {(testCaseFields, { add, remove }) => (
                <>
                  {testCaseFields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      style={{ marginBottom: spacing.sm }}
                      type="inner"
                      title={`Test Case ${field.name + 1}`}
                      extra={
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      }
                    >
                      <Form.Item
                        name={[field.name, 'input']}
                        label="Input"
                        rules={[{ required: true, message: 'Input is required' }]}
                      >
                        <Input.TextArea rows={2} placeholder="Test case input" />
                      </Form.Item>
                      <Form.Item
                        name={[field.name, 'expectedOutput']}
                        label="Expected Output"
                        rules={[{ required: true, message: 'Expected output is required' }]}
                      >
                        <Input.TextArea rows={2} placeholder="Expected output" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'isHidden']} valuePropName="checked">
                        <Checkbox>Hidden test case</Checkbox>
                      </Form.Item>
                    </Card>
                  ))}
                  <Button icon={<PlusOutlined />} type="dashed" block onClick={() => add({})}>
                    Add Test Case
                  </Button>
                </>
              )}
            </Form.List>
          </Form>
        </Modal>
      </div>
    </div>
  );
};

