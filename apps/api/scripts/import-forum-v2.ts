/* Import one-shot du forum v2 (sujets/messages → items/contributions). */
import { prisma } from '@spok/database';
import * as fs from 'fs';
import bcrypt from 'bcrypt';

// Parse SQL file
const content = fs.readFileSync('C:/_dev/spok/ex forum.sql', 'utf8');

interface ForumMember {
  id: number;
  username: string;
  realName: string;
  email: string;
  posts: number;
  dateRegistered: Date;
}

interface ForumBoard {
  id: number;
  catId: number;
  name: string;
  description: string;
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

// Parse members
function parseMembers(): ForumMember[] {
  const members: ForumMember[] = [];
  const membersSection = content.match(/INSERT INTO `gbk_members` \([^)]+\) VALUES([\s\S]+?)(?=INSERT INTO `gbk_|$)/);

  if (membersSection) {
    const memberRegex = /\((\d+),\s*'([^']*)',\s*(\d+),\s*(\d+),\s*\d+,\s*'[^']*',\s*\d+,\s*'([^']*)'[^)]*'([^']*)'/g;
    let match;
    while ((match = memberRegex.exec(membersSection[1])) !== null) {
      const [_, id, username, dateReg, posts, realName, email] = match;
      if (parseInt(posts) > 0) {
        members.push({
          id: parseInt(id),
          username,
          realName: realName || username,
          email: email || `${username.toLowerCase()}@forum-import.local`,
          posts: parseInt(posts),
          dateRegistered: new Date(parseInt(dateReg) * 1000),
        });
      }
    }
  }

  return members;
}

// Parse boards
function parseBoards(): ForumBoard[] {
  const boards: ForumBoard[] = [];
  const boardsSection = content.match(/INSERT INTO `gbk_boards` \([^)]+\) VALUES([\s\S]+?)(?=INSERT INTO `gbk_|$)/);

  if (boardsSection) {
    const boardRegex = /\((\d+),\s*(\d+),\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*'[^']*',\s*\d+,\s*'([^']*)',\s*'([^']*)'/g;
    let match;
    while ((match = boardRegex.exec(boardsSection[1])) !== null) {
      const [_, id, catId, name, description] = match;
      boards.push({
        id: parseInt(id),
        catId: parseInt(catId),
        name: name || `Board ${id}`,
        description: description || '',
      });
    }
  }

  return boards;
}

// Parse topics
function parseTopics(): ForumTopic[] {
  const topics: ForumTopic[] = [];
  const topicsRegex = /INSERT INTO `gbk_topics` \([^)]+\) VALUES([\s\S]+?)(?=;)/g;
  let sectionMatch;

  while ((sectionMatch = topicsRegex.exec(content)) !== null) {
    const topicRegex = /\((\d+),\s*\d+,\s*(\d+),\s*(\d+),\s*(\d+),\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*\d+,\s*(\d+)/g;
    let match;
    while ((match = topicRegex.exec(sectionMatch[1])) !== null) {
      const [_, id, boardId, firstMsgId, lastMsgId, numReplies] = match;
      topics.push({
        id: parseInt(id),
        boardId: parseInt(boardId),
        firstMsgId: parseInt(firstMsgId),
        lastMsgId: parseInt(lastMsgId),
        numReplies: parseInt(numReplies),
      });
    }
  }

  return topics;
}

// Improved SQL string parser - handles escaped quotes and special characters
function parseSqlString(str: string, startPos: number): { value: string; endPos: number } | null {
  if (str[startPos] !== "'") return null;

  let result = '';
  let i = startPos + 1;

  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      // Escaped character
      const nextChar = str[i + 1];
      if (nextChar === "'") {
        result += "'";
        i += 2;
      } else if (nextChar === '\\') {
        result += '\\';
        i += 2;
      } else if (nextChar === 'n') {
        result += '\n';
        i += 2;
      } else if (nextChar === 'r') {
        result += '\r';
        i += 2;
      } else if (nextChar === 't') {
        result += '\t';
        i += 2;
      } else {
        result += str[i + 1];
        i += 2;
      }
    } else if (str[i] === "'" && str[i + 1] === "'") {
      // SQL escaped quote ''
      result += "'";
      i += 2;
    } else if (str[i] === "'") {
      // End of string
      return { value: result, endPos: i + 1 };
    } else {
      result += str[i];
      i++;
    }
  }

  return null; // Unterminated string
}

// Parse a single SQL value (number, string, or hex blob)
function parseSqlValue(str: string, startPos: number): { value: string | number | null; endPos: number } | null {
  let i = startPos;

  // Skip whitespace
  while (i < str.length && /\s/.test(str[i])) i++;

  if (i >= str.length) return null;

  // String value
  if (str[i] === "'") {
    const result = parseSqlString(str, i);
    if (result) {
      return { value: result.value, endPos: result.endPos };
    }
    return null;
  }

  // Hex blob (0x...)
  if (str[i] === '0' && str[i + 1] === 'x') {
    let j = i + 2;
    while (j < str.length && /[0-9a-fA-F]/.test(str[j])) j++;
    return { value: str.substring(i, j), endPos: j };
  }

  // NULL
  if (str.substring(i, i + 4).toUpperCase() === 'NULL') {
    return { value: null, endPos: i + 4 };
  }

  // Number
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

// Parse a complete SQL record (value1, value2, ...)
function parseSqlRecord(str: string, startPos: number): { values: (string | number | null)[]; endPos: number } | null {
  let i = startPos;

  // Skip whitespace
  while (i < str.length && /\s/.test(str[i])) i++;

  if (str[i] !== '(') return null;
  i++;

  const values: (string | number | null)[] = [];

  while (i < str.length) {
    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;

    if (str[i] === ')') {
      return { values, endPos: i + 1 };
    }

    const result = parseSqlValue(str, i);
    if (!result) {
      // Try to skip to next comma or closing paren
      while (i < str.length && str[i] !== ',' && str[i] !== ')') i++;
      values.push(null);
    } else {
      values.push(result.value);
      i = result.endPos;
    }

    // Skip whitespace
    while (i < str.length && /\s/.test(str[i])) i++;

    if (str[i] === ',') {
      i++;
    } else if (str[i] === ')') {
      return { values, endPos: i + 1 };
    }
  }

  return null;
}

// Improved message parser
function parseMessages(): ForumMessage[] {
  const messages: ForumMessage[] = [];

  console.log('  Recherche des INSERT INTO gbk_messages...');

  // Find all message INSERT statements
  const insertRegex = /INSERT INTO `gbk_messages`[^V]+VALUES\s*/g;
  let insertMatch;
  let insertCount = 0;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    insertCount++;
    const startPos = insertMatch.index + insertMatch[0].length;

    // Find the end of this INSERT (next semicolon not inside a string)
    let endPos = startPos;
    let inString = false;
    let escapeNext = false;

    while (endPos < content.length) {
      if (escapeNext) {
        escapeNext = false;
        endPos++;
        continue;
      }

      const char = content[endPos];

      if (char === '\\') {
        escapeNext = true;
      } else if (char === "'" && !escapeNext) {
        inString = !inString;
      } else if (char === ';' && !inString) {
        break;
      }

      endPos++;
    }

    const valuesSection = content.substring(startPos, endPos);

    // Parse each record
    let pos = 0;
    let recordCount = 0;

    while (pos < valuesSection.length) {
      // Skip whitespace and commas
      while (pos < valuesSection.length && /[\s,]/.test(valuesSection[pos])) pos++;

      if (pos >= valuesSection.length) break;

      const record = parseSqlRecord(valuesSection, pos);

      if (!record) {
        // Skip to next record
        pos++;
        continue;
      }

      recordCount++;
      pos = record.endPos;

      // Extract fields from record
      // Format: (id_msg, id_topic, id_board, poster_time, id_member, id_msg_modified, subject, poster_name, poster_email, smileys_enabled, modified_time, modified_name, body, icon, approved, likes, modified_reason, poster_ip)
      const values = record.values;

      if (values.length >= 13) {
        const idMsg = typeof values[0] === 'number' ? values[0] : parseInt(String(values[0]));
        const idTopic = typeof values[1] === 'number' ? values[1] : parseInt(String(values[1]));
        const idBoard = typeof values[2] === 'number' ? values[2] : parseInt(String(values[2]));
        const posterTime = typeof values[3] === 'number' ? values[3] : parseInt(String(values[3]));
        const idMember = typeof values[4] === 'number' ? values[4] : parseInt(String(values[4]));
        const subject = String(values[6] || '');
        const posterName = String(values[7] || '');
        const body = String(values[12] || '');

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

    console.log(`    INSERT #${insertCount}: ${recordCount} enregistrements parsés`);
  }

  console.log(`  Total: ${messages.length} messages parsés depuis ${insertCount} INSERT statements`);

  return messages;
}

async function importForum() {
  console.log('=== IMPORT DU FORUM MSF DANS SPOK (v2) ===\n');

  // Parse data
  console.log('Parsing du fichier SQL...');
  const members = parseMembers();
  const boards = parseBoards();
  const topics = parseTopics();

  console.log(`  - ${members.length} membres actifs`);
  console.log(`  - ${boards.length} catégories`);
  console.log(`  - ${topics.length} topics`);

  console.log('\nParsing des messages (amélioré)...');
  const messages = parseMessages();

  // Find admin user
  console.log('\nRecherche de l\'utilisateur admin...');
  let adminUser = await prisma.user.findFirst({
    where: { email: 'roedelt@hotmail.com' }
  });

  if (!adminUser) {
    const hashedPassword = await bcrypt.hash('changeme123', 10);
    adminUser = await prisma.user.create({
      data: {
        email: 'roedelt@hotmail.com',
        name: 'ztarr',
        passwordHash: hashedPassword,
        globalRole: 'ADMIN',
      }
    });
  }
  console.log(`  Admin: ${adminUser.name} (${adminUser.id})`);

  // Find or create community
  console.log('\nRecherche/création de la communauté...');
  let community = await prisma.community.findFirst({
    where: { name: 'MSF Forum Archive' }
  });

  if (!community) {
    community = await prisma.community.create({
      data: {
        name: 'MSF Forum Archive',
        description: 'Archive du forum MSF importée depuis SMF',
      }
    });

    await prisma.communityMembership.create({
      data: {
        userId: adminUser.id,
        communityId: community.id,
        role: 'OWNER',
      }
    });
  }
  console.log(`  Communauté: ${community.name} (${community.id})`);

  // Build user map from existing + new users
  console.log('\nGestion des utilisateurs...');
  const userMap = new Map<number, string>();
  userMap.set(1, adminUser.id);

  for (const member of members) {
    if (member.id === 1) continue;

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: member.email },
          { name: member.username }
        ]
      }
    });

    if (!user) {
      const hashedPassword = await bcrypt.hash('changeme123', 10);
      const email = member.email.includes('@') ? member.email : `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@forum-import.local`;

      try {
        user = await prisma.user.create({
          data: {
            email,
            name: member.username,
            passwordHash: hashedPassword,
            globalRole: 'USER',
          }
        });
        console.log(`  + Créé: ${member.username}`);
      } catch (e) {
        user = await prisma.user.create({
          data: {
            email: `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${member.id}@forum-import.local`,
            name: member.username,
            passwordHash: hashedPassword,
            globalRole: 'USER',
          }
        });
      }
    }

    userMap.set(member.id, user.id);

    const existingMembership = await prisma.communityMembership.findUnique({
      where: {
        userId_communityId: {
          userId: user.id,
          communityId: community.id,
        }
      }
    });

    if (!existingMembership) {
      await prisma.communityMembership.create({
        data: {
          userId: user.id,
          communityId: community.id,
          role: 'MEMBER',
        }
      });
    }
  }

  // Build space map
  console.log('\nGestion des espaces...');
  const spaceMap = new Map<number, string>();

  for (const board of boards) {
    let space = await prisma.space.findFirst({
      where: {
        name: board.name,
        communityId: community.id,
      }
    });

    if (!space) {
      space = await prisma.space.create({
        data: {
          name: board.name || `Forum ${board.id}`,
          type: 'GROUP',
          communityId: community.id,
        }
      });

      await prisma.spaceMembership.create({
        data: {
          userId: adminUser.id,
          spaceId: space.id,
          role: 'OWNER',
        }
      });

      console.log(`  + Créé: ${space.name}`);
    }

    spaceMap.set(board.id, space.id);
  }

  // Default space
  let defaultSpace = await prisma.space.findFirst({
    where: { name: 'Forum Général', communityId: community.id }
  });

  if (!defaultSpace) {
    defaultSpace = await prisma.space.create({
      data: {
        name: 'Forum Général',
        type: 'GROUP',
        communityId: community.id,
      }
    });
    await prisma.spaceMembership.create({
      data: {
        userId: adminUser.id,
        spaceId: defaultSpace.id,
        role: 'OWNER',
      }
    });
  }
  const defaultSpaceId = defaultSpace.id;

  // Group messages by topic
  console.log('\nGroupement des messages par topic...');
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

  // Import topics and contributions
  console.log('\nImport des topics et contributions...');

  let importedTopics = 0;
  let importedContributions = 0;
  let skippedTopics = 0;

  for (const topic of topics) {
    const topicMessages = messagesByTopic.get(topic.id) || [];
    if (topicMessages.length === 0) {
      skippedTopics++;
      continue;
    }

    const firstMessage = topicMessages[0];
    const spaceId = spaceMap.get(topic.boardId) || defaultSpaceId;
    const creatorId = userMap.get(firstMessage.memberId) || adminUser.id;

    // Check if already exists
    const existingItem = await prisma.item.findFirst({
      where: {
        title: firstMessage.subject || `Topic ${topic.id}`,
        spaceId,
      }
    });

    if (existingItem) {
      // Add missing contributions
      for (let i = 1; i < topicMessages.length; i++) {
        const msg = topicMessages[i];
        const authorId = userMap.get(msg.memberId) || adminUser.id;

        const existingContrib = await prisma.contribution.findFirst({
          where: {
            itemId: existingItem.id,
            content: msg.body.substring(0, 100),
          }
        });

        if (!existingContrib && msg.body.trim()) {
          await prisma.contribution.create({
            data: {
              content: msg.body,
              itemId: existingItem.id,
              authorId,
              createdAt: msg.posterTime,
            }
          });
          importedContributions++;
        }
      }
      continue;
    }

    // Create item
    const item = await prisma.item.create({
      data: {
        type: 'NOTE',
        title: firstMessage.subject || `Topic ${topic.id}`,
        description: firstMessage.body.substring(0, 500) + (firstMessage.body.length > 500 ? '...' : ''),
        content: { originalBody: firstMessage.body, forumTopicId: topic.id },
        spaceId,
        createdById: creatorId,
        createdAt: firstMessage.posterTime,
      }
    });

    importedTopics++;

    // Create contributions
    for (let i = 1; i < topicMessages.length; i++) {
      const msg = topicMessages[i];
      const authorId = userMap.get(msg.memberId) || adminUser.id;

      if (msg.body.trim()) {
        await prisma.contribution.create({
          data: {
            content: msg.body,
            itemId: item.id,
            authorId,
            createdAt: msg.posterTime,
          }
        });
        importedContributions++;
      }
    }

    if (importedTopics % 100 === 0) {
      console.log(`  Progression: ${importedTopics} topics, ${importedContributions} contributions`);
    }
  }

  console.log(`\n=== IMPORT TERMINÉ ===`);
  console.log(`  Messages parsés: ${messages.length}`);
  console.log(`  Topics importés: ${importedTopics}`);
  console.log(`  Topics ignorés (sans messages): ${skippedTopics}`);
  console.log(`  Contributions importées: ${importedContributions}`);
  console.log(`  Utilisateurs: ${userMap.size}`);
  console.log(`  Espaces: ${spaceMap.size}`);
}

importForum()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
