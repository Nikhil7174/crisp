import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const migrateSolutionsToNewSchema = async () => {
  try {
    console.log('🔄 Migrating solutions to new schema...');
    
    // Get all questions that have solutions
    const questionsWithSolutions = await prisma.questionBank.findMany({
      where: {
        solution: { not: null }
      }
    });
    
    console.log(`📊 Found ${questionsWithSolutions.length} questions with solutions to migrate`);
    
    for (const question of questionsWithSolutions) {
      // Create solution record
      await prisma.questionSolution.create({
        data: {
          question_id: question.id,
          language: question.language || 'python', // Default to python if no language specified
          solution: question.solution || '',
          time_complexity: question.time_complexity,
          space_complexity: question.space_complexity,
          explanation: question.explanation
        }
      });
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
};

migrateSolutionsToNewSchema();
