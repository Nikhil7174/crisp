import OpenAI from 'openai';
import { InterviewQuestion, InterviewAnswer } from '../models/types';

export class OpenAIService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async generateInterviewQuestions(resumeText: string, count: number = 5): Promise<InterviewQuestion[]> {
        try {
            const prompt = `Based on this resume, generate ${count} relevant interview questions. 
      Mix of behavioral, technical, and situational questions. 
      Resume: ${resumeText.substring(0, 2000)}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert interviewer. Generate relevant interview questions based on the candidate\'s resume. Return questions in JSON format with id, question, type, difficulty, and timeLimit fields.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No response from OpenAI');

            // Parse the response and create question objects
            const questions = this.parseQuestionsResponse(content);
            return questions;

        } catch (error) {
            console.error('Error generating questions:', error);
            throw new Error('Failed to generate interview questions');
        }
    }

    async evaluateAnswer(question: string, answer: string, resumeText: string): Promise<{ score: number; feedback: string }> {
        try {
            const prompt = `Evaluate this interview answer on a scale of 1-10 and provide feedback.
      
      Question: ${question}
      Answer: ${answer}
      Candidate Background: ${resumeText.substring(0, 1000)}
      
      Consider: relevance, depth, examples, communication skills, and alignment with the role.`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert interviewer. Evaluate answers objectively and provide constructive feedback. Return JSON with score (1-10) and feedback fields.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            const content = response.choices[0]?.message?.content;
            if (!content) throw new Error('No response from OpenAI');

            return this.parseEvaluationResponse(content);

        } catch (error) {
            console.error('Error evaluating answer:', error);
            throw new Error('Failed to evaluate answer');
        }
    }

    async generateFollowUpQuestion(question: string, answer: string): Promise<string> {
        try {
            const prompt = `Generate a follow-up question based on this exchange:
      
      Question: ${question}
      Answer: ${answer}`;

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Generate a relevant follow-up question to deepen the conversation.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            });

            return response.choices[0]?.message?.content || 'Could you elaborate on that?';

        } catch (error) {
            console.error('Error generating follow-up:', error);
            return 'Could you elaborate on that?';
        }
    }

    private parseQuestionsResponse(content: string): InterviewQuestion[] {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                return parsed.map((q, index) => ({
                    id: q.id || `q_${index}`,
                    question: q.question,
                    type: q.type || 'behavioral',
                    difficulty: q.difficulty || 'medium',
                    timeLimit: q.timeLimit || 120
                }));
            }
        } catch {
            // Fallback: extract questions from text
            const questions = content.split('\n').filter(line =>
                line.trim() && (line.includes('?') || line.match(/^\d+\./))
            );

            return questions.map((q, index) => ({
                id: `q_${index}`,
                question: q.replace(/^\d+\.\s*/, '').trim(),
                type: 'behavioral' as const,
                difficulty: 'medium' as const,
                timeLimit: 120
            }));
        }

        return [];
    }

    private parseEvaluationResponse(content: string): { score: number; feedback: string } {
        try {
            const parsed = JSON.parse(content);
            return {
                score: parsed.score || 5,
                feedback: parsed.feedback || 'No specific feedback provided.'
            };
        } catch {
            // Fallback: extract score and feedback from text
            const scoreMatch = content.match(/score[:\s]*(\d+)/i);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;

            return {
                score: Math.max(1, Math.min(10, score)),
                feedback: content.replace(/score[:\s]*\d+/i, '').trim() || 'No specific feedback provided.'
            };
        }
    }
}
