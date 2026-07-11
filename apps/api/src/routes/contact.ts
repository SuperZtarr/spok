/* Formulaire de contact public : crée un item dans l'espace Support de la communauté SPOK. */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createNotification } from '../utils/notifications.js';

const SUPPORT_SPACE_NAME = 'Support';
const SUPPORT_COMMUNITY_NAME = 'SPOK';

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  category: z.enum(['question', 'bug', 'feature', 'technical']),
  message: z.string().min(10),
});

const CATEGORY_LABELS: Record<string, string> = {
  question: 'Question generale',
  bug: 'Signalement de bug',
  feature: 'Demande de fonctionnalite',
  technical: 'Demande technique',
};

export const contactRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /contact — submit a contact form (no auth required)
  fastify.post<{ Body: z.infer<typeof contactSchema> }>('/', { preHandler: [fastify.optionalAuthenticate] }, async (request, reply) => {
    const body = contactSchema.parse(request.body);

    // Find or create the support space
    const spaceId = await getOrCreateSupportSpace(fastify);

    // Determine creator: authenticated user or system admin
    let createdById: string;
    if (request.user?.userId) {
      createdById = request.user.userId;
    } else {
      // Anonymous: use the first admin as creator
      const admin = await fastify.prisma.user.findFirst({
        where: { globalRole: 'ADMIN' },
        select: { id: true },
      });
      if (!admin) return reply.internalServerError('No admin user found');
      createdById = admin.id;
    }

    const categoryLabel = CATEGORY_LABELS[body.category] || body.category;
    const title = `[${categoryLabel}] ${body.message.substring(0, 80)}${body.message.length > 80 ? '...' : ''}`;
    const description = `**De :** ${body.name} (${body.email})\n**Categorie :** ${categoryLabel}\n\n${body.message}`;

    // Create the item
    const item = await fastify.prisma.item.create({
      data: {
        type: 'NOTE',
        title,
        description,
        status: 'todo',
        spaceId,
        createdById,
        startDate: new Date(),
      },
    });

    // Notify all admins
    const admins = await fastify.prisma.user.findMany({
      where: { globalRole: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await createNotification(fastify.prisma, {
        userId: admin.id,
        type: 'CONTRIBUTION',
        title: `Nouveau message de contact : ${categoryLabel}`,
        message: `De ${body.name} (${body.email})`,
        link: `/spaces/${spaceId}/content?item=${item.id}`,
      });
    }

    return reply.status(201).send({ success: true, itemId: item.id });
  });
};

async function getOrCreateSupportSpace(fastify: any): Promise<string> {
  // Look for existing support space
  const existing = await fastify.prisma.space.findFirst({
    where: { name: SUPPORT_SPACE_NAME, type: 'GROUP' },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Find or create the SPOK community
  let community = await fastify.prisma.community.findFirst({
    where: { name: SUPPORT_COMMUNITY_NAME },
    select: { id: true },
  });

  const admin = await fastify.prisma.user.findFirst({
    where: { globalRole: 'ADMIN' },
    select: { id: true },
  });

  if (!community && admin) {
    community = await fastify.prisma.community.create({
      data: {
        name: SUPPORT_COMMUNITY_NAME,
        description: 'Communaute systeme SPOK',
        isPublic: false,
        visibility: 'PRIVATE',
        memberships: {
          create: { userId: admin.id, role: 'OWNER' },
        },
      },
    });
  }

  // Create the support space
  const space = await fastify.prisma.space.create({
    data: {
      name: SUPPORT_SPACE_NAME,
      type: 'GROUP',
      communityId: community?.id || null,
      visibility: 'PRIVATE',
      memberships: admin ? {
        create: { userId: admin.id, role: 'OWNER' },
      } : undefined,
    },
  });

  return space.id;
}
