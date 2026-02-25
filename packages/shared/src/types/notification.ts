export type NotificationType = 'INVITATION' | 'ASSIGNMENT' | 'CONTRIBUTION' | 'MENTION';

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
