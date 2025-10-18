import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Initialize the database if it doesn't exist
 * This ensures new developers can run the project without manual database setup
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const dbPath = path.join(__dirname, '../../prisma/data');
    const dbFile = path.join(dbPath, 'interviews.db');

    if (!fs.existsSync(dbFile)) {
      console.log('🗄️  Database not found, initializing...');
      
      // Create data directory if it doesn't exist
      if (!fs.existsSync(dbPath)) {
        fs.mkdirSync(dbPath, { recursive: true });
        console.log('📁 Created data directory');
      }
      
      // Run Prisma push to create database and tables
      console.log('🔧 Creating database schema...');
      execSync('npx prisma db push', { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'inherit'
      });
      
      // Generate Prisma client
      console.log('⚙️  Generating Prisma client...');
      execSync('npx prisma generate', { 
        cwd: path.join(__dirname, '../..'),
        stdio: 'inherit'
      });
      
      console.log('✅ Database initialized successfully!');
    } else {
      console.log('✅ Database already exists');
    }
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}
