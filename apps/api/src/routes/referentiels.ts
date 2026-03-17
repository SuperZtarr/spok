import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DEFAULT_REFERENTIELS, type SpaceReferentiels, type StatusConfig, type TypeLabelConfig } from '@spok/shared';
import { checkSpaceAccess } from './items.js';

const MODULE_KEY = 'referentiels';

const statusConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  borderColor: z.string().min(1),
  order: z.number().int().min(0),
  visible: z.boolean(),
});

const typeLabelConfigSchema = z.object({
  label: z.string().min(1),
  labelShort: z.string().min(1),
  color: z.string().min(1),
  bgHover: z.string().min(1),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const updateReferentielsSchema = z.object({
  statuses: z.array(statusConfigSchema).optional(),
  typeLabels: z.record(z.string(), typeLabelConfigSchema).optional(),
});

/**
 * Safely cast Prisma JsonValue to SpaceReferentiels
 */
function parseReferentiels(config: unknown): SpaceReferentiels | null {
  if (!config || typeof config !== 'object') return null;
  const obj = config as Record<string, unknown>;
  if (!Array.isArray(obj.statuses) || typeof obj.typeLabels !== 'object') return null;
  return config as SpaceReferentiels;
}

export const referentielsRoutes: FastifyPluginAsync = async (fastify) => {

  // GET /spaces/:spaceId/referentiels - Récupérer les référentiels
  fastify.get('/', async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    // Récupérer les référentiels personnalisés
    const module = await fastify.prisma.spaceModule.findUnique({
      where: {
        spaceId_moduleKey: {
          spaceId,
          moduleKey: MODULE_KEY,
        },
      },
    });

    const referentiels = parseReferentiels(module?.config);
    if (referentiels) {
      return {
        referentiels,
        isDefault: false,
      };
    }

    // Retourner les valeurs par défaut
    return {
      referentiels: DEFAULT_REFERENTIELS,
      isDefault: true,
    };
  });

  // PUT /spaces/:spaceId/referentiels - Mettre à jour les référentiels
  fastify.put<{ Body: z.infer<typeof updateReferentielsSchema> }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Permissions insuffisantes');
    }

    const body = updateReferentielsSchema.parse(request.body);

    // Récupérer les référentiels actuels ou les défauts
    const existingModule = await fastify.prisma.spaceModule.findUnique({
      where: {
        spaceId_moduleKey: {
          spaceId,
          moduleKey: MODULE_KEY,
        },
      },
    });

    const currentReferentiels = parseReferentiels(existingModule?.config) || DEFAULT_REFERENTIELS;

    // Fusionner avec les nouvelles valeurs
    const updatedReferentiels: SpaceReferentiels = {
      statuses: (body.statuses as StatusConfig[]) || currentReferentiels.statuses,
      typeLabels: (body.typeLabels as Record<string, TypeLabelConfig>) || currentReferentiels.typeLabels,
    };

    // Upsert le module
    const module = await fastify.prisma.spaceModule.upsert({
      where: {
        spaceId_moduleKey: {
          spaceId,
          moduleKey: MODULE_KEY,
        },
      },
      create: {
        spaceId,
        moduleKey: MODULE_KEY,
        config: JSON.parse(JSON.stringify(updatedReferentiels)),
        enabled: true,
      },
      update: {
        config: JSON.parse(JSON.stringify(updatedReferentiels)),
      },
    });

    const savedReferentiels = parseReferentiels(module.config) || updatedReferentiels;
    return {
      referentiels: savedReferentiels,
      isDefault: false,
    };
  });

  // POST /spaces/:spaceId/referentiels/reset - Réinitialiser aux valeurs par défaut
  fastify.post('/reset', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };

    const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    if (membership.role !== 'OWNER') {
      return reply.forbidden('Permissions insuffisantes');
    }

    // Supprimer le module pour revenir aux valeurs par défaut
    await fastify.prisma.spaceModule.deleteMany({
      where: {
        spaceId,
        moduleKey: MODULE_KEY,
      },
    });

    return {
      referentiels: DEFAULT_REFERENTIELS,
      isDefault: true,
    };
  });

  // GET /spaces/:spaceId/referentiels/check-status-usage/:statusId - Vérifier si un statut est utilisé
  fastify.get<{ Params: { statusId: string } }>('/check-status-usage/:statusId', async (request, reply) => {
    const { spaceId, statusId } = request.params as { spaceId: string; statusId: string };

    const membership = await checkSpaceAccess(fastify.prisma, request.user?.userId, spaceId);
    if (!membership) {
      return reply.notFound('Espace non trouvé ou accès refusé');
    }

    // Compter les items utilisant ce statut
    const count = await fastify.prisma.item.count({
      where: {
        spaceId,
        status: statusId === 'undefined' ? null : statusId,
      },
    });

    return {
      statusId,
      itemCount: count,
      isUsed: count > 0,
    };
  });
};
