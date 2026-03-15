import type { PrismaClient, NotificationType } from '@spok/database';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@spok/shared';
import type { NotificationPreferences, NotificationChannel } from '@spok/shared';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Get user's notification preference for a given type.
 */
function getUserPreference(
  preferences: NotificationPreferences | null | undefined,
  type: NotificationType,
): NotificationChannel {
  if (!preferences) return DEFAULT_NOTIFICATION_PREFERENCES[type];
  return preferences[type] ?? DEFAULT_NOTIFICATION_PREFERENCES[type];
}

/**
 * Send a notification email via Resend.
 */
async function sendNotificationEmail(
  email: string,
  title: string,
  message?: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;
  try {
    await resend.emails.send({
      from: 'SPOK <notifications@spok.space>',
      to: email,
      subject: title,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">${title}</h2>
          ${message ? `<p style="color: #666;">${message}</p>` : ''}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">
            Vous recevez cet email car vous avez activé les notifications email sur SPOK.
            Vous pouvez modifier vos préférences dans votre profil.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('[notification] Failed to send email:', err);
  }
}

/**
 * Create a notification for a user, respecting their preferences.
 * - 'all': in-app + email
 * - 'in_app': in-app only
 * - 'none': skip entirely
 * Silently catches errors to never block the main operation.
 */
export async function createNotification(
  prisma: PrismaClient,
  input: CreateNotificationInput,
): Promise<void> {
  try {
    // Fetch user preferences and email
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, notificationPreferences: true },
    });

    if (!user) return;

    const pref = getUserPreference(
      user.notificationPreferences as NotificationPreferences | null,
      input.type,
    );

    if (pref === 'none') return;

    // Create in-app notification
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

    // Send email if preference is 'all'
    if (pref === 'all') {
      await sendNotificationEmail(user.email, input.title, input.message);
    }
  } catch (err) {
    console.error('[notification] Failed to create notification:', err);
  }
}
