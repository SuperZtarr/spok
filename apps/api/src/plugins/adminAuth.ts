/* Plugin : décorateur authenticateAdmin — 403 si globalRole différent de ADMIN. */
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const adminAuthPluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticateAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    // First, verify JWT token
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.unauthorized('Invalid or expired token');
      return;
    }

    // Then, check if user has ADMIN role
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { globalRole: true },
    });

    if (!user || user.globalRole !== 'ADMIN') {
      reply.forbidden('Admin access required');
    }
  });
};

export const adminAuthPlugin = fp(adminAuthPluginAsync, {
  name: 'adminAuth',
  dependencies: ['jwt', 'prisma'],
});
