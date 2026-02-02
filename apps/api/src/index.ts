import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { prismaPlugin } from './plugins/prisma.js';
import { jwtPlugin } from './plugins/jwt.js';
import { authRoutes } from './routes/auth.js';
import { spacesRoutes } from './routes/spaces.js';

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

async function buildApp() {
  const app = Fastify({
    logger: envToLogger[process.env.NODE_ENV as keyof typeof envToLogger] ?? true,
  });

  // Register plugins
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://spok').split(',');
  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  await app.register(sensible);
  await app.register(prismaPlugin);
  await app.register(jwtPlugin);

  // Register routes
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(spacesRoutes, { prefix: '/spaces' });

  // Health check
  app.get('/health', async () => {
    let database = 'disconnected';
    try {
      await app.prisma.$queryRaw`SELECT 1`;
      database = 'connected';
    } catch {
      database = 'disconnected';
    }
    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      database,
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.API_PORT || '3001', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  try {
    await app.listen({ port, host });
    console.log(`Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
