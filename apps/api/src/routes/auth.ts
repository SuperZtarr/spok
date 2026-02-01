import { FastifyPluginAsync } from 'fastify';
import { hash, compare } from 'bcrypt';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { AuthResponse, AuthTokens, AuthUser } from '@spok/shared';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Register
  fastify.post<{ Body: z.infer<typeof registerSchema> }>('/register', async (request, reply) => {
    const body = registerSchema.parse(request.body);

    // Check if user exists
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return reply.conflict('Email already registered');
    }

    // Create user
    const passwordHash = await hash(body.password, 10);
    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name,
      },
    });

    // Create personal space
    const personalSpace = await fastify.prisma.space.create({
      data: {
        name: 'Mon espace personnel',
        type: 'PERSONAL',
        memberships: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    // Generate tokens
    const tokens = await generateTokens(fastify, user.id, user.email);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const response: AuthResponse = {
      user: authUser,
      tokens,
    };

    return reply.status(201).send(response);
  });

  // Login
  fastify.post<{ Body: z.infer<typeof loginSchema> }>('/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      return reply.unauthorized('Invalid credentials');
    }

    const validPassword = await compare(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.unauthorized('Invalid credentials');
    }

    const tokens = await generateTokens(fastify, user.id, user.email);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    const response: AuthResponse = {
      user: authUser,
      tokens,
    };

    return response;
  });

  // Refresh token
  fastify.post<{ Body: z.infer<typeof refreshSchema> }>('/refresh', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);

    const storedToken = await fastify.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!storedToken) {
      return reply.unauthorized('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await fastify.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      return reply.unauthorized('Refresh token expired');
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: storedToken.userId },
    });

    if (!user) {
      return reply.unauthorized('User not found');
    }

    // Delete old refresh token
    await fastify.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    // Generate new tokens
    const tokens = await generateTokens(fastify, user.id, user.email);

    return { tokens };
  });

  // Get current user
  fastify.get('/me', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return user;
  });

  // Logout
  fastify.post<{ Body: z.infer<typeof refreshSchema> }>('/logout', async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);

    await fastify.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { success: true };
  });
};

async function generateTokens(
  fastify: any,
  userId: string,
  email: string
): Promise<AuthTokens> {
  const accessToken = fastify.jwt.sign({ userId, email });

  const refreshToken = randomBytes(64).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await fastify.prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt,
    },
  });

  return {
    accessToken,
    refreshToken,
  };
}
