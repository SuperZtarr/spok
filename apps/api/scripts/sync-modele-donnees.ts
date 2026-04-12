/**
 * Sync un espace de la prod vers le dev local.
 * Usage : SPACE_NAME="Interface utilisateur" DEV_SPACE_ID="..." npx tsx ...
 * Ou modifier les constantes ci-dessous directement.
 */
import { PrismaClient } from '@spok/database';

const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});
const dev = new PrismaClient({
  datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } },
});

const DEV_ADMIN_ID = 'cmlup9ug40000n86xjf96ej3f';

// Paramètres à ajuster
const SEARCH_NAME = process.env.SPACE_NAME || 'Interface utilisateur';
const DEV_SPACE_ID = process.env.DEV_SPACE_ID || '';

async function findProdSpace(name: string) {
  // Chercher dans "Projet SPOK" (communauté "Les Projets")
  const community = await prod.community.findFirst({
    where: { name: { contains: 'Projets', mode: 'insensitive' } },
  });
  if (!community) throw new Error('Communauté "Les Projets" introuvable');

  const projetSpok = await prod.space.findFirst({
    where: { communityId: community.id, name: { contains: 'Projet SPOK', mode: 'insensitive' } },
  });
  if (!projetSpok) throw new Error('Espace "Projet SPOK" introuvable');

  const space = await prod.space.findFirst({
    where: { parentId: projetSpok.id, name: { contains: name, mode: 'insensitive' } },
  });
  if (!space) {
    const children = await prod.space.findMany({ where: { parentId: projetSpok.id } });
    console.log('Enfants de Projet SPOK:', children.map(s => `${s.name} (${s.id})`));
    throw new Error(`Espace "${name}" introuvable sous Projet SPOK`);
  }
  return space;
}

async function main() {
  const prodSpace = await findProdSpace(SEARCH_NAME);
  console.log(`Espace prod: ${prodSpace.name} (${prodSpace.id})`);

  const items = await prod.item.findMany({
    where: { spaceId: prodSpace.id },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`${items.length} items en prod:`);
  items.forEach(i => console.log(`  [${i.type}] ${i.title} parent=${i.parentId ?? 'null'}`));

  let targetSpaceId = DEV_SPACE_ID;

  if (!targetSpaceId) {
    // Créer l'espace en dev sous Produit SPOK
    const PRODUIT_SPOK_DEV_ID = 'cmnn2fh8401tutmos4yse7vuk';
    const DOC_COMMUNITY_DEV_ID = 'cmmtheuzn0005f03nqjf8p238';
    const existing = await dev.space.findFirst({ where: { name: prodSpace.name, parentId: PRODUIT_SPOK_DEV_ID } });
    if (existing) {
      console.log(`Espace dev existant: ${existing.name} (${existing.id})`);
      targetSpaceId = existing.id;
    } else {
      const created = await dev.space.create({
        data: {
          name: prodSpace.name,
          type: prodSpace.type,
          parentId: PRODUIT_SPOK_DEV_ID,
          communityId: DOC_COMMUNITY_DEV_ID,
          defaultRole: prodSpace.defaultRole,
          visibility: prodSpace.visibility ?? 'PRIVATE',
          memberships: { create: { userId: DEV_ADMIN_ID, role: 'OWNER' } },
        },
      });
      console.log(`Espace dev créé: ${created.name} (${created.id})`);
      targetSpaceId = created.id;
    }
  }

  const devSpace = await dev.space.findUnique({ where: { id: targetSpaceId } });
  if (!devSpace) throw new Error(`Espace dev ${targetSpaceId} introuvable`);
  DEV_SPACE_ID || (process.env.DEV_SPACE_ID = targetSpaceId);
  console.log(`\nEspace dev: ${devSpace.name} (${devSpace.id})`);

  const devItems = await dev.item.findMany({ where: { spaceId: targetSpaceId } });
  console.log(`Items existants en dev: ${devItems.length}`);
  const devItemsByTitle = new Map(devItems.map(i => [i.title, i]));
  const prodIdToDevId = new Map<string, string>();

  const roots = items.filter(i => !i.parentId || !items.find(p => p.id === i.parentId));
  const children = items.filter(i => i.parentId && items.find(p => p.id === i.parentId));

  async function upsertItem(item: typeof items[0], devParentId?: string) {
    const data: any = {
      title: item.title,
      type: item.type,
      status: (item.status as string) || null,
      description: item.description,
      content: item.content as any,
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.dueDate,
      priority: item.priority,
      parentId: devParentId ?? null,
    };
    const existing = devItemsByTitle.get(item.title);
    if (existing) {
      const updated = await dev.item.update({ where: { id: existing.id }, data });
      console.log(`  UPDATE: ${updated.title}`);
      prodIdToDevId.set(item.id, updated.id);
    } else {
      const created = await dev.item.create({
        data: { ...data, spaceId: targetSpaceId, createdById: DEV_ADMIN_ID },
      });
      console.log(`  CREATE: ${created.title} (${created.id})`);
      prodIdToDevId.set(item.id, created.id);
    }
  }

  console.log(`\nSync: ${roots.length} racines, ${children.length} enfants`);
  for (const item of roots) await upsertItem(item);
  for (const item of children) await upsertItem(item, prodIdToDevId.get(item.parentId!));

  console.log(`\nDone. ${items.length} items synchronisés dans "${devSpace.name}".`);
}

main()
  .catch(e => { console.error('ERR:', e.message); process.exit(1); })
  .finally(() => Promise.all([prod.$disconnect(), dev.$disconnect()]));
