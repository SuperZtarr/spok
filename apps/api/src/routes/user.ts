import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import sharp from 'sharp';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const updatePreferencesSchema = z.object({
  themePreference: z.enum(['light', 'dark', 'system']).optional(),
});

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Le nom ne peut pas être vide').max(100).optional(),
  email: z.string().email('Email invalide').optional(),
}).refine(data => data.name || data.email, { message: 'Au moins un champ requis' });

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

    const updateData: { name?: string; email?: string } = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email;

    const user = await fastify.prisma.user.update({
      where: { id: request.user.userId },
      data: updateData,
      select: { name: true, email: true },
    });

    return { name: user.name, email: user.email };
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
