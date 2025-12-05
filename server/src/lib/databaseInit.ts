import { execSync } from 'child_process';

/**
 * Initialize the database by applying pending Prisma migrations.
 * Intended for Postgres deployments (e.g., Supabase).
 */
export async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL is not set. Skipping database initialization.');
    return;
  }

  try {
    console.log('🔧 Applying Prisma migrations (migrate deploy)...');
    execSync('npx prisma migrate deploy', {
      cwd: `${__dirname}/../..`,
      stdio: 'inherit',
    });

    console.log('⚙️  Generating Prisma client...');
    execSync('npx prisma generate', {
      cwd: `${__dirname}/../..`,
      stdio: 'inherit',
    });

    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}
