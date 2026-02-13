import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// IMPORT ACTIVITY - Données legacy ProjeQtOr → SPOK
// =============================================================
// Source: activity.sql (dump MySQL de superzta_projeqtor)
// Cible: Espace personnel de l'utilisateur "ztarr" en prod
// =============================================================

const SQL_FILE = 'C:/_dev/spok/activity.sql';
const PROJECT_SQL_FILE = 'C:/_dev/spok/project.sql';

// ---- Project name mapping (from project.sql) ----
interface LegacyProject {
  id: number;
  name: string;
  idProject: number | null; // parent project
}

// ---- Status mapping (ProjeQtOr idStatus → SPOK) ----
const STATUS_MAP: Record<number, string> = {
  1: 'todo',        // assigned
  3: 'in_progress', // in progress
  4: 'done',        // done
  7: 'done',        // closed
  8: 'done',        // cancelled
  10: 'in_progress',// handled
  14: 'todo',       // other
};

// ---- SQL Parser ----

interface LegacyActivity {
  id: number;
  idProject: number | null;
  idActivityType: number | null;
  name: string;
  description: string | null;
  creationDate: string | null;
  idUser: number | null;
  idStatus: number | null;
  idResource: number | null;
  result: string | null;
  comment: string | null;
  idle: number;
  idActivity: number | null;  // parent
  done: number;
  idleDate: string | null;
  doneDate: string | null;
  handled: number;
  handledDate: string | null;
  idVersion: number | null;
  reference: string | null;
  externalReference: string | null;
  idContact: number | null;
  cancelled: number;
  idComponent: number | null;
  idProduct: number | null;
  isPlanningActivity: number;
  lastUpdateDateTime: string | null;
  idComponentVersion: number | null;
  idMilestone: number | null;
  fixPlanning: number;
  paused: number;
  workOnRealTime: number;
  tags: string | null;
}

function parseSqlInserts(sql: string): LegacyActivity[] {
  const items: LegacyActivity[] = [];

  // Handle multiple INSERT statements
  const insertRegex = /INSERT INTO `activity`[^)]+\) VALUES\s*/g;
  let match;
  const insertPositions: number[] = [];

  while ((match = insertRegex.exec(sql)) !== null) {
    insertPositions.push(match.index + match[0].length);
  }

  for (const pos of insertPositions) {
    const valuesBlock = sql.substring(pos);
    const rows = extractRows(valuesBlock);

    for (const row of rows) {
      const values = parseRow(row);

      if (values.length >= 33) {
        items.push({
          id: parseInt(values[0]) || 0,
          idProject: values[1] === 'NULL' ? null : parseInt(values[1]) || null,
          idActivityType: values[2] === 'NULL' ? null : parseInt(values[2]) || null,
          name: unescapeSql(values[3]),
          description: values[4] === 'NULL' ? null : unescapeSql(values[4]) || null,
          creationDate: values[5] === 'NULL' ? null : unescapeSql(values[5]),
          idUser: values[6] === 'NULL' ? null : parseInt(values[6]) || null,
          idStatus: values[7] === 'NULL' ? null : parseInt(values[7]) || null,
          idResource: values[8] === 'NULL' ? null : parseInt(values[8]) || null,
          result: values[9] === 'NULL' ? null : unescapeSql(values[9]) || null,
          comment: values[10] === 'NULL' ? null : unescapeSql(values[10]) || null,
          idle: parseInt(values[11]) || 0,
          idActivity: values[12] === 'NULL' ? null : parseInt(values[12]) || null,
          done: parseInt(values[13]) || 0,
          idleDate: values[14] === 'NULL' ? null : unescapeSql(values[14]),
          doneDate: values[15] === 'NULL' ? null : unescapeSql(values[15]),
          handled: parseInt(values[16]) || 0,
          handledDate: values[17] === 'NULL' ? null : unescapeSql(values[17]),
          idVersion: values[18] === 'NULL' ? null : parseInt(values[18]) || null,
          reference: values[19] === 'NULL' ? null : unescapeSql(values[19]) || null,
          externalReference: values[20] === 'NULL' ? null : unescapeSql(values[20]) || null,
          idContact: values[21] === 'NULL' ? null : parseInt(values[21]) || null,
          cancelled: parseInt(values[22]) || 0,
          idComponent: values[23] === 'NULL' ? null : parseInt(values[23]) || null,
          idProduct: values[24] === 'NULL' ? null : parseInt(values[24]) || null,
          isPlanningActivity: parseInt(values[25]) || 0,
          lastUpdateDateTime: values[26] === 'NULL' ? null : unescapeSql(values[26]),
          idComponentVersion: values[27] === 'NULL' ? null : parseInt(values[27]) || null,
          idMilestone: values[28] === 'NULL' ? null : parseInt(values[28]) || null,
          fixPlanning: parseInt(values[29]) || 0,
          paused: parseInt(values[30]) || 0,
          workOnRealTime: parseInt(values[31]) || 0,
          tags: values[32] === 'NULL' ? null : unescapeSql(values[32]) || null,
        });
      }
    }
  }

  return items;
}

function parseProjectInserts(sql: string): LegacyProject[] {
  const projects: LegacyProject[] = [];

  const valuesMatch = sql.match(/VALUES\s*/);
  if (!valuesMatch || valuesMatch.index === undefined) return projects;

  const valuesBlock = sql.substring(valuesMatch.index + valuesMatch[0].length);
  const rows = extractRows(valuesBlock);

  for (const row of rows) {
    const values = parseRow(row);
    if (values.length >= 8) {
      projects.push({
        id: parseInt(values[0]) || 0,
        name: unescapeSql(values[1]),
        idProject: values[7] === 'NULL' ? null : parseInt(values[7]) || null,
      });
    }
  }

  return projects;
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

function buildDescription(act: LegacyActivity): string | null {
  const parts: string[] = [];

  if (act.description && act.description.trim()) {
    parts.push(act.description);
  }

  if (act.result && act.result.trim()) {
    parts.push(`<p><strong>Résultat :</strong></p>${act.result}`);
  }

  if (act.reference) {
    parts.push(`<p><em>Réf: ${act.reference}</em></p>`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

function getSpokStatus(act: LegacyActivity): string {
  if (act.done === 1) return 'done';
  if (act.cancelled === 1) return 'done';
  if (act.idle === 1) return 'done';
  if (act.idStatus) return STATUS_MAP[act.idStatus] || 'todo';
  return 'todo';
}

// ---- Main ----

async function main() {
  console.log('=== Import activity.sql → SPOK ===\n');

  // 1. Parse SQL files
  console.log('[1/7] Lecture des fichiers SQL...');
  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const activities = parseSqlInserts(sql);
  console.log(`  ${activities.length} activités trouvées`);

  if (activities.length === 0) {
    console.error('Aucune activité trouvée. Abandon.');
    process.exit(1);
  }

  // Parse projects
  const projectSql = fs.readFileSync(PROJECT_SQL_FILE, 'utf8');
  const projects = parseProjectInserts(projectSql);
  const projectMap = new Map<number, LegacyProject>();
  for (const p of projects) {
    projectMap.set(p.id, p);
  }
  console.log(`  ${projects.length} projets trouvés`);

  // List projects used in activities
  const projectIds = [...new Set(activities.map(a => a.idProject).filter(Boolean))] as number[];
  console.log(`  ${projectIds.length} projets distincts dans les activités`);
  for (const pid of projectIds) {
    const p = projectMap.get(pid);
    console.log(`    #${pid}: ${p ? p.name : '(inconnu)'}`);
  }

  // 2. Trouver l'utilisateur
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

  // 4. Vérifier doublons
  console.log('\n[4/7] Vérification des doublons...');
  const existingRoot = await prisma.item.findFirst({
    where: {
      spaceId: personalSpace.id,
      title: 'Import activity ProjeQtOr',
    },
  });

  if (existingRoot) {
    console.error(`L'item "Import activity ProjeQtOr" existe déjà (${existingRoot.id}). Import déjà effectué ?`);
    process.exit(1);
  }

  // 5. Créer l'item racine
  console.log('\n[5/7] Création de l\'item racine "Import activity ProjeQtOr"...');
  const rootItem = await prisma.item.create({
    data: {
      type: 'NOTE',
      title: 'Import activity ProjeQtOr',
      description: `<p>Import des ${activities.length} activités depuis ProjeQtOr (${new Date().toISOString().split('T')[0]})</p>`,
      spaceId: personalSpace.id,
      createdById: user.id,
      position: 0,
    },
  });
  console.log(`  Item racine créé: ${rootItem.id}`);

  // 6. Créer les items projets (avec hiérarchie ProjeQtOr)
  console.log('\n[6/7] Création des items par projet...');
  const projectItemIds: Record<number, string> = {};

  // Collect all project IDs needed (activity projects + their parent projects)
  const allProjectIds = new Set<number>(projectIds);
  for (const pid of projectIds) {
    let current = projectMap.get(pid);
    while (current && current.idProject) {
      allProjectIds.add(current.idProject);
      current = projectMap.get(current.idProject);
    }
  }

  // Create projects in order (parents first) using topological sort
  const created_projects: number[] = [];
  const remaining = new Set(allProjectIds);

  while (remaining.size > 0) {
    const batch: number[] = [];
    for (const pid of remaining) {
      const p = projectMap.get(pid);
      if (!p) { batch.push(pid); continue; }
      // Can create if parent is already created or parent is not in our set
      if (!p.idProject || !remaining.has(p.idProject)) {
        batch.push(pid);
      }
    }
    if (batch.length === 0) {
      // Circular reference, just create remaining
      for (const pid of remaining) batch.push(pid);
    }
    for (const pid of batch) {
      const p = projectMap.get(pid);
      const name = p ? p.name : `Projet #${pid}`;
      const parentProjectId = p?.idProject ? projectItemIds[p.idProject] : null;

      const projectItem = await prisma.item.create({
        data: {
          type: 'PROJECT',
          title: name,
          parentId: parentProjectId || rootItem.id,
          spaceId: personalSpace.id,
          createdById: user.id,
          position: pid,
          content: { legacyId: pid, legacyTable: 'project' },
        },
      });
      projectItemIds[pid] = projectItem.id;
      remaining.delete(pid);
      created_projects.push(pid);
    }
  }
  console.log(`  ${created_projects.length} projets créés`);

  // 7. Créer les activités (sans parentId d'abord)
  console.log('\n[7/7] Création des activités...');
  const oldToNewId: Record<number, string> = {};
  let created = 0;
  let errors = 0;

  for (const act of activities) {
    try {
      const description = buildDescription(act);
      const status = getSpokStatus(act);

      const item = await prisma.item.create({
        data: {
          type: 'TASK',
          title: act.name,
          description,
          position: 0,
          status,
          startDate: parseDate(act.creationDate),
          endDate: parseDate(act.doneDate),
          spaceId: personalSpace.id,
          createdById: user.id,
          content: {
            legacyId: act.id,
            legacyTable: 'activity',
            legacyProject: act.idProject,
            legacyReference: act.reference,
          },
        },
      });

      oldToNewId[act.id] = item.id;
      created++;

      if (created % 50 === 0) {
        console.log(`  ${created}/${activities.length} activités créées...`);
      }
    } catch (err: any) {
      console.error(`  Erreur activité #${act.id} "${act.name}": ${err.message}`);
      errors++;
    }
  }
  console.log(`  ${created} activités créées, ${errors} erreurs`);

  // 8. Mise à jour de la hiérarchie
  console.log('\n[8/8] Mise à jour de la hiérarchie...');
  let parented = 0;

  for (const act of activities) {
    const newId = oldToNewId[act.id];
    if (!newId) continue;

    let newParentId: string | null = null;

    if (act.idActivity) {
      // Has a parent activity
      newParentId = oldToNewId[act.idActivity] || null;
    }

    if (!newParentId) {
      // No parent activity → child of project folder
      const projectParent = act.idProject ? projectItemIds[act.idProject] : null;
      newParentId = projectParent || rootItem.id;
    }

    try {
      await prisma.item.update({
        where: { id: newId },
        data: { parentId: newParentId },
      });
      parented++;
    } catch (err: any) {
      console.error(`  Erreur parentId activité #${act.id}: ${err.message}`);
    }
  }
  console.log(`  ${parented} liens parent/enfant créés`);

  // Résumé
  console.log('\n=== Résumé ===');
  console.log(`Projets créés: ${Object.keys(projectItemIds).length}`);
  console.log(`Activités créées: ${created} + 1 racine`);
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
