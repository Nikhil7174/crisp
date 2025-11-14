import React, { useState } from 'react';
import {
  Modal,
  Button,
  Card,
  Typography,
  Space,
  Tag,
  Divider,
  Spin,
  message,
  Row,
  Col,
  Checkbox,
  Alert,
} from 'antd';
import {
  QuestionCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../constants/api';
import { colors, spacing } from '../../styles';

const { Title, Text, Paragraph } = Typography;

interface GeneratedQuestion {
  id: string;
  question: string;
  type: 'theoretical' | 'machine_coding';
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  topic: string;
  options?: Array<{
    id: string;
    text: string;
    isCorrect: boolean;
  }>;
  correctAnswerId?: string;
  language?: string;
  problemStatement?: string;
  starterCode?: string;
  testCases?: Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>;
  constraints?: string[];
  hints?: string[];
  examples?: Array<{
    input?: string;
    output?: string;
    explanation?: string;
  }> | string;
}

interface QuestionGenerationModalProps {
  visible: boolean;
  onClose: () => void;
  linkId: number;
  linkTitle: string;
  onQuestionsApproved: () => void;
}

export const QuestionGenerationModal: React.FC<QuestionGenerationModalProps> = ({
  visible,
  onClose,
  linkId,
  linkTitle,
  onQuestionsApproved,
}) => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);

  // Load existing questions when modal opens
  React.useEffect(() => {
    if (visible && linkId) {
      loadExistingQuestions();
    }
  }, [visible, linkId]);

  const loadExistingQuestions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');
      console.log('Loading existing questions for link ID:', linkId);
      const response = await fetch(`${API_BASE_URL}/admin/interview-link/${linkId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Load existing questions response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Load existing questions result:', result);
        if (result.success && result.data.generated_questions) {
          const existingQuestions = JSON.parse(result.data.generated_questions);
          setQuestions(existingQuestions);
          setSelectedQuestions(new Set(existingQuestions.map((q: GeneratedQuestion) => q.id)));
          message.success(`Loaded ${existingQuestions.length} existing questions`);
        } else {
          message.info('No existing questions found for this interview link');
        }
      } else {
        const errorResult = await response.json();
        message.error(errorResult.error || 'Failed to load existing questions');
      }
    } catch (error) {
      console.error('Error loading existing questions:', error);
      message.error('Failed to load existing questions');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuestions = async () => {
    try {
      setGenerating(true);
      const token = localStorage.getItem('adminToken');
      console.log('Admin token:', token ? 'Present' : 'Missing');
      console.log('Link ID:', linkId);
      console.log('API URL:', `${API_BASE_URL}/admin/generate-questions/${linkId}`);
      
      const response = await fetch(`${API_BASE_URL}/admin/generate-questions/${linkId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      const result = await response.json();
      console.log('Response data:', result);
      
      if (result.success) {
        setQuestions(result.data.questions);
        // Select all questions by default
        setSelectedQuestions(new Set(result.data.questions.map((q: GeneratedQuestion) => q.id)));
        message.success(`Generated ${result.data.totalQuestions} questions successfully!`);
      } else {
        message.error(result.message || 'Failed to generate questions');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      message.error('Failed to generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveQuestions = async () => {
    try {
      setApproving(true);
      const token = localStorage.getItem('adminToken');
      const approvedQuestions = questions.filter(q => selectedQuestions.has(q.id));
      
      const response = await fetch(`${API_BASE_URL}/admin/approve-questions/${linkId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions: approvedQuestions }),
      });

      const result = await response.json();
      if (result.success) {
        message.success('Questions approved and saved successfully!');
        onQuestionsApproved();
        onClose();
      } else {
        message.error(result.message || 'Failed to approve questions');
      }
    } catch (error) {
      console.error('Error approving questions:', error);
      message.error('Failed to approve questions');
    } finally {
      setApproving(false);
    }
  };

  const handleQuestionToggle = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedQuestions(new Set(questions.map(q => q.id)));
  };

  const handleDeselectAll = () => {
    setSelectedQuestions(new Set());
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'green';
      case 'medium': return 'orange';
      case 'hard': return 'red';
      default: return 'blue';
    }
  };

  const renderTheoreticalQuestion = (question: GeneratedQuestion) => (
    <div>
      <Paragraph strong>{question.question}</Paragraph>
      {question.options && (
        <div style={{ marginLeft: spacing.md }}>
          {question.options.map((option) => (
            <div key={option.id} style={{ marginBottom: spacing.xs }}>
              <Text style={{ 
                color: option.isCorrect ? colors.success.main : colors.text.primary,
                fontWeight: option.isCorrect ? 'bold' : 'normal'
              }}>
                {option.id.toUpperCase()}. {option.text}
                {option.isCorrect && ' ✓'}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMachineCodingQuestion = (question: GeneratedQuestion) => (
    <div>
      <Paragraph strong>{question.problemStatement || question.question}</Paragraph>
      {question.constraints && question.constraints.length > 0 && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Constraints:</Text>
          <ul style={{ marginTop: spacing.xs }}>
            {question.constraints.map((constraint, index) => (
              <li key={index}>{constraint}</li>
            ))}
          </ul>
        </div>
      )}
      {question.examples && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Examples:</Text>
          {Array.isArray(question.examples) ? (
            question.examples.map((example, index) => (
              <div key={`${question.id}-example-${index}`} style={{ marginTop: spacing.xs, fontSize: '12px' }}>
                {example.input && <Text code>Input: {example.input}</Text>}
                {example.input && example.output && <br />}
                {example.output && <Text code>Output: {example.output}</Text>}
                {example.explanation && (
                  <>
                    <br />
                    <Text>Explanation: {example.explanation}</Text>
                  </>
                )}
              </div>
            ))
          ) : (
            <pre style={{ 
              background: colors.background.secondary, 
              padding: spacing.sm, 
              borderRadius: 4,
              marginTop: spacing.xs,
              fontSize: '12px',
              overflow: 'auto'
            }}>
              {question.examples}
            </pre>
          )}
        </div>
      )}
      {question.starterCode && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Starter Code:</Text>
          <pre style={{ 
            background: colors.background.secondary, 
            padding: spacing.sm, 
            borderRadius: 4,
            marginTop: spacing.xs,
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {question.starterCode}
          </pre>
        </div>
      )}
    </div>
  );

  return (
    <Modal
      title={`Generate Questions for "${linkTitle}"`}
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={null}
      style={{ top: 20 }}
    >
      <div style={{ maxHeight: '70vh', overflow: 'auto' }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <QuestionCircleOutlined style={{ fontSize: 48, color: colors.primary.main, marginBottom: spacing.lg }} />
            <Title level={4}>Generate Interview Questions</Title>
            <Paragraph>
              Click the button below to generate questions based on your interview link configuration.
              The system will create a mix of theoretical and coding questions tailored to your requirements.
            </Paragraph>
            
            {/* Debug Information */}
            <Alert
              message="Debug Information"
              description={
                <div>
                  <p><strong>Link ID:</strong> {linkId}</p>
                  <p><strong>Link Title:</strong> {linkTitle}</p>
                  <p><strong>Admin Token:</strong> {localStorage.getItem('adminToken') ? 'Present' : 'Missing'}</p>
                  <p><strong>API Base URL:</strong> {API_BASE_URL}</p>
                </div>
              }
              type="info"
              style={{ marginBottom: spacing.lg }}
            />
            <Space style={{ marginTop: spacing.lg }}>
              <Button
                type="primary"
                size="large"
                loading={generating}
                onClick={handleGenerateQuestions}
              >
                {generating ? 'Generating Questions...' : 'Generate Questions'}
              </Button>
              <Button
                size="large"
                onClick={loadExistingQuestions}
                loading={loading}
              >
                {loading ? 'Loading...' : 'View Existing Questions'}
              </Button>
            </Space>
          </div>
        ) : (
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: spacing.lg,
              padding: spacing.md,
              background: colors.background.secondary,
              borderRadius: 8
            }}>
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  Generated Questions ({questions.length})
                </Title>
                <Text type="secondary">
                  Select the questions you want to approve for this interview
                </Text>
              </div>
              <Space>
                <Button onClick={handleSelectAll}>Select All</Button>
                <Button onClick={handleDeselectAll}>Deselect All</Button>
                <Button onClick={handleGenerateQuestions} loading={generating}>
                  Regenerate
                </Button>
              </Space>
            </div>

            <Alert
              message={`${selectedQuestions.size} of ${questions.length} questions selected`}
              type="info"
              style={{ marginBottom: spacing.lg }}
            />

            <div style={{ marginBottom: spacing.lg }}>
              {questions.map((question, index) => (
                <Card
                  key={question.id}
                  style={{ 
                    marginBottom: spacing.md,
                    border: selectedQuestions.has(question.id) ? `2px solid ${colors.primary.main}` : '1px solid #d9d9d9',
                    background: selectedQuestions.has(question.id) ? colors.primary.light : 'white'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: spacing.md }}>
                    <Checkbox
                      checked={selectedQuestions.has(question.id)}
                      onChange={() => handleQuestionToggle(question.id)}
                      style={{ marginTop: 4 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: spacing.sm
                      }}>
                        <Space>
                          <Tag color={getDifficultyColor(question.difficulty)}>
                            {question.difficulty.toUpperCase()}
                          </Tag>
                          <Tag color="blue">{question.type.replace('_', ' ').toUpperCase()}</Tag>
                          <Tag color="purple">{question.topic}</Tag>
                        </Space>
                        <Space>
                          <ClockCircleOutlined />
                          <Text>{question.timeLimit}s</Text>
                        </Space>
                      </div>
                      
                      {question.type === 'theoretical' 
                        ? renderTheoreticalQuestion(question)
                        : renderMachineCodingQuestion(question)
                      }
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: spacing.lg,
              background: colors.background.secondary,
              borderRadius: 8
            }}>
              <div>
                <Text strong>Selected: {selectedQuestions.size} questions</Text>
                <br />
                <Text type="secondary">
                  {selectedQuestions.size > 0 
                    ? 'Ready to approve these questions for the interview'
                    : 'Please select at least one question to approve'
                  }
                </Text>
              </div>
              <Space>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                  type="primary"
                  loading={approving}
                  disabled={selectedQuestions.size === 0}
                  onClick={handleApproveQuestions}
                >
                  Approve Selected Questions
                </Button>
              </Space>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
