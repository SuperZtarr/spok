/*
 * Plugin JWT : décorateurs authenticate (401 sans token), optionalAuthenticate (request.user
 * undefined pour un anonyme — toujours garder request.user?.userId) et authenticateAdmin.
 */
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { JWTPayload } from '@spok/shared';

declare module 'fastify' {
  interface FastifyRequest {
    isAdminMode: boolean;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

const jwtPluginAsync: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'super-secret-key-change-in-production',
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
    } catch (err) {
      reply.unauthorized('Invalid or expired token');
    }
  });

  fastify.decorate('optionalAuthenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
    } catch {
      // No token or invalid token — continue as anonymous (request.user stays undefined)
      request.isAdminMode = false;
    }
  });
};

export const jwtPlugin = fp(jwtPluginAsync, {
  name: 'jwt',
});
