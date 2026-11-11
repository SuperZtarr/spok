/*
 * Question (type QUESTION, 2026-11-08) — règles serveur, source unique pour les routes items, item-question,
 * item-bulk et la copie de séance.
 * - statusForType(type, status) : statut normalisé pour un type. Un statut réservé à un autre type devient null ;
 *   une question sans statut (ou avec un statut non permis) démarre « Ouverte ». La réservation fait foi depuis
 *   DEFAULT_STATUSES (withDefaultStatuses la rétablit dans tout référentiel personnalisé).
 * - syncQuestionAfterStatus : après un changement de statut d'une question (fiche, menu, Kanban, MCP), garde la
 *   table questions cohérente — retour à « Ouverte » efface l'issue ; une issue autre que « Tranchée » efface
 *   l'option retenue / la réponse écrite ; toute issue note qui et quand.
 * - loadQuestionView : vue du lecteur (votes nominatifs, option majoritaire, unanimité — au moins 2 votants tous sur
 *   l'option, indication seulement —, droits canVote/canDecide/canEditOptions). Réponse liée à un élément
 *   (2026-11-12) : refItem renvoyé seulement si le lecteur peut lire son espace (viewer.canReadSpace).
 * - copyQuestionData : options (avec leur élément lié), réglage, issue (et votes si withVotes) d'une question vers une autre — copie de
 *   séance (sans votes) et suite de séance (avec votes : trace fidèle).
 * - notifyLiveQuestion : si l'élément est dans un espace de séance, diffuse { type: 'question', itemId } (les
 *   clients relisent la question) — décompte en direct.
 * Les votes ne tranchent jamais : aucune fonction ici ne change le statut à partir des votes.
 */
import { DEFAULT_STATUSES, QUESTION_STATUS, statusAllowedForType, type QuestionView } from '@spok/shared';
import { liveHub } from './liveHub.js';

export const QUESTION_OUTCOME_IDS: string[] = Object.values(QUESTION_STATUS);

/** Statut normalisé pour un type (création, changement de type ou de statut). */
export function statusForType(type: string, status: string | null | undefined): string | null | undefined {
  if (type === 'QUESTION') {
    if (!status || status === 'undefined' || !statusAllowedForType(status, type, DEFAULT_STATUSES)) return QUESTION_STATUS.OPEN;
    return status;
  }
  if (status && !statusAllowedForType(status, type, DEFAULT_STATUSES)) return null;
  return status;
}

export const isQuestionOpen = (status: string | null | undefined) => !status || status === 'undefined' || status === QUESTION_STATUS.OPEN;

/** Table questions cohérente avec le statut de l'item (appelée après tout changement de statut d'une question). */
export async function syncQuestionAfterStatus(prisma: any, itemId: string, status: string | null | undefined, userId: string) {
  if (isQuestionOpen(status)) {
    await prisma.question.updateMany({
      where: { itemId },
      data: { chosenOptionId: null, answerText: null, note: null, decidedById: null, decidedAt: null },
    });
    return;
  }
  const keepAnswer = status === QUESTION_STATUS.DECIDED;
  await prisma.question.upsert({
    where: { itemId },
    create: { itemId, decidedById: userId, decidedAt: new Date() },
    update: {
      decidedById: userId, decidedAt: new Date(),
      ...(keepAnswer ? {} : { chosenOptionId: null, answerText: null }),
    },
  });
}

/** L'élément est-il une copie d'une séance dont userId est l'animateur ? (seul à noter l'issue d'une copie) */
export async function isSessionHostFor(prisma: any, spaceId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const session = await prisma.liveSession.findUnique({ where: { spaceId }, select: { hostId: true } });
  return session?.hostId === userId;
}

/**
 * Droits du lecteur. canReadSpace (2026-11-12) : peut-il lire un autre espace (élément lié à une réponse) ? Absent =
 * seuls les éléments liés du même espace que la question sont montrés.
 */
interface ViewerRights { userId?: string; role?: string | null; canReadSpace?: (spaceId: string) => Promise<boolean> }

/** Éléments liés aux réponses, lisibles par le lecteur (même espace que la question, ou espace accessible) */
async function readableRefItems(prisma: any, item: any, options: any[], viewer: ViewerRights) {
  const ids = [...new Set(options.map((o: any) => o.refItemId).filter(Boolean))] as string[];
  const out = new Map<string, { id: string; title: string; type: string; spaceId: string }>();
  if (ids.length === 0) return out;
  const refs = await prisma.item.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, type: true, spaceId: true } });
  const allowed = new Map<string, boolean>([[item.spaceId, true]]);
  for (const r of refs ?? []) {
    if (!allowed.has(r.spaceId)) allowed.set(r.spaceId, viewer.canReadSpace ? await viewer.canReadSpace(r.spaceId) : false);
    if (allowed.get(r.spaceId)) out.set(r.id, { id: r.id, title: r.title ?? '', type: r.type, spaceId: r.spaceId });
  }
  return out;
}

export async function loadQuestionView(prisma: any, item: any, viewer: ViewerRights): Promise<QuestionView> {
  const [question, options, votes] = await Promise.all([
    prisma.question.findUnique({ where: { itemId: item.id }, include: { decidedBy: { select: { id: true, name: true } } } }),
    prisma.questionOption.findMany({ where: { itemId: item.id }, orderBy: { position: 'asc' } }),
    prisma.questionVote.findMany({
      where: { itemId: item.id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
  const refs = await readableRefItems(prisma, item, options ?? [], viewer);
  const optionViews = (options ?? []).map((o: any) => ({
    id: o.id, label: o.label, position: o.position,
    voters: (votes ?? []).filter((v: any) => v.optionId === o.id).map((v: any) => ({ id: v.user.id, name: v.user.name })),
    refItemId: o.refItemId ?? null,
    refItem: o.refItemId ? refs.get(o.refItemId) ?? null : null,
  }));
  const max = Math.max(0, ...optionViews.map((o: any) => o.voters.length));
  const voterCount = new Set((votes ?? []).map((v: any) => v.userId)).size;
  const open = isQuestionOpen(item.status);
  const locked = !!item.lockedAt;
  const isWriter = viewer.role === 'OWNER' || viewer.role === 'MEMBER';
  const manages = viewer.role === 'OWNER'
    || (viewer.role === 'MEMBER' && !!viewer.userId && (item.createdById === viewer.userId || item.assignedToId === viewer.userId));
  const canDecide = locked ? await isSessionHostFor(prisma, item.spaceId, viewer.userId) : manages;
  return {
    itemId: item.id,
    status: item.status ?? null,
    open,
    multiple: !!question?.multiple,
    options: optionViews,
    outcome: {
      chosenOptionId: question?.chosenOptionId ?? null,
      answerText: question?.answerText ?? null,
      note: question?.note ?? null,
      decidedBy: question?.decidedBy ?? null,
      decidedAt: question?.decidedAt ? new Date(question.decidedAt).toISOString() : null,
    },
    voterCount,
    unanimousOptionIds: voterCount >= 2 ? optionViews.filter((o: any) => o.voters.length === voterCount).map((o: any) => o.id) : [],
    leadingOptionIds: max > 0 ? optionViews.filter((o: any) => o.voters.length === max).map((o: any) => o.id) : [],
    myOptionIds: viewer.userId ? (votes ?? []).filter((v: any) => v.userId === viewer.userId).map((v: any) => v.optionId) : [],
    canVote: !!viewer.userId && isWriter && open,
    canDecide,
    canEditOptions: !locked && manages,
    locked,
  };
}

/** Copie options + réglage + issue (+ votes) d'une question. Ne fait rien si la source n'a ni options ni réglage. */
export async function copyQuestionData(prisma: any, fromItemId: string, toItemId: string, opts: { withVotes: boolean; keepOutcome: boolean }) {
  const [question, options] = await Promise.all([
    prisma.question.findUnique({ where: { itemId: fromItemId } }),
    prisma.questionOption.findMany({ where: { itemId: fromItemId }, orderBy: { position: 'asc' } }),
  ]);
  const idMap = new Map<string, string>();
  for (const o of options ?? []) {
    const created = await prisma.questionOption.create({ data: { itemId: toItemId, label: o.label, position: o.position, refItemId: o.refItemId ?? null } });
    idMap.set(o.id, created.id);
  }
  if (question) {
    await prisma.question.create({
      data: {
        itemId: toItemId,
        multiple: question.multiple,
        ...(opts.keepOutcome ? {
          chosenOptionId: question.chosenOptionId ? idMap.get(question.chosenOptionId) ?? null : null,
          answerText: question.answerText, note: question.note,
          decidedById: question.decidedById, decidedAt: question.decidedAt,
        } : {}),
      },
    });
  }
  if (opts.withVotes && idMap.size > 0) {
    const votes = await prisma.questionVote.findMany({ where: { itemId: fromItemId } });
    const data = (votes ?? []).filter((v: any) => idMap.has(v.optionId))
      .map((v: any) => ({ itemId: toItemId, optionId: idMap.get(v.optionId)!, userId: v.userId, createdAt: v.createdAt }));
    if (data.length > 0) await prisma.questionVote.createMany({ data });
  }
}

/** Décompte / issue en direct : prévient les participants si l'élément est dans un espace de séance. */
export async function notifyLiveQuestion(prisma: any, spaceId: string, itemId: string) {
  const session = await prisma.liveSession.findUnique({ where: { spaceId }, select: { id: true } });
  if (session) liveHub.broadcast(session.id, { type: 'question', itemId });
}
