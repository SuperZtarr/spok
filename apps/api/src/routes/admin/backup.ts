/* Enregistrement des métadonnées de backup (appelé par le workflow GitHub backup.yml). */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const bodySchema = z.object({
  filename: z.string(),
  sizeBytes: z.number().int().positive(),
  status: z.enum(['success', 'failure']),
  error: z.string().optional(),
});

export const adminBackupRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticateAdmin);

  fastify.post('/', async (request, reply) => {
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) return reply.badRequest(parsed.error.message);

    const { filename, sizeBytes, status, error } = parsed.data;

    await fastify.prisma.auditLog.create({
      data: {
        action: 'BACKUP',
        entity: 'System',
        entityId: filename,
        spaceId: null,
        userId: request.user.userId,
        changes: {
          after: {
            filename,
            sizeBytes,
            sizeMb: +(sizeBytes / 1024 / 1024).toFixed(2),
            status,
            ...(error ? { error } : {}),
          },
        },
      },
    });

    return reply.status(201).send({ ok: true });
  });
};
