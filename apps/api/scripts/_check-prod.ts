import { PrismaClient } from '@spok/database';
const p = new PrismaClient({datasources:{db:{url:'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway'}}});

async function main() {
  const result = await p.$queryRawUnsafe("SELECT visibility, count(*)::int as c FROM spaces GROUP BY visibility");
  console.log('Visibility distribution:', result);

  const nullCount = await p.$queryRawUnsafe("SELECT count(*)::int as c FROM spaces WHERE visibility IS NULL");
  console.log('NULL visibility:', nullCount);
}

main().catch(e => console.error('ERR:', e.message)).finally(() => p.$disconnect());
