/*
 * Plugin JWT : décorateurs authenticate (401 sans token), optionalAuthenticate (request.user
 * undefined pour un anonyme — toujours garder request.user?.userId) et authenticateAdmin.
 * Jetons personnels (spok_pat_…, MCP distant) : acceptés par authenticate/optionalAuthenticate,
 * jamais par authenticateAdmin (jwtVerify échoue sur un PAT). Un PAT force isAdminMode=false ;
 * portée 'read' → 403 sur toute méthode autre que GET/HEAD ; hors PAT_ALLOWED_PREFIXES (périmètre MCP,
 * jamais /user ni /auth) → 403 ; accès MCP non accordé par l'admin (hasMcpAccess) → 403, même en
 * optionalAuthenticate, et alerte aux admins (mcp/deniedAccessAlert.ts, une par utilisateur et par 24 h). request.authVia indique la source.
 */
import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { JWTPayload } from '@spok/shared';
import { isPersonalToken, resolvePersonalToken, type PersonalTokenScope } from '../utils/personalTokens.js';
import { notifyDeniedMcpAttempt } from '../mcp/deniedAccessAlert.js';

declare module 'fastify' {
  interface FastifyRequest {
    isAdminMode: boolean;
    authVia?: 'jwt' | 'pat';
    personalToken?: { id: string; name: string; scope: PersonalTokenScope };
  }
  interface FastifyContextConfig {
    /** Route acceptant un jeton 'read' malgré une méthode d'écriture (POST /mcp uniquement). */
    allowReadOnlyToken?: boolean;
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
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET doit être défini');
  }

  await fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,
    sign: {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    },
  });

  function bearerOf(request: FastifyRequest): string | undefined {
    const h = request.headers.authorization;
    return h?.startsWith('Bearer ') ? h.slice(7).trim() : undefined;
  }

  /** Périmètre d'un jeton personnel = routes utilisées par les outils MCP. Exclut volontairement /user
   *  (email, mot de passe, jetons : un jeton fuité ne doit pas permettre de prendre le compte) et /auth. */
  const PAT_ALLOWED_PREFIXES = ['/spaces', '/communities', '/search', '/notifications', '/mcp'];

  function inPatPerimeter(url: string): boolean {
    const path = url.split('?')[0];
    return PAT_ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
  }

  const MCP_ACCESS_DENIED = "Accès MCP non autorisé pour ce compte : demandez-le à l'administrateur (spok.space → Profil → Accès Claude)";

  /** 'ok' : request.user posé ; 'invalid' : PAT refusé ; 'outOfScope' : route hors périmètre ;
   *  'notAllowed' : jeton valide mais accès MCP non accordé ; 'none' : pas un PAT. */
  async function tryPersonalToken(request: FastifyRequest): Promise<'ok' | 'invalid' | 'outOfScope' | 'notAllowed' | 'none'> {
    const bearer = bearerOf(request);
    if (!isPersonalToken(bearer)) return 'none';
    if (!inPatPerimeter(request.url)) return 'outOfScope';
    const resolved = await resolvePersonalToken((fastify as any).prisma, bearer);
    if (!resolved) return 'invalid';
    if (!resolved.mcpAllowed) {
      notifyDeniedMcpAttempt((fastify as any).prisma, resolved.userId, resolved.name);
      return 'notAllowed';
    }
    request.user = { userId: resolved.userId, email: resolved.email };
    request.isAdminMode = false;
    request.authVia = 'pat';
    request.personalToken = { id: resolved.id, name: resolved.name, scope: resolved.scope };
    return 'ok';
  }

  const READ_METHODS = new Set(['GET', 'HEAD']);

  /** Jeton 'read' sur une méthode d'écriture : refusé, sauf route marquée config.allowReadOnlyToken
   *  (POST /mcp : le protocole est toujours en POST, la lecture seule y est garantie par le profil d'outils). */
  function readOnlyViolation(request: FastifyRequest): boolean {
    if (request.personalToken!.scope !== 'read' || READ_METHODS.has(request.method)) return false;
    return request.routeOptions?.config?.allowReadOnlyToken !== true;
  }

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const pat = await tryPersonalToken(request);
    if (pat === 'invalid') {
      reply.unauthorized('Invalid or expired token');
      return;
    }
    if (pat === 'outOfScope') {
      reply.forbidden('Route non accessible avec un jeton personnel');
      return;
    }
    if (pat === 'notAllowed') {
      reply.forbidden(MCP_ACCESS_DENIED);
      return;
    }
    if (pat === 'ok') {
      if (readOnlyViolation(request)) reply.forbidden('Jeton en lecture seule');
      return;
    }
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
      request.authVia = 'jwt';
    } catch (err) {
      reply.unauthorized('Invalid or expired token');
    }
  });

  fastify.decorate('optionalAuthenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const pat = await tryPersonalToken(request);
    if (pat === 'ok') {
      if (readOnlyViolation(request)) reply.forbidden('Jeton en lecture seule');
      return;
    }
    if (pat === 'outOfScope') {
      reply.forbidden('Route non accessible avec un jeton personnel');
      return;
    }
    if (pat === 'notAllowed') {
      reply.forbidden(MCP_ACCESS_DENIED);
      return;
    }
    if (pat === 'invalid') {
      request.isAdminMode = false;
      return;
    }
    try {
      await request.jwtVerify();
      request.isAdminMode = request.headers['x-admin-mode'] === 'true';
      request.authVia = 'jwt';
    } catch {
      // No token or invalid token — continue as anonymous (request.user stays undefined)
      request.isAdminMode = false;
    }
  });
};

export const jwtPlugin = fp(jwtPluginAsync, {
  name: 'jwt',
});
