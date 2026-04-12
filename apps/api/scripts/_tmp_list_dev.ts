import { PrismaClient } from '@spok/database';
const dev = new PrismaClient({ datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } } });
const SPACE_ID = 'cmnn2fi3301uatmoswfii34wk';
async function main() {
  const items = await dev.item.findMany({
    where: { spaceId: SPACE_ID },
    select: { id: true, title: true, type: true, parentId: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log('Total: ' + items.length + ' items\n');
  const byParent = new Map();
  for (const item of items) {
    const key = item.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  }
  function print(parentId, indent) {
    const children = byParent.get(parentId) ?? [];
    for (const c of children) {
      console.log(indent + '[' + c.type + '] ' + c.title + ' (' + c.id + ')');
      print(c.id, indent + '  ');
    }
  }
  print(null, '');
  await dev.$disconnect();
}
main();
