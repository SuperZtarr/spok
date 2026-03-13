/**
 * Migrate .drawio files from R2 URLs into item content field
 * - Downloads XML from R2 URL
 * - Stores in content: { xml: ... }
 * - Changes type DOCUMENT → DIAGRAM
 * - Cleans title (removes " (source)" suffix)
 *
 * Prerequisites: DIAGRAM type must exist in prod schema (run db:push first)
 * Usage: npx tsx apps/api/scripts/migrate-drawio-to-content.ts [--dry-run]
 */

import { PrismaClient } from '@prisma/client';

const PROD_DATABASE_URL = 'postgresql://postgres:GSpgpyKTewWFHHkmYtgsxwCmdbBIYiZW@ballast.proxy.rlwy.net:31323/railway';

const prisma = new PrismaClient({
  datasources: { db: { url: PROD_DATABASE_URL } }
});

const isDryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== Migration .drawio R2 → content field ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // Find all items with .drawio URL
  const items = await prisma.item.findMany({
    where: { url: { contains: '.drawio', mode: 'insensitive' } },
    select: { id: true, title: true, type: true, url: true, content: true }
  });

  console.log(`Found ${items.length} items with .drawio URLs\n`);

  let success = 0;
  let errors = 0;
  let skipped = 0;

  for (const item of items) {
    // Skip if already migrated (has content.xml)
    if (item.content && typeof item.content === 'object' && 'xml' in (item.content as Record<string, unknown>)) {
      console.log(`  SKIP (already migrated): "${item.title}"`);
      skipped++;
      continue;
    }

    if (!item.url) {
      console.log(`  SKIP (no URL): "${item.title}"`);
      skipped++;
      continue;
    }

    console.log(`  Processing: "${item.title}"`);
    console.log(`    URL: ${item.url}`);

    try {
      // Download XML from R2
      const response = await fetch(item.url);
      if (!response.ok) {
        console.log(`    ERROR: HTTP ${response.status} ${response.statusText}`);
        errors++;
        continue;
      }

      const xml = await response.text();

      // Validate it looks like draw.io XML
      if (!xml.includes('<mxfile') && !xml.includes('<mxGraphModel')) {
        console.log(`    ERROR: Not valid draw.io XML (${xml.substring(0, 100)}...)`);
        errors++;
        continue;
      }

      console.log(`    Downloaded ${xml.length} chars of XML`);

      // Clean title: remove " (source)" suffix
      const cleanTitle = item.title.replace(/\s*\(source\)\s*$/i, '').trim();

      if (!isDryRun) {
        await prisma.item.update({
          where: { id: item.id },
          data: {
            type: 'DIAGRAM',
            content: { xml },
            title: cleanTitle !== item.title ? cleanTitle : undefined,
          }
        });
        console.log(`    MIGRATED → type=DIAGRAM, title="${cleanTitle}"`);
      } else {
        console.log(`    WOULD MIGRATE → type=DIAGRAM, title="${cleanTitle}", xml=${xml.length} chars`);
      }

      success++;
    } catch (err) {
      console.log(`    ERROR: ${err}`);
      errors++;
    }
  }

  console.log(`\n=== Résultat ===`);
  console.log(`  Migrés : ${success}`);
  console.log(`  Ignorés : ${skipped}`);
  console.log(`  Erreurs : ${errors}`);
  console.log(`  Total : ${items.length}`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
