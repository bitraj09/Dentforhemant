const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@gmai.com';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Default admin ${email} already exists; leaving its password and role unchanged.`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email,
      password: hashedPassword,
      collegeName: 'Dental College',
      collegeYear: 'Final Year',
      collegeIdNumber: 'ADMIN-001',
      role: 'ADMIN',
      status: 'APPROVED',
    },
  });

  console.log(`Created default admin account: ${email}`);
}

main()
  .catch((error) => {
    console.error('Failed to create the default admin account:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
