import { PrismaClient } from '@prisma/client';
import { OpenAIService } from './openaiService';

const prisma = new PrismaClient();

export interface TopicItem {
  name: string;
  questionCount: number;
  enabled: boolean;
}

export interface MachineQuestionItem {
  topic: string;
}

export interface QuestionGenerationParams {
  topics: TopicItem[];
  totalQuestions: number;
  machineQuestions: MachineQuestionItem[];
  maxMachineCoding: number;
}

export interface GeneratedQuestion {
  id: string;
  question: string;
  type: 'theoretical' | 'machine_coding';
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  topic: string;
  
  // For theoretical questions (long-form text answers)
  expectedAnswer?: string; // Key concepts and jargon to cover
  explanation?: string; // Detailed explanation with technical concepts
  keyPoints?: string[]; // Important technical points to mention
  documentation?: string[]; // Relevant documentation links or references
  
  // For machine coding questions
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
}

export class QuestionGenerationService {
  private openaiService: OpenAIService;

  constructor() {
    this.openaiService = new OpenAIService();
  }

  /**
   * Generate interview questions based on interview link metadata
   */
  async generateInterviewQuestions(interviewLink: any): Promise<GeneratedQuestion[]> {
    try {
      console.log('🎯 Generating interview questions...');
      
      // Parse interview metadata
      let topics = JSON.parse(interviewLink.topics || '[]');
      const machineQuestions = JSON.parse(interviewLink.machine_questions || '[]');
      const totalQuestions = interviewLink.max_interview_questions || 10;
      const maxMachineCoding = interviewLink.max_machine_coding_questions || 2;
      
      // Fallback: If no topics are configured, use default topics
      if (!topics || topics.length === 0) {
        console.log('⚠️ No topics configured, using default topics');
        topics = [
          { name: 'JavaScript', questionCount: 1, enabled: true },
          { name: 'React', questionCount: 1, enabled: true },
          { name: 'Node.js', questionCount: 1, enabled: true }
        ];
      }
      
      console.log(`📊 Interview config: ${totalQuestions} total, ${maxMachineCoding} machine coding`);
      console.log(`📋 Topics: ${topics.map((t: TopicItem) => t.name).join(', ')}`);
      
      // Generate questions
      const questions = await this.selectQuestions({
        topics,
        totalQuestions,
        machineQuestions,
        maxMachineCoding
      });
      
      console.log(`✅ Generated ${questions.length} questions`);
      return questions;
      
    } catch (error) {
      console.error('❌ Error generating interview questions:', error);
      throw new Error('Failed to generate interview questions');
    }
  }

  /**
   * Select questions from database and generate theoretical questions
   * Returns questions with proper separation between theoretical and coding
   */
  private async selectQuestions(params: QuestionGenerationParams): Promise<GeneratedQuestion[]> {
    const { topics, totalQuestions, machineQuestions, maxMachineCoding } = params;
    
    const selectedQuestions: GeneratedQuestion[] = [];
    
    // Calculate exact number of questions requested by interviewer
    const requestedMachineCoding = machineQuestions.length;
    const requestedTheoretical = topics.reduce((sum, topic) => sum + (topic.enabled ? topic.questionCount : 0), 0);
    const totalRequested = requestedMachineCoding + requestedTheoretical;
    
    
    // 1. Get theoretical questions FIRST (respect exact count, but cap at total limit)
    const theoreticalCount = Math.min(requestedTheoretical, totalQuestions);
    const theoreticalQuestions = await this.getTheoreticalQuestionsByCountWithLimit(topics, theoreticalCount);
    
    // 2. Get machine coding questions (respect exact count, but cap at max limit)
    const machineCodingCount = Math.min(requestedMachineCoding, maxMachineCoding);
    const machineCodingQuestions = await this.getMachineCodingQuestions(machineQuestions, machineCodingCount);
    
    // 3. Combine in proper order: theoretical first, then coding
    // DO NOT shuffle - keep them separated for proper interview flow
    selectedQuestions.push(...theoreticalQuestions);
    selectedQuestions.push(...machineCodingQuestions);
    
    console.log(`✅ Selected ${theoreticalQuestions.length} theoretical and ${machineCodingQuestions.length} coding questions`);
    
    return selectedQuestions;
  }

  /**
   * Get machine coding questions from database
   */
  private async getMachineCodingQuestions(machineQuestions: MachineQuestionItem[], maxCount: number): Promise<GeneratedQuestion[]> {
    if (machineQuestions.length === 0 || maxCount === 0) {
      return [];
    }

    const topics = machineQuestions.map(mq => mq.topic);
    const questions = await prisma.machineCodingQuestion.findMany({
      where: {
        topic: { in: topics },
        solution: { not: null } // Only questions with solutions
      },
      take: maxCount
    });

    return questions.map(q => this.transformDatabaseQuestion(q));
  }

  /**
   * Get theoretical questions based on individual topic questionCount with total limit
   */
  private async getTheoreticalQuestionsByCountWithLimit(topics: TopicItem[], totalLimit: number): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    
    for (const topic of topics) {
      if (!topic.enabled || topic.questionCount <= 0) {
        continue;
      }
      
      // Check if we've reached the total limit
      if (questions.length >= totalLimit) {
        break;
      }
      
      const topicCount = Math.min(topic.questionCount, totalLimit - questions.length);
      console.log(`📋 Getting ${topicCount} questions for ${topic.name}`);
      
      // Check if we have enough questions in database for this topic
      console.log(`🔍 Checking if we have enough questions for ${topic.name}...`);
      const hasEnoughInDB = await this.hasEnoughQuestionsInDB(topic.name, topicCount);
      console.log(`🔍 Result: hasEnoughInDB = ${hasEnoughInDB} for ${topic.name}`);
      
      if (hasEnoughInDB) {
        // Use database questions
        console.log(`📚 Using database questions for ${topic.name}`);
        const dbQuestions = await this.getQuestionsFromDB(topic.name, topicCount);
        questions.push(...dbQuestions);
      } else {
        // Use AI generation as fallback
        console.log(`🤖 Using AI generation for ${topic.name} (insufficient DB questions)`);
        const aiQuestions = await this.generateTheoreticalQuestionsForTopic(topic.name, topicCount);
        questions.push(...aiQuestions);
      }
    }

    return questions;
  }

  /**
   * Get theoretical questions based on individual topic questionCount
   */
  private async getTheoreticalQuestionsByCount(topics: TopicItem[]): Promise<GeneratedQuestion[]> {
    const questions: GeneratedQuestion[] = [];
    
    for (const topic of topics) {
      if (!topic.enabled || topic.questionCount <= 0) {
        continue;
      }
      
      const topicCount = topic.questionCount;
      console.log(`📋 Getting ${topicCount} questions for ${topic.name}`);
      
      // Check if we have enough questions in database for this topic
      console.log(`🔍 Checking if we have enough questions for ${topic.name}...`);
      const hasEnoughInDB = await this.hasEnoughQuestionsInDB(topic.name, topicCount);
      console.log(`🔍 Result: hasEnoughInDB = ${hasEnoughInDB} for ${topic.name}`);
      
      if (hasEnoughInDB) {
        // Use database questions
        console.log(`📚 Using database questions for ${topic.name}`);
        const dbQuestions = await this.getQuestionsFromDB(topic.name, topicCount);
        questions.push(...dbQuestions);
      } else {
        // Use AI generation as fallback
        console.log(`🤖 Using AI generation for ${topic.name} (insufficient DB questions)`);
        const aiQuestions = await this.generateTheoreticalQuestionsForTopic(topic.name, topicCount);
        questions.push(...aiQuestions);
      }
    }

    return questions;
  }

  /**
   * Get theoretical questions (generate with AI or fetch from database)
   */
  private async getTheoreticalQuestions(topics: TopicItem[], count: number): Promise<GeneratedQuestion[]> {
    if (count <= 0) {
      return [];
    }

    const questions: GeneratedQuestion[] = [];
    
    // Distribute questions across topics
    const questionsPerTopic = Math.ceil(count / topics.length);
    
    for (const topic of topics) {
      if (questions.length >= count) break;
      
      const topicCount = Math.min(questionsPerTopic, count - questions.length);
      
      // Check if we have enough questions in database for this topic
      const hasEnoughInDB = await this.hasEnoughQuestionsInDB(topic.name, topicCount);
      
      if (hasEnoughInDB) {
        // Use database questions
        console.log(`📚 Using database questions for ${topic.name}`);
        const dbQuestions = await this.getQuestionsFromDB(topic.name, topicCount);
        questions.push(...dbQuestions);
      } else {
        // Use AI generation as fallback
        console.log(`🤖 Using AI generation for ${topic.name} (insufficient DB questions)`);
        const aiQuestions = await this.generateTheoreticalQuestionsForTopic(topic.name, topicCount);
        questions.push(...aiQuestions);
      }
    }

    return questions.slice(0, count);
  }

  /**
   * Generate theoretical questions for a specific topic using AI
   */
  private async generateTheoreticalQuestionsForTopic(topic: string, count: number): Promise<GeneratedQuestion[]> {
    try {
      const prompt = `
      Generate ${count} long-form interview questions for the topic: ${topic}
      
      Requirements:
      - Each question should be relevant to ${topic}
      - Questions should require detailed, comprehensive answers covering technical concepts and jargon
      - Include key technical terms, concepts, and real-world applications
      - Questions should be realistic and commonly asked in senior-level interviews
      - Mix of easy, medium, and hard difficulty
      - Include time limits (5min for easy, 10min for medium, 15min for hard)
      - Provide expected answer covering important technical concepts
      - Include relevant documentation links and references
      
      Return JSON array with this format:
      [
        {
          "id": "q1",
          "question": "Explain the concept of closures in JavaScript with examples and use cases",
          "type": "theoretical",
          "difficulty": "medium",
          "timeLimit": 600,
          "topic": "${topic}",
          "expectedAnswer": "A closure is a function that has access to variables in its outer (enclosing) scope even after the outer function returns. Key concepts: lexical scoping, execution context, memory management, practical examples like module patterns, event handlers, and data privacy.",
          "explanation": "Closures are fundamental to JavaScript's functional programming paradigm. They enable powerful patterns like module systems, currying, and maintaining state in functional components. Understanding closures is crucial for advanced JavaScript development.",
          "keyPoints": [
            "Lexical scoping and scope chain",
            "Execution context and variable environment",
            "Memory management and garbage collection",
            "Practical applications: module patterns, currying, event handlers",
            "Common pitfalls and best practices"
          ],
          "documentation": [
            "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
            "https://javascript.info/closure"
          ]
        }
      ]
      `;

      const response = await this.openaiService.generateQuestions(prompt);
      return response;
      
    } catch (error) {
      console.error(`❌ Error generating questions for topic ${topic}:`, error);
      return [];
    }
  }


  /**
   * Get time limit based on difficulty
   */
  private getTimeLimitForDifficulty(difficulty: string): number {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 20;
      case 'medium': return 60;
      case 'hard': return 120;
      default: return 60;
    }
  }

  /**
   * Shuffle array to randomize question order
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  /**
   * Get questions by topic for testing
   */
  async getQuestionsByTopic(topic: string, limit: number = 10): Promise<GeneratedQuestion[]> {
    const questions = await prisma.theoreticalQuestion.findMany({
      where: { topic },
      take: limit
    });

    return questions.map((q: any) => this.transformDatabaseQuestion(q));
  }

  /**
   * Get questions by multiple topics
   */
  async getQuestionsByTopics(topics: string[], limit: number = 10): Promise<GeneratedQuestion[]> {
    const questions = await prisma.theoreticalQuestion.findMany({
      where: { topic: { in: topics } },
      take: limit
    });

    return questions.map((q: any) => this.transformDatabaseQuestion(q));
  }

  /**
   * Get questions by topic and difficulty
   */
  async getQuestionsByTopicAndDifficulty(topic: string, difficulty: string, limit: number = 10): Promise<GeneratedQuestion[]> {
    const questions = await prisma.theoreticalQuestion.findMany({
      where: { 
        topic,
        difficulty: difficulty.toLowerCase()
      },
      take: limit
    });

    return questions.map((q: any) => this.transformDatabaseQuestion(q));
  }

  /**
   * Check if we have enough questions in the database for a topic
   */
  private async hasEnoughQuestionsInDB(topic: string, requiredCount: number): Promise<boolean> {
    // Get all questions for the topic
    const questions = await prisma.theoreticalQuestion.findMany({
      where: {
        topic: topic
      },
      select: {
        question_text: true
      }
    });
    
    // Count unique questions by text
    const uniqueQuestions = new Set(questions.map(q => q.question_text));
    const uniqueCount = uniqueQuestions.size;
    
    console.log(`📊 Topic ${topic}: ${questions.length} total questions, ${uniqueCount} unique questions, need ${requiredCount}`);
    
    return uniqueCount >= requiredCount;
  }

  /**
   * Get questions from database for a specific topic
   */
  private async getQuestionsFromDB(topic: string, count: number, difficulty?: string): Promise<GeneratedQuestion[]> {
    const whereClause: any = {
      topic: topic
    };

    if (difficulty) {
      whereClause.difficulty = difficulty;
    }

    // Get more questions than needed to account for duplicates
    const questions = await prisma.theoreticalQuestion.findMany({
      where: whereClause,
      take: count * 3, // Get 3x more to account for duplicates
      orderBy: {
        id: 'asc' // For consistent ordering
      }
    });

    // Deduplicate by question text
    const uniqueQuestions = new Map<string, any>();
    for (const question of questions) {
      if (!uniqueQuestions.has(question.question_text)) {
        uniqueQuestions.set(question.question_text, question);
      }
    }

    // Take only the requested count
    const deduplicatedQuestions = Array.from(uniqueQuestions.values()).slice(0, count);
    
    console.log(`📚 Retrieved ${questions.length} questions, deduplicated to ${deduplicatedQuestions.length} unique questions for ${topic}`);

    return deduplicatedQuestions.map(q => this.transformDatabaseQuestion(q));
  }

  /**
   * Transform database question to GeneratedQuestion format
   */
  private transformDatabaseQuestion(dbQuestion: any): GeneratedQuestion {
    // Determine if this is a machine coding question based on the table structure
    const isMachineCoding = dbQuestion.problem_statement || dbQuestion.starter_code || dbQuestion.test_cases;
    
    return {
      id: `db_${dbQuestion.id}`,
      question: dbQuestion.question_text || dbQuestion.problem_statement,
      type: isMachineCoding ? 'machine_coding' : 'theoretical',
      difficulty: dbQuestion.difficulty as 'easy' | 'medium' | 'hard',
      timeLimit: this.getTimeLimitForDifficulty(dbQuestion.difficulty),
      topic: dbQuestion.topic,
      expectedAnswer: dbQuestion.expected_answer,
      explanation: dbQuestion.explanation,
      keyPoints: dbQuestion.key_points ? JSON.parse(dbQuestion.key_points) : [],
      documentation: dbQuestion.documentation ? JSON.parse(dbQuestion.documentation) : [],
      // Machine coding specific fields
      language: dbQuestion.language,
      problemStatement: dbQuestion.problem_statement,
      starterCode: dbQuestion.starter_code,
      testCases: dbQuestion.test_cases ? JSON.parse(dbQuestion.test_cases) : [],
      constraints: dbQuestion.constraints ? JSON.parse(dbQuestion.constraints) : [],
      hints: dbQuestion.hints ? JSON.parse(dbQuestion.hints) : []
    };
  }

  /**
   * Extract key points from explanation text
   */
  private extractKeyPoints(explanation: string): string[] {
    // Simple extraction - look for bullet points or numbered lists
    const lines = explanation.split('\n');
    return lines
      .filter(line => line.trim().match(/^[-*•]\s/) || line.trim().match(/^\d+\.\s/))
      .map(line => line.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '').trim())
      .filter(point => point.length > 0);
  }

  /**
   * Extract documentation references from explanation
   */
  private extractDocumentation(explanation: string): string[] {
    const urls = explanation.match(/https?:\/\/[^\s]+/g) || [];
    return urls;
  }
}
