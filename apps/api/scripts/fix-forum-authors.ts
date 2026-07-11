/* Correctif one-shot : réattribution des auteurs après import forum. */
import { prisma } from '@spok/database';
import * as fs from 'fs';
import bcrypt from 'bcrypt';

// =============================================================
// FIX FORUM AUTHORS - Corriger les auteurs mal attribués
// =============================================================
// Le script d'import original (v2) utilisait un regex fragile pour
// parser les membres SMF. Beaucoup de membres n'ont pas été créés
// et leurs contributions ont été attribuées à l'admin (ztarr).
//
// Ce script :
// 1. Parse les membres avec le parser SQL robuste
// 2. Crée les utilisateurs manquants
// 3. Corrige les auteurs des items et contributions
// =============================================================

// Deux fichiers SQL :
// - ex forum.sql : contient 191 membres (complet) avec email_address à index 16
// - superzta_forum_gbk.sql : contient les messages avec body à index 14
const SQL_FILE_MEMBERS = 'C:/_dev/spok/_archive/ex forum.sql';
const SQL_FILE_MESSAGES = 'C:/_dev/spok/_archive/superzta_forum_gbk.sql';
const COMMUNITY_NAME = 'Archive Forum GBK Team';

console.log('Chargement des fichiers SQL...');
const contentMembers = fs.readFileSync(SQL_FILE_MEMBERS, 'utf8');
console.log(`  Fichier membres: ${(contentMembers.length / 1024 / 1024).toFixed(1)} Mo`);
const contentMessages = fs.readFileSync(SQL_FILE_MESSAGES, 'utf8');
console.log(`  Fichier messages: ${(contentMessages.length / 1024 / 1024).toFixed(1)} Mo`);

// ---- Interfaces ----

interface ForumMember {
  id: number;
  username: string;
  realName: string;
  email: string;
  posts: number;
  dateRegistered: Date;
}

interface ForumTopic {
  id: number;
  boardId: number;
  firstMsgId: number;
  lastMsgId: number;
  numReplies: number;
}

interface ForumMessage {
  id: number;
  topicId: number;
  boardId: number;
  posterTime: Date;
  memberId: number;
  subject: string;
  posterName: string;
  body: string;
}

// ---- SQL Parser (robuste, copié de import-forum-v3) ----

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
      result += "'";
      i += 2;
    } else if (str[i] === "'") {
      return { value: result, endPos: i + 1 };
    } else {
      result += str[i];
      i++;
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

function toInt(val: string | number | null): number {
  if (typeof val === 'number') return Math.floor(val);
  return parseInt(String(val), 10) || 0;
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

// ---- Parsers ----

function parseMembers(): ForumMember[] {
  const members: ForumMember[] = [];
  // Colonnes de ex forum.sql :
  // 0: id_member, 1: member_name, 2: date_registered, 3: posts,
  // 7: real_name, 16: email_address
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
      if (v.length >= 17) {
        const id = toInt(v[0]);
        const username = String(v[1] || '');
        const dateReg = toInt(v[2]);
        const posts = toInt(v[3]);
        const realName = String(v[7] || username);
        const email = String(v[16] || '');

        if (posts > 0 && id > 0) {
          members.push({
            id,
            username,
            realName: realName || username,
            email: email || `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@forum-import.local`,
            posts,
            dateRegistered: new Date(dateReg * 1000),
          });
        }
      }
    }
  }

  return members;
}

function parseTopics(): ForumTopic[] {
  const topics: ForumTopic[] = [];
  const insertRegex = /INSERT INTO `gbk_topics`[^V]+VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(contentMessages)) !== null) {
    const startPos = insertMatch.index + insertMatch[0].length;
    const endPos = findInsertEnd(contentMessages, startPos);
    const section = contentMessages.substring(startPos, endPos);

    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;

      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;

      const v = record.values;
      if (v.length >= 11) {
        topics.push({
          id: toInt(v[0]),
          boardId: toInt(v[2]),
          firstMsgId: toInt(v[3]),
          lastMsgId: toInt(v[4]),
          numReplies: toInt(v[10]),
        });
      }
    }
  }

  return topics;
}

function parseMessages(): ForumMessage[] {
  const messages: ForumMessage[] = [];
  // Colonnes superzta_forum_gbk.sql : body à index 14
  const insertRegex = /INSERT INTO `gbk_messages`[^V]+VALUES\s*/g;
  let insertMatch;
  let insertCount = 0;

  while ((insertMatch = insertRegex.exec(contentMessages)) !== null) {
    insertCount++;
    const startPos = insertMatch.index + insertMatch[0].length;
    const endPos = findInsertEnd(contentMessages, startPos);
    const section = contentMessages.substring(startPos, endPos);

    let pos = 0;
    let recordCount = 0;

    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;

      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      recordCount++;
      pos = record.endPos;

      const v = record.values;
      if (v.length >= 15) {
        const idMsg = toInt(v[0]);
        const idTopic = toInt(v[1]);
        const idBoard = toInt(v[2]);
        const posterTime = toInt(v[3]);
        const idMember = toInt(v[4]);
        const subject = String(v[6] || '');
        const posterName = String(v[7] || '');
        const body = String(v[14] || '');

        if (!isNaN(idMsg) && !isNaN(idTopic) && idMsg > 0) {
          messages.push({
            id: idMsg,
            topicId: idTopic,
            boardId: idBoard,
            posterTime: new Date(posterTime * 1000),
            memberId: idMember,
            subject,
            posterName,
            body,
          });
        }
      }
    }

    console.log(`    INSERT messages #${insertCount}: ${recordCount} enregistrements`);
  }

  console.log(`  Total: ${messages.length} messages parsés`);
  return messages;
}

// ---- Main ----

async function fixForumAuthors() {
  console.log('=== FIX FORUM AUTHORS ===\n');

  // ---- Étape 1 : Parser le SQL ----
  console.log('1. Parsing du fichier SQL...');
  const members = parseMembers();
  const topics = parseTopics();

  console.log(`  - ${members.length} membres actifs (parser robuste)`);
  console.log(`  - ${topics.length} topics`);

  console.log('\n   Parsing des messages...');
  const messages = parseMessages();

  // ---- Étape 2 : Trouver admin et communauté ----
  console.log('\n2. Recherche admin et communauté...');
  const adminUser = await prisma.user.findFirst({
    where: { email: 'roedelt@hotmail.com' }
  });

  if (!adminUser) {
    console.error('ERREUR: Admin user (roedelt@hotmail.com) non trouvé!');
    process.exit(1);
  }
  console.log(`  Admin: ${adminUser.name} (${adminUser.id})`);

  const community = await prisma.community.findFirst({
    where: { name: COMMUNITY_NAME }
  });

  if (!community) {
    console.error(`ERREUR: Communauté "${COMMUNITY_NAME}" non trouvée!`);
    process.exit(1);
  }
  console.log(`  Communauté: ${community.name} (${community.id})`);

  // ---- Étape 3 : Créer les utilisateurs manquants ----
  console.log('\n3. Création des utilisateurs manquants...');

  // Charger tous les utilisateurs existants
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  const userByEmail = new Map<string, string>();
  const userByName = new Map<string, string>();
  for (const u of allUsers) {
    userByEmail.set(u.email.toLowerCase(), u.id);
    userByName.set(u.name.toLowerCase(), u.id);
  }

  // Charger les memberships communauté existants
  const existingCommunityMemberships = await prisma.communityMembership.findMany({
    where: { communityId: community.id },
    select: { userId: true },
  });
  const communityMemberIds = new Set(existingCommunityMemberships.map(m => m.userId));

  const userMap = new Map<number, string>(); // forumMemberId → spokUserId
  userMap.set(1, adminUser.id);

  const defaultHash = await bcrypt.hash('changeme123', 10);
  let createdUsers = 0;
  let createdMemberships = 0;

  for (const member of members) {
    if (member.id === 1) continue;

    // Chercher par email ou nom (case-insensitive)
    let userId = userByEmail.get(member.email.toLowerCase())
      || userByName.get(member.username.toLowerCase());

    if (!userId) {
      // Créer l'utilisateur
      const email = member.email.includes('@')
        ? member.email
        : `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@forum-import.local`;

      try {
        const user = await prisma.user.create({
          data: {
            email,
            name: member.username,
            passwordHash: defaultHash,
            globalRole: 'USER',
          }
        });
        userId = user.id;
        userByEmail.set(email.toLowerCase(), userId);
        userByName.set(member.username.toLowerCase(), userId);
        createdUsers++;
        console.log(`  + Créé: ${member.username} (${email})`);
      } catch {
        // Email peut-être déjà pris, essayer avec un suffixe
        try {
          const fallbackEmail = `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${member.id}@forum-import.local`;
          const user = await prisma.user.create({
            data: {
              email: fallbackEmail,
              name: member.username,
              passwordHash: defaultHash,
              globalRole: 'USER',
            }
          });
          userId = user.id;
          userByEmail.set(fallbackEmail.toLowerCase(), userId);
          userByName.set(member.username.toLowerCase(), userId);
          createdUsers++;
          console.log(`  + Créé (fallback): ${member.username} (${fallbackEmail})`);
        } catch {
          console.log(`  ! Impossible de créer: ${member.username} — utilisation admin`);
          userId = adminUser.id;
        }
      }
    }

    userMap.set(member.id, userId);

    // Ajouter à la communauté si pas encore membre
    if (!communityMemberIds.has(userId)) {
      try {
        await prisma.communityMembership.create({
          data: { userId, communityId: community.id, role: 'MEMBER' },
        });
        communityMemberIds.add(userId);
        createdMemberships++;
      } catch {
        // Déjà membre
      }
    }
  }

  console.log(`\n  Résultat utilisateurs:`);
  console.log(`    - ${userMap.size} membres forum mappés`);
  console.log(`    - ${createdUsers} nouveaux utilisateurs créés`);
  console.log(`    - ${createdMemberships} nouveaux memberships communauté`);

  // ---- Étape 4 : Grouper les messages par topic ----
  console.log('\n4. Groupement des messages par topic...');
  const messagesByTopic = new Map<number, ForumMessage[]>();
  for (const msg of messages) {
    if (!messagesByTopic.has(msg.topicId)) {
      messagesByTopic.set(msg.topicId, []);
    }
    messagesByTopic.get(msg.topicId)!.push(msg);
  }

  for (const [_, msgs] of messagesByTopic) {
    msgs.sort((a, b) => a.id - b.id);
  }
  console.log(`  ${messagesByTopic.size} topics avec messages`);

  // ---- Étape 5 : Charger les items existants par forumTopicId ----
  console.log('\n5. Chargement des items existants...');

  const communitySpaces = await prisma.space.findMany({
    where: { communityId: community.id },
    select: { id: true },
  });
  const spaceIds = communitySpaces.map(s => s.id);

  const existingItems = await prisma.item.findMany({
    where: { spaceId: { in: spaceIds }, type: 'NOTE' },
    select: { id: true, title: true, content: true, createdById: true },
  });

  // Index par forumTopicId
  const itemByTopicId = new Map<number, { id: string; title: string; createdById: string }>();
  for (const item of existingItems) {
    const c = item.content as Record<string, unknown> | null;
    if (c && typeof c.forumTopicId === 'number') {
      itemByTopicId.set(c.forumTopicId, { id: item.id, title: item.title, createdById: item.createdById });
    }
  }

  console.log(`  ${existingItems.length} items NOTE trouvés`);
  console.log(`  ${itemByTopicId.size} items avec forumTopicId`);

  // ---- Étape 6 : Corriger les auteurs ----
  console.log('\n6. Correction des auteurs...\n');

  let fixedItems = 0;
  let fixedContributions = 0;
  let skippedItems = 0;
  let skippedContributions = 0;
  let errorCount = 0;

  for (const topic of topics) {
    const topicMessages = messagesByTopic.get(topic.id);
    if (!topicMessages || topicMessages.length === 0) continue;

    const existingItem = itemByTopicId.get(topic.id);
    if (!existingItem) continue;

    const firstMessage = topicMessages[0];

    // --- Corriger l'auteur de l'Item ---
    const expectedCreatorId = userMap.get(firstMessage.memberId);
    if (expectedCreatorId
      && existingItem.createdById === adminUser.id
      && expectedCreatorId !== adminUser.id) {
      // L'item est attribué à admin mais le vrai auteur est quelqu'un d'autre
      try {
        await prisma.item.update({
          where: { id: existingItem.id },
          data: { createdById: expectedCreatorId },
        });
        fixedItems++;
      } catch (e) {
        console.log(`  ! Erreur correction item ${existingItem.id}: ${e}`);
        errorCount++;
      }
    } else {
      skippedItems++;
    }

    // --- Corriger les auteurs des Contributions ---
    if (topicMessages.length <= 1) continue;

    // Charger les contributions de cet item
    const contributions = await prisma.contribution.findMany({
      where: { itemId: existingItem.id },
      select: { id: true, content: true, authorId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Pour chaque réponse (message index 1+), trouver la contribution correspondante
    for (let i = 1; i < topicMessages.length; i++) {
      const msg = topicMessages[i];
      if (!msg.body.trim()) continue;

      const expectedAuthorId = userMap.get(msg.memberId);
      if (!expectedAuthorId || expectedAuthorId === adminUser.id) continue;

      // Trouver la contribution correspondante
      // Stratégie 1 : par date exacte (posterTime)
      let matchedContrib = contributions.find(c =>
        c.createdAt.getTime() === msg.posterTime.getTime()
      );

      // Stratégie 2 : par début de contenu (les 80 premiers caractères)
      if (!matchedContrib) {
        const bodyPrefix = msg.body.substring(0, 80);
        matchedContrib = contributions.find(c =>
          c.content.substring(0, 80) === bodyPrefix
        );
      }

      if (!matchedContrib) {
        // Stratégie 3 : chercher en DB directement avec startsWith
        const bodyPrefix = msg.body.substring(0, 100);
        matchedContrib = contributions.find(c =>
          c.content.startsWith(bodyPrefix)
        );
      }

      if (matchedContrib && matchedContrib.authorId === adminUser.id) {
        try {
          await prisma.contribution.update({
            where: { id: matchedContrib.id },
            data: { authorId: expectedAuthorId },
          });
          fixedContributions++;
        } catch (e) {
          console.log(`  ! Erreur correction contrib ${matchedContrib.id}: ${e}`);
          errorCount++;
        }
      } else {
        skippedContributions++;
      }
    }

    // Progress
    if ((fixedItems + skippedItems) % 500 === 0 && fixedItems > 0) {
      console.log(`  Progression: ${fixedItems} items corrigés, ${fixedContributions} contributions corrigées...`);
    }
  }

  // ---- Étape 7 : Rapport final ----
  console.log('\n=== RAPPORT FINAL ===');
  console.log(`  Membres forum parsés:          ${members.length}`);
  console.log(`  Utilisateurs créés:            ${createdUsers}`);
  console.log(`  Memberships créés:             ${createdMemberships}`);
  console.log(`  Items corrigés:                ${fixedItems}`);
  console.log(`  Items inchangés:               ${skippedItems}`);
  console.log(`  Contributions corrigées:       ${fixedContributions}`);
  console.log(`  Contributions inchangées:      ${skippedContributions}`);
  console.log(`  Erreurs:                       ${errorCount}`);

  // Vérification : combien de contributions sont encore à ztarr ?
  console.log('\n=== VÉRIFICATION ===');
  const ztarrContribCount = await prisma.contribution.count({
    where: {
      authorId: adminUser.id,
      item: { spaceId: { in: spaceIds } },
    },
  });
  const totalContribCount = await prisma.contribution.count({
    where: {
      item: { spaceId: { in: spaceIds } },
    },
  });
  const ztarrItemCount = await prisma.item.count({
    where: {
      createdById: adminUser.id,
      spaceId: { in: spaceIds },
    },
  });
  const totalItemCount = await prisma.item.count({
    where: {
      spaceId: { in: spaceIds },
    },
  });

  console.log(`  Contributions ztarr: ${ztarrContribCount}/${totalContribCount} (${((ztarrContribCount / totalContribCount) * 100).toFixed(1)}%)`);
  console.log(`  Items ztarr:         ${ztarrItemCount}/${totalItemCount} (${((ztarrItemCount / totalItemCount) * 100).toFixed(1)}%)`);
}

fixForumAuthors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
