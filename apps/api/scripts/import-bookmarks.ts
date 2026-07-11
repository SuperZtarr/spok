/* Import one-shot des favoris depuis bookmarks.json. */
import { PrismaClient } from '@spok/database';
import * as fs from 'fs';
import { isProd, ADMIN_ID, ENV } from './_env';

const db = new PrismaClient({
  datasources: { db: { url: isProd ? ENV.PROD_DB_URL : ENV.LOCAL_DB_URL } },
});

const BOOKMARKS_FILE = 'C:/_dev/spok/bookmarks.json';

console.log(`Cible: ${isProd ? 'PROD' : 'LOCAL'} | Admin: ${ADMIN_ID}`);

interface BookmarkNode {
  name: string;
  type: 'url' | 'folder';
  url?: string;
  children?: BookmarkNode[];
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
  const barChildren: BookmarkNode[] = raw.roots.bookmark_bar.children || [];

  // Create community "Favoris"
  let community = await db.community.findFirst({ where: { name: 'Favoris' } });
  if (!community) {
    community = await db.community.create({
      data: { name: 'Favoris', description: 'Favoris navigateur importés', visibility: 'PRIVATE' },
    });
    console.log(`Community created: ${community.id}`);
  } else {
    console.log(`Community exists: ${community.id}`);
  }

  // Ensure admin is member
  const membership = await db.communityMembership.findFirst({
    where: { userId: ADMIN_ID, communityId: community.id },
  });
  if (!membership) {
    await db.communityMembership.create({
      data: { userId: ADMIN_ID, communityId: community.id, role: 'OWNER' },
    });
  }

  // Process each root folder as a space
  let spaceOrder = 0;
  for (const rootNode of barChildren) {
    if (rootNode.type === 'folder') {
      await processRootFolder(rootNode, community.id, spaceOrder++);
    } else if (rootNode.type === 'url' && rootNode.url) {
      let diversSpace = await db.space.findFirst({
        where: { name: 'Divers', communityId: community.id },
      });
      if (!diversSpace) {
        diversSpace = await db.space.create({
          data: {
            name: 'Divers',
            type: 'GROUP',
            communityId: community.id,
            memberships: { create: { userId: ADMIN_ID, role: 'OWNER' } },
          },
        });
      }
      await createLinkItem(rootNode, diversSpace.id, null);
    }
  }

  console.log('\nImport terminé!');
  const stats = await db.item.count({
    where: { space: { communityId: community.id } },
  });
  console.log(`Total items: ${stats}`);
}

async function processRootFolder(node: BookmarkNode, communityId: string, order: number) {
  let space = await db.space.findFirst({
    where: { name: node.name, communityId },
  });
  if (!space) {
    space = await db.space.create({
      data: {
        name: node.name,
        type: 'GROUP',
        communityId,
        memberships: { create: { userId: ADMIN_ID, role: 'OWNER' } },
      },
    });
    console.log(`Space: ${node.name}`);
  } else {
    console.log(`Space exists: ${node.name}`);
  }

  if (!node.children) return;

  let itemOrder = 0;
  for (const child of node.children) {
    await processNode(child, space.id, null, itemOrder++);
  }
}

async function processNode(node: BookmarkNode, spaceId: string, parentId: string | null, order: number) {
  if (node.type === 'url' && node.url) {
    await createLinkItem(node, spaceId, parentId, order);
  } else if (node.type === 'folder') {
    const existing = await db.item.findFirst({
      where: { title: node.name, spaceId, parentId, type: 'NOTE' },
    });
    let folderId: string;
    if (existing) {
      folderId = existing.id;
    } else {
      const folder = await db.item.create({
        data: {
          title: node.name,
          type: 'NOTE',
          spaceId,
          createdById: ADMIN_ID,
          parentId,
          position: order,
        },
      });
      folderId = folder.id;
      console.log(`  Folder: ${node.name}`);
    }

    if (node.children) {
      let childOrder = 0;
      for (const child of node.children) {
        await processNode(child, spaceId, folderId, childOrder++);
      }
    }
  }
}

async function createLinkItem(node: BookmarkNode, spaceId: string, parentId: string | null, order: number = 0) {
  if (!node.url) return;

  const existing = await db.item.findFirst({
    where: { url: node.url, spaceId },
  });
  if (existing) return;

  await db.item.create({
    data: {
      title: node.name || node.url,
      type: 'LINK',
      url: node.url,
      spaceId,
      createdById: ADMIN_ID,
      parentId,
      position: order,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
