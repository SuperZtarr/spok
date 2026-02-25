import type { PrismaClient, NotificationType } from '@spok/database';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a notification for a user.
 * Silently catches errors to never block the main operation.
 */
export async function createNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        metadata: input.metadata as any,
      },
    });
  } catch (err) {
    console.error('[notification] Failed to create notification:', err);
  }
}
