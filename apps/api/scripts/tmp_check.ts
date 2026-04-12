import { PrismaClient } from '@spok/database';
const prod = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway' } },
});
const items = await prod.item.findMany({
  where: { spaceId: 'cmnpqva590003i4t1q0cro6fy', type: 'DOCUMENT' },
  select: { id: true, title: true, content: true },
  orderBy: { createdAt: 'asc' },
});
for (const item of items) {
  console.log(`\n${item.title}`);
  console.log('content:', JSON.stringify(item.content)?.slice(0, 200));
}
await prod.$disconnect();
