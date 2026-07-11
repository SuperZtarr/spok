/*
 * Création de notifications en base + envoi d'emails transactionnels (Resend) : invitations,
 * mentions, contributions. sendInvitationEmail no-op sans RESEND_API_KEY.
 */
import type { PrismaClient, NotificationType } from '@spok/database';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@spok/shared';
import type { NotificationPreferences, NotificationChannel } from '@spok/shared';
import { Resend } from 'resend';
import { wrapEmailTemplate } from './emailTemplate.js';

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
      html: wrapEmailTemplate(`
        <h2 style="margin: 0 0 12px; color: #18181b; font-size: 18px;">${title}</h2>
        ${message ? `<p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.6;">${message}</p>` : ''}
      `),
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
/**
 * Send an invitation email via Resend.
 */
export async function sendInvitationEmail(opts: {
  to: string;
  inviterName: string;
  targetName: string;
  targetType: 'communauté' | 'espace';
  token: string;
  message?: string | null;
  role: string;
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const siteUrl = process.env.SITE_URL || 'https://spok.space';
  const acceptUrl = `${siteUrl}/invitation?token=${opts.token}`;

  const roleLabel = opts.role === 'OWNER' ? 'Propriétaire' : opts.role === 'MEMBER' ? 'Membre' : opts.role;
  const messageBlock = opts.message
    ? `<div style="margin: 16px 0; padding: 12px 16px; background: #f4f4f5; border-radius: 6px; border-left: 3px solid #6366f1;">
        <p style="margin: 0; color: #52525b; font-size: 14px; font-style: italic;">"${opts.message}"</p>
      </div>`
    : '';

  const html = wrapEmailTemplate(`
    <h2 style="margin: 0 0 16px; color: #18181b; font-size: 18px;">
      Vous êtes invité(e) à rejoindre ${opts.targetType === 'communauté' ? 'la communauté' : "l'espace"} « ${opts.targetName} »
    </h2>
    <p style="margin: 0 0 8px; color: #52525b; font-size: 14px; line-height: 1.6;">
      <strong>${opts.inviterName}</strong> vous invite en tant que <strong>${roleLabel}</strong>.
    </p>
    ${messageBlock}
    <div style="text-align: center; margin: 24px 0 16px;">
      <a href="${acceptUrl}" style="display: inline-block; padding: 12px 32px; background: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
        Voir l'invitation
      </a>
    </div>
    <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
      Cette invitation expire dans 30 jours.
    </p>
  `);

  try {
    await resend.emails.send({
      from: 'SPOK <notifications@spok.space>',
      to: opts.to,
      subject: `${opts.inviterName} vous invite sur SPOK`,
      html,
    });
  } catch (err) {
    console.error('[invitation] Failed to send email:', err);
  }
}

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
