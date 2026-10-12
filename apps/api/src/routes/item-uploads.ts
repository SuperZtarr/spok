/*
 * Upload de fichiers d'un item vers R2 : images (5 Mo max, mimes whitelist) et documents
 * (exécutables bloqués, 25 Mo max). Nécessite R2 configuré (isR2Configured).
 * Formats/tailles : validateUpload de @spok/shared (source unique web + API) — jamais redéfinis ici.
 * Refusé sur copie de séance verrouillée (itemLock).
 */
import { FastifyPluginAsync } from 'fastify';
import { validateUpload } from '@spok/shared';
import { isR2Configured, processImage, uploadImageToR2, deleteImageFromR2, uploadFileToR2, deleteFileFromR2 } from '../utils/r2.js';
import { checkSpaceAccess } from './items.js';
import { isLocked, LOCKED_MESSAGE } from '../utils/itemLock.js';

export const itemUploadRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /:id/image — upload image to R2
  fastify.post<{ Params: { spaceId: string; id: string } }>(
    '/:id/image',
    async (request, reply) => {
      if (!isR2Configured()) {
        return reply.badRequest('Le stockage R2 n\'est pas configuré. Contactez l\'administrateur.');
      }

      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot upload images');
      }

      const item = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!item) {
        return reply.notFound('Item not found');
      }
      if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);

      const file = await request.file();
      if (!file) {
        return reply.badRequest('Aucun fichier envoyé');
      }

      const typeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename });
      if (typeError) return reply.badRequest(typeError);

      const buffer = await file.toBuffer();
      const sizeError = validateUpload('image', { mimeType: file.mimetype, fileName: file.filename, size: buffer.length });
      if (sizeError) return reply.badRequest(sizeError);

      // Process and upload
      const processed = await processImage(buffer);
      const cdnUrl = await uploadImageToR2(processed, item.id);

      // Delete old R2 image if replacing
      if (item.url) {
        await deleteImageFromR2(item.url).catch(() => {});
      }

      // Update item URL
      const updated = await fastify.prisma.item.update({
        where: { id: item.id },
        data: { url: cdnUrl },
        include: {
          tags: { include: { tag: true } },
        },
      });

      return {
        ...updated,
        tags: updated.tags.map((t) => t.tag),
      };
    }
  );

  // POST /:id/document — upload document to R2
  fastify.post<{ Params: { spaceId: string; id: string } }>(
    '/:id/document',
    async (request, reply) => {
      if (!isR2Configured()) {
        return reply.badRequest('Le stockage R2 n\'est pas configuré. Contactez l\'administrateur.');
      }

      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId, request.isAdminMode);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
        return reply.forbidden('Viewers cannot upload documents');
      }

      const item = await fastify.prisma.item.findFirst({
        where: {
          id: request.params.id,
          spaceId: request.params.spaceId,
        },
      });

      if (!item) {
        return reply.notFound('Item not found');
      }
      if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);

      const file = await request.file();
      if (!file) {
        return reply.badRequest('Aucun fichier envoyé');
      }

      const typeError = validateUpload('document', { mimeType: file.mimetype, fileName: file.filename });
      if (typeError) return reply.badRequest(typeError);

      const buffer = await file.toBuffer();
      const sizeError = validateUpload('document', { mimeType: file.mimetype, fileName: file.filename, size: buffer.length });
      if (sizeError) return reply.badRequest(sizeError);

      // Upload directly (no processing for documents)
      const cdnUrl = await uploadFileToR2(buffer, item.id, file.filename, file.mimetype);

      // Delete old R2 file if replacing
      if (item.url) {
        await deleteFileFromR2(item.url).catch(() => {});
      }

      // Update item URL
      const updated = await fastify.prisma.item.update({
        where: { id: item.id },
        data: { url: cdnUrl },
        include: {
          tags: { include: { tag: true } },
        },
      });

      return {
        ...updated,
        tags: updated.tags.map((t) => t.tag),
      };
    }
  );
};
