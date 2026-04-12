import { PrismaClient } from '@spok/database';

const dev = new PrismaClient({
  datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } },
});
const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});

const PROD_ADMIN_ID = 'cml3q8k60000012gz2ev4dz7r';

const DEV_SPACE_IDS = [
  'cmnn2fh8401tutmos4yse7vuk', // Produit SPOK (racine)
  'cmnn824ak023jtmoswzqvrjgq', // Contexte projet
  'cmnn2fhfw01tytmos3k607kvz', // Modèle de données
  'cmnn2fhn801u2tmosagjc84lt', // Structure
  'cmnn2fi3301uatmoswfii34wk', // Interfaces - Espaces
  'cmnn2fhvd01u6tmos0glnjmq8', // Interfaces - Communautés
  'cmnn2fiac01uetmosa27z8zb9', // Interfaces - Administration
  'cmnn2figx01uitmosfqkwqvg2', // Interfaces - Autres
  'cmnn2fiol01umtmoso056ajbx', // Interactions
];

// 1. Créer la communauté Documentations en prod
console.log('Création communauté Documentations...');
const community = await prod.community.create({
  data: {
    name: 'Documentations',
    visibility: 'PRIVATE',
    memberships: { create: { userId: PROD_ADMIN_ID, role: 'OWNER' } },
  },
});
console.log(`  ✓ ${community.id}`);

// 2. Lire les espaces en dev
const devSpaces = await dev.space.findMany({
  where: { id: { in: DEV_SPACE_IDS } },
  select: { id: true, name: true, parentId: true, visibility: true, defaultRole: true, type: true },
  orderBy: { createdAt: 'asc' },
});

// 3. Créer les espaces en prod (racines d'abord)
const spaceIdMap = new Map<string, string>();
const roots = devSpaces.filter(s => !s.parentId || !DEV_SPACE_IDS.includes(s.parentId));
const children = devSpaces.filter(s => s.parentId && DEV_SPACE_IDS.includes(s.parentId));

for (const space of [...roots, ...children]) {
  const prodParentId = space.parentId ? (spaceIdMap.get(space.parentId) ?? null) : null;
  const prodSpace = await prod.space.create({
    data: {
      name: space.name,
      type: space.type,
      communityId: community.id,
      parentId: prodParentId,
      visibility: space.visibility ?? 'PRIVATE',
      defaultRole: null,
      memberships: { create: { userId: PROD_ADMIN_ID, role: 'OWNER' } },
    },
  });
  spaceIdMap.set(space.id, prodSpace.id);
  console.log(`  ✓ Espace "${space.name}" : ${prodSpace.id}`);
}

// 4. Lire tous les items de doc en dev
const devItems = await dev.item.findMany({
  where: { spaceId: { in: DEV_SPACE_IDS } },
  select: { id: true, title: true, type: true, spaceId: true, parentId: true, content: true, status: true, priority: true },
  orderBy: { createdAt: 'asc' },
});

console.log(`\nMigration de ${devItems.length} items...`);

// 5. Créer les items en prod (multi-passes pour la hiérarchie)
const itemIdMap = new Map<string, string>();
let remaining = [...devItems];

for (let pass = 0; pass < 10 && remaining.length > 0; pass++) {
  const nextRound: typeof remaining = [];

  for (const item of remaining) {
    const prodSpaceId = spaceIdMap.get(item.spaceId);
    if (!prodSpaceId) { nextRound.push(item); continue; }

    if (item.parentId && !itemIdMap.has(item.parentId)) {
      nextRound.push(item); continue;
    }

    const prodParentId = item.parentId ? (itemIdMap.get(item.parentId) ?? null) : null;
    const created = await prod.item.create({
      data: {
        title: item.title,
        type: item.type,
        spaceId: prodSpaceId,
        parentId: prodParentId,
        content: item.content ?? undefined,
        status: item.status ?? null,
        priority: item.priority ?? null,
        createdById: PROD_ADMIN_ID,
      },
    });
    itemIdMap.set(item.id, created.id);
  }

  remaining = nextRound;
  if (nextRound.length > 0) console.log(`  Passe ${pass + 1} : ${nextRound.length} items reportés...`);
}

if (remaining.length > 0) {
  console.log(`⚠ ${remaining.length} items non migrés :`);
  remaining.forEach(i => console.log(`  - ${i.title} (parentId: ${i.parentId})`));
}

console.log(`\n✓ Migration terminée : ${itemIdMap.size}/${devItems.length} items créés en prod.`);

await dev.$disconnect();
await prod.$disconnect();
