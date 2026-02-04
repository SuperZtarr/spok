import { prisma } from '@spok/database';
import * as fs from 'fs';
import bcrypt from 'bcrypt';

const content = fs.readFileSync('C:/_dev/spok/ex forum.sql', 'utf8');

// ============ BBCODE TO HTML CONVERTER ============
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

  // Decode entities
  html = html.replace(/&amp;nbsp;/g, ' ');
  html = html.replace(/&amp;quot;/g, '"');
  html = html.replace(/&amp;amp;/g, '&');

  return html;
}

// ============ SQL PARSER ============
function parseSqlString(str: string, startPos: number): { value: string; endPos: number } | null {
  if (str[startPos] !== "'") return null;
  let result = '', i = startPos + 1;
  while (i < str.length) {
    if (str[i] === '\\' && i + 1 < str.length) {
      const next = str[i + 1];
      if (next === "'") { result += "'"; i += 2; }
      else if (next === '\\') { result += '\\'; i += 2; }
      else if (next === 'n') { result += '\n'; i += 2; }
      else if (next === 'r') { result += '\r'; i += 2; }
      else if (next === 't') { result += '\t'; i += 2; }
      else { result += str[i + 1]; i += 2; }
    } else if (str[i] === "'" && str[i + 1] === "'") { result += "'"; i += 2; }
    else if (str[i] === "'") { return { value: result, endPos: i + 1 }; }
    else { result += str[i]; i++; }
  }
  return null;
}

function parseSqlValue(str: string, startPos: number): { value: string | number | null; endPos: number } | null {
  let i = startPos;
  while (i < str.length && /\s/.test(str[i])) i++;
  if (i >= str.length) return null;
  if (str[i] === "'") { const r = parseSqlString(str, i); if (r) return r; return null; }
  if (str[i] === '0' && str[i + 1] === 'x') { let j = i + 2; while (j < str.length && /[0-9a-fA-F]/.test(str[j])) j++; return { value: str.substring(i, j), endPos: j }; }
  if (str.substring(i, i + 4).toUpperCase() === 'NULL') { return { value: null, endPos: i + 4 }; }
  let j = i; if (str[j] === '-') j++;
  while (j < str.length && /[0-9.]/.test(str[j])) j++;
  if (j > i) { const num = parseFloat(str.substring(i, j)); return { value: isNaN(num) ? 0 : num, endPos: j }; }
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
    if (str[i] === ')') { return { values, endPos: i + 1 }; }
    const result = parseSqlValue(str, i);
    if (!result) { while (i < str.length && str[i] !== ',' && str[i] !== ')') i++; values.push(null); }
    else { values.push(result.value); i = result.endPos; }
    while (i < str.length && /\s/.test(str[i])) i++;
    if (str[i] === ',') { i++; } else if (str[i] === ')') { return { values, endPos: i + 1 }; }
  }
  return null;
}

function findInsertEnd(str: string, startPos: number): number {
  let i = startPos, inString = false, escapeNext = false;
  while (i < str.length) {
    if (escapeNext) { escapeNext = false; i++; continue; }
    if (str[i] === '\\') escapeNext = true;
    else if (str[i] === "'" && !escapeNext) inString = !inString;
    else if (str[i] === ';' && !inString) return i;
    i++;
  }
  return i;
}

// ============ TYPES ============
interface ForumMember { id: number; username: string; email: string; posts: number; }
interface ForumBoard { id: number; name: string; }
interface ForumTopic { id: number; boardId: number; }
interface ForumMessage { id: number; topicId: number; boardId: number; posterTime: Date; memberId: number; subject: string; body: string; }

// ============ PARSERS ============
function parseMembers(): ForumMember[] {
  const members: ForumMember[] = [];
  const realNames = new Map<number, { name: string; email: string }>();

  const match = content.match(/INSERT INTO `gbk_members`[^V]+VALUES\s*/);
  if (!match) return members;
  const startPos = match.index! + match[0].length;
  const endPos = findInsertEnd(content, startPos);
  const section = content.substring(startPos, endPos);
  let pos = 0;

  // First pass: collect real member names (non-numeric with email)
  while (pos < section.length) {
    while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
    if (pos >= section.length) break;
    const record = parseSqlRecord(section, pos);
    if (!record) { pos++; continue; }
    pos = record.endPos;
    const v = record.values;
    if (v.length >= 17) {
      const id = Number(v[0]);
      const username = String(v[1] || '');
      const posts = Number(v[3]);
      const email = String(v[16] || '');

      // Store real names (non-numeric usernames with emails)
      if (!isNaN(id) && username && !/^\d+$/.test(username) && email) {
        realNames.set(id, { name: username, email });
      }

      // Include all members with posts
      if (!isNaN(id) && posts > 0) {
        // Use real name if available, otherwise use what we have
        const realData = realNames.get(id);
        members.push({
          id,
          username: realData?.name || username,
          email: realData?.email || email || `user_${id}@forum-import.local`,
          posts
        });
      }
    }
  }

  // Update members with real names found later
  for (const member of members) {
    const realData = realNames.get(member.id);
    if (realData) {
      member.username = realData.name;
      member.email = realData.email;
    }
  }

  return members;
}

function parseBoards(): ForumBoard[] {
  const boards: ForumBoard[] = [];
  const match = content.match(/INSERT INTO `gbk_boards`[^V]+VALUES\s*/);
  if (!match) return boards;
  const startPos = match.index! + match[0].length;
  const endPos = findInsertEnd(content, startPos);
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
      const id = Number(v[0]);
      const name = String(v[9] || '').trim();
      if (!isNaN(id) && name) { boards.push({ id, name }); }
    }
  }
  return boards;
}

function parseTopics(): ForumTopic[] {
  const topics: ForumTopic[] = [];
  const regex = /INSERT INTO `gbk_topics`[^V]+VALUES\s*/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;
    const endPos = findInsertEnd(content, startPos);
    const section = content.substring(startPos, endPos);
    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;
      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;
      const v = record.values;
      if (v.length >= 2) {
        const id = Number(v[0]);
        const boardId = Number(v[2]);
        if (!isNaN(id) && !isNaN(boardId)) { topics.push({ id, boardId }); }
      }
    }
  }
  return topics;
}

function parseMessages(): ForumMessage[] {
  const messages: ForumMessage[] = [];
  const regex = /INSERT INTO `gbk_messages`[^V]+VALUES\s*/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startPos = match.index + match[0].length;
    const endPos = findInsertEnd(content, startPos);
    const section = content.substring(startPos, endPos);
    let pos = 0;
    while (pos < section.length) {
      while (pos < section.length && /[\s,]/.test(section[pos])) pos++;
      if (pos >= section.length) break;
      const record = parseSqlRecord(section, pos);
      if (!record) { pos++; continue; }
      pos = record.endPos;
      const v = record.values;
      if (v.length >= 15) {
        const id = Number(v[0]);
        const topicId = Number(v[1]);
        const boardId = Number(v[2]);
        const posterTime = new Date(Number(v[3]) * 1000);
        const memberId = Number(v[4]);
        const subject = String(v[5] || '');
        const body = String(v[14] || '');
        if (!isNaN(id) && !isNaN(topicId)) {
          messages.push({ id, topicId, boardId, posterTime, memberId, subject, body });
        }
      }
    }
  }
  return messages;
}

// ============ MAIN ============
async function main() {
  console.log('=== RÉIMPORT FORUM AVEC CONVERSION HTML ===\n');

  // 1. Parse data
  console.log('1. Parsing du fichier SQL...');
  const members = parseMembers();
  const boards = parseBoards();
  const topics = parseTopics();
  const messages = parseMessages();

  console.log(`   Membres: ${members.length}`);
  console.log(`   Boards: ${boards.length}`);
  console.log(`   Topics: ${topics.length}`);
  console.log(`   Messages: ${messages.length}`);

  // 2. Delete existing
  console.log('\n2. Suppression des données existantes...');
  const oldCommunity = await prisma.community.findFirst({ where: { name: 'MSF Forum Archive' } });
  if (oldCommunity) {
    await prisma.space.deleteMany({ where: { communityId: oldCommunity.id } });
    await prisma.communityMembership.deleteMany({ where: { communityId: oldCommunity.id } });
    await prisma.community.delete({ where: { id: oldCommunity.id } });
    console.log('   Données supprimées');
  }

  // 3. Admin user
  console.log('\n3. Configuration utilisateur admin...');
  let adminUser = await prisma.user.findFirst({ where: { email: 'superztarr@gmail.com' } });
  if (!adminUser) {
    const hash = await bcrypt.hash('changeme123', 10);
    adminUser = await prisma.user.create({
      data: { email: 'superztarr@gmail.com', name: 'ztarr', passwordHash: hash, globalRole: 'ADMIN' }
    });
  }
  console.log(`   Admin: ${adminUser.name}`);

  // 4. Create community
  console.log('\n4. Création de la communauté...');
  const community = await prisma.community.create({
    data: { name: 'MSF Forum Archive', description: 'Archive du forum MSF (contenu HTML)' }
  });
  await prisma.communityMembership.create({
    data: { userId: adminUser.id, communityId: community.id, role: 'OWNER' }
  });

  // 5. Create users
  console.log('\n5. Création des utilisateurs...');
  const userMap = new Map<number, string>();
  userMap.set(1, adminUser.id);

  for (const member of members) {
    if (member.id === 1) continue;
    let user = await prisma.user.findFirst({
      where: { OR: [{ email: member.email }, { name: member.username }] }
    });
    if (!user) {
      const hash = await bcrypt.hash('changeme123', 10);
      try {
        user = await prisma.user.create({
          data: { email: member.email, name: member.username, passwordHash: hash, globalRole: 'USER' }
        });
      } catch {
        user = await prisma.user.create({
          data: { email: `${member.username.toLowerCase().replace(/[^a-z0-9]/g, '')}_${member.id}@forum-import.local`, name: member.username, passwordHash: hash, globalRole: 'USER' }
        });
      }
    }
    userMap.set(member.id, user.id);
    try {
      await prisma.communityMembership.create({ data: { userId: user.id, communityId: community.id, role: 'MEMBER' } });
    } catch { /* already member */ }
  }
  console.log(`   Utilisateurs: ${userMap.size}`);

  // 6. Create spaces
  console.log('\n6. Création des espaces...');
  const spaceMap = new Map<number, string>();
  for (const board of boards) {
    const space = await prisma.space.create({
      data: { name: board.name, type: 'GROUP', communityId: community.id }
    });
    await prisma.spaceMembership.create({ data: { userId: adminUser.id, spaceId: space.id, role: 'OWNER' } });
    spaceMap.set(board.id, space.id);
  }
  const defaultSpace = await prisma.space.create({
    data: { name: 'Forum Général', type: 'GROUP', communityId: community.id }
  });
  await prisma.spaceMembership.create({ data: { userId: adminUser.id, spaceId: defaultSpace.id, role: 'OWNER' } });
  console.log(`   Espaces: ${spaceMap.size + 1}`);

  // 7. Group messages by topic
  console.log('\n7. Groupement des messages...');
  const messagesByTopic = new Map<number, ForumMessage[]>();
  for (const msg of messages) {
    if (!messagesByTopic.has(msg.topicId)) messagesByTopic.set(msg.topicId, []);
    messagesByTopic.get(msg.topicId)!.push(msg);
  }
  for (const [, msgs] of messagesByTopic) { msgs.sort((a, b) => a.id - b.id); }

  // 8. Import with HTML conversion
  console.log('\n8. Import avec conversion HTML...');
  let importedTopics = 0, importedContributions = 0;

  for (const topic of topics) {
    const topicMessages = messagesByTopic.get(topic.id) || [];
    if (topicMessages.length === 0) continue;

    const firstMsg = topicMessages[0];
    const spaceId = spaceMap.get(topic.boardId) || defaultSpace.id;
    const creatorId = userMap.get(firstMsg.memberId) || adminUser.id;

    // Convert BBCode to HTML for description
    const htmlDescription = bbcodeToHtml(firstMsg.body);

    const item = await prisma.item.create({
      data: {
        type: 'NOTE',
        title: firstMsg.subject || `Topic ${topic.id}`,
        description: htmlDescription,
        content: { forumTopicId: topic.id, forumBoardId: topic.boardId, isHtml: true },
        spaceId,
        createdById: creatorId,
        createdAt: firstMsg.posterTime,
      }
    });
    importedTopics++;

    // Contributions with HTML conversion
    for (let i = 1; i < topicMessages.length; i++) {
      const msg = topicMessages[i];
      const authorId = userMap.get(msg.memberId) || adminUser.id;
      if (msg.body.trim()) {
        const htmlContent = bbcodeToHtml(msg.body);
        await prisma.contribution.create({
          data: { content: htmlContent, itemId: item.id, authorId, createdAt: msg.posterTime }
        });
        importedContributions++;
      }
    }

    if (importedTopics % 500 === 0) {
      console.log(`   Progression: ${importedTopics} topics, ${importedContributions} contributions`);
    }
  }

  console.log(`\n=== IMPORT TERMINÉ ===`);
  console.log(`   Topics importés: ${importedTopics}`);
  console.log(`   Contributions: ${importedContributions}`);
  console.log(`   Total messages: ${importedTopics + importedContributions}`);
  console.log(`   Format: HTML (converti depuis BBCode)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
