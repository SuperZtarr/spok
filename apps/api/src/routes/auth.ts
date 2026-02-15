import { FastifyPluginAsync } from 'fastify';
import { hash, compare } from 'bcrypt';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import type { AuthResponse, AuthTokens, AuthUser } from '@spok/shared';

const resend = new Resend(process.env.RESEND_API_KEY);

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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
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
      return reply.conflict('Cet email est déjà utilisé');
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
    await fastify.prisma.space.create({
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
      emailVerified: false,
      name: user.name,
      globalRole: user.globalRole,
      themePreference: user.themePreference as AuthUser['themePreference'],
      avatarUrl: user.avatarUrl ?? undefined,
    };

    // Send verification email (fire-and-forget)
    sendVerificationEmail(fastify, user.id, user.email, user.name).catch((error) => {
      fastify.log.error(error, 'Failed to send verification email');
    });

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
      return reply.unauthorized('Email ou mot de passe incorrect');
    }

    const validPassword = await compare(body.password, user.passwordHash);
    if (!validPassword) {
      return reply.unauthorized('Email ou mot de passe incorrect');
    }

    // Ensure user has a personal space (fix for legacy users created without one)
    const hasPersonalSpace = await fastify.prisma.spaceMembership.findFirst({
      where: { userId: user.id, space: { type: 'PERSONAL' } },
    });
    if (!hasPersonalSpace) {
      await fastify.prisma.space.create({
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
    }

    const tokens = await generateTokens(fastify, user.id, user.email);

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      name: user.name,
      globalRole: user.globalRole,
      themePreference: user.themePreference as AuthUser['themePreference'],
      avatarUrl: user.avatarUrl ?? undefined,
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
      return reply.unauthorized('Session expirée, veuillez vous reconnecter');
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
        emailVerified: true,
        name: true,
        globalRole: true,
        themePreference: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return user;
  });

  // Logout
  fastify.post<{ Body: z.infer<typeof refreshSchema> }>('/logout', async (request, _reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);

    await fastify.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });

    return { success: true };
  });

  // Forgot password
  fastify.post<{ Body: z.infer<typeof forgotPasswordSchema> }>('/forgot-password', async (request, reply) => {
    const { email } = forgotPasswordSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
    }

    // Delete any existing reset tokens for this user
    await fastify.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // Create reset token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    await fastify.prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

    try {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'SPOK <noreply@resend.dev>',
        to: email,
        subject: 'Réinitialisation de votre mot de passe SPOK',
        html: `
          <h1>Réinitialisation de mot de passe</h1>
          <p>Bonjour ${user.name},</p>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
          <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
          <p>Ce lien expire dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
        `,
      });
    } catch (error) {
      fastify.log.error(error, 'Failed to send password reset email');
      return reply.internalServerError('Erreur lors de l\'envoi de l\'email');
    }

    return { success: true, message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
  });

  // Reset password
  fastify.post<{ Body: z.infer<typeof resetPasswordSchema> }>('/reset-password', async (request, reply) => {
    const { token, password } = resetPasswordSchema.parse(request.body);

    const resetToken = await fastify.prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken) {
      return reply.badRequest('Token invalide ou expiré');
    }

    if (resetToken.expiresAt < new Date()) {
      await fastify.prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return reply.badRequest('Token invalide ou expiré');
    }

    if (resetToken.used) {
      return reply.badRequest('Ce lien a déjà été utilisé');
    }

    // Update password
    const passwordHash = await hash(password, 10);
    await fastify.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await fastify.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return { success: true, message: 'Mot de passe mis à jour avec succès' };
  });

  // Verify email
  const verifyEmailSchema = z.object({
    token: z.string(),
  });

  fastify.post<{ Body: z.infer<typeof verifyEmailSchema> }>('/verify-email', async (request, reply) => {
    const { token } = verifyEmailSchema.parse(request.body);

    const verificationToken = await fastify.prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return reply.badRequest('Token invalide ou expiré');
    }

    if (verificationToken.expiresAt < new Date()) {
      await fastify.prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      return reply.badRequest('Token invalide ou expiré');
    }

    if (verificationToken.used) {
      return reply.badRequest('Ce lien a déjà été utilisé');
    }

    // Mark email as verified
    await fastify.prisma.user.update({
      where: { id: verificationToken.userId },
      data: { emailVerified: true },
    });

    // Mark token as used
    await fastify.prisma.emailVerificationToken.update({
      where: { id: verificationToken.id },
      data: { used: true },
    });

    return { success: true, message: 'Email vérifié avec succès' };
  });

  // Resend verification email
  fastify.post('/resend-verification', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
    });

    if (!user) {
      return reply.notFound('Utilisateur non trouvé');
    }

    if (user.emailVerified) {
      return reply.badRequest('Votre email est déjà vérifié');
    }

    try {
      await sendVerificationEmail(fastify, user.id, user.email, user.name);
    } catch (error) {
      fastify.log.error(error, 'Failed to send verification email');
      return reply.internalServerError("Erreur lors de l'envoi de l'email");
    }

    return { success: true, message: 'Email de vérification envoyé' };
  });
};

export async function sendVerificationEmail(
  fastify: any,
  userId: string,
  email: string,
  name: string
): Promise<void> {
  // Delete any existing verification tokens for this user
  await fastify.prisma.emailVerificationToken.deleteMany({
    where: { userId },
  });

  // Create verification token (24h expiry)
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await fastify.prisma.emailVerificationToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'SPOK <noreply@resend.dev>',
    to: email,
    subject: 'Vérifiez votre adresse email - SPOK',
    html: `
      <h1>Bienvenue sur SPOK !</h1>
      <p>Bonjour ${name},</p>
      <p>Merci de vous être inscrit. Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :</p>
      <p><a href="${verifyUrl}">Vérifier mon email</a></p>
      <p>Ce lien expire dans 24 heures.</p>
      <p>Si vous n'avez pas créé de compte SPOK, ignorez cet email.</p>
    `,
  });
}

export async function generateTokens(
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
