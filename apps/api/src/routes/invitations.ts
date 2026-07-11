/*
 * Invitations par token (communauté ou espace) : création, acceptation (avec auto-join des
 * espaces à defaultRole), refus, liste. Helper createInvitation partagé par communities/spaces.
 */
import { FastifyPluginAsync } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { createNotification } from '../utils/notifications.js';

/** Auto-join user to community spaces that have a defaultRole configured */
export async function autoJoinCommunitySpaces(prisma: PrismaClient, userId: string, communityId: string) {
  const spacesWithDefault = await prisma.space.findMany({
    where: { communityId, defaultRole: { not: null } },
    select: { id: true, defaultRole: true },
  });

  if (spacesWithDefault.length === 0) return;

  const existingMemberships = await prisma.spaceMembership.findMany({
    where: {
      userId,
      spaceId: { in: spacesWithDefault.map(s => s.id) },
    },
    select: { spaceId: true },
  });

  const existingSpaceIds = new Set(existingMemberships.map(m => m.spaceId));
  const toCreate = spacesWithDefault.filter(s => !existingSpaceIds.has(s.id));

  if (toCreate.length > 0) {
    await prisma.spaceMembership.createMany({
      data: toCreate.map(s => ({
        userId,
        spaceId: s.id,
        role: s.defaultRole!,
      })),
    });
  }
}

const INVITATION_EXPIRY_DAYS = 30;

const invitationInclude = {
  invitedBy: { select: { id: true, name: true, email: true } },
  community: { select: { id: true, name: true } },
  space: { select: { id: true, name: true } },
};

function serializeInvitation(inv: any) {
  return {
    id: inv.id,
    email: inv.email,
    token: inv.token,
    status: inv.status,
    role: inv.role,
    message: inv.message,
    communityId: inv.communityId,
    spaceId: inv.spaceId,
    invitedById: inv.invitedById,
    invitedBy: inv.invitedBy,
    community: inv.community,
    space: inv.space,
    expiresAt: inv.expiresAt,
    respondedAt: inv.respondedAt,
    createdAt: inv.createdAt,
  };
}

export const invitationsRoutes: FastifyPluginAsync = async (fastify) => {

  // ─── GET INVITATION BY TOKEN (public, no auth) ─────────────────
  fastify.get<{ Params: { token: string } }>(
    '/by-token/:token',
    async (request, reply) => {
      const invitation = await fastify.prisma.invitation.findUnique({
        where: { token: request.params.token },
        include: invitationInclude,
      });

      if (!invitation) return reply.notFound('Invitation not found');

      return serializeInvitation(invitation);
    }
  );

  // ─── MY PENDING INVITATIONS ────────────────────────────────────
  fastify.get(
    '/my',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { email: true },
      });
      if (!user) return reply.notFound();

      const invitations = await fastify.prisma.invitation.findMany({
        where: { email: user.email, status: 'PENDING', expiresAt: { gt: new Date() } },
        include: invitationInclude,
        orderBy: { createdAt: 'desc' },
      });

      return invitations.map(serializeInvitation);
    }
  );

  // ─── ACCEPT INVITATION ──────────────────────────────────────────
  fastify.post<{ Params: { token: string } }>(
    '/:token/accept',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const invitation = await fastify.prisma.invitation.findUnique({
        where: { token: request.params.token },
        include: invitationInclude,
      });

      if (!invitation) return reply.notFound('Invitation not found');
      if (invitation.status !== 'PENDING') return reply.badRequest(`Invitation already ${invitation.status.toLowerCase()}`);
      if (invitation.expiresAt < new Date()) return reply.badRequest('Invitation has expired');

      // Verify the accepting user matches the invitation email
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { id: true, email: true, name: true },
      });
      if (!user) return reply.notFound();
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return reply.forbidden('This invitation is for a different email address');
      }

      // Create the membership + update invitation in a transaction
      await fastify.prisma.$transaction(async (tx) => {
        if (invitation.communityId) {
          // Community invitation
          const existing = await tx.communityMembership.findUnique({
            where: { userId_communityId: { userId: user.id, communityId: invitation.communityId! } },
          });
          if (!existing) {
            await tx.communityMembership.create({
              data: {
                userId: user.id,
                communityId: invitation.communityId!,
                role: invitation.role as any,
              },
            });
            // Auto-join community spaces with defaultRole
            await autoJoinCommunitySpaces(tx as unknown as PrismaClient, user.id, invitation.communityId!);
          }
        }

        if (invitation.spaceId) {
          // Space invitation
          const existing = await tx.spaceMembership.findUnique({
            where: { userId_spaceId: { userId: user.id, spaceId: invitation.spaceId! } },
          });
          if (!existing) {
            await tx.spaceMembership.create({
              data: {
                userId: user.id,
                spaceId: invitation.spaceId!,
                role: invitation.role as any,
              },
            });
          }
        }

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        });
      });

      // Notify the inviter
      const targetName = invitation.community?.name || invitation.space?.name || '';
      const targetType = invitation.communityId ? 'la communauté' : "l'espace";
      await createNotification(fastify.prisma, {
        userId: invitation.invitedById,
        type: 'INVITATION',
        title: `${user.name} a accepté votre invitation à rejoindre ${targetType} « ${targetName} »`,
        link: invitation.communityId
          ? `/communities/${invitation.communityId}`
          : `/spaces/${invitation.spaceId}`,
        metadata: { actorId: user.id, actorName: user.name },
      });

      return { success: true, status: 'ACCEPTED' };
    }
  );

  // ─── DECLINE INVITATION ─────────────────────────────────────────
  fastify.post<{ Params: { token: string } }>(
    '/:token/decline',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const invitation = await fastify.prisma.invitation.findUnique({
        where: { token: request.params.token },
      });

      if (!invitation) return reply.notFound('Invitation not found');
      if (invitation.status !== 'PENDING') return reply.badRequest(`Invitation already ${invitation.status.toLowerCase()}`);

      // Verify the declining user matches
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { email: true },
      });
      if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return reply.forbidden('This invitation is for a different email address');
      }

      await fastify.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });

      return { success: true, status: 'DECLINED' };
    }
  );

  // ─── CANCEL INVITATION (by inviter or admin) ───────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const invitation = await fastify.prisma.invitation.findUnique({
        where: { id: request.params.id },
      });

      if (!invitation) return reply.notFound('Invitation not found');
      if (invitation.status !== 'PENDING') return reply.badRequest('Only pending invitations can be cancelled');

      // Check that user is the inviter or an admin of the target
      const isInviter = invitation.invitedById === request.user.userId;
      let isAdmin = false;

      if (!isInviter && invitation.communityId) {
        const mem = await fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId: request.user.userId, communityId: invitation.communityId } },
        });
        isAdmin = mem ? mem.role === 'OWNER' : false;
      }
      if (!isInviter && invitation.spaceId) {
        const mem = await fastify.prisma.spaceMembership.findUnique({
          where: { userId_spaceId: { userId: request.user.userId, spaceId: invitation.spaceId } },
        });
        isAdmin = mem ? mem.role === 'OWNER' : false;
      }

      if (!isInviter && !isAdmin) {
        return reply.forbidden('Insufficient permissions');
      }

      await fastify.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'CANCELLED', respondedAt: new Date() },
      });

      return { success: true };
    }
  );
};

/** Helper: create an invitation for a community or space */
export async function createInvitation(
  prisma: PrismaClient,
  opts: {
    email: string;
    role: string;
    message?: string;
    communityId?: string;
    spaceId?: string;
    invitedById: string;
  }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS);

  return prisma.invitation.create({
    data: {
      email: opts.email,
      role: opts.role,
      message: opts.message,
      communityId: opts.communityId,
      spaceId: opts.spaceId,
      invitedById: opts.invitedById,
      expiresAt,
    },
    include: invitationInclude,
  });
}
