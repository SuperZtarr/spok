import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const updatePreferencesSchema = z.object({
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
});

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /user/preferences
  fastify.get('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { themePreference: true },
    });

    return { themePreference: user?.themePreference ?? 'system' };
  });

  // PATCH /user/preferences
  fastify.patch('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const data = updatePreferencesSchema.parse(request.body);

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data,
      select: { themePreference: true },
    });

    return { themePreference: user.themePreference };
  });
};
