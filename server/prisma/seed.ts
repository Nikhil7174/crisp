import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default admin user if none exists
  const adminCount = await prisma.adminUser.count();
  
  if (adminCount === 0) {
    const defaultPassword = 'admin123'; // Change this in production!
    const hashedPassword = bcrypt.hashSync(defaultPassword, 10);

    await prisma.adminUser.create({
      data: {
        username: 'admin',
        password_hash: hashedPassword,
      },
    });

    console.log('✅ Default admin user created: username=admin, password=admin123');
  } else {
    console.log('ℹ️ Admin users already exist, skipping admin creation');
  }

  console.log('🌱 Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
