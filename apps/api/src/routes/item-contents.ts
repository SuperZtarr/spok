/*
 * Contenus d'un élément (refonte « contenus multiples », lot 1, 2026-11-08) : images, fichiers, liens et schémas
 * portés par un élément, plusieurs par sorte (table item_contents). Préfixe /spaces/:spaceId/items, authentifié.
 * - POST   /:id/contents                 { kind: LINK, url, name? } | { kind: IMAGE, url, name? } (adresse externe)
 *                                        | { kind: DIAGRAM, xml, url?, name? } → contenu créé, placé en fin de sa sorte.
 * - POST   /:id/contents/upload?kind=image|file  (multipart, champ fichier) → envoi R2 contrôlé par validateUpload
 *                                        (@spok/shared, source unique) ; image ramenée en webp (processImage).
 *                                        &previewOf=<id d'un schéma> (kind=image) : l'image devient l'aperçu PNG de ce
 *                                        schéma (son url) au lieu d'un nouveau contenu (lot 2).
 *                                        kind=file : aperçu calculé (utils/filePreview.ts) → previewUrl (page 1) et
 *                                        excerpt (début du texte), absents si le format ne s'y prête pas ; jamais
 *                                        bloquant (aperçu des fichiers, 2026-11-11).
 * - PATCH  /:id/contents/:contentId      { name?, url? (LINK/IMAGE), xml? (DIAGRAM) }.
 * - DELETE /:id/contents/:contentId      → le fichier R2 (et son aperçu) n'est effacé que s'il est rangé sous items/<id>/ (fichier de
 *                                        CET élément — une adresse saisie ne vise jamais l'objet d'un autre) et n'est
 *                                        plus utilisé par aucun autre contenu ni par la colonne items.url (gardée en
 *                                        sauvegarde depuis le lot 4 : une restauration doit retrouver son fichier).
 * - PUT    /:id/contents/order { ids }   → ordre complet des contenus d'UNE sorte (ids de cette sorte, tous).
 * Droits : OWNER ou MEMBER de l'espace ; VIEWER refusé ; copie de séance verrouillée refusée.
 * Plafond ITEM_CONTENTS_MAX par élément. Toute écriture marque l'élément modifié (updatedAt / updatedById).
 * Lecture : les contenus sont renvoyés avec l'élément (items.ts — détail avec xml, liste sans xml).
 * Seule source des médias d'un élément depuis le lot 4 (2026-11-11) : plus de pont vers Item.url / content.xml.
 * Règles de gestion : apps/web/src/lib/businessRules.ts (item-contents-*).
 * Journal (2026-11-12) : chaque ajout, modification, retrait et réordonnancement écrit une entrée UPDATE de l'ÉLÉMENT
 * (entity Item, entityId = élément) avec changes.after.contentChange = { op, kind, name, previousName?, … } — lue par
 * l'historique de la fiche (utils/itemHistory.ts). Clé ignorée par la restauration admin : pas d'entité ItemContent,
 * que la restauration (auditLogs.ts) traiterait comme un élément. L'aperçu PNG d'un schéma (previewOf) n'est pas tracé.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ITEM_CONTENTS_MAX, validateUpload } from '@spok/shared';
import { isR2Configured, isR2Url, isItemStorageUrl, processImage, uploadImageToR2, uploadFileToR2, deleteFileFromR2 } from '../utils/r2.js';
import { checkSpaceAccess } from './items.js';
import { isLocked, LOCKED_MESSAGE } from '../utils/itemLock.js';
import { storeFilePreview } from '../utils/filePreview.js';
import { createAuditLog } from '../utils/audit.js';

type P = { spaceId: string; id: string };
type PC = P & { contentId: string };

const HTTP_URL = /^https?:\/\//i;
const urlField = z.string().trim().url().max(2000)
  .refine((u) => HTTP_URL.test(u), { message: "L'URL doit commencer par http:// ou https://" });
const nameField = z.string().trim().max(255).nullable().optional();
const XML_MAX = 5_000_000;

const createSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('LINK'), url: urlField, name: nameField }),
  z.object({ kind: z.literal('IMAGE'), url: urlField, name: nameField }),
  z.object({ kind: z.literal('DIAGRAM'), xml: z.string().max(XML_MAX), url: urlField.nullable().optional(), name: nameField }),
]);
const patchSchema = z.object({
  name: nameField,
  url: urlField.nullable().optional(),
  xml: z.string().max(XML_MAX).optional(),
});
const orderSchema = z.object({ ids: z.array(z.string()).min(1).max(ITEM_CONTENTS_MAX) });
const uploadQuerySchema = z.object({ kind: z.enum(['image', 'file']), previewOf: z.string().min(1).max(64).optional() });

/** Élément modifiable par le lecteur, ou réponse d'erreur déjà envoyée (null). */
async function writableItem(fastify: any, request: any, reply: any) {
  const { spaceId, id } = request.params as P;
  const membership = await checkSpaceAccess(fastify.prisma, request.user.userId, spaceId, request.isAdminMode);
  if (!membership) { reply.notFound('Space not found'); return null; }
  if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') {
    reply.forbidden('Les lecteurs ne peuvent pas modifier les contenus'); return null;
  }
  const item = await fastify.prisma.item.findFirst({ where: { id, spaceId } });
  if (!item) { reply.notFound('Item not found'); return null; }
  if (isLocked(item)) { reply.forbidden(LOCKED_MESSAGE); return null; }
  return item;
}

/** Efface un fichier du stockage s'il est rangé sous items/<itemId>/ et n'est plus utilisé nulle part
 *  (adresse ou aperçu d'un contenu — une duplication partage les deux —, ou ancienne colonne items.url). */
async function deleteIfUnused(prisma: any, url: string | null | undefined, itemId: string) {
  // Seulement un fichier rangé sous le dossier de CET élément : une adresse saisie ne doit jamais permettre
  // d'effacer l'objet d'un autre élément, d'un avatar ou d'une couverture
  if (!isItemStorageUrl(url, itemId)) return;
  const [otherContents, itemsUsing] = await Promise.all([
    prisma.itemContent.count({ where: { OR: [{ url }, { previewUrl: url }] } }),
    prisma.item.count({ where: { url } }),
  ]);
  if (!otherContents && !itemsUsing) await deleteFileFromR2(url).catch(() => {});
}

/** Position suivante dans la sorte, ou null si le plafond de l'élément est atteint. */
async function nextPosition(prisma: any, itemId: string, kind: string): Promise<number | null> {
  const total = await prisma.itemContent.count({ where: { itemId } });
  if (total >= ITEM_CONTENTS_MAX) return null;
  const last = await prisma.itemContent.aggregate({ where: { itemId, kind }, _max: { position: true } });
  const max = last?._max?.position;
  return typeof max === 'number' ? max + 1 : 0;
}

type ContentChange = { op: 'add' | 'update' | 'remove' | 'reorder'; kind: string; name?: string | null; previousName?: string | null; urlChanged?: boolean; xmlChanged?: boolean };

/** Entrée de journal d'un changement de contenus, rattachée à l'élément (voir en-tête) */
const logContentChange = (prisma: any, request: any, itemId: string, change: ContentChange) =>
  createAuditLog(prisma, {
    action: 'UPDATE', entity: 'Item', entityId: itemId, userId: request.user.userId,
    spaceId: (request.params as P).spaceId, changes: { after: { contentChange: change } },
  });

/** Nom affichable d'un contenu : son nom, sinon son adresse */
const contentLabel = (c: { name?: string | null; url?: string | null }) => c.name || c.url || null;

/** Après toute écriture de contenus : élément marqué modifié */
const touchItem = async (prisma: any, itemId: string, userId: string) => {
  await prisma.item.update({ where: { id: itemId }, data: { updatedAt: new Date(), updatedById: userId } });
};

const LIMIT_MESSAGE = `Un élément porte au plus ${ITEM_CONTENTS_MAX} contenus`;

export const itemContentRoutes: FastifyPluginAsync = async (fastify) => {
  // Ajout d'un lien, d'une image par adresse ou d'un schéma
  fastify.post<{ Params: P }>('/:id/contents', async (request, reply) => {
    const body = createSchema.parse(request.body);
    const item = await writableItem(fastify, request, reply);
    if (!item) return reply;
    const position = await nextPosition(fastify.prisma, item.id, body.kind);
    if (position === null) return reply.badRequest(LIMIT_MESSAGE);
    const content = await fastify.prisma.itemContent.create({
      data: {
        itemId: item.id,
        kind: body.kind,
        url: 'url' in body ? body.url ?? null : null,
        name: body.name ?? null,
        xml: body.kind === 'DIAGRAM' ? body.xml : null,
        position,
        createdById: request.user.userId,
      },
    });
    await touchItem(fastify.prisma, item.id, request.user.userId);
    await logContentChange(fastify.prisma, request, item.id, { op: 'add', kind: content.kind, name: contentLabel(content) });
    return reply.status(201).send(content);
  });

  // Envoi d'une image ou d'un fichier vers le stockage
  fastify.post<{ Params: P; Querystring: { kind?: string } }>('/:id/contents/upload', async (request, reply) => {
    const { kind, previewOf } = uploadQuerySchema.parse(request.query);
    if (!isR2Configured()) {
      return reply.badRequest('Le stockage R2 n\'est pas configuré. Contactez l\'administrateur.');
    }
    const item = await writableItem(fastify, request, reply);
    if (!item) return reply;
    const contentKind = kind === 'image' ? 'IMAGE' : 'FILE';
    // Aperçu d'un schéma : remplace l'url du schéma, ne crée pas de contenu (pas de plafond)
    let diagram: { id: string; url: string | null } | null = null;
    if (previewOf) {
      if (kind !== 'image') return reply.badRequest('Un aperçu de schéma est une image');
      diagram = await fastify.prisma.itemContent.findFirst({ where: { id: previewOf, itemId: item.id, kind: 'DIAGRAM' } });
      if (!diagram) return reply.notFound('Schéma introuvable');
    }
    const position = diagram ? 0 : await nextPosition(fastify.prisma, item.id, contentKind);
    if (position === null) return reply.badRequest(LIMIT_MESSAGE);

    const file = await request.file();
    if (!file) return reply.badRequest('Aucun fichier envoyé');
    const rule = kind === 'image' ? 'image' : 'document';
    const typeError = validateUpload(rule, { mimeType: file.mimetype, fileName: file.filename });
    if (typeError) return reply.badRequest(typeError);
    const buffer = await file.toBuffer();
    const sizeError = validateUpload(rule, { mimeType: file.mimetype, fileName: file.filename, size: buffer.length });
    if (sizeError) return reply.badRequest(sizeError);

    let url: string; let mimeType: string; let size: number;
    let previewUrl: string | null = null; let excerpt: string | null = null;
    if (kind === 'image') {
      const processed = await processImage(buffer);
      url = await uploadImageToR2(processed, item.id);
      mimeType = 'image/webp'; size = processed.length;
    } else {
      url = await uploadFileToR2(buffer, item.id, file.filename, file.mimetype);
      mimeType = file.mimetype; size = buffer.length;
      // Aperçu (page 1, début du texte) : jamais bloquant — sans aperçu, le fichier est enregistré tel quel
      ({ previewUrl, excerpt } = await storeFilePreview(buffer, file.mimetype, file.filename, item.id));
    }
    if (diagram) {
      const updated = await fastify.prisma.itemContent.update({ where: { id: diagram.id }, data: { url } });
      await touchItem(fastify.prisma, item.id, request.user.userId);
      await deleteIfUnused(fastify.prisma, diagram.url, item.id);
      return updated;
    }
    const content = await fastify.prisma.itemContent.create({
      data: {
        itemId: item.id, kind: contentKind, url, name: file.filename || null, mimeType, size, previewUrl, excerpt,
        position, createdById: request.user.userId,
      },
    });
    await touchItem(fastify.prisma, item.id, request.user.userId);
    await logContentChange(fastify.prisma, request, item.id, { op: 'add', kind: content.kind, name: contentLabel(content) });
    return reply.status(201).send(content);
  });

  // Modification : nom, adresse (lien / image externe), xml (schéma)
  fastify.patch<{ Params: PC }>('/:id/contents/:contentId', async (request, reply) => {
    const body = patchSchema.parse(request.body ?? {});
    const item = await writableItem(fastify, request, reply);
    if (!item) return reply;
    const content = await fastify.prisma.itemContent.findFirst({ where: { id: request.params.contentId, itemId: item.id } });
    if (!content) return reply.notFound('Contenu introuvable');
    if (body.xml !== undefined && content.kind !== 'DIAGRAM') return reply.badRequest('Seul un schéma porte du xml');
    if (body.url !== undefined && content.kind !== 'LINK' && content.kind !== 'DIAGRAM' && !(content.kind === 'IMAGE' && !isR2Url(content.url))) {
      return reply.badRequest('L\'adresse d\'un fichier envoyé ne se modifie pas');
    }
    if (body.url === null && content.kind !== 'DIAGRAM') return reply.badRequest('Adresse obligatoire');
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.url !== undefined) data.url = body.url;
    if (body.xml !== undefined) data.xml = body.xml;
    const updated = await fastify.prisma.itemContent.update({ where: { id: content.id }, data });
    await touchItem(fastify.prisma, item.id, request.user.userId);
    const renamed = body.name !== undefined && (body.name ?? null) !== (content.name ?? null);
    const urlChanged = body.url !== undefined && body.url !== content.url;
    const xmlChanged = body.xml !== undefined && body.xml !== content.xml;
    if (renamed || urlChanged || xmlChanged) {
      await logContentChange(fastify.prisma, request, item.id, {
        op: 'update', kind: content.kind, name: contentLabel(updated),
        ...(renamed ? { previousName: contentLabel(content) } : {}),
        ...(urlChanged ? { urlChanged: true } : {}), ...(xmlChanged ? { xmlChanged: true } : {}),
      });
    }
    return updated;
  });

  // Suppression (fichier effacé du stockage seulement s'il n'est plus utilisé nulle part)
  fastify.delete<{ Params: PC }>('/:id/contents/:contentId', async (request, reply) => {
    const item = await writableItem(fastify, request, reply);
    if (!item) return reply;
    const content = await fastify.prisma.itemContent.findFirst({ where: { id: request.params.contentId, itemId: item.id } });
    if (!content) return reply.notFound('Contenu introuvable');
    await fastify.prisma.itemContent.delete({ where: { id: content.id } });
    // Ancien champ resynchronisé AVANT le contrôle d'usage : sinon Item.url garderait le fichier « utilisé »
    await touchItem(fastify.prisma, item.id, request.user.userId);
    await deleteIfUnused(fastify.prisma, content.url, item.id);
    await deleteIfUnused(fastify.prisma, content.previewUrl, item.id);
    await logContentChange(fastify.prisma, request, item.id, { op: 'remove', kind: content.kind, name: contentLabel(content) });
    return reply.status(204).send();
  });

  // Ordre des contenus d'une sorte : liste complète des ids de cette sorte
  fastify.put<{ Params: P }>('/:id/contents/order', async (request, reply) => {
    const { ids } = orderSchema.parse(request.body);
    const item = await writableItem(fastify, request, reply);
    if (!item) return reply;
    const contents: { id: string; kind: string }[] = await fastify.prisma.itemContent.findMany({
      where: { itemId: item.id }, select: { id: true, kind: true },
    });
    const byId = new Map(contents.map((c) => [c.id, c.kind]));
    const kind = byId.get(ids[0]);
    const sameKind = contents.filter((c) => c.kind === kind).map((c) => c.id);
    const valid = kind !== undefined && new Set(ids).size === ids.length && ids.length === sameKind.length
      && ids.every((id) => byId.get(id) === kind);
    if (!valid) return reply.badRequest('Donner tous les contenus d\'une même sorte, chacun une fois');
    await fastify.prisma.$transaction(ids.map((id, position) =>
      fastify.prisma.itemContent.update({ where: { id }, data: { position } })));
    await touchItem(fastify.prisma, item.id, request.user.userId);
    await logContentChange(fastify.prisma, request, item.id, { op: 'reorder', kind });
    return fastify.prisma.itemContent.findMany({ where: { itemId: item.id }, orderBy: [{ kind: 'asc' }, { position: 'asc' }] });
  });
};
