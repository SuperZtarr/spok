/*
 * Règles d'invitation aux séances live (invités = membres de la communauté SANS accès à l'espace parent).
 * Un invité devient membre MEMBER de l'espace de séance (PRIVÉ) — les droits étant propres à chaque espace,
 * il n'obtient rien sur l'espace parent. Retrait = suppression de l'invitation ET de cette adhésion.
 * Limite assumée : un flux SSE déjà ouvert n'est pas coupé au retrait (contrôle à la connexion seulement).
 * Utilisé par routes/live-sessions.ts (création, /:id/invitees, /invite-candidates, suite).
 */
import type { LiveInviteCandidate, LiveInvitee } from '@spok/shared';
import { checkSpaceAccess } from '../routes/items.js';
import { createNotification } from './notifications.js';

const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;

async function communityOf(prisma: any, parentSpaceId: string): Promise<string | null> {
  const parent = await prisma.space.findUnique({ where: { id: parentSpaceId }, select: { communityId: true } });
  return parent?.communityId ?? null;
}

export async function listInviteCandidates(prisma: any, parentSpaceId: string, excludeUserIds: string[]): Promise<LiveInviteCandidate[]> {
  const communityId = await communityOf(prisma, parentSpaceId);
  if (!communityId) return [];
  const members = (await prisma.communityMembership.findMany({
    where: { communityId }, include: { user: { select: { id: true, name: true, email: true } } },
  })) ?? [];
  const exclude = new Set(excludeUserIds);
  const result: LiveInviteCandidate[] = [];
  for (const m of members) {
    if (exclude.has(m.userId)) continue;
    if (await checkSpaceAccess(prisma, m.userId, parentSpaceId)) continue;
    result.push({ userId: m.userId, name: m.user?.name ?? '', email: m.user?.email ?? '' });
  }
  return result.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export async function assertInvitable(prisma: any, parentSpaceId: string, userIds: string[]): Promise<string | null> {
  const communityId = await communityOf(prisma, parentSpaceId);
  if (!communityId) return 'Espace sans communauté';
  const members = (await prisma.communityMembership.findMany({ where: { communityId, userId: { in: userIds } }, select: { userId: true } })) ?? [];
  const inCommunity = new Set(members.map((m: any) => m.userId));
  for (const id of userIds) {
    if (!inCommunity.has(id)) return 'Seuls des membres de la communauté peuvent être invités';
    if (await checkSpaceAccess(prisma, id, parentSpaceId)) return 'Cette personne a déjà accès à l\'espace : elle peut rejoindre la séance sans invitation';
  }
  return null;
}

export async function addInvitees(
  prisma: any, session: { id: string; spaceId: string }, userIds: string[], invitedById: string, sessionName: string,
): Promise<string[]> {
  const added: string[] = [];
  for (const userId of [...new Set(userIds)]) {
    const existing = await prisma.liveSessionInvite.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
    if (existing) continue;
    const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: session.spaceId } } });
    if (!m) await prisma.spaceMembership.create({ data: { userId, spaceId: session.spaceId, role: 'MEMBER' } });
    await prisma.liveSessionInvite.create({ data: { sessionId: session.id, userId, invitedById } });
    await createNotification(prisma, {
      userId, type: 'INVITATION',
      title: `Invitation à la séance « ${sessionName} »`,
      message: 'Vous êtes invité à une séance de présentation.',
      link: `/spaces/${session.spaceId}`,
    });
    added.push(userId);
  }
  return added;
}

export async function removeInvitee(prisma: any, session: { id: string; spaceId: string }, userId: string): Promise<boolean> {
  const invite = await prisma.liveSessionInvite.findUnique({ where: { sessionId_userId: { sessionId: session.id, userId } } });
  if (!invite) return false;
  await prisma.liveSessionInvite.delete({ where: { id: invite.id } });
  await prisma.spaceMembership.deleteMany({ where: { userId, spaceId: session.spaceId } });
  return true;
}

export async function listInvitees(prisma: any, sessionId: string): Promise<LiveInvitee[]> {
  const rows = (await prisma.liveSessionInvite.findMany({
    where: { sessionId }, include: { user: { select: USER_SELECT } }, orderBy: { createdAt: 'asc' },
  })) ?? [];
  return rows.map((r: any) => ({ userId: r.userId, user: r.user, invitedAt: new Date(r.createdAt).toISOString() }));
}
