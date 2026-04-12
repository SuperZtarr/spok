import { PrismaClient } from '@prisma/client';

const dbUrl = process.argv[2] || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: { url: dbUrl },
  },
});

async function main() {
  console.log('Migrating roles: ADMIN → OWNER, VIEWER → MEMBER...');

  // Community memberships
  const cm1 = await prisma.$executeRawUnsafe(`UPDATE community_memberships SET role = 'OWNER' WHERE role = 'ADMIN'`);
  console.log(`Community memberships: ${cm1} ADMIN → OWNER`);

  // Space memberships
  const sm1 = await prisma.$executeRawUnsafe(`UPDATE space_memberships SET role = 'OWNER' WHERE role = 'ADMIN'`);
  const sm2 = await prisma.$executeRawUnsafe(`UPDATE space_memberships SET role = 'MEMBER' WHERE role = 'VIEWER'`);
  console.log(`Space memberships: ${sm1} ADMIN → OWNER, ${sm2} VIEWER → MEMBER`);

  // Invitations
  const inv1 = await prisma.$executeRawUnsafe(`UPDATE invitations SET role = 'OWNER' WHERE role = 'ADMIN'`);
  const inv2 = await prisma.$executeRawUnsafe(`UPDATE invitations SET role = 'MEMBER' WHERE role = 'VIEWER'`);
  console.log(`Invitations: ${inv1} ADMIN → OWNER, ${inv2} VIEWER → MEMBER`);

  // Space defaultRole
  const sp1 = await prisma.$executeRawUnsafe(`UPDATE spaces SET "defaultRole" = 'OWNER' WHERE "defaultRole" = 'ADMIN'`);
  const sp2 = await prisma.$executeRawUnsafe(`UPDATE spaces SET "defaultRole" = 'MEMBER' WHERE "defaultRole" = 'VIEWER'`);
  console.log(`Space defaultRole: ${sp1} ADMIN → OWNER, ${sp2} VIEWER → MEMBER`);

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
