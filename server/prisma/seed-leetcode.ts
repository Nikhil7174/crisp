import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface LeetcodeQuestion {
  title: string;
  problem_id: string;
  frontend_id: string;
  difficulty: string;
  problem_slug: string;
  topics: string[];
  description: string;
  examples: Array<{
    example_num: number;
    example_text: string;
    images: string[];
  }>;
  constraints: string[];
  follow_ups: any[];
  hints: string[];
  code_snippets: Record<string, string>;
  solution: string;
}

interface LeetcodeDataset {
  questions: LeetcodeQuestion[];
}

async function seedLeetcodeQuestions() {
  console.log('🌱 Starting LeetCode dataset seeding...');

  try {
    // Read the leetcode dataset
    const datasetPath = path.join(__dirname, '../data/leetcode-dataset.json');
    const datasetContent = fs.readFileSync(datasetPath, 'utf-8');
    const dataset: LeetcodeDataset = JSON.parse(datasetContent);

    console.log(`📊 Found ${dataset.questions.length} questions in dataset`);

    // Clear existing machine coding questions
    console.log('🗑️ Clearing existing machine coding questions...');
    await prisma.machineCodingQuestion.deleteMany({});

    let successCount = 0;
    let errorCount = 0;

    // Process each question
    for (const [index, question] of dataset.questions.entries()) {
      try {
        // Map leetcode data to our schema
        const machineCodingQuestion = {
          topic: question.topics[0] || 'General', // Use first topic as primary topic
          question_text: question.title,
          difficulty: question.difficulty.toLowerCase(),
          category: 'DSA', // Default category for leetcode questions
          language: 'javascript', // Default language
          problem_statement: question.description,
          constraints: JSON.stringify(question.constraints),
          examples: JSON.stringify(question.examples.map(ex => ({
            input: ex.example_text.split('\n')[0]?.replace('Input: ', '') || '',
            output: ex.example_text.split('\n')[1]?.replace('Output: ', '') || '',
            explanation: ex.example_text.split('\n')[2]?.replace('Explanation: ', '') || ''
          }))),
          starter_code: question.code_snippets?.javascript || question.code_snippets?.python || '',
          test_cases: JSON.stringify(question.examples.map(ex => ({
            input: ex.example_text.split('\n')[0]?.replace('Input: ', '') || '',
            output: ex.example_text.split('\n')[1]?.replace('Output: ', '') || '',
            hidden: false
          }))),
          hints: JSON.stringify(question.hints),
          solution: JSON.stringify({
            javascript: question.code_snippets?.javascript || '',
            python: question.code_snippets?.python || '',
            explanation: question.solution || ''
          }),
          time_complexity: extractTimeComplexity(question.solution),
          space_complexity: extractSpaceComplexity(question.solution),
          companies: JSON.stringify(['LeetCode']), // Default company
          tags: JSON.stringify(question.topics),
          success_rate: Math.random() * 0.4 + 0.3 // Random success rate between 30-70%
        };

        await prisma.machineCodingQuestion.create({
          data: machineCodingQuestion
        });

        successCount++;
        
        if ((index + 1) % 100 === 0) {
          console.log(`✅ Processed ${index + 1}/${dataset.questions.length} questions`);
        }
      } catch (error) {
        console.error(`❌ Error processing question ${index + 1} (${question.title}):`, error);
        errorCount++;
      }
    }

    console.log(`🎉 Seeding completed!`);
    console.log(`✅ Successfully seeded: ${successCount} questions`);
    console.log(`❌ Errors: ${errorCount} questions`);

  } catch (error) {
    console.error('❌ Failed to seed leetcode questions:', error);
    throw error;
  }
}

function extractTimeComplexity(solution: string | undefined): string {
  if (!solution) return 'O(n)';
  const timeMatch = solution.match(/Time complexity:\s*O\([^)]+\)/i);
  return timeMatch ? timeMatch[0].replace(/Time complexity:\s*/i, '') : 'O(n)';
}

function extractSpaceComplexity(solution: string | undefined): string {
  if (!solution) return 'O(1)';
  const spaceMatch = solution.match(/Space complexity:\s*O\([^)]+\)/i);
  return spaceMatch ? spaceMatch[0].replace(/Space complexity:\s*/i, '') : 'O(1)';
}

async function main() {
  try {
    await seedLeetcodeQuestions();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed if this file is executed directly
if (require.main === module) {
  main();
}

export { seedLeetcodeQuestions };
