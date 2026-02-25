import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

export const notificationsRoutes: FastifyPluginAsync = async (app) => {
  // All routes require authentication
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ message: 'Non authentifié' });
    }
  });

  // GET /notifications — paginated list (unread first, then by date desc)
  app.get('/', async (request) => {
    const { limit = '20', offset = '0' } = request.query as { limit?: string; offset?: string };

    const notifications = await app.prisma.notification.findMany({
      where: { userId: request.user.userId },
      orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
      take: parseInt(limit, 10),
      skip: parseInt(offset, 10),
    });

    return notifications;
  });

  // GET /notifications/unread-count
  app.get('/unread-count', async (request) => {
    const count = await app.prisma.notification.count({
      where: { userId: request.user.userId, read: false },
    });

    return { count };
  });

  // PATCH /notifications/:id/read
  app.patch('/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };

    const notification = await app.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== request.user.userId) {
      return reply.status(404).send({ message: 'Notification non trouvée' });
    }

    const updated = await app.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return updated;
  });

  // PATCH /notifications/read-all
  app.patch('/read-all', async (request) => {
    const { count } = await app.prisma.notification.updateMany({
      where: { userId: request.user.userId, read: false },
      data: { read: true },
    });

    return { updated: count };
  });

  // DELETE /notifications/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const notification = await app.prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== request.user.userId) {
      return reply.status(404).send({ message: 'Notification non trouvée' });
    }

    await app.prisma.notification.delete({ where: { id } });

    return { success: true };
  });
};
