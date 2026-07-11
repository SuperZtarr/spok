/* Extraction des @mentions dans le HTML des descriptions/contributions → notifications. */
import type { PrismaClient } from '@spok/database';
import { createNotification } from './notifications.js';

/**
 * Extract mentioned user IDs from TipTap HTML content.
 * TipTap Mention extension generates: <span data-type="mention" data-id="userId">@name</span>
 */
export function extractMentionedUserIds(html: string): string[] {
  const regex = /data-type="mention"[^>]*data-id="([^"]+)"/g;
  const ids = new Set<string>();
  let match;
  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
  }
  // Also try reverse attribute order
  const regex2 = /data-id="([^"]+)"[^>]*data-type="mention"/g;
  while ((match = regex2.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}

/**
 * Create MENTION notifications for all mentioned users in HTML content.
 * Skips the author (don't notify yourself).
 */
export async function notifyMentionedUsers(
  prisma: PrismaClient,
  html: string,
  authorId: string,
  authorName: string,
  itemId: string,
  itemTitle: string,
  spaceId: string,
): Promise<void> {
  const mentionedIds = extractMentionedUserIds(html);
  for (const userId of mentionedIds) {
    if (userId === authorId) continue;
    await createNotification(prisma, {
      userId,
      type: 'MENTION',
      title: `${authorName} vous a mentionné dans « ${itemTitle} »`,
      link: `/spaces/${spaceId}`,
      metadata: { actorId: authorId, actorName: authorName, itemId, itemTitle },
    });
  }
}
