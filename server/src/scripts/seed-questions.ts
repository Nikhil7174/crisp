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

interface TopQuestion {
  id: number;
  topic: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  category: string;
  correct_answer: string | null;
  explanation: string;
  options: any;
  language: string;
  problem_statement: string;
  constraints: string;
  examples: string;
  starter_code: string;
  test_cases: any;
  hints: string;
  solution: string;
  time_complexity: string;
  space_complexity: string;
  companies: string;
  similar_to: any;
  tags: string;
  success_rate: any;
  avg_time_taken: any;
  created_at: string;
  updated_at: string;
}

async function seedMachineCodingQuestions() {
  console.log('🌱 Seeding Machine Coding Questions...');
  
  // Load leetcode dataset
  const leetcodeData = JSON.parse(
    fs.readFileSync('/home/nikhil/Desktop/data/leetcode-dataset.json', 'utf8')
  );
  
  // Load top questions dataset
  const topQuestionsData = JSON.parse(
    fs.readFileSync('/home/nikhil/Desktop/data/top-questions.json', 'utf8')
  );

  let seededCount = 0;

  // Process leetcode questions
  console.log(`Processing ${leetcodeData.questions.length} leetcode questions...`);
  
  for (const question of leetcodeData.questions) {
    try {
      // Map leetcode difficulty to our format
      const difficultyMap: Record<string, string> = {
        'Easy': 'easy',
        'Medium': 'medium', 
        'Hard': 'hard'
      };

      // Create test cases from examples
      const testCases = question.examples.map((example: any, index: number) => ({
        input: extractInputFromExample(example.example_text),
        expected_output: extractOutputFromExample(example.example_text),
        hidden: false,
        description: `Example ${index + 1}`
      }));

      await prisma.machineCodingQuestion.create({
        data: {
          topic: question.topics[0] || 'General',
          question_text: question.title,
          difficulty: difficultyMap[question.difficulty] || 'medium',
          category: 'DSA',
          language: 'javascript',
          problem_statement: question.description,
          constraints: JSON.stringify(question.constraints),
          examples: JSON.stringify(question.examples),
          starter_code: question.code_snippets.javascript || question.code_snippets.python || '',
          test_cases: JSON.stringify(testCases),
          hints: JSON.stringify(question.hints),
          solution: JSON.stringify({
            javascript: question.code_snippets.javascript,
            python: question.code_snippets.python,
            java: question.code_snippets.java,
            cpp: question.code_snippets.cpp
          }),
          time_complexity: extractTimeComplexity(question.solution),
          space_complexity: extractSpaceComplexity(question.solution),
          companies: JSON.stringify([]),
          tags: JSON.stringify(question.topics),
          success_rate: null
        }
      });
      
      seededCount++;
      
      if (seededCount % 100 === 0) {
        console.log(`Seeded ${seededCount} machine coding questions...`);
      }
    } catch (error) {
      console.error(`Error seeding leetcode question ${question.title}:`, error);
    }
  }

  // Process top questions (machine coding type)
  console.log(`Processing ${topQuestionsData.length} top questions...`);
  
  for (const question of topQuestionsData) {
    if (question.question_type === 'machine_coding') {
      try {
        // Create test cases from examples if test_cases is null
        let testCases = question.test_cases;
        if (!testCases) {
          try {
            const examples = JSON.parse(question.examples);
            testCases = JSON.stringify(examples.map((example: any, index: number) => ({
              input: extractInputFromExample(example.example_text),
              expected_output: extractOutputFromExample(example.example_text),
              hidden: false,
              description: `Example ${index + 1}`
            })));
          } catch (error) {
            testCases = JSON.stringify([{
              input: "Sample input",
              expected_output: "Sample output",
              hidden: false,
              description: "Sample test case"
            }]);
          }
        }

        await prisma.machineCodingQuestion.create({
          data: {
            topic: question.topic,
            question_text: question.question_text,
            difficulty: question.difficulty,
            category: question.category,
            language: question.language,
            problem_statement: question.problem_statement,
            constraints: question.constraints,
            examples: question.examples,
            starter_code: question.starter_code,
            test_cases: testCases,
            hints: question.hints,
            solution: question.solution,
            time_complexity: question.time_complexity,
            space_complexity: question.space_complexity,
            companies: question.companies,
            tags: question.tags,
            success_rate: question.success_rate
          }
        });
        
        seededCount++;
      } catch (error) {
        console.error(`Error seeding top question ${question.question_text}:`, error);
      }
    }
  }

  console.log(`✅ Seeded ${seededCount} machine coding questions`);
}

async function seedTheoreticalQuestions() {
  console.log('🌱 Seeding Theoretical Questions...');
  
  // Load top questions dataset
  const topQuestionsData = JSON.parse(
    fs.readFileSync('/home/nikhil/Desktop/data/top-questions.json', 'utf8')
  );

  let seededCount = 0;

  // Process top questions (theoretical type)
  for (const question of topQuestionsData) {
    if (question.question_type === 'theoretical') {
      try {
        await prisma.theoreticalQuestion.create({
          data: {
            topic: question.topic,
            question_text: question.question_text,
            difficulty: question.difficulty,
            category: question.category,
            expected_answer: question.correct_answer || question.explanation,
            explanation: question.explanation,
            key_points: question.tags ? JSON.parse(question.tags) : null,
            documentation: null,
            companies: question.companies ? JSON.parse(question.companies) : null,
            tags: question.tags ? JSON.parse(question.tags) : null,
            success_rate: question.success_rate
          }
        });
        
        seededCount++;
      } catch (error) {
        console.error(`Error seeding theoretical question ${question.question_text}:`, error);
      }
    }
  }

  // Add some additional theoretical questions if needed
  const additionalTheoreticalQuestions = [
    {
      topic: "JavaScript",
      question_text: "What is the difference between let, const, and var in JavaScript?",
      difficulty: "easy",
      category: "Frontend",
      expected_answer: "var has function scope and is hoisted, let and const have block scope. let can be reassigned, const cannot be reassigned after declaration.",
      explanation: "var declarations are hoisted to the top of their function scope and can be redeclared. let and const are block-scoped and are not hoisted. const must be initialized and cannot be reassigned, while let can be reassigned but not redeclared in the same scope.",
      key_points: ["Scope differences", "Hoisting behavior", "Reassignment rules", "Temporal dead zone"],
      companies: ["Google", "Facebook", "Amazon", "Microsoft"],
      tags: ["variables", "scope", "hoisting", "ES6"]
    },
    {
      topic: "React",
      question_text: "Explain the React component lifecycle methods",
      difficulty: "medium",
      category: "Frontend",
      expected_answer: "Mounting: constructor, componentDidMount. Updating: componentDidUpdate, getSnapshotBeforeUpdate. Unmounting: componentWillUnmount.",
      explanation: "React components have three main lifecycle phases: Mounting (component is created and inserted into DOM), Updating (component is re-rendered due to state/props changes), and Unmounting (component is removed from DOM). Each phase has specific methods that get called.",
      key_points: ["Mounting phase", "Updating phase", "Unmounting phase", "Hooks vs Class methods"],
      companies: ["Facebook", "Netflix", "Airbnb", "Uber"],
      tags: ["lifecycle", "hooks", "components", "state"]
    },
    {
      topic: "Node.js",
      question_text: "What is the Event Loop in Node.js and how does it work?",
      difficulty: "hard",
      category: "Backend",
      expected_answer: "The Event Loop is Node.js's mechanism for handling asynchronous operations. It has phases: timers, pending callbacks, idle/prepare, poll, check, and close callbacks.",
      explanation: "Node.js uses a single-threaded event loop to handle asynchronous operations. The event loop has six phases that execute in order. Each phase has a FIFO queue of callbacks to execute. The poll phase is where I/O callbacks are executed, and it can block if the queue is empty.",
      key_points: ["Single-threaded", "Six phases", "Call stack", "Callback queue", "Non-blocking I/O"],
      companies: ["Netflix", "Uber", "PayPal", "LinkedIn"],
      tags: ["event-loop", "asynchronous", "callbacks", "non-blocking"]
    }
  ];

  for (const question of additionalTheoreticalQuestions) {
    try {
      await prisma.theoreticalQuestion.create({
        data: {
          topic: question.topic,
          question_text: question.question_text,
          difficulty: question.difficulty,
          category: question.category,
          expected_answer: question.expected_answer,
          explanation: question.explanation,
          key_points: JSON.stringify(question.key_points),
          documentation: null,
          companies: JSON.stringify(question.companies),
          tags: JSON.stringify(question.tags),
          success_rate: null
        }
      });
      
      seededCount++;
    } catch (error) {
      console.error(`Error seeding additional theoretical question ${question.question_text}:`, error);
    }
  }

  console.log(`✅ Seeded ${seededCount} theoretical questions`);
}

// Helper functions
function extractInputFromExample(exampleText: string): string {
  const inputMatch = exampleText.match(/Input:\s*(.+?)(?:\n|$)/);
  return inputMatch ? inputMatch[1].trim() : '';
}

function extractOutputFromExample(exampleText: string): string {
  const outputMatch = exampleText.match(/Output:\s*(.+?)(?:\n|$)/);
  return outputMatch ? outputMatch[1].trim() : '';
}

function extractTimeComplexity(solution: string): string | null {
  if (!solution) return null;
  const timeMatch = solution.match(/Time complexity:\s*([^\n]+)/i);
  return timeMatch ? timeMatch[1].trim() : null;
}

function extractSpaceComplexity(solution: string): string | null {
  if (!solution) return null;
  const spaceMatch = solution.match(/Space complexity:\s*([^\n]+)/i);
  return spaceMatch ? spaceMatch[1].trim() : null;
}

async function main() {
  try {
    console.log('🚀 Starting database seeding...');
    
    // Clear existing data
    console.log('🧹 Clearing existing questions...');
    await prisma.machineCodingQuestion.deleteMany();
    await prisma.theoreticalQuestion.deleteMany();
    
    // Seed machine coding questions
    await seedMachineCodingQuestions();
    
    // Seed theoretical questions
    await seedTheoreticalQuestions();
    
    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding
main();
