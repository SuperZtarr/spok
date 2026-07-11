/* Correctif one-shot : réparation d'encodage (mojibake) sur les contenus importés. */
import { prisma } from '@spok/database';

// =============================================================
// FIX MOJIBAKE - Corrige le double encodage UTF-8 (ciblé)
// =============================================================
// Certains textes ont un mélange de caractères correctement encodés
// et de séquences mojibake. On ne corrige que les séquences mojibake
// sans toucher au reste du texte.
// =============================================================

const BATCH_SIZE = 100;

// Pattern SQL pour détecter la présence de mojibake
const SQL_PATTERN = "\u00C3[\u00A0-\u00BF]|\u00C2[\u0080-\u00BF]|\u00C4[\u0080-\u00BF]|\u00C5[\u0080-\u00BF]";

/**
 * Corrige les séquences mojibake dans un texte de manière ciblée.
 * Remplace uniquement les séquences de 2 ou 3 caractères Latin-1 qui
 * forment un caractère UTF-8 valide, sans toucher au reste.
 */
function fixMojibakeTargeted(text: string): string {
  // Regex pour trouver les séquences mojibake :
  // - 2-byte : char 0xC2-0xDF suivi de char 0x80-0xBF
  // - 3-byte : char 0xE0-0xEF suivi de 2x char 0x80-0xBF
  return text.replace(
    /([\u00C0-\u00DF])([\u0080-\u00BF])|([\u00E0-\u00EF])([\u0080-\u00BF])([\u0080-\u00BF])/g,
    (...args) => {
      try {
        if (args[1] && args[2]) {
          // 2-byte sequence
          const bytes = Buffer.from([args[1].charCodeAt(0), args[2].charCodeAt(0)]);
          const decoded = bytes.toString('utf8');
          if (!decoded.includes('\uFFFD')) return decoded;
        } else if (args[3] && args[4] && args[5]) {
          // 3-byte sequence
          const bytes = Buffer.from([args[3].charCodeAt(0), args[4].charCodeAt(0), args[5].charCodeAt(0)]);
          const decoded = bytes.toString('utf8');
          if (!decoded.includes('\uFFFD')) return decoded;
        }
      } catch {
        // pas de conversion possible, on garde l'original
      }
      return args[0]; // retourner le match original si la conversion échoue
    }
  );
}

async function fixMojibake() {
  console.log('=== FIX MOJIBAKE (cible) - Double encodage UTF-8 ===\n');

  // 1. Items
  console.log('1. Detection des items avec mojibake...');
  const mojibakeItems = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    description: string | null;
  }>>(
    `SELECT id, title, description FROM items
     WHERE title ~ '${SQL_PATTERN}'
       OR (description IS NOT NULL AND description ~ '${SQL_PATTERN}')`
  );
  console.log(`   ${mojibakeItems.length} items detectes`);

  if (mojibakeItems.length > 0) {
    console.log('\n   Preview (10 premiers) :');
    for (const item of mojibakeItems.slice(0, 10)) {
      const fixed = fixMojibakeTargeted(item.title);
      const changed = fixed !== item.title;
      console.log(`   ${changed ? 'V' : '='} "${item.title}" -> "${fixed}"`);
    }
  }

  // 2. Corriger les items
  console.log('\n2. Correction des items...');
  let fixedItemTitles = 0;
  let fixedItemDescs = 0;

  for (let i = 0; i < mojibakeItems.length; i += BATCH_SIZE) {
    const batch = mojibakeItems.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const updates: { title?: string; description?: string } = {};

      const fixedTitle = fixMojibakeTargeted(item.title);
      if (fixedTitle !== item.title) {
        updates.title = fixedTitle;
        fixedItemTitles++;
      }

      if (item.description) {
        const fixedDesc = fixMojibakeTargeted(item.description);
        if (fixedDesc !== item.description) {
          updates.description = fixedDesc;
          fixedItemDescs++;
        }
      }

      if (Object.keys(updates).length > 0) {
        await prisma.item.update({
          where: { id: item.id },
          data: updates,
        });
      }
    }

    if (i + BATCH_SIZE < mojibakeItems.length) {
      console.log(`   [${Math.min(i + BATCH_SIZE, mojibakeItems.length)}/${mojibakeItems.length}] items traites...`);
    }
  }

  console.log(`   Titres corriges:       ${fixedItemTitles}`);
  console.log(`   Descriptions corrigees: ${fixedItemDescs}`);

  // 3. Contributions
  console.log('\n3. Detection des contributions avec mojibake...');
  const mojibakeContribs = await prisma.$queryRawUnsafe<Array<{
    id: string;
    content: string;
  }>>(
    `SELECT id, content FROM contributions
     WHERE content ~ '${SQL_PATTERN}'`
  );
  console.log(`   ${mojibakeContribs.length} contributions detectees`);

  let fixedContribs = 0;

  for (let i = 0; i < mojibakeContribs.length; i += BATCH_SIZE) {
    const batch = mojibakeContribs.slice(i, i + BATCH_SIZE);

    for (const contrib of batch) {
      const fixed = fixMojibakeTargeted(contrib.content);
      if (fixed !== contrib.content) {
        await prisma.contribution.update({
          where: { id: contrib.id },
          data: { content: fixed },
        });
        fixedContribs++;
      }
    }

    if (i + BATCH_SIZE < mojibakeContribs.length) {
      console.log(`   [${Math.min(i + BATCH_SIZE, mojibakeContribs.length)}/${mojibakeContribs.length}] contributions traitees...`);
    }
  }

  console.log(`   Contributions corrigees: ${fixedContribs}`);

  // 4. Espaces
  console.log('\n4. Detection des espaces avec mojibake...');
  const mojibakeSpaces = await prisma.$queryRawUnsafe<Array<{
    id: string;
    name: string;
  }>>(
    `SELECT id, name FROM spaces WHERE name ~ '${SQL_PATTERN}'`
  );
  console.log(`   ${mojibakeSpaces.length} espaces detectes`);

  let fixedSpaces = 0;
  for (const space of mojibakeSpaces) {
    const fixed = fixMojibakeTargeted(space.name);
    if (fixed !== space.name) {
      await prisma.space.update({
        where: { id: space.id },
        data: { name: fixed },
      });
      fixedSpaces++;
      console.log(`   V "${space.name}" -> "${fixed}"`);
    }
  }
  console.log(`   Espaces corriges: ${fixedSpaces}`);

  // 5. Resume
  console.log('\n=== RESUME ===');
  console.log(`  Titres corriges:        ${fixedItemTitles}`);
  console.log(`  Descriptions corrigees: ${fixedItemDescs}`);
  console.log(`  Contributions corrigees: ${fixedContribs}`);
  console.log(`  Espaces corriges:       ${fixedSpaces}`);
  console.log(`  Total:                  ${fixedItemTitles + fixedItemDescs + fixedContribs + fixedSpaces}`);

  // 6. Verification
  console.log('\n=== VERIFICATION ===');
  const remainingItems = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM items
     WHERE title ~ '${SQL_PATTERN}'
       OR (description IS NOT NULL AND description ~ '${SQL_PATTERN}')`
  );
  const remainingContribs = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT COUNT(*) as count FROM contributions WHERE content ~ '${SQL_PATTERN}'`
  );

  console.log(`  Items restants:          ${Number(remainingItems[0].count)}`);
  console.log(`  Contributions restantes: ${Number(remainingContribs[0].count)}`);
}

fixMojibake()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
