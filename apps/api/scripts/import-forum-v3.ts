import { prisma } from '@spok/database';
import * as fs from 'fs';

// =============================================================
// IMPORT FORUM v3 - Optimisé pour compléter l'import existant
// =============================================================
// - Source: superzta_forum_gbk.sql (body à index 14)
// - Conversion BBCode → HTML avec classes Tailwind
// - Batch creates pour les contributions (lots de 100)
// - Déduplication par forumTopicId (pas title+spaceId)
// - Chargement de l'état existant en mémoire
// =============================================================

const SQL_FILE = 'C:/_dev/spok/superzta_forum_gbk.sql';
const COMMUNITY_ID = 'cml8nwsz30000xc3a6pm6spe3';
const BATCH_SIZE = 100;

// Parse SQL file
console.log('Chargement du fichier SQL...');
const content = fs.readFileSync(SQL_FILE, 'utf8');
console.log(`  Fichier chargé: ${(content.length / 1024 / 1024).toFixed(1)} Mo`);

// ---- BBCode → HTML Converter ----

const EMOTICONS: Record<string, string> = {
  ':)': '🙂', ':-)': '🙂', ':(': '😞', ':-(': '😞',
  ';)': '😉', ';-)': '😉', ':D': '😃', ':-D': '😃', ';D': '😆',
  ':o': '😮', ':O': '😮', ':-o': '😮', '8)': '😎', '8-)': '😎',
  ':P': '😛', ':-P': '😛', '::)': '🙄', ':-\\': '😕', ':-/': '😕',
  ':-[': '😳', 'O0': '👍', ':\'(': '😢', '>:(': '😠',
  ':x': '😡', ':-x': '😡', ':*': '😘', ':-*': '😘', '<3': '❤️',
};

function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

function convertEmoticons(text: string): string {
  let result = text;
  const sorted = Object.entries(EMOTICONS).sort((a, b) => b[0].length - a[0].length);
  for (const [emoticon, emoji] of sorted) {
    const escaped = emoticon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), emoji);
  }
  return result;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function bbcodeToHtml(bbcode: string): string {
  if (!bbcode) return '';
  let html = bbcode;

  // Handle <br /> tags
  html = html.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  html = html.replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n');

  // Escape HTML
  html = escapeHtml(html);

  // BBCode formatting
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>');
  html = html.replace(/\[hr\]/gi, '<hr class="my-2 border-border">');

  // Color and size
  html = html.replace(/\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi, '<span style="color: $1">$2</span>');
  html = html.replace(/\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi, (_, size, content) => {
    const sizeNum = parseInt(size);
    let fontSize = size;
    if (!isNaN(sizeNum) && sizeNum <= 7) {
      const sizes = ['0.5rem', '0.625rem', '0.75rem', '0.875rem', '1.125rem', '1.5rem', '2.25rem'];
      fontSize = sizes[sizeNum - 1] || '1rem';
    }
    return `<span style="font-size: ${fontSize}">${content}</span>`;
  });

  // URLs
  html = html.replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline">$2</a>');
  html = html.replace(/\[url\]([\s\S]*?)\[\/url\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline break-all">$1</a>');

  // Images
  html = html.replace(/\[img\]([\s\S]*?)\[\/img\]/gi,
    '<img src="$1" alt="Image" class="max-w-full h-auto rounded my-2" loading="lazy" onerror="this.style.display=\'none\'">');

  // YouTube
  html = html.replace(/\[youtube\]([\s\S]*?)\[\/youtube\]/gi, (_, url) => {
    const videoId = extractYoutubeId(url.trim());
    if (videoId) {
      return `<div class="aspect-video my-2"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" class="w-full h-full rounded" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
    }
    return `<a href="${url}" target="_blank" class="text-primary underline">[YouTube] ${url}</a>`;
  });

  // Quotes
  html = html.replace(/\[quote\s+author=([^\]]+?)(?:\s+link=[^\]]+)?(?:\s+date=\d+)?\s*\]([\s\S]*?)\[\/quote\]/gi,
    '<blockquote class="border-l-4 border-primary/50 pl-4 my-3 py-2 bg-muted/50 rounded-r"><div class="text-xs text-muted-foreground mb-1 font-medium">$1 a écrit :</div><div class="text-sm">$2</div></blockquote>');
  html = html.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi,
    '<blockquote class="border-l-4 border-primary/50 pl-4 my-3 py-2 bg-muted/50 rounded-r"><div class="text-sm">$1</div></blockquote>');

  // Code
  html = html.replace(/\[code\]([\s\S]*?)\[\/code\]/gi,
    '<pre class="bg-muted p-3 rounded my-2 overflow-x-auto text-sm font-mono"><code>$1</code></pre>');

  // Lists
  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul class="list-disc pl-5 my-2">$1</ul>');
  html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, '<ol class="list-decimal pl-5 my-2">$1</ol>');
  html = html.replace(/\[\*\]/gi, '</li><li>');
  html = html.replace(/<ul([^>]*)><\/li>/gi, '<ul$1>');
  html = html.replace(/<ol([^>]*)><\/li>/gi, '<ol$1>');
  html = html.replace(/<li>\s*<\/ul>/gi, '</ul>');
  html = html.replace(/<li>\s*<\/ol>/gi, '</ol>');

  // Spoiler
  html = html.replace(/\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    '<details class="my-2"><summary class="cursor-pointer text-primary hover:underline">Spoiler</summary><div class="mt-2 p-2 bg-muted rounded">$1</div></details>');
  html = html.replace(/\[spoiler=([^\]]+)\]([\s\S]*?)\[\/spoiler\]/gi,
    '<details class="my-2"><summary class="cursor-pointer text-primary hover:underline">$1</summary><div class="mt-2 p-2 bg-muted rounded">$2</div></details>');

  // Emoticons and newlines
  html = convertEmoticons(html);
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/(<br>\s*){3,}/g, '<br><br>');

  // Decode double-encoded entities (from source SQL already having entities)
  html = html.replace(/&amp;nbsp;/g, ' ');
  html = html.replace(/&amp;quot;/g, '"');
  html = html.replace(/&amp;#039;/g, "'");
  html = html.replace(/&amp;amp;/g, '&');

  // Decode single-encoded entities (created by escapeHtml above)
  html = html.replace(/&#039;/g, "'");
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&amp;/g, '&'); // must be last

  return html;
}

// ---- Interfaces ----

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

// ---- SQL Parsing Helpers ----

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

// ---- Parsers ----

function parseMembers(): ForumMember[] {
  const members: ForumMember[] = [];
  // Column order: id_member(0), member_name(1), date_registered(2), posts(3), ..., real_name(7), ..., email_address(17)
  const insertRegex = /INSERT INTO `gbk_members`[^V]+VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    const startPos = insertMatch.index + insertMatch[0].length;
    let endPos = findInsertEnd(startPos);
    const section = content.substring(startPos, endPos);

    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;

      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;

      const v = record.values;
      if (v.length >= 18) {
        const id = toInt(v[0]);
        const username = String(v[1] || '');
        const dateReg = toInt(v[2]);
        const posts = toInt(v[3]);
        const realName = String(v[7] || username);
        const email = String(v[17] || '');

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

function parseBoards(): ForumBoard[] {
  const boards: ForumBoard[] = [];
  // Column order: id_board(0), id_cat(1), ..., name(9), description(10)
  const insertRegex = /INSERT INTO `gbk_boards`[^V]+VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    const startPos = insertMatch.index + insertMatch[0].length;
    let endPos = findInsertEnd(startPos);
    const section = content.substring(startPos, endPos);

    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;

      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;

      const v = record.values;
      if (v.length >= 11) {
        boards.push({
          id: toInt(v[0]),
          catId: toInt(v[1]),
          name: String(v[9] || `Board ${v[0]}`),
          description: String(v[10] || ''),
        });
      }
    }
  }

  return boards;
}

function parseTopics(): ForumTopic[] {
  const topics: ForumTopic[] = [];
  // Column order: id_topic(0), is_sticky(1), id_board(2), id_first_msg(3), id_last_msg(4), ..., num_replies(10)
  const insertRegex = /INSERT INTO `gbk_topics`[^V]+VALUES\s*/g;
  let insertMatch;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    const startPos = insertMatch.index + insertMatch[0].length;
    let endPos = findInsertEnd(startPos);
    const section = content.substring(startPos, endPos);

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
  // Column order for superzta_forum_gbk.sql:
  // id_msg(0), id_topic(1), id_board(2), poster_time(3), id_member(4),
  // id_msg_modified(5), subject(6), poster_name(7), poster_email(8),
  // poster_ip(9), smileys_enabled(10), modified_time(11), modified_name(12),
  // modified_reason(13), body(14), icon(15), approved(16), likes(17)

  console.log('  Recherche des INSERT INTO gbk_messages...');

  const insertRegex = /INSERT INTO `gbk_messages`[^V]+VALUES\s*/g;
  let insertMatch;
  let insertCount = 0;

  while ((insertMatch = insertRegex.exec(content)) !== null) {
    insertCount++;
    const startPos = insertMatch.index + insertMatch[0].length;
    let endPos = findInsertEnd(startPos);
    const section = content.substring(startPos, endPos);

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
        const body = String(v[14] || ''); // INDEX 14 pour superzta_forum_gbk.sql

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

// ---- Helpers ----

function toInt(val: string | number | null): number {
  if (typeof val === 'number') return Math.floor(val);
  return parseInt(String(val), 10) || 0;
}

function findInsertEnd(startPos: number): number {
  let pos = startPos;
  let inString = false;
  let escapeNext = false;

  while (pos < content.length) {
    if (escapeNext) { escapeNext = false; pos++; continue; }
    const char = content[pos];
    if (char === '\\') { escapeNext = true; }
    else if (char === "'" && !escapeNext) { inString = !inString; }
    else if (char === ';' && !inString) { break; }
    pos++;
  }

  return pos;
}

// ---- Main Import ----

async function importForum() {
  console.log('=== IMPORT DU FORUM GBK DANS SPOK (v3 - optimisé) ===\n');

  // 1. Parse SQL
  console.log('1. Parsing du fichier SQL...');
  const members = parseMembers();
  const boards = parseBoards();
  const topics = parseTopics();

  console.log(`  - ${members.length} membres actifs`);
  console.log(`  - ${boards.length} boards`);
  console.log(`  - ${topics.length} topics`);

  console.log('\n   Parsing des messages...');
  const messages = parseMessages();

  // 2. Vérifier la communauté
  console.log('\n2. Vérification de la communauté...');
  const community = await prisma.community.findUnique({
    where: { id: COMMUNITY_ID }
  });

  if (!community) {
    console.error(`ERREUR: Communauté ${COMMUNITY_ID} non trouvée!`);
    process.exit(1);
  }
  console.log(`  Communauté: "${community.name}" (${community.id})`);

  // 3. Charger l'état existant en mémoire
  console.log('\n3. Chargement de l\'état existant...');

  // Charger tous les items de la communauté forum
  const existingSpaces = await prisma.space.findMany({
    where: { communityId: COMMUNITY_ID },
    select: { id: true, name: true },
  });
  const spaceIds = existingSpaces.map(s => s.id);

  const existingItems = await prisma.item.findMany({
    where: { spaceId: { in: spaceIds }, type: 'NOTE' },
    select: { id: true, title: true, content: true, spaceId: true },
  });

  // Construire un index forumTopicId → item
  const itemByTopicId = new Map<number, { id: string; title: string; spaceId: string }>();
  for (const item of existingItems) {
    const c = item.content as Record<string, unknown> | null;
    if (c && typeof c.forumTopicId === 'number') {
      itemByTopicId.set(c.forumTopicId, { id: item.id, title: item.title, spaceId: item.spaceId });
    }
  }

  // Charger les contributions existantes (juste les IDs d'items qui en ont)
  const existingContribCounts = await prisma.contribution.groupBy({
    by: ['itemId'],
    where: { itemId: { in: existingItems.map(i => i.id) } },
    _count: { id: true },
  });
  const contribCountByItemId = new Map<string, number>();
  for (const c of existingContribCounts) {
    contribCountByItemId.set(c.itemId, c._count.id);
  }

  console.log(`  - ${existingSpaces.length} espaces existants`);
  console.log(`  - ${existingItems.length} items existants`);
  console.log(`  - ${itemByTopicId.size} items avec forumTopicId`);
  console.log(`  - ${existingContribCounts.reduce((s, c) => s + c._count.id, 0)} contributions existantes`);

  // 3b. Groupement des messages par topic (utilisé pour conversion + import)
  console.log('\n3b. Groupement des messages par topic...');
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

  // 3c. Convertir les items existants de BBCode brut → HTML si nécessaire
  console.log('\n3c. Conversion BBCode → HTML des items existants...');

  let convertedItems = 0;
  let convertedContribs = 0;

  for (const item of existingItems) {
    const c = item.content as Record<string, unknown> | null;
    if (!c || !c.forumTopicId) continue;

    // Si déjà en HTML, passer
    if (c.isHtml === true) continue;

    const topicId = c.forumTopicId as number;
    const topicMsgs = messagesByTopic.get(topicId);
    if (!topicMsgs || topicMsgs.length === 0) continue;

    // Convertir la description (premier message)
    const firstMsg = topicMsgs[0];
    const htmlDescription = bbcodeToHtml(firstMsg.body);

    await prisma.item.update({
      where: { id: item.id },
      data: {
        description: htmlDescription,
        content: { forumTopicId: topicId, forumBoardId: firstMsg.boardId, isHtml: true },
      },
    });
    convertedItems++;

    // Convertir les contributions existantes de cet item
    const existingContribs = await prisma.contribution.findMany({
      where: { itemId: item.id },
      select: { id: true, content: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const contrib of existingContribs) {
      // Vérifier si c'est déjà du HTML (contient des balises HTML)
      if (contrib.content.includes('<strong>') || contrib.content.includes('<br>') || contrib.content.includes('<blockquote')) {
        continue;
      }
      // Convertir BBCode → HTML
      const htmlContent = bbcodeToHtml(contrib.content);
      if (htmlContent !== contrib.content) {
        await prisma.contribution.update({
          where: { id: contrib.id },
          data: { content: htmlContent },
        });
        convertedContribs++;
      }
    }

    if (convertedItems % 100 === 0 && convertedItems > 0) {
      console.log(`    Convertis: ${convertedItems} items, ${convertedContribs} contributions`);
    }
  }

  console.log(`  - ${convertedItems} items convertis en HTML`);
  console.log(`  - ${convertedContribs} contributions converties en HTML`);

  // 4. Admin user
  console.log('\n4. Recherche de l\'utilisateur admin...');
  const adminUser = await prisma.user.findFirst({
    where: { email: 'roedelt@hotmail.com' }
  });

  if (!adminUser) {
    console.error('ERREUR: Admin user non trouvé!');
    process.exit(1);
  }
  console.log(`  Admin: ${adminUser.name} (${adminUser.id})`);

  // 5. User mapping
  console.log('\n5. Gestion des utilisateurs...');
  const allUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
  });

  const userByEmail = new Map<string, string>();
  const userByName = new Map<string, string>();
  for (const u of allUsers) {
    userByEmail.set(u.email, u.id);
    userByName.set(u.name, u.id);
  }

  const userMap = new Map<number, string>();
  userMap.set(1, adminUser.id);

  // Charger les memberships communauté existants
  const existingCommunityMemberships = await prisma.communityMembership.findMany({
    where: { communityId: COMMUNITY_ID },
    select: { userId: true },
  });
  const communityMemberIds = new Set(existingCommunityMemberships.map(m => m.userId));

  let newUsers = 0;
  let newCommunityMembers = 0;

  const bcrypt = await import('bcrypt');
  const defaultHash = await bcrypt.hash('changeme123', 10);

  for (const member of members) {
    if (member.id === 1) continue;

    // Chercher l'utilisateur existant
    let userId = userByEmail.get(member.email) || userByName.get(member.username);

    if (!userId) {
      // Créer l'utilisateur
      const email = member.email.includes('@') ? member.email : `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}@forum-import.local`;

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
        newUsers++;
      } catch {
        try {
          const user = await prisma.user.create({
            data: {
              email: `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${member.id}@forum-import.local`,
              name: member.username,
              passwordHash: defaultHash,
              globalRole: 'USER',
            }
          });
          userId = user.id;
          newUsers++;
        } catch {
          // Utilisateur probablement déjà existant avec un nom différent, utiliser admin
          userId = adminUser.id;
        }
      }
    }

    userMap.set(member.id, userId);

    // Ajouter à la communauté si pas encore membre
    if (!communityMemberIds.has(userId)) {
      try {
        await prisma.communityMembership.create({
          data: { userId, communityId: COMMUNITY_ID, role: 'MEMBER' },
        });
        communityMemberIds.add(userId);
        newCommunityMembers++;
      } catch {
        // Déjà membre
      }
    }
  }

  console.log(`  - ${userMap.size} utilisateurs mappés`);
  console.log(`  - ${newUsers} nouveaux utilisateurs créés`);
  console.log(`  - ${newCommunityMembers} nouveaux membres communauté`);

  // 6. Space mapping
  console.log('\n6. Gestion des espaces...');
  const spaceByName = new Map<string, string>();
  for (const s of existingSpaces) {
    spaceByName.set(s.name, s.id);
  }

  const spaceMap = new Map<number, string>();
  let newSpaces = 0;

  for (const board of boards) {
    const boardName = board.name || `Forum ${board.id}`;
    let spaceId = spaceByName.get(boardName);

    if (!spaceId) {
      const space = await prisma.space.create({
        data: {
          name: boardName,
          type: 'GROUP',
          communityId: COMMUNITY_ID,
        }
      });
      spaceId = space.id;
      spaceByName.set(boardName, spaceId);

      await prisma.spaceMembership.create({
        data: { userId: adminUser.id, spaceId, role: 'OWNER' },
      });

      newSpaces++;
      console.log(`  + Créé: ${boardName}`);
    }

    spaceMap.set(board.id, spaceId);
  }

  // Default space
  let defaultSpaceId = spaceByName.get('Forum Général');
  if (!defaultSpaceId) {
    const defaultSpace = await prisma.space.create({
      data: { name: 'Forum Général', type: 'GROUP', communityId: COMMUNITY_ID },
    });
    defaultSpaceId = defaultSpace.id;
    await prisma.spaceMembership.create({
      data: { userId: adminUser.id, spaceId: defaultSpaceId, role: 'OWNER' },
    });
    newSpaces++;
  }

  console.log(`  - ${spaceMap.size} boards mappés`);
  console.log(`  - ${newSpaces} nouveaux espaces`);

  // 7. Import topics and contributions
  console.log('\n7. Import des topics et contributions...\n');

  let createdTopics = 0;
  let skippedTopics = 0;
  let existingTopicsCompleted = 0;
  let createdContributions = 0;
  let skippedContributions = 0;
  let batchBuffer: Array<{
    content: string;
    itemId: string;
    authorId: string;
    createdAt: Date;
  }> = [];

  async function flushBatch() {
    if (batchBuffer.length === 0) return;
    await prisma.contribution.createMany({ data: batchBuffer });
    createdContributions += batchBuffer.length;
    batchBuffer = [];
  }

  const totalTopics = topics.length;

  for (let t = 0; t < topics.length; t++) {
    const topic = topics[t];
    const topicMessages = messagesByTopic.get(topic.id) || [];

    if (topicMessages.length === 0) {
      skippedTopics++;
      continue;
    }

    const firstMessage = topicMessages[0];
    const spaceId = spaceMap.get(topic.boardId) || defaultSpaceId;
    const creatorId = userMap.get(firstMessage.memberId) || adminUser.id;

    // Vérifier si le topic existe déjà (par forumTopicId)
    const existing = itemByTopicId.get(topic.id);

    if (existing) {
      // Topic existe - compléter les contributions manquantes
      const existingContribs = contribCountByItemId.get(existing.id) || 0;
      const expectedContribs = topicMessages.length - 1; // sans le premier message

      if (existingContribs >= expectedContribs) {
        existingTopicsCompleted++;
        skippedContributions += expectedContribs;
        continue;
      }

      // Il manque des contributions - les recréer toutes manquantes
      // Charger les contributions existantes pour ce topic
      const existingContribsList = await prisma.contribution.findMany({
        where: { itemId: existing.id },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const existingDates = new Set(existingContribsList.map(c => c.createdAt.getTime()));

      for (let i = 1; i < topicMessages.length; i++) {
        const msg = topicMessages[i];
        if (!msg.body.trim()) continue;

        // Vérifier si cette contribution existe déjà (par date)
        if (existingDates.has(msg.posterTime.getTime())) {
          skippedContributions++;
          continue;
        }

        const authorId = userMap.get(msg.memberId) || adminUser.id;
        batchBuffer.push({
          content: bbcodeToHtml(msg.body),
          itemId: existing.id,
          authorId,
          createdAt: msg.posterTime,
        });

        if (batchBuffer.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }

      existingTopicsCompleted++;
      continue;
    }

    // Créer le topic (item) avec conversion BBCode → HTML
    const htmlDescription = bbcodeToHtml(firstMessage.body);
    const item = await prisma.item.create({
      data: {
        type: 'NOTE',
        title: firstMessage.subject || `Topic ${topic.id}`,
        description: htmlDescription,
        content: { forumTopicId: topic.id, forumBoardId: topic.boardId, isHtml: true },
        spaceId,
        createdById: creatorId,
        createdAt: firstMessage.posterTime,
      }
    });

    createdTopics++;
    itemByTopicId.set(topic.id, { id: item.id, title: item.title, spaceId: item.spaceId });

    // Créer les contributions en batch (avec conversion BBCode → HTML)
    for (let i = 1; i < topicMessages.length; i++) {
      const msg = topicMessages[i];
      if (!msg.body.trim()) continue;

      const authorId = userMap.get(msg.memberId) || adminUser.id;
      batchBuffer.push({
        content: bbcodeToHtml(msg.body),
        itemId: item.id,
        authorId,
        createdAt: msg.posterTime,
      });

      if (batchBuffer.length >= BATCH_SIZE) {
        await flushBatch();
      }
    }

    // Progress
    if (createdTopics % 200 === 0) {
      await flushBatch();
      console.log(`  [${t + 1}/${totalTopics}] ${createdTopics} topics créés, ${createdContributions} contributions`);
    }
  }

  // Flush remaining
  await flushBatch();

  // 9. Résumé
  console.log(`\n=== IMPORT TERMINÉ ===`);
  console.log(`  Messages parsés:               ${messages.length}`);
  console.log(`  Topics source:                 ${topics.length}`);
  console.log(`  Topics sans messages:          ${skippedTopics}`);
  console.log(`  Topics déjà complets:          ${existingTopicsCompleted}`);
  console.log(`  Topics créés:                  ${createdTopics}`);
  console.log(`  Contributions créées:          ${createdContributions}`);
  console.log(`  Contributions ignorées:        ${skippedContributions}`);
  console.log(`  Utilisateurs mappés:           ${userMap.size}`);
  console.log(`  Espaces:                       ${spaceMap.size}`);

  // 10. Vérification finale
  console.log('\n=== VÉRIFICATION ===');
  const finalItemCount = await prisma.item.count({
    where: { spaceId: { in: spaceIds }, type: 'NOTE' },
  });
  const finalContribCount = await prisma.contribution.count({
    where: { item: { spaceId: { in: spaceIds } } },
  });

  console.log(`  Items NOTE total:              ${finalItemCount}`);
  console.log(`  Contributions total:           ${finalContribCount}`);

  // Board par board
  console.log('\n  Détail par board:');
  for (const board of boards) {
    const sid = spaceMap.get(board.id);
    if (!sid) continue;

    const topicsInBoard = topics.filter(t => t.boardId === board.id).length;
    const itemsInSpace = await prisma.item.count({
      where: { spaceId: sid, type: 'NOTE' },
    });

    const status = itemsInSpace >= topicsInBoard ? '✓' : `MANQUE ${topicsInBoard - itemsInSpace}`;
    console.log(`    ${board.name.padEnd(40)} source=${topicsInBoard}\timporté=${itemsInSpace}\t${status}`);
  }
}

importForum()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
