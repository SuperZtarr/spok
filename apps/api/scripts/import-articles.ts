import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// IMPORT ARTICLES - Données legacy superztarr → SPOK
// =============================================================
// Source: articles.sql (dump MySQL de superzta_roedel)
// Cible: Espace personnel de l'utilisateur "ztarr" en prod
// =============================================================

const SQL_FILE = 'C:/_dev/spok/articles.sql';

// ---- SQL Parser ----

interface LegacyArticle {
  id: number;
  createur: number | null;
  date_creation: string | null;
  date_modification: string | null;
  ordre: number | null;
  publication: string | null;
  titre: string;
  description: string | null;
  resume: string | null;
  parent: number | null;
  type: string | null;
  contenu: string | null;
}

function parseSqlInserts(sql: string): LegacyArticle[] {
  const articles: LegacyArticle[] = [];

  const valuesIdx = sql.indexOf('VALUES');
  if (valuesIdx === -1) return articles;

  const valuesBlock = sql.substring(valuesIdx + 6);
  const rows = extractRows(valuesBlock);

  for (const row of rows) {
    const values = parseRow(row);

    if (values.length >= 12) {
      articles.push({
        id: parseInt(values[0]) || 0,
        createur: values[1] === 'NULL' ? null : parseInt(values[1]) || 0,
        date_creation: values[2] === 'NULL' ? null : unescapeSql(values[2]),
        date_modification: values[3] === 'NULL' ? null : unescapeSql(values[3]),
        ordre: values[4] === 'NULL' ? null : parseInt(values[4]) || 0,
        publication: values[5] === 'NULL' ? null : unescapeSql(values[5]) || null,
        titre: unescapeSql(values[6]),
        description: values[7] === 'NULL' ? null : unescapeSql(values[7]) || null,
        resume: values[8] === 'NULL' ? null : unescapeSql(values[8]) || null,
        parent: values[9] === 'NULL' ? null : parseInt(values[9]) || 0,
        type: values[10] === 'NULL' ? null : unescapeSql(values[10]) || null,
        contenu: values[11] === 'NULL' ? null : unescapeSql(values[11]) || null,
      });
    }
  }

  return articles;
}

function extractRows(block: string): string[] {
  const rows: string[] = [];
  let i = 0;

  while (i < block.length) {
    if (block[i] === '(') {
      let depth = 1;
      let inString = false;
      let escape = false;
      let start = i + 1;
      i++;

      while (i < block.length && depth > 0) {
        const char = block[i];

        if (escape) {
          escape = false;
          i++;
          continue;
        }

        if (char === '\\' && inString) {
          escape = true;
          i++;
          continue;
        }

        if (char === "'" && !escape) {
          inString = !inString;
          i++;
          continue;
        }

        if (!inString) {
          if (char === '(') depth++;
          if (char === ')') depth--;
        }

        i++;
      }

      rows.push(block.substring(start, i - 1));
    } else if (block[i] === ';') {
      break;
    } else {
      i++;
    }
  }

  return rows;
}

function parseRow(row: string): string[] {
  const values: string[] = [];
  let current = '';
  let inString = false;
  let escape = false;
  let i = 0;

  while (i < row.length) {
    const char = row[i];

    if (escape) {
      current += char;
      escape = false;
      i++;
      continue;
    }

    if (char === '\\') {
      escape = true;
      current += char;
      i++;
      continue;
    }

    if (char === "'" && !inString) {
      inString = true;
      i++;
      continue;
    }

    if (char === "'" && inString) {
      if (i + 1 < row.length && row[i + 1] === "'") {
        current += "'";
        i += 2;
        continue;
      }
      inString = false;
      i++;
      continue;
    }

    if (char === ',' && !inString) {
      values.push(current.trim());
      current = '';
      i++;
      continue;
    }

    current += char;
    i++;
  }

  values.push(current.trim());
  return values;
}

function unescapeSql(value: string): string {
  return value
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

function parseDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

// ---- Build description from description + contenu ----

function buildDescription(art: LegacyArticle): string | null {
  const parts: string[] = [];

  if (art.description && art.description.trim()) {
    parts.push(art.description);
  }

  if (art.contenu && art.contenu.trim()) {
    parts.push(art.contenu);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

// ---- Main ----

async function main() {
  console.log('=== Import articles.sql → SPOK ===\n');

  // 1. Parse SQL
  console.log('[1/6] Lecture du fichier SQL...');
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const articles = parseSqlInserts(sql);
  console.log(`  ${articles.length} articles trouvés`);

  if (articles.length === 0) {
    console.error('Aucun article trouvé dans le fichier SQL. Abandon.');
    process.exit(1);
  }

  // 2. Trouver l'utilisateur ztarr
  console.log('\n[2/6] Recherche de l\'utilisateur ztarr...');
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { name: { contains: 'ztarr', mode: 'insensitive' } },
        { email: { contains: 'ztarr', mode: 'insensitive' } },
      ],
    },
  });

  if (!user) {
    console.error('Utilisateur ztarr introuvable. Abandon.');
    process.exit(1);
  }
  console.log(`  Trouvé: ${user.name} (${user.id})`);

  // 3. Trouver l'espace personnel
  console.log('\n[3/6] Recherche de l\'espace personnel...');
  const personalSpace = await prisma.space.findFirst({
    where: {
      type: 'PERSONAL',
      memberships: {
        some: { userId: user.id, role: 'OWNER' },
      },
    },
  });

  if (!personalSpace) {
    console.error('Espace personnel introuvable. Abandon.');
    process.exit(1);
  }
  console.log(`  Espace: ${personalSpace.name} (${personalSpace.id})`);

  // 4. Vérifier si l'import a déjà été fait
  console.log('\n[4/6] Vérification des doublons...');
  const existingRoot = await prisma.item.findFirst({
    where: {
      spaceId: personalSpace.id,
      title: 'Import articles superztarr',
    },
  });

  if (existingRoot) {
    console.error(`L'item "Import articles superztarr" existe déjà (${existingRoot.id}). Import déjà effectué ?`);
    console.error('Supprimez-le d\'abord si vous voulez relancer l\'import.');
    process.exit(1);
  }

  // 5. Créer l'item racine
  console.log('\n[4/6] Création de l\'item racine "Import articles superztarr"...');
  const rootItem = await prisma.item.create({
    data: {
      type: 'NOTE',
      title: 'Import articles superztarr',
      description: `<p>Import des ${articles.length} articles depuis l'ancienne application superztarr (${new Date().toISOString().split('T')[0]})</p>`,
      spaceId: personalSpace.id,
      createdById: user.id,
      position: 0,
    },
  });
  console.log(`  Item racine créé: ${rootItem.id}`);

  // 6. Première passe : créer tous les items (sans parentId)
  console.log('\n[5/6] Création des items...');
  const oldToNewId: Record<number, string> = {};
  let created = 0;
  let errors = 0;

  for (const art of articles) {
    try {
      const description = buildDescription(art);

      const item = await prisma.item.create({
        data: {
          type: 'NOTE',
          title: art.titre,
          description,
          position: art.ordre ?? 0,
          startDate: parseDate(art.date_creation),
          spaceId: personalSpace.id,
          createdById: user.id,
          content: { legacyId: art.id, legacyTable: 'articles', legacyCreateur: art.createur },
        },
      });

      oldToNewId[art.id] = item.id;
      created++;

      if (created % 20 === 0) {
        console.log(`  ${created}/${articles.length} items créés...`);
      }
    } catch (err: any) {
      console.error(`  Erreur article #${art.id} "${art.titre}": ${err.message}`);
      errors++;
    }
  }
  console.log(`  ${created} items créés, ${errors} erreurs`);

  // 7. Deuxième passe : mettre à jour les parentId
  console.log('\n[6/6] Mise à jour de la hiérarchie...');
  let parented = 0;

  for (const art of articles) {
    const newId = oldToNewId[art.id];
    if (!newId) continue;

    let newParentId: string | null = null;

    if (art.parent === 0 || art.parent === null) {
      // Racine → enfant de l'item racine
      newParentId = rootItem.id;
    } else {
      // Enfant → chercher le nouveau parent
      newParentId = oldToNewId[art.parent] || rootItem.id;
    }

    try {
      await prisma.item.update({
        where: { id: newId },
        data: { parentId: newParentId },
      });
      parented++;
    } catch (err: any) {
      console.error(`  Erreur parentId article #${art.id}: ${err.message}`);
    }
  }
  console.log(`  ${parented} liens parent/enfant créés`);

  // Résumé
  console.log('\n=== Résumé ===');
  console.log(`Items créés: ${created} + 1 racine`);
  console.log(`Liens parent/enfant: ${parented}`);
  console.log(`Erreurs: ${errors}`);
  console.log(`\nImport terminé !`);
}

main()
  .catch((err) => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
