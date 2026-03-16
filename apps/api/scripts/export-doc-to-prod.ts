import { PrismaClient } from '@spok/database';

const LOCAL_URL = process.env.DATABASE_URL!;
const PROD_URL = 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway';

const COMMUNITY_ID = 'cmmtheuzn0005f03nqjf8p238';
// ztarr user in prod
const PROD_USER_ID = 'cml3q8k60000012gz2ev4dz7r';

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });

async function main() {
  console.log('Reading local community...');

  // 1. Get community
  const community = await local.community.findUnique({ where: { id: COMMUNITY_ID } });
  if (!community) throw new Error('Community not found locally');
  console.log(`Community: ${community.name}`);

  // 2. Get spaces
  const spaces = await local.space.findMany({ where: { communityId: COMMUNITY_ID } });
  console.log(`Spaces: ${spaces.length}`);

  const spaceIds = spaces.map(s => s.id);

  // 3. Get all items in those spaces
  const items = await local.item.findMany({ where: { spaceId: { in: spaceIds } } });
  console.log(`Items: ${items.length}`);

  // 4. Get all relations between items in those spaces
  const itemIds = items.map(i => i.id);
  const relations = await local.itemRelation.findMany({
    where: { OR: [{ fromItemId: { in: itemIds } }, { toItemId: { in: itemIds } }] }
  });
  console.log(`Relations: ${relations.length}`);

  // 5. Get space memberships
  const memberships = await local.spaceMembership.findMany({ where: { spaceId: { in: spaceIds } } });
  console.log(`Space memberships: ${memberships.length}`);

  // 6. Get community membership
  const communityMemberships = await local.communityMembership.findMany({ where: { communityId: COMMUNITY_ID } });
  console.log(`Community memberships: ${communityMemberships.length}`);

  // --- WRITE TO PROD ---
  console.log('\nWriting to prod...');

  // Upsert community
  await prod.community.upsert({
    where: { id: COMMUNITY_ID },
    create: {
      id: community.id,
      name: community.name,
      description: community.description,
      isPublic: community.isPublic,
      pendingPublic: false,
      avatarUrl: community.avatarUrl,
      coverUrl: community.coverUrl,
      createdAt: community.createdAt,
      updatedAt: new Date(),
    },
    update: {
      name: community.name,
      description: community.description,
      isPublic: community.isPublic,
      avatarUrl: community.avatarUrl,
      coverUrl: community.coverUrl,
      updatedAt: new Date(),
    },
  });
  console.log('Community upserted');

  // Upsert community membership for prod user
  await prod.communityMembership.upsert({
    where: { userId_communityId: { userId: PROD_USER_ID, communityId: COMMUNITY_ID } },
    create: { userId: PROD_USER_ID, communityId: COMMUNITY_ID, role: 'OWNER' },
    update: { role: 'OWNER' },
  });
  console.log('Community membership upserted');

  // Upsert spaces (parents first)
  const spaceMap = new Map(spaces.map(s => [s.id, s]));
  const insertedSpaces = new Set<string>();

  async function upsertSpace(space: typeof spaces[0]) {
    if (insertedSpaces.has(space.id)) return;
    // Insert parent space first if it's in our set
    if (space.parentId && spaceMap.has(space.parentId) && !insertedSpaces.has(space.parentId)) {
      await upsertSpace(spaceMap.get(space.parentId)!);
    }
    insertedSpaces.add(space.id);
    await prod.space.upsert({
      where: { id: space.id },
      create: {
        id: space.id,
        name: space.name,
        description: space.description,
        type: space.type,
        communityId: COMMUNITY_ID,
        parentId: space.parentId,
        defaultRole: space.defaultRole,
        avatarUrl: space.avatarUrl,
        coverUrl: space.coverUrl,
        createdAt: space.createdAt,
        updatedAt: new Date(),
      },
      update: {
        name: space.name,
        description: space.description,
        type: space.type,
        parentId: space.parentId,
        defaultRole: space.defaultRole,
        avatarUrl: space.avatarUrl,
        coverUrl: space.coverUrl,
        updatedAt: new Date(),
      },
    });

    // Ensure prod user has membership
    await prod.spaceMembership.upsert({
      where: { userId_spaceId: { userId: PROD_USER_ID, spaceId: space.id } },
      create: { userId: PROD_USER_ID, spaceId: space.id, role: 'OWNER' },
      update: { role: 'OWNER' },
    });
  }

  for (const space of spaces) {
    await upsertSpace(space);
  }
  console.log(`${spaces.length} spaces upserted`);

  // Delete existing items in prod for these spaces (clean sync)
  const existingProdItems = await prod.item.findMany({ where: { spaceId: { in: spaceIds } }, select: { id: true } });
  const existingProdItemIds = existingProdItems.map(i => i.id);
  if (existingProdItemIds.length > 0) {
    await prod.itemRelation.deleteMany({ where: { OR: [{ fromItemId: { in: existingProdItemIds } }, { toItemId: { in: existingProdItemIds } }] } });
    // Delete contributions, tags links, reactions etc.
    await prod.contribution.deleteMany({ where: { itemId: { in: existingProdItemIds } } });
    await prod.item.deleteMany({ where: { spaceId: { in: spaceIds } } });
  }
  console.log(`Cleaned ${existingProdItemIds.length} existing prod items`);

  // Insert items (parent-first order to respect FK constraints)
  const itemMap = new Map(items.map(i => [i.id, i]));
  const inserted = new Set<string>();

  function insertItem(item: typeof items[0]): Promise<void> {
    return (async () => {
      if (inserted.has(item.id)) return;
      // Insert parent first if needed
      if (item.parentId && itemMap.has(item.parentId) && !inserted.has(item.parentId)) {
        await insertItem(itemMap.get(item.parentId)!);
      }
      inserted.add(item.id);
      await prod.item.create({
        data: {
          id: item.id,
          type: item.type,
          title: item.title,
          description: item.description,
          content: item.content as any,
          url: item.url,
          status: item.status,
          priority: item.priority,
          position: item.position,
          dueDate: item.dueDate,
          startDate: item.startDate,
          endDate: item.endDate,
          spaceId: item.spaceId,
          parentId: item.parentId,
          createdById: PROD_USER_ID,
          assignedToId: null,
          createdAt: item.createdAt,
          updatedAt: new Date(),
        },
      });
    })();
  }

  for (const item of items) {
    await insertItem(item);
  }
  console.log(`${items.length} items inserted`);

  // Insert relations
  for (const rel of relations) {
    await prod.itemRelation.create({
      data: {
        id: rel.id,
        fromItemId: rel.fromItemId,
        toItemId: rel.toItemId,
        type: rel.type,
        label: rel.label,
        createdAt: rel.createdAt,
      },
    });
  }
  console.log(`${relations.length} relations inserted`);

  console.log('\nDone!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => {
    await local.$disconnect();
    await prod.$disconnect();
  });
