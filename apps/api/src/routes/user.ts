import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { hash, compare } from 'bcrypt';
import sharp from 'sharp';
import { generateTokens, sendVerificationEmail } from './auth.js';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const updatePreferencesSchema = z.object({
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Le nom ne peut pas être vide').max(100).optional(),
  email: z.string().email('Email invalide').optional(),
}).refine(data => data.name || data.email, { message: 'Au moins un champ requis' });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Le nouveau mot de passe doit faire au moins 8 caractères'),
});

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /user/preferences
  fastify.get('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { themePreference: true },
    });

    return { themePreference: user?.themePreference ?? 'system' };
  });

  // PATCH /user/preferences
  fastify.patch('/preferences', { preHandler: [fastify.authenticate] }, async (request) => {
    const data = updatePreferencesSchema.parse(request.body);

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data,
      select: { themePreference: true },
    });

    return { themePreference: user.themePreference };
  });

  // PATCH /user/profile — update name and/or email
  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const data = updateProfileSchema.parse(request.body);

    // Check email uniqueness if changing email
    if (data.email) {
      const existing = await fastify.prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== request.user.userId) {
        return reply.conflict('Cet email est déjà utilisé');
      }
    }

    const updateData: { name?: string; email?: string; emailVerified?: boolean } = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;

    // If email is changing, reset verification
    const isEmailChanging = data.email && data.email !== request.user.email;
    if (isEmailChanging) {
      updateData.emailVerified = false;
    }

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: updateData,
      select: { name: true, email: true, emailVerified: true },
    });

    // If email changed, regenerate tokens and send verification email
    if (isEmailChanging) {
      const tokens = await generateTokens(fastify, request.user.userId, user.email);

      // Send verification email for the new address (fire-and-forget)
      sendVerificationEmail(fastify, request.user.userId, user.email, user.name).catch((error) => {
        fastify.log.error(error, 'Failed to send verification email after email change');
      });

      return { name: user.name, email: user.email, emailVerified: user.emailVerified, tokens };
    }

    return { name: user.name, email: user.email, emailVerified: user.emailVerified };
  });

  // PATCH /user/password — change password
  fastify.patch('/password', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body);

    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { passwordHash: true },
    });

    if (!user) return reply.notFound('Utilisateur non trouvé');

    const valid = await compare(currentPassword, user.passwordHash);
    if (!valid) {
      return reply.badRequest('Mot de passe actuel incorrect');
    }

    const passwordHash = await hash(newPassword, 10);
    await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: { passwordHash },
    });

    return { success: true };
  });

  // POST /user/avatar — upload avatar (stored as data URI in DB)
  fastify.post('/avatar', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const file = await request.file();

    if (!file) {
      return reply.badRequest('Aucun fichier envoyé');
    }

    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      return reply.badRequest('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
    }

    const buffer = await file.toBuffer();

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.badRequest('Fichier trop volumineux (max 5 Mo)');
    }

    // Resize and convert to webp
    const processed = await sharp(buffer)
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Store as data URI in DB (no filesystem dependency)
    const avatarUrl = `data:image/webp;base64,${processed.toString('base64')}`;
    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: { avatarUrl },
      select: { avatarUrl: true },
    });

    return { avatarUrl: user.avatarUrl };
  });

  // DELETE /user/avatar — remove avatar
  fastify.delete('/avatar', { preHandler: [fastify.authenticate] }, async (request) => {
    await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: { avatarUrl: null },
    });

    return { success: true };
  });
};
