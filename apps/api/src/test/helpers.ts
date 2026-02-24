import Fastify, { FastifyInstance } from 'fastify'
import sensible from '@fastify/sensible'
import { ZodError } from 'zod'
import { vi } from 'vitest'
import { jwtPlugin } from '../plugins/jwt.js'
import { authRoutes } from '../routes/auth.js'
import { itemsRoutes } from '../routes/items.js'
import { spacesRoutes } from '../routes/spaces.js'
import { communitiesRoutes } from '../routes/communities.js'

/**
 * Creates a mock PrismaClient with vi.fn() for all methods.
 * Add models/methods as needed.
 */
export function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    space: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    spaceMembership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    itemTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    itemRelation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    contribution: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    spaceModule: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    community: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    communityMembership: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      groupBy: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    passwordResetToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    emailVerificationToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn().mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) return Promise.resolve(arg)
      if (typeof arg === 'function') return (arg as Function)(createMockPrisma())
      return Promise.resolve()
    }),
    $disconnect: vi.fn(),
  }
}

export type MockPrisma = ReturnType<typeof createMockPrisma>

/**
 * Builds a Fastify test app with mocked Prisma and real JWT.
 * Returns the app + the mock prisma for assertions.
 */
export async function buildTestApp(): Promise<{
  app: FastifyInstance
  prisma: MockPrisma
}> {
  const app = Fastify({ logger: false })
  const mockPrisma = createMockPrisma()

  // Error handler matching production (src/index.ts)
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: `Données invalides: ${details[0]}`,
        details,
        code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
      })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)

  // Decorate with mock prisma BEFORE jwt plugin (which doesn't use prisma)
  app.decorate('prisma', mockPrisma as any)

  await app.register(jwtPlugin)

  // Register auth routes
  await app.register(authRoutes, { prefix: '/auth' })

  await app.ready()

  return { app, prisma: mockPrisma }
}

/**
 * Helper to get a valid JWT token for a test user.
 */
export function getTestToken(app: FastifyInstance, payload = { userId: 'test-user-id', email: 'test@test.com' }) {
  return app.jwt.sign(payload)
}

/**
 * Builds a Fastify test app with items routes registered under /spaces/:spaceId/items.
 * Includes authenticate hook like production spaces plugin does.
 */
export async function buildItemsTestApp(): Promise<{
  app: FastifyInstance
  prisma: MockPrisma
}> {
  const app = Fastify({ logger: false })
  const mockPrisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: `Données invalides: ${details[0]}`,
        details,
        code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
      })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', mockPrisma as any)
  await app.register(jwtPlugin)

  // Register items routes with authenticate hook, like spaces.ts does
  await app.register(async (instance) => {
    instance.addHook('preHandler', instance.authenticate)
    await instance.register(itemsRoutes, { prefix: '/:spaceId/items' })
  }, { prefix: '/spaces' })

  await app.ready()

  return { app, prisma: mockPrisma }
}

/**
 * Builds a Fastify test app with full spaces routes (including nested items, tags, etc.).
 */
export async function buildSpacesTestApp(): Promise<{
  app: FastifyInstance
  prisma: MockPrisma
}> {
  const app = Fastify({ logger: false })
  const mockPrisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: `Données invalides: ${details[0]}`,
        details,
        code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
      })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', mockPrisma as any)
  await app.register(jwtPlugin)
  await app.register(spacesRoutes, { prefix: '/spaces' })

  await app.ready()

  return { app, prisma: mockPrisma }
}

/**
 * Builds a Fastify test app with communities routes.
 */
export async function buildCommunitiesTestApp(): Promise<{
  app: FastifyInstance
  prisma: MockPrisma
}> {
  const app = Fastify({ logger: false })
  const mockPrisma = createMockPrisma()

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      const details = error.errors.map((e) => {
        const path = e.path.join('.')
        return path ? `${path}: ${e.message}` : e.message
      })
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: `Données invalides: ${details[0]}`,
        details,
        code: 'VALIDATION_ERROR',
      })
    }
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name || 'Error',
        message: error.message,
      })
    }
    return reply.status(500).send({ statusCode: 500, message: error.message })
  })

  await app.register(sensible)
  app.decorate('prisma', mockPrisma as any)
  await app.register(jwtPlugin)
  await app.register(communitiesRoutes, { prefix: '/communities' })

  await app.ready()

  return { app, prisma: mockPrisma }
}
