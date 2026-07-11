/* Seed de données de test en local (communautés/espaces/items factices). */
import { PrismaClient } from '@spok/database';

const p = new PrismaClient();

const TYPES = ['NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const;
const STATUSES = ['undefined', 'todo', 'in_progress', 'late', 'blocked', 'done', 'cancelled'] as const;
const STATUS_LABELS: Record<string, string> = {
  undefined: 'Non défini', todo: 'À faire', in_progress: 'En cours',
  late: 'En retard', blocked: 'Bloqué', done: 'Terminé', cancelled: 'Annulé',
};

const SPACE_NAME = '🧪 Espace de test';

async function main() {
  const admin = await p.user.findFirst({ where: { email: 'admin@spok.app' } });
  if (!admin) {
    console.error('Admin user not found (admin@spok.app). Run db:seed first.');
    process.exit(1);
  }

  // Also add superztarr if exists
  const superztarr = await p.user.findFirst({ where: { email: 'superztarr@gmail.com' } });

  // Delete existing test space if any
  const existing = await p.space.findFirst({ where: { name: SPACE_NAME } });
  if (existing) {
    await p.itemRelation.deleteMany({ where: { fromItem: { spaceId: existing.id } } });
    await p.itemTag.deleteMany({ where: { item: { spaceId: existing.id } } });
    await p.contribution.deleteMany({ where: { item: { spaceId: existing.id } } });
    await p.item.deleteMany({ where: { spaceId: existing.id } });
    await p.tag.deleteMany({ where: { spaceId: existing.id } });
    await p.spaceMembership.deleteMany({ where: { spaceId: existing.id } });
    await p.space.delete({ where: { id: existing.id } });
    console.log('Deleted previous test space');
  }

  // Create test space
  const space = await p.space.create({
    data: { name: SPACE_NAME, type: 'GROUP' },
  });

  // Add memberships
  await p.spaceMembership.create({
    data: { userId: admin.id, spaceId: space.id, role: 'OWNER' },
  });
  if (superztarr) {
    await p.spaceMembership.create({
      data: { userId: superztarr.id, spaceId: space.id, role: 'OWNER' },
    });
  }

  console.log(`Created space: ${space.name} (${space.id})`);

  // Create tags
  const tagColors = [
    { name: 'Urgent', color: '#ef4444' },
    { name: 'Documentation', color: '#3b82f6' },
    { name: 'Idée', color: '#8b5cf6' },
    { name: 'Bug', color: '#f97316' },
    { name: 'Amélioration', color: '#22c55e' },
  ];
  const tags = [];
  for (const t of tagColors) {
    const tag = await p.tag.create({
      data: { name: t.name, color: t.color, spaceId: space.id },
    });
    tags.push(tag);
  }
  console.log(`Created ${tags.length} tags`);

  let pos = 0;

  // Helper to create an item
  async function createItem(data: {
    type: string; title: string; status?: string | null;
    parentId?: string; priority?: number; startDate?: Date; endDate?: Date;
  }) {
    const item = await p.item.create({
      data: {
        type: data.type as any,
        title: data.title,
        status: data.status === 'undefined' ? null : (data.status || null),
        parentId: data.parentId,
        priority: data.priority,
        startDate: data.startDate,
        endDate: data.endDate,
        spaceId: space.id,
        createdById: admin.id,
        position: pos++,
      },
    });
    return item;
  }

  // =============================================
  // 1. 📋 Test Statuts — un enfant par statut
  // =============================================
  const statusParent = await createItem({
    type: 'PROJECT', title: '📋 Test Statuts', status: 'in_progress',
  });
  const statusChildren: string[] = [];
  for (const status of STATUSES) {
    const child = await createItem({
      type: 'TASK', title: STATUS_LABELS[status], status, parentId: statusParent.id,
    });
    statusChildren.push(child.id);
  }
  console.log(`Created "Test Statuts" with ${STATUSES.length} children`);

  // =============================================
  // 2. 🎨 Test Types — un enfant par type
  // =============================================
  const typeParent = await createItem({
    type: 'PROJECT', title: '🎨 Test Types', status: 'in_progress',
  });
  for (const type of TYPES) {
    await createItem({
      type, title: `${type}`, status: 'todo', parentId: typeParent.id,
    });
  }
  console.log(`Created "Test Types" with ${TYPES.length} children`);

  // =============================================
  // 3. 🔗 Test Relations — items avec liens
  // =============================================
  const relParent = await createItem({
    type: 'PROJECT', title: '🔗 Test Relations', status: 'in_progress',
  });
  const relTypes = ['blocks', 'depends', 'relates', 'implements', 'tests', 'duplicates'];
  const relItems: string[] = [];
  for (const relType of relTypes) {
    const a = await createItem({
      type: 'TASK', title: `Source (${relType})`, status: 'todo', parentId: relParent.id,
    });
    const b = await createItem({
      type: 'TASK', title: `Cible (${relType})`, status: 'todo', parentId: relParent.id,
    });
    relItems.push(a.id, b.id);
    await p.itemRelation.create({
      data: { fromItemId: a.id, toItemId: b.id, type: relType },
    });
  }
  console.log(`Created "Test Relations" with ${relTypes.length} paires`);

  // =============================================
  // 4. 🏷️ Test Tags — items avec tags variés
  // =============================================
  const tagParent = await createItem({
    type: 'PROJECT', title: '🏷️ Test Tags', status: 'in_progress',
  });
  for (let i = 0; i < tags.length; i++) {
    const item = await createItem({
      type: 'NOTE', title: `Tag: ${tags[i].name}`, status: 'done', parentId: tagParent.id,
    });
    await p.itemTag.create({ data: { itemId: item.id, tagId: tags[i].id } });
  }
  // Item with multiple tags
  const multiTagItem = await createItem({
    type: 'NOTE', title: 'Multi-tags (tous)', status: 'todo', parentId: tagParent.id,
  });
  for (const tag of tags) {
    await p.itemTag.create({ data: { itemId: multiTagItem.id, tagId: tag.id } });
  }
  console.log(`Created "Test Tags" with ${tags.length + 1} children`);

  // =============================================
  // 5. 📅 Test Timeline — items avec dates
  // =============================================
  const timeParent = await createItem({
    type: 'PROJECT', title: '📅 Test Timeline', status: 'in_progress',
  });
  const now = new Date();
  const timelineStatuses = ['todo', 'in_progress', 'late', 'done', 'blocked'];
  for (let i = 0; i < timelineStatuses.length; i++) {
    const start = new Date(now);
    start.setDate(start.getDate() + i * 3 - 5);
    const end = new Date(start);
    end.setDate(end.getDate() + 4 + i);
    await createItem({
      type: 'TASK',
      title: `Tâche ${STATUS_LABELS[timelineStatuses[i]]}`,
      status: timelineStatuses[i],
      parentId: timeParent.id,
      startDate: start,
      endDate: end,
    });
  }
  console.log(`Created "Test Timeline" with ${timelineStatuses.length} children`);

  // =============================================
  // 6. ⚡ Test Priorités — items avec priorité 1-5
  // =============================================
  const prioParent = await createItem({
    type: 'PROJECT', title: '⚡ Test Priorités', status: 'in_progress',
  });
  for (let priority = 1; priority <= 5; priority++) {
    await createItem({
      type: 'TASK', title: `Priorité ${priority}`, status: 'todo',
      parentId: prioParent.id, priority,
    });
  }
  console.log('Created "Test Priorités" with 5 children');

  // =============================================
  // 7. 🌳 Test Hiérarchie — imbrication profonde
  // =============================================
  const hierParent = await createItem({
    type: 'PROJECT', title: '🌳 Test Hiérarchie', status: 'in_progress',
  });
  let currentParent = hierParent.id;
  for (let depth = 1; depth <= 4; depth++) {
    const child = await createItem({
      type: depth < 4 ? 'PROJECT' : 'TASK',
      title: `Niveau ${depth}`,
      status: 'todo',
      parentId: currentParent,
    });
    // Add siblings at each level
    await createItem({
      type: 'NOTE', title: `Note niveau ${depth}`, status: 'done', parentId: currentParent,
    });
    currentParent = child.id;
  }
  console.log('Created "Test Hiérarchie" (4 niveaux)');

  const total = await p.item.count({ where: { spaceId: space.id } });
  console.log(`\n✅ Done! ${total} items in "${SPACE_NAME}"`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => p.$disconnect());
