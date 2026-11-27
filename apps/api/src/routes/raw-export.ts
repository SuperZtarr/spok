/*
 * Routes de l'export brut réimportable (« Données brutes », décision Thomas 2026-11-27) — logique dans utils/rawExport.ts.
 *   GET  /spaces/:id/raw-export?format=json|xml : l'espace et ses sous-espaces lisibles par l'appelant (lecture suffit).
 *        E-mails des personnes écrits seulement pour un rôle OWNER (propriétaire, propriétaire de la communauté, mode
 *        admin — règle members-email-scope) : sans eux, l'import ne rapproche pas les personnes.
 *   POST /spaces/raw-import : { format, content (texte du fichier), communityId? | parentSpaceId?, dryRun }.
 *        Droits = ceux de la création d'un espace : sous un espace → écriture (OWNER/MEMBER) sur cet espace de groupe ;
 *        racine d'une communauté → membre de la communauté (ou admin en mode admin). dryRun = aperçu, rien n'est écrit.
 *        Erreur de contenu du fichier → 400 avec un message lisible (RawImportError).
 * Enregistré dans index.ts sous le préfixe /spaces.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { RAW_EXPORT_FILE_FORMAT_IDS, RAW_EXPORT_FILE_FORMATS, RAW_EXPORT_MAX_BYTES } from '@spok/shared';
import { checkSpaceAccess } from './items.js';
import { buildRawExport, importRawDocument, parseRawDocument, readableSpaceTree, serializeRawExport, RawImportError } from '../utils/rawExport.js';

const exportQuerySchema = z.object({ format: z.enum(RAW_EXPORT_FILE_FORMAT_IDS).default('json') });

const importSchema = z.object({
  format: z.enum(RAW_EXPORT_FILE_FORMAT_IDS),
  content: z.string().min(1).max(RAW_EXPORT_MAX_BYTES),
  communityId: z.string().optional(),
  parentSpaceId: z.string().optional(),
  dryRun: z.boolean().default(true),
}).refine((b) => !!b.communityId !== !!b.parentSpaceId, { message: 'Choisir une communauté OU un espace parent' });

export const rawExportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string }; Querystring: { format?: string } }>(
    '/:id/raw-export',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { format } = exportQuerySchema.parse(request.query);
      const { userId } = request.user;
      const access = await checkSpaceAccess(fastify.prisma, userId, request.params.id, request.isAdminMode);
      if (!access) return reply.notFound('Space not found');

      const spaceIds = await readableSpaceTree(fastify.prisma, request.params.id,
        async (id) => !!(await checkSpaceAccess(fastify.prisma, userId, id, request.isAdminMode)));
      const doc = await buildRawExport(fastify.prisma, spaceIds, { includeEmails: access.role === 'OWNER' });
      const mime = RAW_EXPORT_FILE_FORMATS.find((f) => f.id === format)!.mimeType;
      return reply.type(`${mime}; charset=utf-8`).send(serializeRawExport(doc, format));
    },
  );

  fastify.post<{ Body: z.infer<typeof importSchema> }>(
    '/raw-import',
    { preHandler: [fastify.authenticate], bodyLimit: Math.ceil(RAW_EXPORT_MAX_BYTES * 1.2) },
    async (request, reply) => {
      const parsedBody = importSchema.safeParse(request.body);
      if (!parsedBody.success) return reply.badRequest(parsedBody.error.issues[0]?.message ?? 'Requête invalide');
      const body = parsedBody.data;
      const { userId } = request.user;

      let communityId: string | null = null;
      let parentSpaceId: string | null = null;
      if (body.parentSpaceId) {
        const parent = await fastify.prisma.space.findUnique({ where: { id: body.parentSpaceId }, select: { type: true, communityId: true } });
        if (!parent) return reply.notFound('Espace parent introuvable');
        if (parent.type !== 'GROUP') return reply.badRequest('Seuls les espaces de groupe peuvent avoir des sous-espaces');
        const access = await checkSpaceAccess(fastify.prisma, userId, body.parentSpaceId, request.isAdminMode);
        if (!access || (access.role !== 'OWNER' && access.role !== 'MEMBER')) {
          return reply.forbidden('Accès en écriture à l\'espace parent requis');
        }
        parentSpaceId = body.parentSpaceId;
        communityId = parent.communityId ?? null;
      } else {
        const community = await fastify.prisma.community.findUnique({ where: { id: body.communityId! }, select: { id: true } });
        if (!community) return reply.notFound('Communauté introuvable');
        const membership = await fastify.prisma.communityMembership.findUnique({
          where: { userId_communityId: { userId, communityId: body.communityId! } },
        });
        if (!membership) {
          const user = await fastify.prisma.user.findUnique({ where: { id: userId }, select: { globalRole: true } });
          if (!(user?.globalRole === 'ADMIN' && request.isAdminMode)) return reply.forbidden('You are not a member of this community');
        }
        communityId = body.communityId!;
      }

      try {
        const doc = parseRawDocument(body.content, body.format);
        return await importRawDocument(fastify.prisma, doc, { userId, communityId, parentSpaceId, dryRun: body.dryRun });
      } catch (e) {
        if (e instanceof RawImportError) return reply.badRequest(e.message);
        throw e;
      }
    },
  );
};
