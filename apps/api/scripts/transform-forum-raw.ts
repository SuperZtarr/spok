/**
 * Transform raw forum tables into SPOK entities
 *
 * Source: forum_raw_categories, forum_raw_boards, forum_raw_members, forum_raw_messages, forum_raw_topics
 * Target: Community, User, Space, Item, Contribution, SpaceMembership, CommunityMembership
 *
 * Usage: DATABASE_URL="..." pnpm exec tsx apps/api/scripts/transform-forum-raw.ts
 */

import { PrismaClient } from '@spok/database';
import crypto from 'crypto';

const prisma = new PrismaClient({ log: [] });

const COMMUNITY_NAME = 'MSF Forum Archive';

// ── Text Transformation Functions ──

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
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function bbcodeToHtml(bbcode: string): string {
  if (!bbcode) return '';
  let html = bbcode;

  html = html.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  html = html.replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n');

  html = escapeHtml(html);

  // BBCode formatting
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>');
  html = html.replace(/\[hr\]/gi, '<hr class="my-2 border-border">');

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

  // Decode double-encoded entities
  html = html.replace(/&amp;nbsp;/g, ' ');
  html = html.replace(/&amp;quot;/g, '"');
  html = html.replace(/&amp;#039;/g, "'");
  html = html.replace(/&amp;amp;/g, '&');

  html = html.replace(/&#039;/g, "'");
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&amp;/g, '&');

  return html;
}

// Mojibake fix
function fixMojibake(text: string): string {
  return text.replace(
    /([\u00C0-\u00DF])([\u0080-\u00BF])|([\u00E0-\u00EF])([\u0080-\u00BF])([\u0080-\u00BF])/g,
    (...args) => {
      try {
        if (args[1] && args[2]) {
          const bytes = Buffer.from([args[1].charCodeAt(0), args[2].charCodeAt(0)]);
          const decoded = bytes.toString('utf8');
          if (!decoded.includes('\uFFFD')) return decoded;
        } else if (args[3] && args[4] && args[5]) {
          const bytes = Buffer.from([args[3].charCodeAt(0), args[4].charCodeAt(0), args[5].charCodeAt(0)]);
          const decoded = bytes.toString('utf8');
          if (!decoded.includes('\uFFFD')) return decoded;
        }
      } catch { /* keep original */ }
      return args[0];
    }
  );
}

// HTML entity decoder
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  Agrave: 'À', agrave: 'à', Aacute: 'Á', aacute: 'á', Acirc: 'Â', acirc: 'â', Atilde: 'Ã', atilde: 'ã', Auml: 'Ä', auml: 'ä',
  Ccedil: 'Ç', ccedil: 'ç',
  Egrave: 'È', egrave: 'è', Eacute: 'É', eacute: 'é', Ecirc: 'Ê', ecirc: 'ê', Euml: 'Ë', euml: 'ë',
  Igrave: 'Ì', igrave: 'ì', Iacute: 'Í', iacute: 'í', Icirc: 'Î', icirc: 'î', Iuml: 'Ï', iuml: 'ï',
  Ntilde: 'Ñ', ntilde: 'ñ',
  Ograve: 'Ò', ograve: 'ò', Oacute: 'Ó', oacute: 'ó', Ocirc: 'Ô', ocirc: 'ô', Otilde: 'Õ', otilde: 'õ', Ouml: 'Ö', ouml: 'ö',
  Ugrave: 'Ù', ugrave: 'ù', Uacute: 'Ú', uacute: 'ú', Ucirc: 'Û', ucirc: 'û', Uuml: 'Ü', uuml: 'ü',
  Yacute: 'Ý', yacute: 'ý', yuml: 'ÿ',
  laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿', copy: '©', reg: '®', trade: '™',
  deg: '°', plusmn: '±', micro: 'µ', para: '¶', middot: '·', bull: '•',
  ndash: '–', mdash: '—', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  hellip: '…', euro: '€', pound: '£', yen: '¥', cent: '¢',
  times: '×', divide: '÷', frac12: '½', frac14: '¼', frac34: '¾',
  OElig: 'Œ', oelig: 'œ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#') && !entity.startsWith('#x')) {
      const code = parseInt(entity.substring(1), 10);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = parseInt(entity.substring(2), 16);
      return isNaN(code) ? match : String.fromCharCode(code);
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

// Full pipeline: mojibake → entities → BBCode→HTML
function transformBody(raw: string): string {
  if (!raw) return '';
  let text = raw;
  text = fixMojibake(text);
  text = decodeEntities(text);
  text = bbcodeToHtml(text);
  return text;
}

function transformTitle(raw: string): string {
  if (!raw) return '';
  let text = raw;
  text = fixMojibake(text);
  text = decodeEntities(text);
  return text;
}

// ── Main ──

async function main() {
  console.log('=== Forum Raw → SPOK Transformation ===\n');

  // ── Step 1: Find or create community (resume-safe) ──
  console.log('1. Finding/creating community...');
  let existingCommunity = await prisma.community.findFirst({ where: { name: COMMUNITY_NAME } });

  // ── Step 2: Load raw data ──
  console.log('\n2. Loading raw tables...');
  const rawCategories = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM forum_raw_categories ORDER BY cat_order');
  const rawBoards = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM forum_raw_boards ORDER BY id_board');
  const rawMembers = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM forum_raw_members ORDER BY id_member');
  const rawTopics = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM forum_raw_topics ORDER BY id_topic');
  const rawMessages = await prisma.$queryRawUnsafe<any[]>('SELECT * FROM forum_raw_messages ORDER BY id_msg');

  console.log(`   Categories: ${rawCategories.length}`);
  console.log(`   Boards: ${rawBoards.length}`);
  console.log(`   Members: ${rawMembers.length}`);
  console.log(`   Topics: ${rawTopics.length}`);
  console.log(`   Messages: ${rawMessages.length}`);

  // Index messages by id_msg and by id_topic
  const messageById = new Map<number, any>();
  const messagesByTopic = new Map<number, any[]>();
  for (const m of rawMessages) {
    messageById.set(m.id_msg, m);
    const list = messagesByTopic.get(m.id_topic) || [];
    list.push(m);
    messagesByTopic.set(m.id_topic, list);
  }

  // ── Step 3: Create Community if needed ──
  console.log('\n3. Community...');
  const community = existingCommunity || await prisma.community.create({
    data: { name: COMMUNITY_NAME, description: 'Archive du forum MSF importée depuis SMF' }
  });
  console.log(`   Community: ${community.id} (${existingCommunity ? 'existing' : 'created'})`);

  // ── Step 4: Create/Find Users ──
  console.log('\n4. Creating users...');

  // Collect all unique poster identities
  const memberById = new Map<number, any>();
  for (const m of rawMembers) memberById.set(m.id_member, m);

  // Find all distinct poster_name for id_member=0 (guests) or orphan members
  const guestNames = new Set<string>();
  for (const m of rawMessages) {
    if (m.id_member === 0 || !memberById.has(m.id_member)) {
      if (m.poster_name && m.poster_name.trim()) {
        guestNames.add(m.poster_name.trim());
      }
    }
  }

  // Create users for registered members
  const userByMemberId = new Map<number, string>(); // forum id_member → SPOK user id
  const userByName = new Map<string, string>(); // poster_name lowercase → SPOK user id
  const dummyPassword = crypto.randomBytes(32).toString('hex');

  for (const member of rawMembers) {
    const name = transformTitle(member.real_name || member.member_name);
    const email = member.email_address || `forum-${member.id_member}@spok.local`;

    // Check if user already exists by email
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name, passwordHash: dummyPassword }
      });
    }
    userByMemberId.set(member.id_member, user.id);
    userByName.set(member.member_name.toLowerCase(), user.id);
    if (member.real_name) userByName.set(member.real_name.toLowerCase(), user.id);
  }
  console.log(`   Registered members: ${userByMemberId.size} users`);

  // Create users for guests (poster_name only, no member record)
  let guestCount = 0;
  for (const guestName of guestNames) {
    if (userByName.has(guestName.toLowerCase())) continue;
    const email = `forum-guest-${guestName.toLowerCase().replace(/[^a-z0-9]/g, '_')}@spok.local`;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email, name: transformTitle(guestName), passwordHash: dummyPassword }
      });
      guestCount++;
    }
    userByName.set(guestName.toLowerCase(), user.id);
  }
  console.log(`   Guest users created: ${guestCount}`);

  // Fallback user for messages with no identifiable author
  const fallbackEmail = 'forum-unknown@spok.local';
  let fallbackUser = await prisma.user.findUnique({ where: { email: fallbackEmail } });
  if (!fallbackUser) {
    fallbackUser = await prisma.user.create({
      data: { email: fallbackEmail, name: 'Membre inconnu', passwordHash: dummyPassword }
    });
  }

  // Helper to resolve author
  function resolveAuthor(msg: any): string {
    if (msg.id_member > 0 && userByMemberId.has(msg.id_member)) {
      return userByMemberId.get(msg.id_member)!;
    }
    if (msg.poster_name) {
      const uid = userByName.get(msg.poster_name.trim().toLowerCase());
      if (uid) return uid;
    }
    return fallbackUser!.id;
  }

  // ── Step 5: Community Memberships ──
  console.log('\n5. Creating community memberships...');
  const allUserIds = new Set([...userByMemberId.values(), ...userByName.values(), fallbackUser.id]);
  let cmCount = 0;
  for (const userId of allUserIds) {
    await prisma.communityMembership.create({
      data: { userId, communityId: community.id, role: 'MEMBER' }
    }).catch(() => {}); // ignore duplicates
    cmCount++;
  }
  console.log(`   Community memberships: ${cmCount}`);

  // ── Step 6: Create Spaces (from boards) ──
  console.log('\n6. Creating spaces...');
  const catById = new Map<number, string>();
  for (const c of rawCategories) catById.set(c.id_cat, c.name);

  // Index boards by id for parent lookup
  const boardById = new Map<number, any>();
  for (const b of rawBoards) boardById.set(b.id_board, b);

  // Load existing spaces in this community to resume
  const existingSpaces = await prisma.space.findMany({
    where: { communityId: community.id },
    select: { id: true, name: true }
  });
  const existingSpaceByName = new Map<string, string>();
  for (const s of existingSpaces) existingSpaceByName.set(s.name, s.id);

  const spaceByBoardId = new Map<number, string>(); // board id → SPOK space id
  let spacesCreated = 0;
  for (const board of rawBoards) {
    let spaceName = transformTitle(board.name);
    // Prefix with parent board name if board has a parent (to avoid duplicates)
    if (board.id_parent > 0) {
      const parent = boardById.get(board.id_parent);
      if (parent) {
        spaceName = `${transformTitle(parent.name)} > ${spaceName}`;
      }
    }
    // Reuse existing space or create
    const existingId = existingSpaceByName.get(spaceName);
    if (existingId) {
      spaceByBoardId.set(board.id_board, existingId);
    } else {
      const space = await prisma.space.create({
        data: { name: spaceName, type: 'GROUP', communityId: community.id }
      });
      spaceByBoardId.set(board.id_board, space.id);
      spacesCreated++;
    }
  }
  console.log(`   Spaces: ${existingSpaces.length} existing, ${spacesCreated} created`);

  // ── Step 7: Create Items (from topics) + Contributions (from messages) ──
  console.log('\n7. Creating items and contributions...');

  // Load already-imported topic IDs to resume safely
  const existingItems = await prisma.item.findMany({
    where: { space: { communityId: community.id } },
    select: { content: true }
  });
  const importedTopicIds = new Set<number>();
  for (const item of existingItems) {
    const c = item.content as any;
    if (c?.forumTopicId) importedTopicIds.add(c.forumTopicId);
  }
  console.log(`   Already imported: ${importedTopicIds.size} topics`);

  let itemCount = 0;
  let contribCount = 0;
  let skipCount = 0;

  // Batch contributions for performance
  const contribBatch: Array<{ content: string; itemId: string; authorId: string; createdAt: Date }> = [];

  for (const topic of rawTopics) {
    // Skip already imported topics
    if (importedTopicIds.has(topic.id_topic)) continue;

    const spaceId = spaceByBoardId.get(topic.id_board);
    if (!spaceId) {
      skipCount++;
      continue;
    }

    const topicMessages = messagesByTopic.get(topic.id_topic) || [];
    if (topicMessages.length === 0) {
      skipCount++;
      continue;
    }

    // Sort messages by id_msg (chronological)
    topicMessages.sort((a, b) => a.id_msg - b.id_msg);

    // First message = item description
    const firstMsg = topicMessages[0];
    const title = transformTitle(firstMsg.subject || `Topic ${topic.id_topic}`);
    const description = transformBody(firstMsg.body || '');
    const authorId = resolveAuthor(firstMsg);
    const createdAt = new Date(Number(firstMsg.poster_time) * 1000);

    const item = await prisma.item.create({
      data: {
        type: 'NOTE',
        title,
        description,
        spaceId,
        createdById: authorId,
        createdAt,
        content: { forumTopicId: topic.id_topic, forumBoardId: topic.id_board, isHtml: true },
      }
    });
    itemCount++;

    // Remaining messages = contributions
    for (let i = 1; i < topicMessages.length; i++) {
      const msg = topicMessages[i];
      contribBatch.push({
        content: transformBody(msg.body || ''),
        itemId: item.id,
        authorId: resolveAuthor(msg),
        createdAt: new Date(Number(msg.poster_time) * 1000),
      });
    }

    // Flush batch every 200 contributions
    if (contribBatch.length >= 200) {
      await prisma.contribution.createMany({ data: contribBatch });
      contribCount += contribBatch.length;
      contribBatch.length = 0;
    }

    if (itemCount % 200 === 0) {
      console.log(`   Progress: ${itemCount} new items, ${contribCount} new contributions...`);
    }
  }

  // Flush remaining contributions
  if (contribBatch.length > 0) {
    await prisma.contribution.createMany({ data: contribBatch });
    contribCount += contribBatch.length;
  }

  console.log(`   New items created: ${itemCount}`);
  console.log(`   New contributions created: ${contribCount}`);
  console.log(`   Total items: ${importedTopicIds.size + itemCount}`);
  console.log(`   Topics skipped (no space/messages): ${skipCount}`);

  // ── Step 8: Space Memberships ──
  console.log('\n8. Creating space memberships...');
  // For each space, find distinct authors who posted there
  const spaceAuthors = new Map<string, Set<string>>();
  for (const topic of rawTopics) {
    const spaceId = spaceByBoardId.get(topic.id_board);
    if (!spaceId) continue;
    const topicMessages = messagesByTopic.get(topic.id_topic) || [];
    for (const msg of topicMessages) {
      const authorId = resolveAuthor(msg);
      if (!spaceAuthors.has(spaceId)) spaceAuthors.set(spaceId, new Set());
      spaceAuthors.get(spaceId)!.add(authorId);
    }
  }

  let smCount = 0;
  for (const [spaceId, authors] of spaceAuthors) {
    for (const userId of authors) {
      await prisma.spaceMembership.create({
        data: { userId, spaceId, role: 'MEMBER' }
      }).catch(() => {}); // ignore duplicates
      smCount++;
    }
  }
  console.log(`   Space memberships: ${smCount}`);

  // ── Summary ──
  console.log('\n=== DONE ===');
  console.log(`Community: ${COMMUNITY_NAME} (${community.id})`);
  console.log(`Users: ${allUserIds.size} (${rawMembers.length} members + ${guestCount} guests + 1 fallback)`);
  console.log(`Spaces: ${spaceByBoardId.size}`);
  console.log(`Items: ${itemCount}`);
  console.log(`Contributions: ${contribCount}`);
  console.log(`Space memberships: ${smCount}`);
  console.log(`Community memberships: ${cmCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
