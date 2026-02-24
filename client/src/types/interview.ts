// Interview types (ported from crispDesktop shared/types.ts)

export interface Question {
    id: string
    question: string
    expectedAnswer: string
    keyPoints: string[]
    followUps?: FollowUp[]
}

export interface FollowUp {
    trigger: string | string[]
    question: string
    expectedAnswer: string
    keyPoints: string[]
}

export interface CodingProblem {
    id: string
    title: string
    description: string
    language: string
    starterCode?: string
    starterCodes?: Record<string, string>
    solution: string
    hints: string[]
    testCases: TestCase[]
    difficulty: 'easy' | 'medium' | 'hard'
    constraints?: string[] | string
    examples?: Array<{
        input?: string
        output?: string
        explanation?: string
    }> | string | any
}

export interface TestCase {
    input: string
    expectedOutput: string
    description: string
}
