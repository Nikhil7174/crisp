import React, { useState, useEffect } from 'react';
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
  Alert,
  Input,
} from 'antd';
import {
  QuestionCircleOutlined,
  CodeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { API_BASE_URL } from '../../constants/api';
import { colors, spacing } from '../../styles';
import { useAuth } from '../../hooks/useAuth';

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

interface ViewQuestionsModalProps {
  visible: boolean;
  onClose: () => void;
  linkId: number;
  linkTitle: string;
}

export const ViewQuestionsModal: React.FC<ViewQuestionsModalProps> = ({
  visible,
  onClose,
  linkId,
  linkTitle,
}) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<GeneratedQuestion[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (visible && linkId) {
      loadQuestions();
    }
  }, [visible, linkId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = questions.filter(q => 
        q.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.problemStatement && q.problemStatement.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredQuestions(filtered);
    } else {
      setFilteredQuestions(questions);
    }
  }, [searchTerm, questions]);

  const generateQuestions = async () => {
    try {
      setLoading(true);
      console.log('Generating questions for link ID:', linkId);
      
      if (!token) {
        message.error('No authentication token found');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/interviewer/generate-questions/${linkId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Generate questions response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Generate questions result:', result);
        message.success('Questions generated successfully!');
        // Reload questions to show the newly generated ones
        await loadQuestions();
      } else {
        const errorData = await response.json();
        console.error('Generate questions error:', errorData);
        message.error(errorData.message || 'Failed to generate questions');
      }
    } catch (error) {
      console.error('Generate questions error:', error);
      message.error('Failed to generate questions');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      setLoading(true);
      console.log('Loading questions for link ID:', linkId);
      console.log('Token from useAuth:', token ? 'Token exists' : 'No token found');
      console.log('API URL:', `${API_BASE_URL}/interviewer/interview-link/${linkId}`);
      
      if (!token) {
        message.error('No authentication token found');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/interviewer/interview-link/${linkId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Load questions response status:', response.status);
      if (response.ok) {
        const result = await response.json();
        console.log('Load questions result:', result);
        if (result.success && result.data.generated_questions) {
          const existingQuestions = JSON.parse(result.data.generated_questions);
          setQuestions(existingQuestions);
          setFilteredQuestions(existingQuestions);
          message.success(`Loaded ${existingQuestions.length} questions`);
        } else {
          message.info('No questions found for this interview link');
          setQuestions([]);
          setFilteredQuestions([]);
        }
      } else {
        const errorResult = await response.json();
        message.error(errorResult.error || 'Failed to load questions');
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      message.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
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
          {question.options.map((option, optionIndex) => (
            <div key={`${question.id}-option-${optionIndex}`} style={{ marginBottom: spacing.xs }}>
              <Text style={{ 
                color: option.isCorrect ? colors.success.main : colors.neutral[600],
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
    <div style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
      {question.question && question.question !== question.problemStatement && (
        <Title level={5} style={{ marginBottom: spacing.sm }}>
          {question.question}
        </Title>
      )}
      {question.problemStatement && (
        <Paragraph strong style={{ marginBottom: question.constraints ? spacing.sm : 0 }}>
          {question.problemStatement}
        </Paragraph>
      )}
      {question.constraints && question.constraints.length > 0 && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Constraints:</Text>
          <ul style={{ marginTop: spacing.xs }}>
            {question.constraints.map((constraint, index) => (
              <li key={`${question.id}-constraint-${index}`}>{constraint}</li>
            ))}
          </ul>
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
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxWidth: '100%'
          }}>
            {question.starterCode}
          </pre>
        </div>
      )}
      {question.examples && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Examples:</Text>
          {Array.isArray(question.examples) ? (
            question.examples.map((example, index) => (
              <div key={`${question.id}-example-${index}`} style={{ marginTop: spacing.xs, fontSize: '12px', wordBreak: 'break-word' }}>
                {example.input && <Text code style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>Input: {example.input}</Text>}
                {example.input && example.output && <br />}
                {example.output && <Text code style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>Output: {example.output}</Text>}
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
      {question.testCases && question.testCases.length > 0 && (
        <div style={{ marginBottom: spacing.sm }}>
          <Text strong>Test Cases:</Text>
          {question.testCases.map((testCase, index) => (
            <div key={`${question.id}-testcase-${index}`} style={{ marginTop: spacing.xs, fontSize: '12px', wordBreak: 'break-word' }}>
              <Text code style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>Input: {testCase.input}</Text>
              <br />
              <Text code style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>Expected: {testCase.expectedOutput}</Text>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Modal
      title={`Questions for: ${linkTitle}`}
      open={visible}
      onCancel={onClose}
      width={1000}
      style={{ maxWidth: '90vw' }}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div style={{ maxHeight: '70vh', overflow: 'auto', overflowX: 'hidden', wordWrap: 'break-word' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <Spin size="large" />
            <div style={{ marginTop: spacing.lg }}>
              <Text>Loading questions...</Text>
            </div>
          </div>
        ) : questions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: spacing.xxl }}>
            <QuestionCircleOutlined style={{ fontSize: 48, color: colors.neutral[500], marginBottom: spacing.lg }} />
            <Title level={4}>No Questions Found</Title>
            <Paragraph>
              This interview link doesn't have any generated questions yet.
            </Paragraph>
            <Space>
              <Button type="primary" onClick={generateQuestions} loading={loading}>
                Generate Questions
              </Button>
              <Button onClick={loadQuestions}>
                Refresh
              </Button>
            </Space>
          </div>
        ) : (
          <div>
            {/* Search and Stats */}
            <div style={{ marginBottom: spacing.lg }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Input
                    placeholder="Search questions..."
                    prefix={<SearchOutlined />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ marginBottom: spacing.md }}
                  />
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ textAlign: 'right', marginRight: spacing.md }}>
                    <Text type="secondary">
                      Showing {filteredQuestions.length} of {questions.length} questions
                    </Text>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Questions List */}
            <div>
              {filteredQuestions.map((question, index) => (
                <Card
                  key={`question-${question.id}-${index}`}
                  style={{ 
                    marginBottom: spacing.md,
                    border: `1px solid ${colors.neutral[300]}`,
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word'
                  }}
                  bodyStyle={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}
                >
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
                    {question.type !== 'theoretical' && (
                      <Space>
                        <ClockCircleOutlined />
                        <Text>{Math.round(question.timeLimit / 60)} min</Text>
                      </Space>
                    )}
                  </div>

                  <div style={{ marginBottom: spacing.sm }}>
                    {question.type === 'theoretical' 
                      ? renderTheoreticalQuestion(question)
                      : renderMachineCodingQuestion(question)
                    }
                  </div>

                  {question.hints && question.hints.length > 0 && (
                    <div style={{ 
                      background: colors.background.secondary, 
                      padding: spacing.sm, 
                      borderRadius: 4,
                      marginTop: spacing.sm
                    }}>
                      <Text strong>Hints:</Text>
                      <ul style={{ marginTop: spacing.xs, marginBottom: 0 }}>
                        {question.hints.map((hint, hintIndex) => (
                          <li key={`${question.id}-hint-${hintIndex}`}>{hint}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
