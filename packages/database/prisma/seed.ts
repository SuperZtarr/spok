import { PrismaClient, SpaceType, Role, ItemType } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const passwordHash = await hash('demo1234', 10);

  const user = await prisma.user.upsert({
    where: { email: 'demo@spok.app' },
    update: {},
    create: {
      email: 'demo@spok.app',
      name: 'Demo User',
      passwordHash,
    },
  });

  console.log('Created user:', user.email);

  // Create personal space
  const personalSpace = await prisma.space.upsert({
    where: { id: 'personal-space-demo' },
    update: {},
    create: {
      id: 'personal-space-demo',
      name: 'Mon espace personnel',
      type: SpaceType.PERSONAL,
    },
  });

  // Add membership
  await prisma.spaceMembership.upsert({
    where: {
      userId_spaceId: {
        userId: user.id,
        spaceId: personalSpace.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      spaceId: personalSpace.id,
      role: Role.OWNER,
    },
  });

  console.log('Created personal space:', personalSpace.name);

  // Create sample items
  const project = await prisma.item.create({
    data: {
      type: ItemType.PROJECT,
      title: 'Mon premier projet',
      content: { description: 'Un projet de démonstration' },
      spaceId: personalSpace.id,
      createdById: user.id,
    },
  });

  await prisma.item.createMany({
    data: [
      {
        type: ItemType.TASK,
        title: 'Tâche 1 - Planification',
        status: 'todo',
        priority: 1,
        spaceId: personalSpace.id,
        createdById: user.id,
        parentId: project.id,
      },
      {
        type: ItemType.TASK,
        title: 'Tâche 2 - Développement',
        status: 'todo',
        priority: 2,
        spaceId: personalSpace.id,
        createdById: user.id,
        parentId: project.id,
      },
      {
        type: ItemType.NOTE,
        title: 'Notes de projet',
        content: { text: 'Quelques notes importantes...' },
        spaceId: personalSpace.id,
        createdById: user.id,
        parentId: project.id,
      },
    ],
  });

  console.log('Created sample items');

  // Create tags
  await prisma.tag.createMany({
    data: [
      { name: 'Important', color: '#ef4444', spaceId: personalSpace.id },
      { name: 'En cours', color: '#3b82f6', spaceId: personalSpace.id },
      { name: 'Idée', color: '#8b5cf6', spaceId: personalSpace.id },
    ],
    skipDuplicates: true,
  });

  console.log('Created tags');
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
