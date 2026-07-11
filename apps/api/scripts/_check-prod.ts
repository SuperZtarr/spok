import { prodPrisma } from './_env';
const p = prodPrisma();

async function main() {
  const result = await p.$queryRawUnsafe("SELECT visibility, count(*)::int as c FROM spaces GROUP BY visibility");
  console.log('Visibility distribution:', result);

  const nullCount = await p.$queryRawUnsafe("SELECT count(*)::int as c FROM spaces WHERE visibility IS NULL");
  console.log('NULL visibility:', nullCount);
}

main().catch(e => console.error('ERR:', e.message)).finally(() => p.$disconnect());
