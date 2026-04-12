import { PrismaClient } from '@spok/database';

const dev = new PrismaClient({
  datasources: { db: { url: 'postgresql://spok:spok@localhost:25432/spok?schema=public' } },
});

// Lire tous les espaces de doc en dev avec leur hiérarchie
const DOC_SPACE_IDS = [
  'cmnn2fh8401tutmos4yse7vuk',
  'cmnn824ak023jtmoswzqvrjgq',
  'cmnn2fhfw01tytmos3k607kvz',
  'cmnn2fhn801u2tmosagjc84lt',
  'cmnn2fi3301uatmoswfii34wk',
  'cmnn2fhvd01u6tmos0glnjmq8',
  'cmnn2fiac01uetmosa27z8zb9',
  'cmnn2figx01uitmosfqkwqvg2',
  'cmnn2fiol01umtmoso056ajbx',
];

const spaces = await dev.space.findMany({
  where: { id: { in: DOC_SPACE_IDS } },
  select: { id: true, name: true, description: true, parentId: true, type: true },
  orderBy: { createdAt: 'asc' },
});
console.log('Espaces:', JSON.stringify(spaces.map(s => ({ id: s.id, name: s.name, parentId: s.parentId })), null, 2));

await dev.$disconnect();
