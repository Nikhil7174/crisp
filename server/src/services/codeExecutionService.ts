// src/services/codeExecutionService.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

export interface TestCase {
    input: string;
    expectedOutput: string;
}

export interface TestResult {
    passed: boolean;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    error?: string;
}

export class CodeExecutionService {
    private tempDir: string;

    constructor() {
        this.tempDir = os.tmpdir();
    }

    /**
     * Execute user code and test it against test cases
     */
    async validateCode(
        userCode: string,
        testCases: TestCase[],
        functionName: string
    ): Promise<TestResult[]> {
        const results: TestResult[] = [];
        const tempFile = path.join(this.tempDir, `test_${Date.now()}.js`);

        try {
            // Create test file with user code and test cases
            const testCode = `
${userCode}

// Test cases
const testCases = ${JSON.stringify(testCases)};

// Run tests
const results = [];
for (let i = 0; i < testCases.length; i++) {
  const testCase = testCases[i];
  try {
    const input = eval(testCase.input);
    const result = ${functionName}(input);
    const actualOutput = String(result);
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
      actualOutput: "Error",
      error: error.message
    });
  }
}

console.log(JSON.stringify(results));
      `;

            // Write test file
            fs.writeFileSync(tempFile, testCode);

            // Execute the test file with timeout
            const { stdout, stderr } = await execAsync(`node "${tempFile}"`, {
                timeout: 5000,
                maxBuffer: 1024 * 1024 // 1MB buffer
            });

            if (stderr) {
                throw new Error(stderr);
            }

            // Parse results
            const testResults = JSON.parse(stdout.trim());
            results.push(...testResults);

        } catch (error) {
            // If there's an execution error, mark all tests as failed
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            for (const testCase of testCases) {
                results.push({
                    passed: false,
                    input: testCase.input,
                    expectedOutput: testCase.expectedOutput,
                    actualOutput: 'Error',
                    error: errorMessage
                });
            }
        } finally {
            // Clean up temp file
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (error) {
                console.warn('Failed to clean up temp file:', error);
            }
        }

        return results;
    }

    /**
     * Validate code for specific questions (Q5 and Q6)
     */
    async validateQuestionCode(questionId: string, userCode: string): Promise<TestResult[]> {
        switch (questionId) {
            case 'q5':
                return this.validateFindMaxCode(userCode);
            case 'q6':
                return this.validatePalindromeCode(userCode);
            default:
                throw new Error(`Unknown question ID: ${questionId}`);
        }
    }

    /**
     * Validate findMax function (Q5)
     */
    private async validateFindMaxCode(userCode: string): Promise<TestResult[]> {
        const testCases: TestCase[] = [
            { input: '[1, 5, 3, 9, 2]', expectedOutput: '9' },
            { input: '[10, 2, 8, 4]', expectedOutput: '10' },
            { input: '[-1, -5, -3]', expectedOutput: '-1' },
            { input: '[42]', expectedOutput: '42' },
            { input: '[]', expectedOutput: 'undefined' } // Edge case
        ];

        return this.validateCode(userCode, testCases, 'findMax');
    }

    /**
     * Validate isPalindrome function (Q6)
     */
    private async validatePalindromeCode(userCode: string): Promise<TestResult[]> {
        const testCases: TestCase[] = [
            { input: '"racecar"', expectedOutput: 'true' },
            { input: '"hello"', expectedOutput: 'false' },
            { input: '"A man a plan a canal Panama"', expectedOutput: 'true' },
            { input: '"Madam"', expectedOutput: 'true' },
            { input: '""', expectedOutput: 'true' }, // Empty string is palindrome
            { input: '"a"', expectedOutput: 'true' } // Single character is palindrome
        ];

        return this.validateCode(userCode, testCases, 'isPalindrome');
    }

    /**
     * Check if code is syntactically valid JavaScript
     */
    isValidJavaScript(code: string): boolean {
        try {
            // Try to parse the code as JavaScript
            new Function(code);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // No cleanup needed for file-based execution
    }

    /**
     * Get a summary of test results
     */
    getTestSummary(results: TestResult[]): {
        totalTests: number;
        passedTests: number;
        failedTests: number;
        successRate: number;
        isCorrect: boolean;
    } {
        const totalTests = results.length;
        const passedTests = results.filter(r => r.passed).length;
        const failedTests = totalTests - passedTests;
        const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
        const isCorrect = passedTests === totalTests && totalTests > 0;

        return {
            totalTests,
            passedTests,
            failedTests,
            successRate,
            isCorrect
        };
    }
}

export default CodeExecutionService;
