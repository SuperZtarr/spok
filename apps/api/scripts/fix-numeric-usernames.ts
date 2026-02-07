import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// FIX NUMERIC USERNAMES
// =============================================================
// Le script fix-forum-authors a créé des utilisateurs avec des
// noms numériques ("2", "3", etc.) à cause d'un bug de parsing :
// le parser SQL a lu des records de gbk_messages (18 colonnes)
// comme s'ils étaient des gbk_members (50 colonnes).
//
// Ces faux utilisateurs correspondent en réalité à des id_member
// du forum. Ce script :
// 1. Parse correctement les vrais membres (50 colonnes)
// 2. Construit un mapping id_member → vrai nom
// 3. Renomme les utilisateurs numériques avec leur vrai nom
// 4. Si un utilisateur avec ce nom existe déjà, fusionne
// =============================================================

const SQL_FILE = 'C:/_dev/spok/_archive/ex forum.sql';

console.log('Chargement du fichier SQL...');
const contentMembers = fs.readFileSync(SQL_FILE, 'utf8');

// ---- SQL Parser (copié) ----

function parseSqlString(str: string, startPos: number): { value: string; endPos: number } | null {
  if (str[startPos] !== "'") return null;
  let result = '';
  let i = startPos + 1;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const nextChar = str[i + 1];
      if (nextChar === "'") { result += "'"; i += 2; }
      else if (nextChar === '\\') { result += '\\'; i += 2; }
      else if (nextChar === 'n') { result += '\n'; i += 2; }
      else if (nextChar === 'r') { result += '\r'; i += 2; }
      else if (nextChar === 't') { result += '\t'; i += 2; }
      else { result += str[i + 1]; i += 2; }
    } else if (str[i] === "'" && str[i + 1] === "'") {
      result += "'"; i += 2;
    } else if (str[i] === "'") {
      return { value: result, endPos: i + 1 };
    } else {
      result += str[i]; i++;
    }
  }
  return null;
}

function parseSqlValue(str: string, startPos: number): { value: string | number | null; endPos: number } | null {
  let i = startPos;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length) return null;
  if (str[i] === "'") {
    const result = parseSqlString(str, i);
    if (result) return { value: result.value, endPos: result.endPos };
    return null;
  }
  if (str[i] === '0' && str[i + 1] === 'x') {
    let j = i + 2;
    while (j < str.length && /[0-9a-fA-F]/.test(str[j])) j++;
    return { value: str.substring(i, j), endPos: j };
  }
  if (str.substring(i, i + 4).toUpperCase() === 'NULL') {
    return { value: null, endPos: i + 4 };
  }
  let j = i;
  if (str[j] === '-') j++;
  while (j < str.length && /[0-9.]/.test(str[j])) j++;
  if (j > i) {
    const numStr = str.substring(i, j);
    const num = parseFloat(numStr);
    return { value: isNaN(num) ? numStr : num, endPos: j };
  }
  return null;
}

function parseSqlRecord(str: string, startPos: number): { values: (string | number | null)[]; endPos: number } | null {
  let i = startPos;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (str[i] !== '(') return null;
  i++;
  const values: (string | number | null)[] = [];
  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === ')') return { values, endPos: i + 1 };
    const result = parseSqlValue(str, i);
    if (!result) {
      while (i < str.length && str[i] !== ',' && str[i] !== ')') i++;
      values.push(null);
    } else {
      values.push(result.value);
      i = result.endPos;
    }
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === ',') i++;
    else if (str[i] === ')') return { values, endPos: i + 1 };
  }
  return null;
}

function findInsertEnd(source: string, startPos: number): number {
  let pos = startPos;
  let inString = false;
  let escapeNext = false;
  while (pos < source.length) {
    if (escapeNext) { escapeNext = false; pos++; continue; }
    const char = source[pos];
    if (char === '\\') { escapeNext = true; }
    else if (char === "'" && !escapeNext) { inString = !inString; }
    else if (char === ';' && !inString) { break; }
    pos++;
  }
  return pos;
}

function toInt(val: string | number | null): number {
  if (typeof val === 'number') return Math.floor(val);
  return parseInt(String(val), 10) || 0;
}

// ---- Parse les VRAIS membres (50 colonnes) ----

interface ForumMember {
  id: number;
  username: string;
  realName: string;
  email: string;
}

function parseRealMembers(): ForumMember[] {
  const members: ForumMember[] = [];
  const insertRegex = /INSERT INTO `gbk_members`[^V]+VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(contentMembers)) !== null) {
    const startPos = insertMatch.index + insertMatch[0].length;
    const endPos = findInsertEnd(contentMembers, startPos);
    const section = contentMembers.substring(startPos, endPos);

    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;

      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;

      const v = record.values;
      // IMPORTANT : ne garder que les vrais membres (50 colonnes)
      if (v.length >= 40) {
        const id = toInt(v[0]);
        const username = String(v[1] || '');
        const realName = String(v[7] || username);
        const email = String(v[16] || '');

        if (id > 0 && username) {
          members.push({ id, username, realName, email });
        }
      }
    }
  }

  return members;
}

// ---- Main ----

async function fixNumericUsernames() {
  console.log('=== FIX NUMERIC USERNAMES ===\n');

  // 1. Parser les vrais membres
  console.log('1. Parsing des vrais membres (50 colonnes)...');
  const realMembers = parseRealMembers();
  console.log(`  ${realMembers.length} vrais membres parsés`);

  // Construire le mapping id → nom
  const memberNameById = new Map<number, string>();
  for (const m of realMembers) {
    memberNameById.set(m.id, m.username);
  }
  console.log('  Mapping:');
  for (const m of realMembers) {
    console.log(`    ${m.id} → ${m.username}`);
  }

  // 2. Trouver les utilisateurs avec des noms numériques
  console.log('\n2. Recherche des utilisateurs numériques...');
  const numericUsers = await prisma.user.findMany({
    where: { email: { endsWith: '@forum-import.local' } },
    select: { id: true, name: true, email: true },
  });

  // Filtrer ceux dont le nom est un nombre
  const toFix = numericUsers.filter(u => /^\d+$/.test(u.name));
  console.log(`  ${toFix.length} utilisateurs avec nom numérique`);

  // 3. Corriger chaque utilisateur
  console.log('\n3. Corrections...');
  let renamed = 0;
  let merged = 0;
  let deleted = 0;
  let skipped = 0;

  for (const user of toFix) {
    const numericName = user.name;
    // Le nom numérique correspond à un id_member (les faux records avaient le name = id_member)
    // Mais en réalité, ces records n'étaient PAS des membres.
    // Ce sont des utilisateurs fantômes créés par erreur.
    // On doit les supprimer et réattribuer leurs contributions à l'admin ou au bon auteur.

    // Vérifier si cet utilisateur a des contributions ou items
    const contribCount = await prisma.contribution.count({ where: { authorId: user.id } });
    const itemCount = await prisma.item.count({ where: { createdById: user.id } });

    if (contribCount === 0 && itemCount === 0) {
      // Aucune donnée — supprimer l'utilisateur
      try {
        await prisma.communityMembership.deleteMany({ where: { userId: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
        console.log(`  ✗ Supprimé: "${numericName}" (aucune donnée)`);
        deleted++;
      } catch (e) {
        console.log(`  ! Erreur suppression "${numericName}": ${e}`);
        skipped++;
      }
    } else {
      // Cet utilisateur a des données — il faut trouver le vrai auteur
      // Le nom numérique pourrait correspondre à un id_member du forum
      const memberId = parseInt(numericName);
      const realName = memberNameById.get(memberId);

      if (realName) {
        // Trouver l'utilisateur avec le vrai nom
        const realUser = await prisma.user.findFirst({
          where: { name: { equals: realName, mode: 'insensitive' } },
        });

        if (realUser) {
          // Réattribuer les contributions et items au vrai utilisateur
          const updatedContribs = await prisma.contribution.updateMany({
            where: { authorId: user.id },
            data: { authorId: realUser.id },
          });
          const updatedItems = await prisma.item.updateMany({
            where: { createdById: user.id },
            data: { createdById: realUser.id },
          });

          // Supprimer le faux utilisateur
          await prisma.communityMembership.deleteMany({ where: { userId: user.id } });
          await prisma.user.delete({ where: { id: user.id } });

          console.log(`  → Fusionné: "${numericName}" → "${realName}" (${updatedContribs.count} contribs, ${updatedItems.count} items)`);
          merged++;
        } else {
          // Le vrai utilisateur n'existe pas — renommer
          try {
            await prisma.user.update({
              where: { id: user.id },
              data: { name: `Membre ${numericName}` },
            });
            console.log(`  ~ Renommé: "${numericName}" → "Membre ${numericName}" (${contribCount} contribs, ${itemCount} items)`);
            renamed++;
          } catch {
            skipped++;
          }
        }
      } else {
        // Pas de mapping connu — renommer en "Membre N"
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { name: `Membre ${numericName}` },
          });
          console.log(`  ~ Renommé: "${numericName}" → "Membre ${numericName}" (${contribCount} contribs, ${itemCount} items)`);
          renamed++;
        } catch {
          skipped++;
        }
      }
    }
  }

  console.log('\n=== RAPPORT ===');
  console.log(`  Fusionnés:  ${merged}`);
  console.log(`  Renommés:   ${renamed}`);
  console.log(`  Supprimés:  ${deleted}`);
  console.log(`  Ignorés:    ${skipped}`);
}

fixNumericUsernames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
