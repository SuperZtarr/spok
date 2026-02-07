import { prisma } from '@spok/database';

// =============================================================
// FIX MOJIBAKE - Corrige le double encodage UTF-8
// =============================================================
// Problème : les données importées du forum SMF (SQL en GBK) ont été
// lues en UTF-8 alors que les bytes UTF-8 originaux étaient stockés
// tels quels. Résultat : double encodage (UTF-8 → Latin-1 → UTF-8).
//
// Exemple : ゼ (U+30BC) → UTF-8 bytes E3 82 BC → interprété Latin-1
//           → ã‚¼ (3 chars au lieu de 1)
//
// Solution : inverser le double encodage via
//   Buffer.from(text, 'latin1').toString('utf8')
// =============================================================

const BATCH_SIZE = 100;

// Pattern regex pour détecter le mojibake (double-encoded UTF-8)
// - 2-byte UTF-8 double-encodé (accents latins) : [Â-ß][€-¿] → \xC2-\xDF suivi de \x80-\xBF
// - 3-byte UTF-8 double-encodé (CJK/asiatiques) : [à-ï][€-¿]{2} → \xE0-\xEF suivi de 2x \x80-\xBF
const MOJIBAKE_REGEX = /[\xC2-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}/;

// Pattern SQL pour PostgreSQL (utilise les noms Unicode des caractères)
const MOJIBAKE_SQL_PATTERN = '[Â-ß][€-¿]|[à-ï][€-¿]{2}';

/**
 * Inverse le double encodage UTF-8.
 * Les bytes ASCII (0x00-0x7F) restent identiques.
 * Les bytes 0x80-0xFF retrouvent leur valeur originale.
 */
function fixDoubleEncoding(text: string): string {
  const latin1Bytes = Buffer.from(text, 'latin1');
  return latin1Bytes.toString('utf8');
}

/**
 * Vérifie que le texte corrigé est du UTF-8 valide et ne contient plus de mojibake.
 */
function isValidFix(original: string, fixed: string): boolean {
  // Le résultat ne doit plus contenir de mojibake
  if (MOJIBAKE_REGEX.test(fixed)) return false;

  // Le résultat doit être différent de l'original
  if (fixed === original) return false;

  // Le résultat ne doit pas contenir le caractère de remplacement U+FFFD
  if (fixed.includes('\uFFFD')) return false;

  return true;
}

async function fixMojibake() {
  console.log('=== FIX MOJIBAKE - Double encodage UTF-8 ===\n');

  // 1. Détecter les items avec mojibake
  console.log('1. Détection des items avec mojibake...');
  const mojibakeItems = await prisma.$queryRaw<Array<{
    id: string;
    title: string;
    description: string | null;
  }>>`
    SELECT id, title, description FROM items
    WHERE title ~ ${MOJIBAKE_SQL_PATTERN}
      OR (description IS NOT NULL AND description ~ ${MOJIBAKE_SQL_PATTERN})
  `;
  console.log(`   ${mojibakeItems.length} items détectés`);

  // 2. Preview des 10 premiers
  if (mojibakeItems.length > 0) {
    console.log('\n   Preview des corrections (10 premiers) :');
    for (const item of mojibakeItems.slice(0, 10)) {
      const hasTitleMojibake = MOJIBAKE_REGEX.test(item.title);
      if (hasTitleMojibake) {
        const fixed = fixDoubleEncoding(item.title);
        const valid = isValidFix(item.title, fixed);
        console.log(`   ${valid ? '✓' : '✗'} "${item.title}" → "${fixed}"`);
      }
      if (item.description && MOJIBAKE_REGEX.test(item.description)) {
        const fixed = fixDoubleEncoding(item.description);
        const valid = isValidFix(item.description, fixed);
        const preview = item.description.substring(0, 60);
        const fixedPreview = fixed.substring(0, 60);
        console.log(`     desc: ${valid ? '✓' : '✗'} "${preview}..." → "${fixedPreview}..."`);
      }
    }
  }

  // 3. Appliquer les corrections sur les items
  console.log('\n2. Correction des items...');
  let fixedItemTitles = 0;
  let fixedItemDescs = 0;
  let skippedItems = 0;

  for (let i = 0; i < mojibakeItems.length; i += BATCH_SIZE) {
    const batch = mojibakeItems.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      const updates: { title?: string; description?: string } = {};

      if (MOJIBAKE_REGEX.test(item.title)) {
        const fixed = fixDoubleEncoding(item.title);
        if (isValidFix(item.title, fixed)) {
          updates.title = fixed;
          fixedItemTitles++;
        } else {
          skippedItems++;
        }
      }

      if (item.description && MOJIBAKE_REGEX.test(item.description)) {
        const fixed = fixDoubleEncoding(item.description);
        if (isValidFix(item.description, fixed)) {
          updates.description = fixed;
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
      console.log(`   [${Math.min(i + BATCH_SIZE, mojibakeItems.length)}/${mojibakeItems.length}] items traités...`);
    }
  }

  console.log(`   Titres corrigés:       ${fixedItemTitles}`);
  console.log(`   Descriptions corrigées: ${fixedItemDescs}`);
  console.log(`   Items ignorés (fix invalide): ${skippedItems}`);

  // 4. Détecter et corriger les contributions
  console.log('\n3. Détection des contributions avec mojibake...');
  const mojibakeContribs = await prisma.$queryRaw<Array<{
    id: string;
    content: string;
  }>>`
    SELECT id, content FROM contributions
    WHERE content ~ ${MOJIBAKE_SQL_PATTERN}
  `;
  console.log(`   ${mojibakeContribs.length} contributions détectées`);

  let fixedContribs = 0;
  let skippedContribs = 0;

  for (let i = 0; i < mojibakeContribs.length; i += BATCH_SIZE) {
    const batch = mojibakeContribs.slice(i, i + BATCH_SIZE);

    for (const contrib of batch) {
      const fixed = fixDoubleEncoding(contrib.content);
      if (isValidFix(contrib.content, fixed)) {
        await prisma.contribution.update({
          where: { id: contrib.id },
          data: { content: fixed },
        });
        fixedContribs++;
      } else {
        skippedContribs++;
      }
    }

    if (i + BATCH_SIZE < mojibakeContribs.length) {
      console.log(`   [${Math.min(i + BATCH_SIZE, mojibakeContribs.length)}/${mojibakeContribs.length}] contributions traitées...`);
    }
  }

  console.log(`   Contributions corrigées: ${fixedContribs}`);
  console.log(`   Contributions ignorées:  ${skippedContribs}`);

  // 5. Détecter et corriger les espaces
  console.log('\n4. Détection des espaces avec mojibake...');
  const mojibakeSpaces = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
  }>>`
    SELECT id, name FROM spaces
    WHERE name ~ ${MOJIBAKE_SQL_PATTERN}
  `;
  console.log(`   ${mojibakeSpaces.length} espaces détectés`);

  let fixedSpaces = 0;

  for (const space of mojibakeSpaces) {
    const fixed = fixDoubleEncoding(space.name);
    if (isValidFix(space.name, fixed)) {
      await prisma.space.update({
        where: { id: space.id },
        data: { name: fixed },
      });
      fixedSpaces++;
      console.log(`   ✓ "${space.name}" → "${fixed}"`);
    }
  }

  console.log(`   Espaces corrigés: ${fixedSpaces}`);

  // 6. Résumé final
  console.log('\n=== RÉSUMÉ ===');
  console.log(`  Items - titres corrigés:       ${fixedItemTitles}`);
  console.log(`  Items - descriptions corrigées: ${fixedItemDescs}`);
  console.log(`  Contributions corrigées:        ${fixedContribs}`);
  console.log(`  Espaces corrigés:               ${fixedSpaces}`);
  console.log(`  Total corrections:              ${fixedItemTitles + fixedItemDescs + fixedContribs + fixedSpaces}`);

  // 7. Vérification
  console.log('\n=== VÉRIFICATION ===');
  const remainingItems = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM items
    WHERE title ~ ${MOJIBAKE_SQL_PATTERN}
      OR (description IS NOT NULL AND description ~ ${MOJIBAKE_SQL_PATTERN})
  `;
  const remainingContribs = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM contributions
    WHERE content ~ ${MOJIBAKE_SQL_PATTERN}
  `;
  const remainingSpaces = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM spaces
    WHERE name ~ ${MOJIBAKE_SQL_PATTERN}
  `;

  console.log(`  Items restants avec mojibake:        ${Number(remainingItems[0].count)}`);
  console.log(`  Contributions restantes avec mojibake: ${Number(remainingContribs[0].count)}`);
  console.log(`  Espaces restants avec mojibake:       ${Number(remainingSpaces[0].count)}`);
}

fixMojibake()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
