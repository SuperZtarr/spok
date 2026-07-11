/* Types notification : Notification, NotificationType, payloads. */
export type NotificationType = 'INVITATION' | 'ASSIGNMENT' | 'CONTRIBUTION' | 'MENTION' | 'EMAIL_VERIFICATION' | 'NEW_USER' | 'AUDIT_ALERT';

// 'all' = in-app + email, 'in_app' = in-app only, 'none' = disabled
export type NotificationChannel = 'all' | 'in_app' | 'none';

export type NotificationPreferences = Record<NotificationType, NotificationChannel>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  INVITATION: 'all',
  ASSIGNMENT: 'all',
  CONTRIBUTION: 'in_app',
  MENTION: 'all',
  EMAIL_VERIFICATION: 'in_app',
  NEW_USER: 'in_app',
  AUDIT_ALERT: 'in_app',
};

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}
