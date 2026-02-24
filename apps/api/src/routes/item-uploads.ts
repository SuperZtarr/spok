import { FastifyPluginAsync } from 'fastify';
import { isR2Configured, processImage, uploadImageToR2, deleteImageFromR2, uploadFileToR2, deleteFileFromR2 } from '../utils/r2.js';
import { checkSpaceAccess } from './items.js';

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 Mo

const ALLOWED_DOCUMENT_MIMES = [
  // PDF
  'application/pdf',
  // Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
  'application/msword',                    // doc
  'application/vnd.ms-excel',              // xls
  'application/vnd.ms-powerpoint',         // ppt
  // Text
  'text/plain',
  'text/csv',
  'text/markdown',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
];
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25 Mo

export const itemUploadRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /:id/image — upload image to R2
  fastify.post<{ Params: { spaceId: string; id: string } }>(
    '/:id/image',
    async (request, reply) => {
      if (!isR2Configured()) {
        return reply.badRequest('Le stockage R2 n\'est pas configuré. Contactez l\'administrateur.');
      }

      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
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

      const file = await request.file();
      if (!file) {
        return reply.badRequest('Aucun fichier envoyé');
      }

      if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
        return reply.badRequest('Format non supporté. Utilisez JPEG, PNG, WebP ou GIF.');
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_IMAGE_SIZE) {
        return reply.badRequest('Fichier trop volumineux (max 5 Mo)');
      }

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

      const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, request.params.spaceId);
      if (!membership) {
        return reply.notFound('Space not found');
      }

      if (membership.role === 'VIEWER') {
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

      const file = await request.file();
      if (!file) {
        return reply.badRequest('Aucun fichier envoyé');
      }

      if (!ALLOWED_DOCUMENT_MIMES.includes(file.mimetype)) {
        return reply.badRequest('Format non supporté. Types acceptés : PDF, Office, texte, images, archives.');
      }

      const buffer = await file.toBuffer();
      if (buffer.length > MAX_DOCUMENT_SIZE) {
        return reply.badRequest('Fichier trop volumineux (max 25 Mo)');
      }

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
