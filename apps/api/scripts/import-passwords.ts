import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// IMPORT PASSWORDS - Données legacy superztarr → SPOK
// =============================================================
// Source: passwords.sql (dump MySQL de superzta_roedel)
// Cible: Espace personnel de l'utilisateur "ztarr" en prod
// =============================================================

const SQL_FILE = 'C:/_dev/spok/passwords.sql';

// ---- SQL Parser ----

interface LegacyPassword {
  id: number;
  ordre: number | null;
  description: string | null;
  statut: string | null;
  titre: string;
  favoris: number | null;
  login: string | null;
  code: string | null;
}

function parseSqlInserts(sql: string): LegacyPassword[] {
  const items: LegacyPassword[] = [];

  const valuesIdx = sql.indexOf('VALUES');
  if (valuesIdx === -1) return items;

  const valuesBlock = sql.substring(valuesIdx + 6);
  const rows = extractRows(valuesBlock);

  for (const row of rows) {
    const values = parseRow(row);

    if (values.length >= 8) {
      items.push({
        id: parseInt(values[0]) || 0,
        ordre: values[1] === 'NULL' ? null : parseInt(values[1]) || 0,
        description: values[2] === 'NULL' ? null : unescapeSql(values[2]) || null,
        statut: values[3] === 'NULL' ? null : unescapeSql(values[3]) || null,
        titre: unescapeSql(values[4]),
        favoris: values[5] === 'NULL' ? null : parseInt(values[5]) || 0,
        login: values[6] === 'NULL' ? null : unescapeSql(values[6]) || null,
        code: values[7] === 'NULL' ? null : unescapeSql(values[7]) || null,
      });
    }
  }

  return items;
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

// ---- Build description from login + code ----

function buildDescription(pw: LegacyPassword): string | null {
  const parts: string[] = [];

  if (pw.login) {
    parts.push(`<p><strong>Login :</strong> ${pw.login}</p>`);
  }

  if (pw.code) {
    parts.push(`<p><strong>Code :</strong> ${pw.code}</p>`);
  }

  if (pw.description && pw.description.trim()) {
    parts.push(`<p>${pw.description}</p>`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

// ---- Main ----

async function main() {
  console.log('=== Import passwords.sql → SPOK ===\n');

  // 1. Parse SQL
  console.log('[1/5] Lecture du fichier SQL...');
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const passwords = parseSqlInserts(sql);
  console.log(`  ${passwords.length} passwords trouvés`);

  if (passwords.length === 0) {
    console.error('Aucun password trouvé dans le fichier SQL. Abandon.');
    process.exit(1);
  }

  // 2. Trouver l'utilisateur ztarr
  console.log('\n[2/5] Recherche de l\'utilisateur ztarr...');
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
  console.log('\n[3/5] Recherche de l\'espace personnel...');
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
  console.log('\n[4/5] Vérification des doublons...');
  const existingRoot = await prisma.item.findFirst({
    where: {
      spaceId: personalSpace.id,
      title: 'Import passwords superztarr',
    },
  });

  if (existingRoot) {
    console.error(`L'item "Import passwords superztarr" existe déjà (${existingRoot.id}). Import déjà effectué ?`);
    process.exit(1);
  }

  // 5. Créer l'item racine
  console.log('\n[4/5] Création de l\'item racine "Import passwords superztarr"...');
  const rootItem = await prisma.item.create({
    data: {
      type: 'NOTE',
      title: 'Import passwords superztarr',
      description: `<p>Import des ${passwords.length} mots de passe (mnémoniques) depuis l'ancienne application superztarr (${new Date().toISOString().split('T')[0]})</p>`,
      spaceId: personalSpace.id,
      createdById: user.id,
      position: 0,
    },
  });
  console.log(`  Item racine créé: ${rootItem.id}`);

  // 6. Créer les items (structure plate, pas de hiérarchie)
  console.log('\n[5/5] Création des items...');
  let created = 0;
  let errors = 0;

  for (const pw of passwords) {
    try {
      const description = buildDescription(pw);

      await prisma.item.create({
        data: {
          type: 'NOTE',
          title: pw.titre,
          description,
          position: pw.ordre ?? 0,
          parentId: rootItem.id,
          spaceId: personalSpace.id,
          createdById: user.id,
          content: { legacyId: pw.id, legacyTable: 'passwords' },
        },
      });

      created++;
    } catch (err: any) {
      console.error(`  Erreur password #${pw.id} "${pw.titre}": ${err.message}`);
      errors++;
    }
  }
  console.log(`  ${created} items créés, ${errors} erreurs`);

  // Résumé
  console.log('\n=== Résumé ===');
  console.log(`Items créés: ${created} + 1 racine`);
  console.log(`Erreurs: ${errors}`);
  console.log(`\nImport terminé !`);
}

main()
  .catch((err) => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
