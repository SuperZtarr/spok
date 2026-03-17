import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { Prisma } from '@spok/database';
import { prismaPlugin } from './plugins/prisma.js';
import { jwtPlugin } from './plugins/jwt.js';
import { adminAuthPlugin } from './plugins/adminAuth.js';
import { authRoutes } from './routes/auth.js';
import { spacesRoutes } from './routes/spaces.js';
import { communitiesRoutes } from './routes/communities.js';
import { invitationsRoutes } from './routes/invitations.js';
import { adminUsersRoutes } from './routes/admin/users.js';
import { adminSpacesRoutes } from './routes/admin/spaces.js';
import { adminCommunitiesRoutes } from './routes/admin/communities.js';
import { adminAnomaliesRoutes } from './routes/admin/anomalies.js';
import { adminReferentielsRoutes } from './routes/admin/referentiels.js';
import { adminTestsRoutes } from './routes/admin/tests.js';
import { adminStatsRoutes } from './routes/admin/stats.js';
import { adminAuditLogsRoutes } from './routes/admin/auditLogs.js';
import { adminConfigRoutes, publicConfigRoutes } from './routes/admin/config.js';
import { searchRoutes } from './routes/search.js';
import { userRoutes } from './routes/user.js';
import { userTasksRoutes } from './routes/user-tasks.js';
import { graphRoutes } from './routes/graph.js';
import { notificationsRoutes } from './routes/notifications.js';

const envToLogger = {
  development: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
  production: true,
  test: false,
};

/**
 * Formate les erreurs Zod en messages lisibles
 */
function formatZodError(error: ZodError): { message: string; field?: string; details: string[] } {
  const details = error.errors.map((e) => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });

  const firstError = error.errors[0];
  const field = firstError?.path?.join('.');

  return {
    message: `Données invalides: ${details[0]}`,
    field: field || undefined,
    details,
  };
}

/**
 * Formate les erreurs Prisma en messages lisibles
 */
function formatPrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
  code: string;
} {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const target = (error.meta?.target as string[])?.join(', ') || 'champ';
      return {
        statusCode: 409,
        message: `Cette valeur existe déjà pour: ${target}`,
        code: 'UNIQUE_CONSTRAINT',
      };
    }
    case 'P2003':
      // Foreign key constraint violation
      return {
        statusCode: 400,
        message: 'Référence invalide: l\'élément lié n\'existe pas',
        code: 'FOREIGN_KEY_CONSTRAINT',
      };
    case 'P2025':
      // Record not found
      return {
        statusCode: 404,
        message: 'Élément non trouvé',
        code: 'NOT_FOUND',
      };
    case 'P2014':
      // Required relation violation
      return {
        statusCode: 400,
        message: 'Une relation requise est manquante',
        code: 'REQUIRED_RELATION',
      };
    default:
      return {
        statusCode: 500,
        message: `Erreur base de données (${error.code})`,
        code: error.code,
      };
  }
}

async function buildApp() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV as keyof typeof envToLogger] ?? true,
  });

  // Gestionnaire d'erreurs global
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    // Erreurs de validation Zod
    if (error instanceof ZodError) {
      const formatted = formatZodError(error);
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: formatted.message,
        field: formatted.field,
        details: formatted.details,
        code: 'VALIDATION_ERROR',
      });
    }

    // Erreurs Prisma connues
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const formatted = formatPrismaError(error);
      return reply.status(formatted.statusCode).send({
        statusCode: formatted.statusCode,
        error: 'Database Error',
        message: formatted.message,
        code: formatted.code,
      });
    }

    // Erreurs Prisma de validation
    if (error instanceof Prisma.PrismaClientValidationError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Données invalides pour la base de données',
        code: 'PRISMA_VALIDATION',
      });
    }

    // Erreurs Fastify (via @fastify/sensible)
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message || 'Une erreur est survenue',
        code: (error as any).code,
      });
    }

    // Erreur inconnue
    const statusCode = 500;
    const message =
      process.env.NODE_ENV === 'development'
        ? error.message
        : 'Une erreur interne est survenue';

    return reply.status(statusCode).send({
      statusCode,
      error: 'Internal Server Error',
      message,
      code: 'INTERNAL_ERROR',
    });
  });

  // Gestionnaire 404 pour les routes non trouvées
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route non trouvée: ${request.method} ${request.url}`,
      code: 'ROUTE_NOT_FOUND',
      availableRoutes: ['/health', '/auth/*', '/spaces/*', '/communities/*', '/admin/*'],
    });
  });

  // Register plugins
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://spok').split(',');
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  await app.register(prismaPlugin);
  await app.register(jwtPlugin);
  await app.register(adminAuthPlugin);

  // Register routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(spacesRoutes, { prefix: '/spaces' });
  await app.register(communitiesRoutes, { prefix: '/communities' });
  await app.register(invitationsRoutes, { prefix: '/invitations' });
  await app.register(adminUsersRoutes, { prefix: '/admin/users' });
  await app.register(adminSpacesRoutes, { prefix: '/admin/spaces' });
  await app.register(adminCommunitiesRoutes, { prefix: '/admin/communities' });
  await app.register(adminAnomaliesRoutes, { prefix: '/admin/anomalies' });
  await app.register(adminReferentielsRoutes, { prefix: '/admin/referentiels' });
  await app.register(adminTestsRoutes, { prefix: '/admin/tests' });
  await app.register(adminStatsRoutes, { prefix: '/admin/stats' });
  await app.register(adminAuditLogsRoutes, { prefix: '/admin/audit-logs' });
  await app.register(adminConfigRoutes, { prefix: '/admin/config' });
  await app.register(publicConfigRoutes, { prefix: '/config' });
  await app.register(searchRoutes, { prefix: '/search' });
  await app.register(userRoutes, { prefix: '/user' });
  await app.register(userTasksRoutes, { prefix: '/user' });
  await app.register(graphRoutes);
  await app.register(notificationsRoutes, { prefix: '/notifications' });

  // Health check
  app.get('/health', async () => {
    let database = 'disconnected';
    let databaseError: string | undefined;
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch (err) {
      database = 'disconnected';
      databaseError = err instanceof Error ? err.message : 'Erreur inconnue';
    }
    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      databaseError,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    };
  });

  return app;
}

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.API_PORT || '3001', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
