import OpenAI from 'openai';
import { InterviewQuestion, InterviewAnswer, DetailedResumeData, FinalResults, InterviewSession } from '../models/types';

export class OpenAIService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateInterviewQuestions(candidateData: DetailedResumeData): Promise<InterviewQuestion[]> {
        // MOCK DATA - Remove this when OpenAI is configured
        console.log('Using MOCK interview questions (OpenAI not configured)');

        const mockQuestions: InterviewQuestion[] = [
            {
                id: "q1",
                question: "What is the difference between let, const, and var in JavaScript?",
                type: "technical",
                difficulty: "easy",
                timeLimit: 20,
                options: [
                    { id: "a", text: "let and const are block-scoped, var is function-scoped", isCorrect: true },
                    { id: "b", text: "All three are function-scoped", isCorrect: false },
                    { id: "c", text: "let and var are block-scoped, const is function-scoped", isCorrect: false },
                    { id: "d", text: "All three are block-scoped", isCorrect: false }
                ],
                correctAnswerId: "a"
            },
            {
                id: "q2",
                question: "Which React hook is used to perform side effects?",
                type: "technical",
                difficulty: "easy",
                timeLimit: 20,
                options: [
                    { id: "a", text: "useState", isCorrect: false },
                    { id: "b", text: "useEffect", isCorrect: true },
                    { id: "c", text: "useContext", isCorrect: false },
                    { id: "d", text: "useReducer", isCorrect: false }
                ],
                correctAnswerId: "b"
            },
            {
                id: "q3",
                question: "How would you optimize a React component that re-renders frequently?",
                type: "technical",
                difficulty: "medium",
                timeLimit: 60,
                options: [
                    { id: "a", text: "Use React.memo() to prevent unnecessary re-renders", isCorrect: true },
                    { id: "b", text: "Move all state to Redux", isCorrect: false },
                    { id: "c", text: "Use class components instead", isCorrect: false },
                    { id: "d", text: "Remove all props from the component", isCorrect: false }
                ],
                correctAnswerId: "a"
            },
            {
                id: "q4",
                question: "What is the purpose of middleware in Express.js?",
                type: "technical",
                difficulty: "medium",
                timeLimit: 60,
                options: [
                    { id: "a", text: "To handle database connections", isCorrect: false },
                    { id: "b", text: "To process requests before they reach route handlers", isCorrect: true },
                    { id: "c", text: "To serve static files", isCorrect: false },
                    { id: "d", text: "To handle errors only", isCorrect: false }
                ],
                correctAnswerId: "b"
            },
            {
                id: "q5",
                question: "How would you implement a scalable microservices architecture for a large e-commerce platform?",
                type: "technical",
                difficulty: "hard",
                timeLimit: 120,
                options: [
                    { id: "a", text: "Use a single monolithic application", isCorrect: false },
                    { id: "b", text: "Implement service mesh with API gateway, load balancing, and distributed databases", isCorrect: true },
                    { id: "c", text: "Use only client-side rendering", isCorrect: false },
                    { id: "d", text: "Store everything in localStorage", isCorrect: false }
                ],
                correctAnswerId: "b"
            },
            {
                id: "q6",
                question: "Describe how you would handle a situation where your application needs to process 1 million records efficiently.",
                type: "behavioral",
                difficulty: "hard",
                timeLimit: 120,
                options: [
                    { id: "a", text: "Process all records synchronously in a single request", isCorrect: false },
                    { id: "b", text: "Implement pagination, streaming, and background job processing", isCorrect: true },
                    { id: "c", text: "Use setTimeout to delay processing", isCorrect: false },
                    { id: "d", text: "Store everything in memory at once", isCorrect: false }
                ],
                correctAnswerId: "b"
            }
        ];

        return mockQuestions;

        /* ORIGINAL OPENAI CODE - Uncomment when OpenAI is configured
        try {
            const prompt = `
Generate 6 multiple choice interview questions for a Full Stack Developer (React/Node.js) role based on this candidate's profile:

CANDIDATE PROFILE:
- Name: ${candidateData.name || 'Not provided'}
- Skills: ${candidateData.technicalSkills?.join(', ') || 'Not specified'}
- Programming Languages: ${candidateData.programmingLanguages?.join(', ') || 'Not specified'}
- Frameworks: ${candidateData.frameworks?.join(', ') || 'Not specified'}
- Projects: ${candidateData.projects?.map(p => `${p.name}: ${p.description}`).join('; ') || 'None'}
- Experience: ${candidateData.internships?.map(i => `${i.role} at ${i.company}`).join('; ') || 'None'}

REQUIREMENTS:
- Generate exactly 6 questions total
- 2 Easy questions (20 seconds each): Basic concepts, syntax, simple problem-solving
- 2 Medium questions (60 seconds each): Problem-solving, architecture, debugging
- 2 Hard questions (120 seconds each): Complex scenarios, system design, optimization

QUESTION TYPES:
- Technical: React, Node.js, JavaScript, databases, APIs
- Behavioral: Problem-solving approach, teamwork, learning
- Situational: Real-world scenarios, edge cases

MULTIPLE CHOICE REQUIREMENTS:
- Each question must have exactly 4 options (A, B, C, D)
- Only ONE option should be correct
- Make incorrect options plausible but clearly wrong
- Options should be concise but descriptive

Return JSON array with this exact format:
[
  {
    "id": "q1",
    "question": "What is the difference between let, const, and var in JavaScript?",
    "type": "technical",
    "difficulty": "easy",
    "timeLimit": 20,
    "options": [
      {
        "id": "a",
        "text": "let and const are block-scoped, var is function-scoped",
        "isCorrect": true
      },
      {
        "id": "b", 
        "text": "All three are function-scoped",
        "isCorrect": false
      },
      {
        "id": "c",
        "text": "let and var are block-scoped, const is function-scoped",
        "isCorrect": false
      },
      {
        "id": "d",
        "text": "All three are block-scoped",
        "isCorrect": false
      }
    ],
    "correctAnswerId": "a"
  }
]
`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer. Generate relevant multiple choice interview questions for Full Stack Developer roles. Always return valid JSON format with exactly 4 options per question.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 3000
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No response from OpenAI');

            const questions = JSON.parse(content);

            // Validate and add IDs if missing
            return questions.map((q: any, index: number) => ({
                id: q.id || `q${index + 1}`,
                question: q.question,
                type: q.type || 'technical',
                difficulty: q.difficulty || 'medium',
                timeLimit: q.timeLimit || 60,
                options: q.options || [],
                correctAnswerId: q.correctAnswerId || 'a'
            }));

        } catch (error) {
            console.error('Error generating questions:', error);
            throw new Error('Failed to generate interview questions');
        }
        */
    }

    async generateFinalResults(session: InterviewSession): Promise<FinalResults> {
        // MOCK DATA - Remove this when OpenAI is configured
        console.log('Using MOCK final results (OpenAI not configured)');

        const correctAnswers = session.answers.filter(answer => answer.isCorrect).length;
        const totalQuestions = session.questions.length;
        const finalScore = Math.round((correctAnswers / totalQuestions) * 10 * 10) / 10; // Convert to 0-10 scale

        const mockResults: FinalResults = {
            sessionId: session.id || 'mock-session',
            finalScore: finalScore,
            summary: `Interview completed successfully! You answered ${correctAnswers} out of ${totalQuestions} questions correctly. Your overall performance shows ${finalScore >= 7 ? 'strong' : finalScore >= 5 ? 'good' : 'room for improvement'} technical knowledge. Keep practicing to improve your skills!`,
            answers: session.questions.map((question, index) => {
                const answer = session.answers.find(a => a.questionId === question.id);
                const isCorrect = answer?.isCorrect || false;
                const score = isCorrect ? Math.floor(Math.random() * 3) + 7 : Math.floor(Math.random() * 4) + 3; // 7-9 for correct, 3-6 for incorrect

                return {
                    question: question.question,
                    answer: answer?.answer || 'No answer provided',
                    score: score,
                    timeTaken: answer?.timeTaken || 0
                };
            }),
            duration: session.duration || 0
        };

        return mockResults;

        /* ORIGINAL OPENAI CODE - Uncomment when OpenAI is configured
        try {
            const prompt = `
Evaluate this complete interview session and provide a comprehensive assessment:

INTERVIEW SESSION:
- Duration: ${session.duration ? Math.round(session.duration / 60000) : 0} minutes
- Total Questions: ${session.questions.length}
- Questions Answered: ${session.answers.length}

QUESTIONS AND ANSWERS:
${session.questions.map((q, index) => {
                const answer = session.answers.find(a => a.questionId === q.id);
                return `
Question ${index + 1} (${q.difficulty}, ${q.timeLimit}s):
"${q.question}"
Answer: "${answer?.answer || 'No answer provided'}"
Time Taken: ${answer?.timeTaken || 0} seconds
`;
            }).join('\n')}

EVALUATION REQUIREMENTS:
1. Score each answer individually (1-10 scale)
2. Calculate overall score (average of all answers)
3. Provide comprehensive summary including:
   - Technical knowledge assessment
   - Problem-solving ability
   - Communication skills
   - Areas of strength
   - Areas for improvement
   - Overall recommendation

Return JSON with this exact format:
{
  "finalScore": 7.5,
  "summary": "Comprehensive evaluation summary...",
  "answers": [
    {
      "question": "Question text",
      "answer": "Answer text", 
      "score": 8,
      "timeTaken": 45
    }
  ]
}
`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert technical interviewer. Provide fair, constructive evaluation of interview performance. Always return valid JSON format.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 3000
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No response from OpenAI');

            const results = JSON.parse(content);

            return {
                sessionId: session.id,
                finalScore: results.finalScore,
                summary: results.summary,
                answers: results.answers,
                duration: session.duration || 0
            };

        } catch (error) {
            console.error('Error generating final results:', error);
            throw new Error('Failed to generate final results');
        }
        */
    }
}
