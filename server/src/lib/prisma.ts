import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

// Helper function to check if error is a connection/prepared statement error
const isConnectionError = (error: any): boolean => {
  return (
    error?.message?.includes('prepared statement') ||
    error?.message?.includes('does not exist') ||
    error?.code === 'P1001' || // Connection error
    error?.code === 'P1008' || // Operations timed out
    error?.code === '26000' || // PostgreSQL prepared statement error
    error?.code === '42P05'    // PostgreSQL prepared statement already exists
  );
};

// Create Prisma client with proper configuration
const createPrismaClient = () => {
  // Add pgbouncer=true to connection string to avoid prepared statement caching issues
  let connectionString = process.env.DATABASE_URL || '';
  
  // Always add pgbouncer param to avoid prepared statement errors
  if (!connectionString.includes('pgbouncer=')) {
    const separator = connectionString.includes('?') ? '&' : '?';
    connectionString = `${connectionString}${separator}pgbouncer=true&statement_cache_size=0`;
  }

  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn'] // Reduced logging to avoid clutter
        : ['error'],
    errorFormat: 'minimal',
    datasources: {
      db: {
        url: connectionString,
      },
    },
  });

  return client;
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown - disconnect Prisma on process exit
if (process.env.NODE_ENV !== 'production') {
  process.on('SIGINT', async () => {
    console.log('🛑 [Prisma] Disconnecting...');
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🛑 [Prisma] Disconnecting...');
    await prisma.$disconnect();
    process.exit(0);
  });
}

export default prisma;

// Export helper function for retrying queries on connection errors
export async function retryOnConnectionError<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (isConnectionError(error) && attempt < maxRetries) {
        console.warn(`🔄 [Prisma] Connection error (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`);
        
        // For prepared statement errors, we need to fully disconnect and reconnect
        try {
          await prisma.$disconnect();
          // Wait longer for PostgreSQL to clean up
          await new Promise(resolve => setTimeout(resolve, 500));
          // Force reconnect
          await prisma.$connect();
        } catch (disconnectError) {
          console.warn('⚠️ [Prisma] Error during reconnect:', disconnectError);
        }
        
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}
