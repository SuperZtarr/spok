import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// IMPORT ELEMENTS - Données legacy superztarr → SPOK
// =============================================================
// Source: elements.sql (dump MySQL de superzta_roedel)
// Cible: Espace personnel de l'utilisateur "ztarr" en prod
// =============================================================

const SQL_FILE = 'C:/_dev/spok/elements.sql';

// ---- Types mapping ----

const TYPE_MAP: Record<string, string> = {
  section: 'NOTE',
  task: 'TASK',
  projet: 'PROJECT',
  article: 'NOTE',
  event: 'NOTE',
  bug: 'BUG',
  asset: 'NOTE',
  dossier: 'NOTE',
  url: 'LINK',
};

const STATUS_MAP: Record<string, string> = {
  todo: 'todo',
  progress: 'in_progress',
  eval: 'todo',
  done: 'done',
  closed: 'done',
};

const CONTEXT_TAGS: Record<number, string> = {
  0: 'Non classé',
  1: 'Personnel',
  2: 'Technique',
  3: 'JDR',
  5: 'Divers',
  6: 'Professionnel',
};

// ---- SQL Parser ----

interface LegacyElement {
  id: number;
  ordre: number | null;
  titre: string;
  description: string | null;
  parent: number | null;
  type: string | null;
  avancement: string | null;
  contenu: string | null;
  contexte: number | null;
  date_debut: string | null;
  date_fin: string | null;
  icon: string | null;
}

function parseSqlInserts(sql: string): LegacyElement[] {
  const elements: LegacyElement[] = [];

  // Find the VALUES block
  const valuesIdx = sql.indexOf('VALUES');
  if (valuesIdx === -1) return elements;

  const valuesBlock = sql.substring(valuesIdx + 6);

  // Parse row tuples manually to handle nested parentheses in HTML content
  const rows = extractRows(valuesBlock);

  for (const row of rows) {
    const values = parseRow(row);

    if (values.length >= 12) {
      elements.push({
        id: parseInt(values[0]) || 0,
        ordre: values[1] === 'NULL' ? null : parseInt(values[1]) || 0,
        titre: unescapeSql(values[2]),
        description: values[3] === 'NULL' ? null : unescapeSql(values[3]),
        parent: values[4] === 'NULL' ? null : parseInt(values[4]) || 0,
        type: values[5] === 'NULL' ? null : unescapeSql(values[5]) || null,
        avancement: values[6] === 'NULL' ? null : unescapeSql(values[6]) || null,
        contenu: values[7] === 'NULL' ? null : unescapeSql(values[7]) || null,
        contexte: values[8] === 'NULL' ? null : parseInt(values[8]),
        date_debut: values[9] === 'NULL' ? null : unescapeSql(values[9]),
        date_fin: values[10] === 'NULL' ? null : unescapeSql(values[10]),
        icon: values[11] === 'NULL' ? null : unescapeSql(values[11]) || null,
      });
    }
  }

  return elements;
}

function extractRows(block: string): string[] {
  const rows: string[] = [];
  let i = 0;

  while (i < block.length) {
    // Find opening parenthesis
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

      // depth is now 0, i points after the closing ')'
      rows.push(block.substring(start, i - 1));
    } else if (block[i] === ';') {
      break; // End of INSERT statement
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
      // Check for escaped quote ''
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

function buildDescription(el: LegacyElement): string | null {
  const parts: string[] = [];

  if (el.description && el.description.trim()) {
    parts.push(`<p>${el.description}</p>`);
  }

  if (el.contenu && el.contenu.trim()) {
    // Le contenu est déjà en HTML
    parts.push(el.contenu);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

// ---- Main ----

async function main() {
  console.log('=== Import elements.sql → SPOK ===\n');

  // 1. Parse SQL
  console.log('[1/7] Lecture du fichier SQL...');
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const elements = parseSqlInserts(sql);
  console.log(`  ${elements.length} éléments trouvés`);

  if (elements.length === 0) {
    console.error('Aucun élément trouvé dans le fichier SQL. Abandon.');
    process.exit(1);
  }

  // 2. Trouver l'utilisateur ztarr
  console.log('\n[2/7] Recherche de l\'utilisateur ztarr...');
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
  console.log('\n[3/7] Recherche de l\'espace personnel...');
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

  // 4. Créer les tags de contexte
  console.log('\n[4/7] Création des tags de contexte...');
  const tagMap: Record<number, string> = {};

  for (const [ctxStr, tagName] of Object.entries(CONTEXT_TAGS)) {
    const ctx = parseInt(ctxStr);
    const existing = await prisma.tag.findFirst({
      where: { spaceId: personalSpace.id, name: tagName },
    });

    if (existing) {
      tagMap[ctx] = existing.id;
      console.log(`  Tag "${tagName}" existe déjà (${existing.id})`);
    } else {
      const tag = await prisma.tag.create({
        data: {
          name: tagName,
          color: getTagColor(ctx),
          spaceId: personalSpace.id,
        },
      });
      tagMap[ctx] = tag.id;
      console.log(`  Tag "${tagName}" créé (${tag.id})`);
    }
  }

  // 5. Vérifier si l'import a déjà été fait
  console.log('\n[5/7] Vérification des doublons...');
  const existingRoot = await prisma.item.findFirst({
    where: {
      spaceId: personalSpace.id,
      title: 'Import superztarr',
    },
  });

  if (existingRoot) {
    console.error(`L'item "Import superztarr" existe déjà (${existingRoot.id}). Import déjà effectué ?`);
    console.error('Supprimez-le d\'abord si vous voulez relancer l\'import.');
    process.exit(1);
  }

  // 6. Créer l'item racine
  console.log('\n[5/7] Création de l\'item racine "Import superztarr"...');
  const rootItem = await prisma.item.create({
    data: {
      type: 'NOTE',
      title: 'Import superztarr',
      description: `<p>Import des ${elements.length} éléments depuis l'ancienne application superztarr (${new Date().toISOString().split('T')[0]})</p>`,
      spaceId: personalSpace.id,
      createdById: user.id,
      position: 0,
    },
  });
  console.log(`  Item racine créé: ${rootItem.id}`);

  // 7. Première passe : créer tous les items (sans parentId)
  console.log('\n[6/7] Création des items...');
  const oldToNewId: Record<number, string> = {};
  const itemContexts: Record<string, number> = {}; // newId → contexte
  let created = 0;
  let errors = 0;

  for (const el of elements) {
    try {
      const itemType = TYPE_MAP[el.type || ''] || 'NOTE';
      const status = el.avancement ? STATUS_MAP[el.avancement] || null : null;
      const description = buildDescription(el);

      const item = await prisma.item.create({
        data: {
          type: itemType as any,
          title: el.titre,
          description,
          url: el.type === 'url' && el.contenu ? extractUrl(el.contenu) : undefined,
          status,
          position: el.ordre ?? 0,
          startDate: parseDate(el.date_debut),
          endDate: parseDate(el.date_fin),
          spaceId: personalSpace.id,
          createdById: user.id,
          content: { legacyId: el.id, legacyType: el.type, legacyContexte: el.contexte },
        },
      });

      oldToNewId[el.id] = item.id;
      if (el.contexte !== null && el.contexte !== undefined) {
        itemContexts[item.id] = el.contexte;
      }
      created++;

      if (created % 50 === 0) {
        console.log(`  ${created}/${elements.length} items créés...`);
      }
    } catch (err: any) {
      console.error(`  Erreur item #${el.id} "${el.titre}": ${err.message}`);
      errors++;
    }
  }
  console.log(`  ${created} items créés, ${errors} erreurs`);

  // 8. Deuxième passe : mettre à jour les parentId
  console.log('\n[7/7] Mise à jour de la hiérarchie...');
  let parented = 0;

  for (const el of elements) {
    const newId = oldToNewId[el.id];
    if (!newId) continue;

    let newParentId: string | null = null;

    if (el.parent === 0 || el.parent === null) {
      // Racine → enfant de l'item racine "Import superztarr"
      newParentId = rootItem.id;
    } else {
      // Enfant → chercher le nouveau parent
      newParentId = oldToNewId[el.parent] || rootItem.id;
    }

    try {
      await prisma.item.update({
        where: { id: newId },
        data: { parentId: newParentId },
      });
      parented++;
    } catch (err: any) {
      console.error(`  Erreur parentId item #${el.id}: ${err.message}`);
    }
  }
  console.log(`  ${parented} liens parent/enfant créés`);

  // 9. Troisième passe : associer les tags
  console.log('\n[8/8] Association des tags...');
  let tagged = 0;

  for (const [newId, ctx] of Object.entries(itemContexts)) {
    const tagId = tagMap[ctx];
    if (!tagId) continue;

    try {
      await prisma.itemTag.create({
        data: { itemId: newId, tagId },
      });
      tagged++;
    } catch (err: any) {
      // Ignore duplicate tag assignments
      if (!err.message.includes('Unique constraint')) {
        console.error(`  Erreur tag item ${newId}: ${err.message}`);
      }
    }
  }
  console.log(`  ${tagged} tags associés`);

  // Résumé
  console.log('\n=== Résumé ===');
  console.log(`Items créés: ${created} + 1 racine`);
  console.log(`Liens parent/enfant: ${parented}`);
  console.log(`Tags associés: ${tagged}`);
  console.log(`Erreurs: ${errors}`);
  console.log(`\nImport terminé !`);
}

function getTagColor(ctx: number): string {
  const colors: Record<number, string> = {
    0: '#94a3b8', // gris
    1: '#3b82f6', // bleu
    2: '#10b981', // vert
    3: '#8b5cf6', // violet
    5: '#f59e0b', // orange
    6: '#ef4444', // rouge
  };
  return colors[ctx] || '#94a3b8';
}

function extractUrl(contenu: string): string | null {
  // Essayer d'extraire une URL du contenu HTML
  const urlMatch = contenu.match(/https?:\/\/[^\s<"']+/);
  return urlMatch ? urlMatch[0] : null;
}

main()
  .catch((err) => {
    console.error('Erreur fatale:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
