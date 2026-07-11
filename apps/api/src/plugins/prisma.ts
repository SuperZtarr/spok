/* Plugin Fastify : instancie PrismaClient et le décore sur fastify.prisma (déconnexion au close). */
import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import { prisma, PrismaClient } from '@spok/database';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
};

export const prismaPlugin = fp(prismaPluginAsync, {
  name: 'prisma',
});
