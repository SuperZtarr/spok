/*
 * Question (type d'item QUESTION, 2026-11-08) : options préparées, issue notée en un clic, votes des membres.
 * Préfixe /spaces/:spaceId/items (comme item-article). Règles de gestion : apps/web/src/lib/businessRules.ts
 * (question-*), utilitaires : utils/question.ts.
 * - GET /:id/question (authentification facultative : un visiteur voit le décompte, sans voter) → QuestionView.
 * - PUT /:id/question/options { multiple?, options: [{ id?, label, refItemId? }] } : refItemId (2026-11-12) = élément
 *   lié à la réponse (null = aucun, absent = inchangé) ; un lien nouveau ou changé doit viser un élément lisible par
 *   l'auteur, autre que la question (400 sinon). Liste complète dans l'ordre ; garde les
 *   identifiants reçus (les votes restent attachés à une option corrigée ou déplacée), crée les nouvelles, retire
 *   les absentes (et leurs votes). Passer en choix unique ne garde que le dernier vote de chacun. Réservé à qui peut
 *   modifier l'élément ; refusé sur une copie de séance verrouillée.
 * - PUT /:id/question/outcome { status, chosenOptionId?, answerText?, note? } : note l'issue (statut réservé
 *   question_*). « Tranchée » exige une option retenue OU une réponse écrite. Hors séance : qui peut modifier
 *   l'élément. Copie de séance (verrouillée) : l'animateur seul — exception au verrou — et l'issue est reportée sur
 *   la question d'origine s'il peut la modifier (option retrouvée par son libellé, sinon réponse écrite).
 * - PUT /:id/question/vote { optionIds } : remplace les votes du lecteur (vide = retire son vote). Membre pouvant
 *   contribuer (OWNER/MEMBER), copie de séance comprise (comme les commentaires) ; 409 si la question n'est plus
 *   Ouverte (vote figé) ; 400 si plusieurs options en choix unique.
 * Vue : un élément lié n'est montré (titre, type, espace) qu'au lecteur qui peut lire son espace (viewerOf).
 * Toute écriture diffuse { type: 'question' } si l'élément est dans un espace de séance (notifyLiveQuestion).
 * Les votes ne tranchent jamais : seule la route outcome change l'issue.
 */
import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { QUESTION_STATUS } from '@spok/shared';
import { checkSpaceAccess } from './items.js';
import { canMemberManageItem } from '../utils/itemOwnership.js';
import { createAuditLog, serializeItemForAudit } from '../utils/audit.js';
import {
  QUESTION_OUTCOME_IDS, isQuestionOpen, isSessionHostFor, loadQuestionView, notifyLiveQuestion, syncQuestionAfterStatus,
} from '../utils/question.js';

type P = { spaceId: string; id: string };

const optionsSchema = z.object({
  multiple: z.boolean().optional(),
  options: z.array(z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1).max(200),
    refItemId: z.string().max(64).nullable().optional(),
  })).max(30),
});
const outcomeSchema = z.object({
  status: z.enum(QUESTION_OUTCOME_IDS as [string, ...string[]]),
  chosenOptionId: z.string().nullable().optional(),
  answerText: z.string().trim().max(500).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
});
const voteSchema = z.object({ optionIds: z.array(z.string()).max(30) });

async function findQuestion(prisma: any, spaceId: string, id: string) {
  const item = await prisma.item.findFirst({ where: { id, spaceId } });
  return item?.type === 'QUESTION' ? item : null;
}

const canManage = (membership: any, item: any, userId: string) =>
  membership.role === 'OWNER' || (membership.role === 'MEMBER' && canMemberManageItem(item, userId));

/** Lecteur de la vue : rôle + accès aux autres espaces (éléments liés aux réponses, 2026-11-12) */
const viewerOf = (prisma: any, userId: string | undefined, membership: any, isAdminMode: boolean) => ({
  userId: userId || undefined,
  role: userId ? membership.role : null,
  canReadSpace: async (spaceId: string) => !!(await checkSpaceAccess(prisma, userId, spaceId, isAdminMode)),
});

/** Lecture (authentification facultative) */
export const itemQuestionReadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: P }>('/:id/question', async (request, reply) => {
    const userId = request.user?.userId;
    const membership = await checkSpaceAccess(fastify.prisma, userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    const item = await findQuestion(fastify.prisma, request.params.spaceId, request.params.id);
    if (!item) return reply.notFound('Question introuvable');
    return loadQuestionView(fastify.prisma, item, viewerOf(fastify.prisma, userId, membership, request.isAdminMode));
  });
};

/** Écritures (enregistrées dans la portée authentifiée d'itemsRoutes) */
export const itemQuestionWriteRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma;

  fastify.put<{ Params: P }>('/:id/question/options', async (request, reply) => {
    const userId = request.user.userId;
    const membership = await checkSpaceAccess(prisma, userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    const item = await findQuestion(prisma, request.params.spaceId, request.params.id);
    if (!item) return reply.notFound('Question introuvable');
    if (item.lockedAt) return reply.forbidden('Question de séance verrouillée : ses options ne se modifient pas');
    if (!canManage(membership, item, userId)) return reply.forbidden('Réservé à qui peut modifier la question');
    const body = optionsSchema.parse(request.body);

    const existing = await prisma.questionOption.findMany({ where: { itemId: item.id } });
    const existingIds = new Set((existing ?? []).map((o: any) => o.id));
    const keptIds = new Set(body.options.filter((o) => o.id && existingIds.has(o.id)).map((o) => o.id!));

    // Élément lié (2026-11-12) : un lien nouveau ou changé doit viser un élément que l'auteur peut lire, autre que la
    // question ; un lien déjà enregistré se garde tel quel (même si l'auteur n'a plus accès à l'élément)
    const previousRef = new Map((existing ?? []).map((o: any) => [o.id, o.refItemId ?? null]));
    const refOf = (o: { id?: string; refItemId?: string | null }) =>
      o.refItemId === undefined ? (o.id && keptIds.has(o.id) ? previousRef.get(o.id) ?? null : null) : o.refItemId;
    const toCheck = [...new Set(body.options
      .filter((o) => { const r = refOf(o); return r && r !== (o.id && keptIds.has(o.id) ? previousRef.get(o.id) : null); })
      .map((o) => refOf(o)!))];
    for (const refId of toCheck) {
      if (refId === item.id) return reply.badRequest('Une réponse ne peut pas renvoyer à la question elle-même');
      const ref = await prisma.item.findUnique({ where: { id: refId }, select: { id: true, spaceId: true } });
      if (!ref || !(await checkSpaceAccess(prisma, userId, ref.spaceId, request.isAdminMode))) {
        return reply.badRequest('Élément lié introuvable ou inaccessible');
      }
    }

    const removed = (existing ?? []).filter((o: any) => !keptIds.has(o.id)).map((o: any) => o.id);
    if (removed.length > 0) await prisma.questionOption.deleteMany({ where: { id: { in: removed } } });
    for (const [position, o] of body.options.entries()) {
      const refItemId = refOf(o);
      if (o.id && keptIds.has(o.id)) await prisma.questionOption.update({ where: { id: o.id }, data: { label: o.label, position, refItemId } });
      else await prisma.questionOption.create({ data: { itemId: item.id, label: o.label, position, refItemId } });
    }

    const question = await prisma.question.findUnique({ where: { itemId: item.id } });
    const multiple = body.multiple ?? question?.multiple ?? false;
    await prisma.question.upsert({
      where: { itemId: item.id },
      create: { itemId: item.id, multiple },
      update: { multiple, ...(question?.chosenOptionId && removed.includes(question.chosenOptionId) ? { chosenOptionId: null } : {}) },
    });
    // Passage en choix unique : on garde le dernier vote de chacun
    if (!multiple) {
      const votes = await prisma.questionVote.findMany({ where: { itemId: item.id }, orderBy: { createdAt: 'desc' } });
      const seen = new Set<string>();
      const extra = (votes ?? []).filter((v: any) => (seen.has(v.userId) ? true : (seen.add(v.userId), false))).map((v: any) => v.id);
      if (extra.length > 0) await prisma.questionVote.deleteMany({ where: { id: { in: extra } } });
    }
    // Change updatedAt : une copie de séance antérieure n'est plus réutilisée à l'affichage
    await prisma.item.update({ where: { id: item.id }, data: { updatedById: userId } });
    await notifyLiveQuestion(prisma, item.spaceId, item.id);
    return loadQuestionView(prisma, item, viewerOf(prisma, userId, membership, request.isAdminMode));
  });

  fastify.put<{ Params: P }>('/:id/question/outcome', async (request, reply) => {
    const userId = request.user.userId;
    const membership = await checkSpaceAccess(prisma, userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    const item = await findQuestion(prisma, request.params.spaceId, request.params.id);
    if (!item) return reply.notFound('Question introuvable');
    const body = outcomeSchema.parse(request.body);
    if (item.lockedAt) {
      if (!(await isSessionHostFor(prisma, item.spaceId, userId))) return reply.forbidden('Seul l\'animateur note l\'issue en séance');
    } else if (!canManage(membership, item, userId)) {
      return reply.forbidden('Réservé à qui peut modifier la question');
    }

    const decided = body.status === QUESTION_STATUS.DECIDED;
    const chosenOptionId = decided ? body.chosenOptionId || null : null;
    const answerText = decided && !chosenOptionId ? body.answerText || null : null;
    if (decided && !chosenOptionId && !answerText) return reply.badRequest('Une question tranchée demande l\'option retenue ou une réponse écrite');
    if (chosenOptionId && !(await prisma.questionOption.findFirst({ where: { id: chosenOptionId, itemId: item.id } }))) {
      return reply.badRequest('Option inconnue');
    }

    const applyOutcome = async (target: any, optionId: string | null, text: string | null) => {
      const updated = await prisma.item.update({ where: { id: target.id }, data: { status: body.status, updatedById: userId } });
      await syncQuestionAfterStatus(prisma, target.id, body.status, userId);
      if (!isQuestionOpen(body.status)) {
        await prisma.question.update({ where: { itemId: target.id }, data: { chosenOptionId: optionId, answerText: text, note: body.note || null } });
      }
      await createAuditLog(prisma, {
        action: 'UPDATE', entity: 'Item', entityId: target.id, userId, spaceId: target.spaceId,
        changes: { before: serializeItemForAudit(target), after: serializeItemForAudit(updated) },
      });
      await notifyLiveQuestion(prisma, target.spaceId, target.id);
    };
    await applyOutcome(item, chosenOptionId, answerText);

    // Copie de séance : issue reportée sur la question d'origine si l'animateur peut la modifier
    if (item.lockedAt && item.sourceItemId) {
      const source = await prisma.item.findUnique({ where: { id: item.sourceItemId } });
      const srcMembership = source && !source.lockedAt && source.type === 'QUESTION'
        ? await checkSpaceAccess(prisma, userId, source.spaceId, false) : null;
      if (source && srcMembership && canManage(srcMembership, source, userId)) {
        let srcOptionId: string | null = null;
        let srcText = answerText;
        if (chosenOptionId) {
          const label = (await prisma.questionOption.findUnique({ where: { id: chosenOptionId } }))?.label ?? '';
          const match = (await prisma.questionOption.findMany({ where: { itemId: source.id } }))
            .find((o: any) => o.label.trim().toLowerCase() === label.trim().toLowerCase());
          srcOptionId = match?.id ?? null;
          srcText = match ? null : label;
        }
        await applyOutcome(source, srcOptionId, srcText);
      }
    }
    return loadQuestionView(prisma, await prisma.item.findUnique({ where: { id: item.id } }), viewerOf(prisma, userId, membership, request.isAdminMode));
  });

  fastify.put<{ Params: P }>('/:id/question/vote', async (request, reply) => {
    const userId = request.user.userId;
    const membership = await checkSpaceAccess(prisma, userId, request.params.spaceId, request.isAdminMode);
    if (!membership) return reply.notFound('Space not found');
    if (membership.role !== 'OWNER' && membership.role !== 'MEMBER') return reply.forbidden('Viewers cannot vote');
    const item = await findQuestion(prisma, request.params.spaceId, request.params.id);
    if (!item) return reply.notFound('Question introuvable');
    if (!isQuestionOpen(item.status)) return reply.conflict('Question close : les votes sont figés');
    const { optionIds } = voteSchema.parse(request.body);
    const unique = [...new Set(optionIds)];
    const question = await prisma.question.findUnique({ where: { itemId: item.id } });
    if (unique.length > 1 && !question?.multiple) return reply.badRequest('Une seule option possible pour cette question');
    const valid = await prisma.questionOption.findMany({ where: { itemId: item.id, id: { in: unique } }, select: { id: true } });
    if ((valid ?? []).length !== unique.length) return reply.badRequest('Option inconnue');

    await prisma.questionVote.deleteMany({ where: { itemId: item.id, userId } });
    if (unique.length > 0) {
      await prisma.questionVote.createMany({ data: unique.map((optionId) => ({ itemId: item.id, optionId, userId })) });
    }
    await notifyLiveQuestion(prisma, item.spaceId, item.id);
    return loadQuestionView(prisma, item, viewerOf(prisma, userId, membership, request.isAdminMode));
  });
};
