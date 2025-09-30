// Alternative: Use a third-party code execution service
// This would be safer for production deployment

import { TestCase, TestResult } from './codeExecutionService';

export class SafeCodeExecutionService {
    private apiKey: string;
    private baseUrl: string;

    constructor() {
        this.apiKey = process.env.CODEX_API_KEY || '';
        this.baseUrl = 'https://api.codex.jaagrav.in';
    }

    async validateCode(userCode: string, testCases: TestCase[], functionName: string): Promise<TestResult[]> {
        const results: TestResult[] = [];

        for (const testCase of testCases) {
            try {
                const response = await fetch(`${this.baseUrl}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        code: `${userCode}\n\nconsole.log(${functionName}(${testCase.input}));`,
                        language: 'javascript',
                        input: '',
                        version: 'latest'
                    })
                });

                const data = await response.json() as { output?: string };
                const actualOutput = data.output?.trim() || 'Error';

                results.push({
                    passed: actualOutput === testCase.expectedOutput,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput: actualOutput
                });
            } catch (error) {
                results.push({
                    passed: false,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput: 'Error',
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        return results;
    }
}
