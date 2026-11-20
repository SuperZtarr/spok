/*
 * Données sécurisées d'un élément (décision Thomas 2026-11-20) : mots de passe, codes, clés rangés sur un élément.
 * Préfixe /spaces/:spaceId/items, authentifié. Seule route (avec utils/itemSecrets.ts) qui lit la table item_secrets :
 * aucune autre lecture (liste, détail, recherche, export, activité, articles, séances, MCP) ne peut donc les voir
 * (garde : secrets-leak.test.ts).
 * - GET    /:id/secrets                     → ItemSecretSummary[] (@spok/shared) — jamais de valeur ni d'identifiant.
 *                                             Les siennes + celles « membres de l'espace » des autres ; mode admin :
 *                                             toutes (libellés). Lecteur (VIEWER, communauté publique) : liste vide.
 * - POST   /:id/secrets { label, login?, value, visibility? } → créée en fin de liste (OWNER/MEMBER, élément non
 *                                             verrouillé, ITEM_SECRETS_MAX).
 * - PATCH  /:id/secrets/:secretId { label?, login?, value?, visibility? } → auteur seul ; login null l'efface.
 * - DELETE /:id/secrets/:secretId           → auteur, ou mode admin.
 * - POST   /:id/secrets/:secretId/reveal    → { login, value } avec Cache-Control: no-store. Auteur, ou visibilité
 *                                             SPACE + membre réel (adhésion explicite OWNER/MEMBER ou propriétaire de
 *                                             la communauté — jamais le rôle implicite d'un espace OPEN / d'une
 *                                             communauté publique). Le mode admin n'ouvre aucun droit de lecture
 *                                             (403). MCP distant ou jeton personnel (PAT) → 403. Donnée invisible
 *                                             pour le lecteur → 404 (n'en confirme pas l'existence).
 * Chiffrement : utils/secretCrypto.ts (AES-256-GCM, AAD = id). Clé absente → 503 sur création, nouvelle valeur et
 * révélation ; la liste reste lisible.
 * Journal : ajout / modification / suppression = UPDATE de l'élément (changes.after.contentChange, kind 'SECRET',
 * libellé seulement, lu par l'historique de la fiche) ; révélation = action READ (changes.after.secretRead) +
 * revealCount / lastRevealedAt. Jamais de valeur, d'identifiant ni de chiffré dans un journal ou un message d'erreur.
 * Règles de gestion : apps/web/src/lib/businessRules.ts (item-secrets).
 */
import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ITEM_SECRETS_MAX, ITEM_SECRET_LIMITS, ITEM_SECRET_VISIBILITIES, type ItemSecretSummary } from '@spok/shared';
import { checkSpaceAccess, isCommunityOwnerOfSpace } from './items.js';
import { isLocked, LOCKED_MESSAGE } from '../utils/itemLock.js';
import { createAuditLog } from '../utils/audit.js';
import { getRequestContext } from '../utils/requestContext.js';
import { isSecretsConfigured, encryptSecret, decryptSecret } from '../utils/secretCrypto.js';

type P = { spaceId: string; id: string };
type PS = P & { secretId: string };

const visibilityField = z.enum(ITEM_SECRET_VISIBILITIES.map((v) => v.id) as [string, ...string[]]);
const labelField = z.string().trim().min(1).max(ITEM_SECRET_LIMITS.label);
const loginField = z.string().max(ITEM_SECRET_LIMITS.login);
const valueField = z.string().min(1).max(ITEM_SECRET_LIMITS.value);

const createSchema = z.object({
  label: labelField,
  login: loginField.nullable().optional(),
  value: valueField,
  visibility: visibilityField.optional(),
});
const patchSchema = z.object({
  label: labelField.optional(),
  login: loginField.nullable().optional(),
  value: valueField.optional(),
  visibility: visibilityField.optional(),
});

const NOT_CONFIGURED = 'Données sécurisées non configurées sur ce serveur';

/** Colonnes lues pour la liste : jamais valueEnc ; loginEnc (chiffré) seulement pour en déduire hasLogin dans toSummary */
const SUMMARY_SELECT = {
  id: true, itemId: true, label: true, loginEnc: true, visibility: true, position: true, createdById: true,
  revealCount: true, lastRevealedAt: true, createdAt: true, updatedAt: true,
  createdBy: { select: { name: true } },
} as const;

/** Droits du lecteur sur les données sécurisées d'un espace */
interface Access {
  userId: string;
  /** Peut écrire (OWNER/MEMBER, mode admin compris) */
  canWrite: boolean;
  /** Membre réel (OWNER/MEMBER hors mode admin) : lit les données « membres de l'espace » */
  isMember: boolean;
  isAdminMode: boolean;
}

async function accessOf(fastify: any, request: any, reply: any): Promise<Access | null> {
  const { spaceId } = request.params as P;
  const userId: string = request.user.userId;
  const isAdminMode = !!request.isAdminMode;
  const membership = await checkSpaceAccess(fastify.prisma, userId, spaceId, isAdminMode);
  if (!membership) { reply.notFound('Space not found'); return null; }
  const writer = (r?: string) => r === 'OWNER' || r === 'MEMBER';
  // Membre réel = adhésion explicite à l'espace (OWNER/MEMBER) ou propriétaire de la communauté. Jamais le rôle
  // implicite d'un espace OPEN ou d'une communauté publique (tout inscrit y est MEMBER — revue sécu 2026-11-20), ni
  // le mode admin (aucun droit de lecture).
  const direct = await fastify.prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId } } });
  const isMember = writer(direct?.role) || await isCommunityOwnerOfSpace(fastify.prisma, userId, spaceId);
  return { userId, canWrite: writer(membership.role), isMember, isAdminMode };
}

/** L'élément de l'espace, ou réponse 404 déjà envoyée (null) */
async function itemOf(fastify: any, request: any, reply: any) {
  const { spaceId, id } = request.params as P;
  const item = await fastify.prisma.item.findFirst({ where: { id, spaceId } });
  if (!item) { reply.notFound('Item not found'); return null; }
  return item;
}

const canSee = (a: Access, s: { createdById: string; visibility: string }) =>
  s.createdById === a.userId || (s.visibility === 'SPACE' && a.isMember) || a.isAdminMode;
const canReveal = (a: Access, s: { createdById: string; visibility: string }) =>
  s.createdById === a.userId || (s.visibility === 'SPACE' && a.isMember);

function toSummary(a: Access, s: any): ItemSecretSummary {
  return {
    id: s.id, itemId: s.itemId, label: s.label, hasLogin: !!s.loginEnc, visibility: s.visibility,
    position: s.position, createdById: s.createdById, createdByName: s.createdBy?.name ?? null,
    canReveal: canReveal(a, s), canEdit: s.createdById === a.userId,
    canDelete: s.createdById === a.userId || a.isAdminMode,
    revealCount: s.revealCount, lastRevealedAt: s.lastRevealedAt ? new Date(s.lastRevealedAt).toISOString() : null,
    createdAt: new Date(s.createdAt).toISOString(), updatedAt: new Date(s.updatedAt).toISOString(),
  };
}

type SecretChange = { op: 'add' | 'update' | 'remove'; kind: 'SECRET'; name: string; previousName?: string; valueChanged?: boolean; visibility?: string };

const logSecretChange = (prisma: any, request: any, itemId: string, change: SecretChange) =>
  createAuditLog(prisma, {
    action: 'UPDATE', entity: 'Item', entityId: itemId, userId: request.user.userId,
    spaceId: (request.params as P).spaceId, changes: { after: { contentChange: change } },
  });

const touchItem = (prisma: any, itemId: string, userId: string) =>
  prisma.item.update({ where: { id: itemId }, data: { updatedAt: new Date(), updatedById: userId } });

/** Ligne de la donnée sur cet élément (sans valueEnc) */
const findSecret = (prisma: any, itemId: string, secretId: string) =>
  prisma.itemSecret.findFirst({ where: { id: secretId, itemId }, select: SUMMARY_SELECT });

export const itemSecretRoutes: FastifyPluginAsync = async (fastify) => {
  // Liste (libellés seulement)
  fastify.get<{ Params: P }>('/:id/secrets', async (request, reply) => {
    const access = await accessOf(fastify, request, reply);
    if (!access) return reply;
    const item = await itemOf(fastify, request, reply);
    if (!item) return reply;
    if (!access.canWrite && !access.isMember) return [];
    const rows = await fastify.prisma.itemSecret.findMany({
      where: { itemId: item.id }, select: SUMMARY_SELECT, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.filter((s: any) => canSee(access, s)).map((s: any) => toSummary(access, s));
  });

  // Création
  fastify.post<{ Params: P }>('/:id/secrets', async (request, reply) => {
    const body = createSchema.parse(request.body);
    const access = await accessOf(fastify, request, reply);
    if (!access) return reply;
    if (!access.canWrite) return reply.forbidden('Les lecteurs ne peuvent pas ajouter de données sécurisées');
    const item = await itemOf(fastify, request, reply);
    if (!item) return reply;
    if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);
    if (!isSecretsConfigured()) return reply.serviceUnavailable(NOT_CONFIGURED);
    const total = await fastify.prisma.itemSecret.count({ where: { itemId: item.id } });
    if (total >= ITEM_SECRETS_MAX) return reply.conflict(`Un élément porte au plus ${ITEM_SECRETS_MAX} données sécurisées`);
    const last = await fastify.prisma.itemSecret.aggregate({ where: { itemId: item.id }, _max: { position: true } });
    const max = last?._max?.position;
    const id = randomUUID();
    const created = await fastify.prisma.itemSecret.create({
      data: {
        id, itemId: item.id, label: body.label,
        loginEnc: body.login ? encryptSecret(body.login, id) : null,
        valueEnc: encryptSecret(body.value, id),
        visibility: (body.visibility ?? 'PRIVATE') as any,
        position: typeof max === 'number' ? max + 1 : 0,
        createdById: access.userId,
      },
      select: SUMMARY_SELECT,
    });
    await touchItem(fastify.prisma, item.id, access.userId);
    await logSecretChange(fastify.prisma, request, item.id, { op: 'add', kind: 'SECRET', name: created.label, visibility: created.visibility });
    return reply.status(201).send(toSummary(access, created));
  });

  // Modification (auteur seul)
  fastify.patch<{ Params: PS }>('/:id/secrets/:secretId', async (request, reply) => {
    const body = patchSchema.parse(request.body);
    const access = await accessOf(fastify, request, reply);
    if (!access) return reply;
    const item = await itemOf(fastify, request, reply);
    if (!item) return reply;
    const secret = await findSecret(fastify.prisma, item.id, request.params.secretId);
    if (!secret || !canSee(access, secret)) return reply.notFound('Donnée introuvable');
    if (secret.createdById !== access.userId) return reply.forbidden("Seul l'auteur modifie une donnée sécurisée");
    if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);
    const touchesCipher = body.value !== undefined || (body.login !== undefined && body.login !== null && body.login !== '');
    if (touchesCipher && !isSecretsConfigured()) return reply.serviceUnavailable(NOT_CONFIGURED);
    const data: Record<string, unknown> = {};
    if (body.label !== undefined) data.label = body.label;
    if (body.visibility !== undefined) data.visibility = body.visibility;
    if (body.value !== undefined) data.valueEnc = encryptSecret(body.value, secret.id);
    if (body.login !== undefined) data.loginEnc = body.login ? encryptSecret(body.login, secret.id) : null;
    const updated = await fastify.prisma.itemSecret.update({ where: { id: secret.id }, data, select: SUMMARY_SELECT });
    await touchItem(fastify.prisma, item.id, access.userId);
    await logSecretChange(fastify.prisma, request, item.id, {
      op: 'update', kind: 'SECRET', name: updated.label,
      ...(body.label !== undefined && body.label !== secret.label ? { previousName: secret.label } : {}),
      ...(body.value !== undefined || body.login !== undefined ? { valueChanged: true } : {}),
      ...(body.visibility !== undefined && body.visibility !== secret.visibility ? { visibility: body.visibility } : {}),
    });
    return toSummary(access, updated);
  });

  // Suppression (auteur, ou mode admin)
  fastify.delete<{ Params: PS }>('/:id/secrets/:secretId', async (request, reply) => {
    const access = await accessOf(fastify, request, reply);
    if (!access) return reply;
    const item = await itemOf(fastify, request, reply);
    if (!item) return reply;
    const secret = await findSecret(fastify.prisma, item.id, request.params.secretId);
    if (!secret || !canSee(access, secret)) return reply.notFound('Donnée introuvable');
    if (secret.createdById !== access.userId && !access.isAdminMode) {
      return reply.forbidden("Seul l'auteur supprime une donnée sécurisée");
    }
    if (isLocked(item)) return reply.forbidden(LOCKED_MESSAGE);
    await fastify.prisma.itemSecret.delete({ where: { id: secret.id } });
    await touchItem(fastify.prisma, item.id, access.userId);
    await logSecretChange(fastify.prisma, request, item.id, { op: 'remove', kind: 'SECRET', name: secret.label });
    return reply.status(204).send();
  });

  // Révélation : seule réponse qui porte la valeur
  fastify.post<{ Params: PS }>('/:id/secrets/:secretId/reveal', async (request, reply) => {
    // Ni MCP distant, ni jeton personnel (MCP local, scripts) : la valeur ne se lit que dans l'application
    if (getRequestContext()?.via === 'mcp' || (request as any).authVia === 'pat') {
      return reply.forbidden('Les données sécurisées ne se lisent que dans SPOK');
    }
    const access = await accessOf(fastify, request, reply);
    if (!access) return reply;
    const item = await itemOf(fastify, request, reply);
    if (!item) return reply;
    const row = await fastify.prisma.itemSecret.findFirst({
      where: { id: request.params.secretId, itemId: item.id },
      select: { id: true, label: true, createdById: true, visibility: true, loginEnc: true, valueEnc: true },
    });
    if (!row || !canSee(access, row)) return reply.notFound('Donnée introuvable');
    if (!canReveal(access, row)) return reply.forbidden("Le mode admin ne donne pas accès à la valeur d'une donnée sécurisée");
    if (!isSecretsConfigured()) return reply.serviceUnavailable(NOT_CONFIGURED);
    let value: string; let login: string | null;
    try {
      value = decryptSecret(row.valueEnc, row.id);
      login = row.loginEnc ? decryptSecret(row.loginEnc, row.id) : null;
    } catch {
      return reply.internalServerError('Donnée sécurisée illisible (clé de chiffrement changée ?)');
    }
    await fastify.prisma.itemSecret.update({
      where: { id: row.id }, data: { revealCount: { increment: 1 }, lastRevealedAt: new Date() }, select: { id: true },
    });
    await createAuditLog(fastify.prisma, {
      action: 'READ', entity: 'Item', entityId: item.id, userId: access.userId,
      spaceId: (request.params as P).spaceId, changes: { after: { secretRead: { secretId: row.id, label: row.label } } },
    });
    reply.header('Cache-Control', 'no-store');
    return { login, value };
  });
};
