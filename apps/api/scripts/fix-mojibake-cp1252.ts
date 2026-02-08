/**
 * Fix CP1252 mojibake in items and contributions
 *
 * Problem: UTF-8 bytes interpreted as Windows-1252, then re-encoded as UTF-8.
 * Bytes 0x80-0x9F in CP1252 map to different Unicode code points (€, ‚, ƒ, „, etc.)
 * so the basic Latin-1 mojibake fixer misses them.
 *
 * Example: ゼ (U+30BC) = UTF-8 bytes E3 82 BC
 *   → CP1252 interprets as: ã (E3) ‚ (82→U+201A) ¼ (BC)
 *   → re-encoded to UTF-8: "ã‚¼" (mojibake)
 *
 * Usage: DATABASE_URL="..." pnpm exec tsx apps/api/scripts/fix-mojibake-cp1252.ts
 */

import { PrismaClient } from '@spok/database';
const prisma = new PrismaClient({ log: [] });

// Reverse map: CP1252 Unicode code point → original byte value
const CP1252_REVERSE: Record<number, number> = {
  0x20AC: 0x80, // €
  0x201A: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201E: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02C6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8A, // Š
  0x2039: 0x8B, // ‹
  0x0152: 0x8C, // Œ
  0x017D: 0x8E, // Ž
  0x2018: 0x91, // '
  0x2019: 0x92, // '
  0x201C: 0x93, // "
  0x201D: 0x94, // "
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02DC: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9A, // š
  0x203A: 0x9B, // ›
  0x0153: 0x9C, // œ
  0x017E: 0x9E, // ž
  0x0178: 0x9F, // Ÿ
};

// Convert a character back to its original byte value
function charToByte(ch: string): number | null {
  const code = ch.charCodeAt(0);
  // Standard Latin-1 range: code point = byte value
  if (code >= 0x00 && code <= 0xFF) return code;
  // CP1252 special range
  return CP1252_REVERSE[code] ?? null;
}

// Check if a character could represent a byte in 0x80-0xBF range
function isContinuationByte(ch: string): boolean {
  const b = charToByte(ch);
  return b !== null && b >= 0x80 && b <= 0xBF;
}

// Check if a character could represent a 2-byte UTF-8 lead (0xC0-0xDF)
function is2ByteLead(ch: string): boolean {
  const b = charToByte(ch);
  return b !== null && b >= 0xC0 && b <= 0xDF;
}

// Check if a character could represent a 3-byte UTF-8 lead (0xE0-0xEF)
function is3ByteLead(ch: string): boolean {
  const b = charToByte(ch);
  return b !== null && b >= 0xE0 && b <= 0xEF;
}

// Check if a character could represent a 4-byte UTF-8 lead (0xF0-0xF4)
function is4ByteLead(ch: string): boolean {
  const b = charToByte(ch);
  return b !== null && b >= 0xF0 && b <= 0xF4;
}

function fixMojibakeCP1252(text: string): string {
  if (!text) return text;
  let result = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // Try 3-byte sequence (most CJK characters)
    if (is3ByteLead(ch) && i + 2 < text.length && isContinuationByte(text[i + 1]) && isContinuationByte(text[i + 2])) {
      const b0 = charToByte(ch)!;
      const b1 = charToByte(text[i + 1])!;
      const b2 = charToByte(text[i + 2])!;
      try {
        const decoded = Buffer.from([b0, b1, b2]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          i += 3;
          continue;
        }
      } catch { /* fall through */ }
    }

    // Try 2-byte sequence (accented chars, etc.)
    if (is2ByteLead(ch) && i + 1 < text.length && isContinuationByte(text[i + 1])) {
      const b0 = charToByte(ch)!;
      const b1 = charToByte(text[i + 1])!;
      try {
        const decoded = Buffer.from([b0, b1]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          i += 2;
          continue;
        }
      } catch { /* fall through */ }
    }

    // Try 4-byte sequence (emoji, rare CJK)
    if (is4ByteLead(ch) && i + 3 < text.length && isContinuationByte(text[i + 1]) && isContinuationByte(text[i + 2]) && isContinuationByte(text[i + 3])) {
      const b0 = charToByte(ch)!;
      const b1 = charToByte(text[i + 1])!;
      const b2 = charToByte(text[i + 2])!;
      const b3 = charToByte(text[i + 3])!;
      try {
        const decoded = Buffer.from([b0, b1, b2, b3]).toString('utf8');
        if (!decoded.includes('\uFFFD')) {
          result += decoded;
          i += 4;
          continue;
        }
      } catch { /* fall through */ }
    }

    result += ch;
    i++;
  }

  return result;
}

async function main() {
  console.log('=== Fix CP1252 Mojibake ===\n');

  // Test with known case
  const test = 'Zero no Tsukaima (ã\u201A¼ã\u0192\u00ADã\u0081\u201Eé\u00AD\u201D)';
  console.log('Test input: ', test);
  console.log('Test output:', fixMojibakeCP1252(test));
  console.log('');

  // Find all items in MSF Forum Archive
  const community = await prisma.community.findFirst({ where: { name: 'MSF Forum Archive' } });
  if (!community) { console.log('Community not found'); return; }

  const items = await prisma.item.findMany({
    where: { space: { communityId: community.id } },
    select: { id: true, title: true, description: true }
  });
  console.log(`Items to scan: ${items.length}`);

  let fixedTitles = 0;
  let fixedDescriptions = 0;

  for (const item of items) {
    const newTitle = fixMojibakeCP1252(item.title);
    const newDesc = item.description ? fixMojibakeCP1252(item.description) : item.description;

    if (newTitle !== item.title || newDesc !== item.description) {
      await prisma.item.update({
        where: { id: item.id },
        data: {
          ...(newTitle !== item.title ? { title: newTitle } : {}),
          ...(newDesc !== item.description ? { description: newDesc } : {}),
        }
      });
      if (newTitle !== item.title) {
        console.log(`  Title: "${item.title}" → "${newTitle}"`);
        fixedTitles++;
      }
      if (newDesc !== item.description) fixedDescriptions++;
    }
  }

  console.log(`\nFixed titles: ${fixedTitles}`);
  console.log(`Fixed descriptions: ${fixedDescriptions}`);

  // Fix contributions
  console.log('\nScanning contributions...');
  const contributions = await prisma.contribution.findMany({
    where: { item: { space: { communityId: community.id } } },
    select: { id: true, content: true }
  });
  console.log(`Contributions to scan: ${contributions.length}`);

  let fixedContribs = 0;
  const contribUpdates: Array<{ id: string; content: string }> = [];

  for (const c of contributions) {
    const newContent = fixMojibakeCP1252(c.content);
    if (newContent !== c.content) {
      contribUpdates.push({ id: c.id, content: newContent });
    }
  }

  // Batch update
  for (const u of contribUpdates) {
    await prisma.contribution.update({ where: { id: u.id }, data: { content: u.content } });
    fixedContribs++;
    if (fixedContribs % 200 === 0) {
      console.log(`  Progress: ${fixedContribs}/${contribUpdates.length}...`);
    }
  }

  console.log(`Fixed contributions: ${fixedContribs}`);

  // Fix space names too
  const spaces = await prisma.space.findMany({
    where: { communityId: community.id },
    select: { id: true, name: true }
  });
  let fixedSpaces = 0;
  for (const s of spaces) {
    const newName = fixMojibakeCP1252(s.name);
    if (newName !== s.name) {
      await prisma.space.update({ where: { id: s.id }, data: { name: newName } });
      console.log(`  Space: "${s.name}" → "${newName}"`);
      fixedSpaces++;
    }
  }
  console.log(`Fixed spaces: ${fixedSpaces}`);

  console.log('\n=== DONE ===');
  await prisma.$disconnect();
}

main().catch(console.error);
