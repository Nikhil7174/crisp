// src/components/interview/chat/CodingQuestion.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Card, Button, Space, Typography, Alert, Divider } from 'antd';
import { CodeOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '../../../styles';
import Editor from '@monaco-editor/react';
import type { Question } from '../../../types';

const { Title, Text, Paragraph } = Typography;

interface CodingQuestionProps {
    question: Question;
    onSubmitAnswer: (code: string) => void;
    loading?: boolean;
    disabled?: boolean;
    showResult?: boolean;
    submittedCode?: string; // eslint-disable-line @typescript-eslint/no-unused-vars
    testResults?: Array<{
        passed: boolean;
        input: string;
        expectedOutput: string;
        actualOutput: string;
    }>;
}

export const CodingQuestion: React.FC<CodingQuestionProps> = ({
    question,
    onSubmitAnswer,
    loading = false,
    disabled = false,
    showResult = false,
    submittedCode,
    testResults = []
}) => {
    const getDefaultCode = useCallback(() => {
        // If showing results and we have submitted code, use that
        if (showResult && submittedCode) {
            return submittedCode;
        }

        if (question.initialCode) {
            return question.initialCode;
        }

        // Fallback based on question ID
        if (question.id === 'q5') {
            return `function findMax(numbers) {
  // Complete this function to return the maximum number
  // Example: findMax([1, 5, 3, 9, 2]) should return 9
  
}`;
        } else if (question.id === 'q6') {
            return `function isPalindrome(str) {
  // Complete this function to check if the string is a palindrome
  // A palindrome reads the same forwards and backwards
  // Example: isPalindrome("racecar") should return true
  
}`;
        }

        return '// Start coding here...';
    }, [question.initialCode, question.id, showResult, submittedCode]);

    const [code, setCode] = useState<string>(getDefaultCode());
    const [isValidating, setIsValidating] = useState(false);
    const editorRef = useRef<any>(null);

    // Reset code when question changes or when submittedCode changes
    useEffect(() => {
        const initialCode = getDefaultCode();
        setCode(initialCode);
    }, [question.id, question.initialCode, getDefaultCode, submittedCode]);

    const handleEditorDidMount = useCallback((editor: any, monaco: any) => { // eslint-disable-line @typescript-eslint/no-unused-vars
        editorRef.current = editor;

        // Configure editor to match the app's styling
        editor.updateOptions({
            fontSize: 14,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            folding: true,
            bracketPairColorization: { enabled: true },
            renderWhitespace: 'selection',
        });
    }, []);

    const handleCodeChange = useCallback((value: string | undefined) => {
        if (value !== undefined) {
            setCode(value);
        }
    }, []);

    const handleSubmit = useCallback(() => {
        if (code.trim() && !loading && !disabled) {
            onSubmitAnswer(code);
        }
    }, [code, loading, disabled, onSubmitAnswer]);

    const handleRunCode = useCallback(async () => {
        if (!code.trim()) return;

        setIsValidating(true);
        try {
            // Simple client-side validation for demo
            // In production, this would be sent to server for execution
            console.log('Running code:', code);

            // Simulate validation delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            // For demo purposes, we'll just show a success message
            // In real implementation, this would execute the code and return results
        } catch (error) {
            console.error('Code execution error:', error);
        } finally {
            setIsValidating(false);
        }
    }, [code]);

    const getLanguageFromQuestion = useCallback(() => {
        return question.language || 'javascript';
    }, [question.language]);

    const getTestResultIcon = useCallback((passed: boolean) => {
        return passed ?
            <CheckCircleOutlined style={{ color: colors.success.main }} /> :
            <CloseCircleOutlined style={{ color: colors.error.main }} />;
    }, []);

    // If no question, don't render anything
    if (!question) {
        return <div>No question provided</div>;
    }

    return (
        <Card style={{ marginBottom: spacing.md }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Question Header */}
                <div>
                    <Title level={4}>
                        <CodeOutlined style={{ marginRight: spacing.sm, color: colors.primary.main }} />
                        {question.question}
                    </Title>
                    <Text type="secondary">
                        {question.type} • {question.difficulty} • {question.timeLimit}s • {getLanguageFromQuestion()}
                    </Text>
                    {question.instructions && (
                        <Paragraph style={{ marginTop: spacing.sm, marginBottom: 0 }}>
                            <Text strong>Instructions:</Text> {question.instructions}
                        </Paragraph>
                    )}
                </div>

                {/* Code Editor */}
                <div style={{
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: colors.background.primary
                }}>
                    <Editor
                        key={question.id}
                        height="300px"
                        language={getLanguageFromQuestion()}
                        value={code}
                        onChange={handleCodeChange}
                        onMount={handleEditorDidMount}
                        options={{
                            readOnly: disabled || showResult,
                            fontSize: 14,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            folding: true,
                            bracketPairColorization: { enabled: true },
                            renderWhitespace: 'selection',
                        }}
                        theme="vs-light"
                    />
                </div>

                {/* Test Results */}
                {showResult && testResults.length > 0 && (
                    <div>
                        <Title level={5}>Test Results:</Title>
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {testResults.map((result, index) => (
                                <Alert
                                    key={index}
                                    type={result.passed ? 'success' : 'error'}
                                    message={
                                        <div>
                                            <Space>
                                                {getTestResultIcon(result.passed)}
                                                <Text strong>Test Case {index + 1}</Text>
                                            </Space>
                                            <Divider style={{ margin: spacing.xs }} />
                                            <div style={{ fontSize: '12px' }}>
                                                <div><Text code>Input:</Text> {result.input}</div>
                                                <div><Text code>Expected:</Text> {result.expectedOutput}</div>
                                                <div><Text code>Actual:</Text> {result.actualOutput}</div>
                                            </div>
                                        </div>
                                    }
                                    showIcon={false}
                                />
                            ))}
                        </Space>
                    </div>
                )}

                {/* Action Buttons */}
                {!showResult && (
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Button
                            icon={<PlayCircleOutlined />}
                            onClick={handleRunCode}
                            loading={isValidating}
                            disabled={disabled || loading || !code.trim()}
                        >
                            Run Code
                        </Button>
                        <Button
                            type="primary"
                            size="large"
                            onClick={handleSubmit}
                            loading={loading}
                            disabled={disabled || !code.trim()}
                        >
                            Submit Solution
                        </Button>
                    </Space>
                )}

                {/* Debug Info */}
                <div style={{ fontSize: '12px', color: colors.neutral[500] }}>
                    Debug: Language: {getLanguageFromQuestion()}, Code length: {code.length} chars
                </div>
            </Space>
        </Card>
    );
};

export default CodingQuestion;
