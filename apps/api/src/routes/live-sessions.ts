/*
 * Routes /live-sessions : séances de présentation en direct (étapes 1 « Socle » et 2 « Préparation »).
 * - Cycle : PREPARED (création) → LIVE (/:id/start, animateur) → ENDED (/:id/end). Afficher/révéler : LIVE seulement.
 * - Création : OWNER de la communauté de l'espace parent uniquement → sous-espace PRIVATE daté + rôle HOST ;
 *   une seule séance en cours (PREPARED|LIVE) par espace parent (409 sinon) ; nom unique « date (n) ».
 *   Préparation initiale facultative (agenda: [{ sourceItemId, includeChildren }]) : éléments de l'espace parent
 *   uniquement (400 sinon, rien n'est créé), sous-éléments directs juste après leur parent.
 * - Suite (/:id/suite, animateur, séance ENDED, une seule suite directe) : nouvelle séance PREPARED liée
 *   (previousSessionId) qui reprend les présentateurs, la préparation NON présentée et recopie les éléments présentés.
 *   Le nom (date locale) est envoyé par le client ; à défaut, date UTC du serveur.
 * - /ongoing : séances en cours (préparées ou en direct) auxquelles l'utilisateur est convié — membre de l'espace
 *   parent ou de l'espace de séance — pour le bouton de l'en-tête ; en direct d'abord.
 * - Préparation (/:id/agenda) : liens vers des items sources (pas de copie), ajout par HOST/PRESENTER avec accès
 *   à la source ; includeChildren ajoute aussi les sous-éléments directs juste après (/:id/source-children les compte) ;
 *   ordre : l'animateur permute tout, un présentateur seulement ses lignes (les autres restent en place).
 * - Révélation progressive : l'affichage ne copie pas les sous-items ; /:id/pending-children (ANIMATEUR seul) liste
 *   les sous-items restants, /:id/reveal en copie un sous la copie courante.
 * - Accès : membres (OWNER/MEMBER effectif) de l'espace parent ; join = membership MEMBER dans l'espace de séance.
 * - Affichage libre : HOST/PRESENTER, le dernier affichage l'emporte (currentEntryId) ; la copie est vérifiée
 *   avec les droits du présentateur sur l'espace source (copyItemToSession, verrouillée).
 * - Flux SSE /:id/stream : état poussé via liveHub (une instance API). Le client refetch l'état complet
 *   (by-space) à chaque (re)connexion — le flux ne rejoue pas l'historique.
 * Ne jamais envoyer de données d'espace source dans un événement : uniquement des copies. Exception maîtrisée :
 * la préparation (titres/espaces sources) n'est envoyée en entier qu'à l'animateur et aux présentateurs ;
 * les participants ne reçoivent que les lignes déjà présentées (visibleAgenda, broadcastEach).
 */
import { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { LiveAgendaItem, LiveEvent, LiveSessionEntry, LiveSessionOngoing, LiveSessionState, LiveUser } from '@spok/shared';
import { checkSpaceAccess } from './items.js';
import { liveHub } from '../utils/liveHub.js';
import { cloneSessionCopies, copyItemToSession, revealChildInSession, SessionCopyError } from '../utils/sessionCopy.js';

const createSchema = z.object({
  parentSpaceId: z.string(),
  name: z.string().trim().min(1).max(120).optional(),
  // Préparation initiale : éléments de l'espace parent, dans l'ordre voulu (fenêtre « Préparer la séance »)
  agenda: z.array(z.object({ sourceItemId: z.string(), includeChildren: z.boolean().optional() })).max(500).optional(),
});
const presentersSchema = z.object({ userIds: z.array(z.string()) });
const displaySchema = z.union([
  z.object({ agendaItemId: z.string() }),
  z.object({ sourceItemId: z.string(), sourceSpaceId: z.string().optional() }),
]);
const agendaAddSchema = z.object({ sourceItemId: z.string(), sourceSpaceId: z.string().optional(), includeChildren: z.boolean().optional() });
const agendaOrderSchema = z.object({ ids: z.array(z.string()) });
const revealSchema = z.object({ sourceItemId: z.string() });
const suiteSchema = z.object({ name: z.string().trim().min(1).max(120).optional() });

const USER_SELECT = { id: true, name: true, avatarUrl: true } as const;
const TAGS_INCLUDE = { tags: { include: { tag: true } } } as const;
const HEARTBEAT_MS = 25_000;

const toEntry = (e: any): LiveSessionEntry => ({
  id: e.id, kind: e.kind, createdAt: new Date(e.createdAt).toISOString(),
  user: e.user, itemId: e.itemId ?? null, itemTitle: e.itemTitle ?? null,
});

const flattenTags = (item: any) => ({ ...item, tags: (item.tags ?? []).map((t: any) => t.tag ?? t) });

async function isParentMember(prisma: any, userId: string, parentSpaceId: string) {
  const access = await checkSpaceAccess(prisma, userId, parentSpaceId);
  return !!access && ['OWNER', 'MEMBER', 'ADMIN'].includes(access.role);
}

/** Résout l'espace d'un item source et vérifie l'accès de l'utilisateur ; null = introuvable/inaccessible. */
async function resolveSource(prisma: any, userId: string, sourceItemId: string, sourceSpaceId?: string) {
  const item = await prisma.item.findUnique({ where: { id: sourceItemId }, select: { id: true, spaceId: true, title: true } });
  if (!item || (sourceSpaceId && item.spaceId !== sourceSpaceId)) return null;
  const access = await checkSpaceAccess(prisma, userId, item.spaceId);
  return access ? item : null;
}

/** Préparation visible : complet pour l'animateur/les présentateurs, lignes déjà présentées pour les participants. */
const visibleAgenda = (agenda: LiveAgendaItem[], canSeeAll: boolean) => (canSeeAll ? agenda : agenda.filter((a) => a.presentedAt));

/** Préparation ordonnée avec nom d'espace source (null si l'espace n'existe plus). */
async function loadAgenda(prisma: any, sessionId: string): Promise<LiveAgendaItem[]> {
  const rows = (await prisma.liveSessionAgendaItem.findMany({
    where: { sessionId }, orderBy: { position: 'asc' }, include: { presenter: { select: USER_SELECT } },
  })) ?? [];
  const spaceIds = [...new Set(rows.map((r: any) => r.sourceSpaceId))];
  const spaces = spaceIds.length ? ((await prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true, name: true } })) ?? []) : [];
  const names = new Map<string, string>(spaces.map((sp: any) => [sp.id, sp.name]));
  return rows.map((r: any) => ({
    id: r.id, presenter: r.presenter, sourceItemId: r.sourceItemId, sourceSpaceId: r.sourceSpaceId,
    sourceSpaceName: names.get(r.sourceSpaceId) ?? null, title: r.title, position: r.position,
    presentedAt: r.presentedAt ? new Date(r.presentedAt).toISOString() : null,
  }));
}

export const liveSessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const prisma = fastify.prisma as any;

  async function loadState(sessionId: string, userId: string): Promise<LiveSessionState | null> {
    const s = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: {
        space: { select: { name: true } },
        previousSession: { select: { id: true, spaceId: true, space: { select: { name: true } } } },
        nextSession: { select: { id: true, spaceId: true, space: { select: { name: true } } } },
        roles: { include: { user: { select: USER_SELECT } } },
        entries: { include: { user: { select: USER_SELECT } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!s) return null;
    const entries = (s.entries ?? []).map(toEntry);
    const currentEntry = entries.find((e: LiveSessionEntry) => e.id === s.currentEntryId) ?? null;
    let current: LiveSessionState['current'] = null;
    if (currentEntry?.itemId) {
      const item = await prisma.item.findFirst({ where: { id: currentEntry.itemId, spaceId: s.spaceId }, include: TAGS_INCLUDE });
      if (item) {
        const children = await prisma.item.findMany({ where: { parentId: item.id, spaceId: s.spaceId }, include: TAGS_INCLUDE, orderBy: { position: 'asc' } });
        current = { entry: currentEntry, item: flattenTags(item), children: children.map(flattenTags) };
      }
    }
    const roles = (s.roles ?? []).map((r: any) => ({ userId: r.userId, role: r.role, user: r.user }));
    const mine = roles.find((r: any) => r.userId === userId);
    const link = (x: any) => (x ? { id: x.id, spaceId: x.spaceId, spaceName: x.space?.name ?? '' } : null);
    return {
      session: {
        id: s.id, spaceId: s.spaceId, parentSpaceId: s.parentSpaceId, hostId: s.hostId, status: s.status,
        controllerId: s.controllerId ?? null, currentEntryId: s.currentEntryId ?? null,
        startedAt: new Date(s.startedAt).toISOString(), liveAt: s.liveAt ? new Date(s.liveAt).toISOString() : null,
        endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
        previousSession: link(s.previousSession), nextSession: link(s.nextSession),
      },
      spaceName: s.space?.name ?? '',
      roles,
      myRole: mine?.role ?? 'PARTICIPANT',
      entries,
      agenda: visibleAgenda(await loadAgenda(prisma, s.id), !!mine),
      current,
      presence: liveHub.presence(s.id),
    };
  }

  /** Séance dont l'utilisateur est membre de l'espace ; sinon répond 404/403 et retourne null. */
  async function sessionForMember(reply: FastifyReply, where: { id: string } | { spaceId: string }, userId: string) {
    const s = await prisma.liveSession.findUnique({ where });
    if (!s) { reply.notFound('Séance introuvable'); return null; }
    const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: s.spaceId } } });
    if (!m) { reply.forbidden('Rejoignez la séance depuis son espace parent'); return null; }
    return s;
  }

  /** Une seule séance en cours (préparée ou en direct) par espace parent. */
  const ongoingIn = (parentSpaceId: string) =>
    prisma.liveSession.findFirst({ where: { parentSpaceId, status: { in: ['PREPARED', 'LIVE'] } }, select: { id: true } });

  /** Nom unique parmi les séances de l'espace : « 2026-10-10 », puis « 2026-10-10 (2) »… */
  async function uniqueName(parentSpaceId: string, baseName: string) {
    const siblings = await prisma.liveSession.findMany({ where: { parentSpaceId }, select: { space: { select: { name: true } } } });
    const taken = new Set((siblings ?? []).map((x: any) => x.space?.name));
    let name = baseName;
    for (let n = 2; taken.has(name); n++) name = `${baseName} (${n})`;
    return name;
  }

  const ONGOING_MESSAGE = 'Une séance est déjà en cours dans cet espace : ouvrez-la ou terminez-la avant d\'en créer une autre';

  const roleOf = (sessionId: string, userId: string) =>
    prisma.liveSessionRole.findUnique({ where: { sessionId_userId: { sessionId, userId } } });

  /** Copie de l'élément actuellement affiché (null si rien d'affiché ou copie supprimée). */
  async function currentCopy(s: any) {
    if (!s.currentEntryId) return null;
    const entry = await prisma.liveSessionEntry.findUnique({ where: { id: s.currentEntryId } });
    if (!entry?.itemId) return null;
    return prisma.item.findFirst({ where: { id: entry.itemId, spaceId: s.spaceId } });
  }

  /** Diffuse la préparation : complet aux titulaires d'un rôle, lignes présentées aux participants. Renvoie le complet. */
  async function broadcastAgenda(sessionId: string) {
    const agenda = await loadAgenda(prisma, sessionId);
    const roleHolders = new Set(((await prisma.liveSessionRole.findMany({ where: { sessionId }, select: { userId: true } })) ?? []).map((r: any) => r.userId));
    liveHub.broadcastEach(sessionId, (user) => ({ type: 'agenda', agenda: visibleAgenda(agenda, roleHolders.has(user.id)) }));
    return agenda;
  }

  // Créer une séance (OWNER de la communauté)
  fastify.post('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const body = createSchema.parse(request.body);
    const parent = await prisma.space.findUnique({ where: { id: body.parentSpaceId } });
    if (!parent) return reply.notFound('Espace introuvable');
    if (parent.type !== 'GROUP' || !parent.communityId) return reply.badRequest('Une séance se crée dans un espace de communauté');
    const cm = await prisma.communityMembership.findUnique({ where: { userId_communityId: { userId, communityId: parent.communityId } } });
    if (cm?.role !== 'OWNER') return reply.forbidden('Seul un propriétaire de la communauté peut créer une séance');

    // Une seule séance en cours (préparée ou en direct) par espace (décision Thomas 2026-10-10)
    if (await ongoingIn(parent.id)) return reply.conflict(ONGOING_MESSAGE);

    // Préparation initiale : tout est vérifié AVANT la moindre écriture (un élément refusé ne crée rien).
    // Seuls des éléments de l'espace parent ; sous-éléments directs ajoutés juste après leur parent, dans leur ordre.
    const wanted = body.agenda ?? [];
    let initialRows: Array<{ id: string; title: string | null }> = [];
    if (wanted.length > 0) {
      // Un OWNER de communauté peut créer une séance dans un espace privé dont il n'est pas membre : il ne doit pas
      // pouvoir en recopier les éléments (titres) — même exigence que l'ajout depuis le menu (resolveSource).
      if (!(await isParentMember(prisma, userId, parent.id))) return reply.forbidden('Accès à l\'espace requis pour préparer la séance à partir de ses éléments');
      const ids = wanted.map((w) => w.sourceItemId);
      const found = (await prisma.item.findMany({ where: { id: { in: ids }, spaceId: parent.id }, select: { id: true, title: true } })) ?? [];
      const byId = new Map<string, { id: string; title: string | null }>(found.map((i: any) => [i.id, i]));
      if (ids.some((id) => !byId.has(id))) return reply.badRequest('Seuls des éléments de cet espace peuvent être ajoutés à la préparation');
      const withChildren = wanted.filter((w) => w.includeChildren).map((w) => w.sourceItemId);
      const children = withChildren.length
        ? ((await prisma.item.findMany({
            where: { parentId: { in: withChildren }, spaceId: parent.id }, orderBy: { position: 'asc' },
            select: { id: true, title: true, parentId: true },
          })) ?? [])
        : [];
      for (const w of wanted) {
        initialRows.push(byId.get(w.sourceItemId)!);
        if (w.includeChildren) initialRows.push(...children.filter((c: any) => c.parentId === w.sourceItemId));
      }
    }

    const name = await uniqueName(parent.id, body.name ?? new Date().toISOString().slice(0, 10));

    const space = await prisma.space.create({
      data: {
        name, type: 'GROUP', communityId: parent.communityId,
        parentId: parent.id, visibility: 'PRIVATE', memberships: { create: { userId, role: 'OWNER' } },
      },
    });
    const s = await prisma.liveSession.create({
      data: { spaceId: space.id, parentSpaceId: parent.id, hostId: userId, roles: { create: { userId, role: 'HOST' } } },
    });
    if (initialRows.length > 0) {
      await prisma.liveSessionAgendaItem.createMany({
        data: initialRows.map((row, position) => ({
          sessionId: s.id, presenterId: userId, sourceItemId: row.id, sourceSpaceId: parent.id,
          title: row.title || 'Sans titre', position,
        })),
      });
    }
    return reply.status(201).send(await loadState(s.id, userId));
  });

  // Séances en cours auxquelles je suis convié (bouton de l'en-tête)
  fastify.get('/ongoing', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = request.user.userId;
    const sessions = await prisma.liveSession.findMany({
      where: { status: { in: ['PREPARED', 'LIVE'] } },
      include: {
        space: { select: { name: true, memberships: { where: { userId }, select: { id: true } } } },
        parentSpace: { select: { name: true } },
        roles: { where: { userId }, select: { role: true } },
      },
      orderBy: { startedAt: 'desc' },
    });
    const result: LiveSessionOngoing[] = [];
    for (const s of sessions ?? []) {
      const isMember = (s.space?.memberships?.length ?? 0) > 0;
      if (!isMember && !(await isParentMember(prisma, userId, s.parentSpaceId))) continue;
      result.push({
        id: s.id, spaceId: s.spaceId, spaceName: s.space?.name ?? '', parentSpaceName: s.parentSpace?.name ?? '',
        status: s.status, isMember, myRole: s.roles?.[0]?.role ?? 'PARTICIPANT',
      });
    }
    return result.sort((a, b) => (a.status === b.status ? 0 : a.status === 'LIVE' ? -1 : 1));
  });

  // Séances d'un espace parent (liste + bouton Rejoindre)
  fastify.get<{ Querystring: { parentSpaceId?: string } }>('/', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const { parentSpaceId } = request.query;
    if (!parentSpaceId) return reply.badRequest('parentSpaceId requis');
    if (!(await isParentMember(prisma, userId, parentSpaceId))) return reply.notFound('Espace introuvable');
    const list = await prisma.liveSession.findMany({
      where: { parentSpaceId },
      include: { space: { select: { name: true, memberships: { where: { userId }, select: { id: true } } } } },
      orderBy: { startedAt: 'desc' },
    });
    return list.map((s: any) => ({
      id: s.id, spaceId: s.spaceId, spaceName: s.space.name, status: s.status,
      startedAt: new Date(s.startedAt).toISOString(), isMember: s.space.memberships.length > 0,
    }));
  });

  // État complet d'une séance à partir de son espace (utilisé par SpacePage)
  fastify.get<{ Params: { spaceId: string } }>('/by-space/:spaceId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await sessionForMember(reply, { spaceId: request.params.spaceId }, request.user.userId);
    if (!s) return reply;
    return loadState(s.id, request.user.userId);
  });

  // Rejoindre (membres de l'espace parent)
  fastify.post<{ Params: { id: string } }>('/:id/join', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await isParentMember(prisma, userId, s.parentSpaceId))) return reply.forbidden('Réservé aux membres de l\'espace');
    const existing = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId, spaceId: s.spaceId } } });
    if (!existing) {
      await prisma.spaceMembership.create({ data: { userId, spaceId: s.spaceId, role: 'MEMBER' } });
      const entry = await prisma.liveSessionEntry.create({
        data: { sessionId: s.id, kind: 'JOIN', userId }, include: { user: { select: USER_SELECT } },
      });
      liveHub.broadcast(s.id, { type: 'join', entry: toEntry(entry) });
    }
    return loadState(s.id, userId);
  });

  // Désigner les présentateurs (host) — remplace la liste
  fastify.put<{ Params: { id: string } }>('/:id/presenters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== userId) return reply.forbidden('Réservé à l\'animateur');
    const { userIds } = presentersSchema.parse(request.body);
    const ids = [...new Set(userIds)].filter((id) => id !== s.hostId);
    for (const id of ids) {
      if (!(await isParentMember(prisma, id, s.parentSpaceId))) return reply.badRequest('Un présentateur doit être membre de l\'espace parent');
    }
    await prisma.liveSessionRole.deleteMany({ where: { sessionId: s.id, role: 'PRESENTER' } });
    if (ids.length > 0) await prisma.liveSessionRole.createMany({ data: ids.map((id) => ({ sessionId: s.id, userId: id, role: 'PRESENTER' })) });
    // Les présentateurs doivent pouvoir ouvrir l'espace de séance
    for (const id of ids) {
      const m = await prisma.spaceMembership.findUnique({ where: { userId_spaceId: { userId: id, spaceId: s.spaceId } } });
      if (!m) await prisma.spaceMembership.create({ data: { userId: id, spaceId: s.spaceId, role: 'MEMBER' } });
    }
    const state = await loadState(s.id, userId);
    const roles = state?.roles ?? [];
    liveHub.broadcast(s.id, { type: 'roles', roles });
    return { roles };
  });

  // Afficher un élément (host/présentateur) — copie verrouillée + diffusion
  fastify.post<{ Params: { id: string } }>('/:id/display', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    const role = await prisma.liveSessionRole.findUnique({ where: { sessionId_userId: { sessionId: s.id, userId } } });
    if (!role) return reply.forbidden('Seuls l\'animateur et les présentateurs peuvent afficher');
    if (s.status !== 'LIVE') return reply.conflict(s.status === 'PREPARED' ? 'Séance pas encore démarrée' : 'Séance terminée');
    const body = displaySchema.parse(request.body);
    let agendaRow: any = null;
    let sourceItemId: string;
    let sourceSpaceId: string | undefined;
    const fromAgenda = (body as { agendaItemId?: string }).agendaItemId;
    if (fromAgenda) {
      agendaRow = await prisma.liveSessionAgendaItem.findFirst({ where: { id: fromAgenda, sessionId: s.id } });
      if (!agendaRow) return reply.notFound('Ligne de préparation introuvable');
      sourceItemId = agendaRow.sourceItemId;
      sourceSpaceId = agendaRow.sourceSpaceId;
    } else {
      const direct = body as { sourceItemId: string; sourceSpaceId?: string };
      sourceItemId = direct.sourceItemId;
      sourceSpaceId = direct.sourceSpaceId;
    }
    const src = await resolveSource(prisma, userId, sourceItemId, sourceSpaceId);
    if (!src) return reply.notFound('Élément source introuvable');

    let displayed;
    try {
      displayed = await copyItemToSession(prisma, {
        sourceItemId: src.id, sourceSpaceId: src.spaceId, sessionSpaceId: s.spaceId, userId,
      });
    } catch (err) {
      if (err instanceof SessionCopyError) return reply.notFound(err.message);
      throw err;
    }
    const entry = await prisma.liveSessionEntry.create({
      data: { sessionId: s.id, kind: 'DISPLAY', userId, itemId: displayed.item.id, itemTitle: displayed.item.title },
      include: { user: { select: USER_SELECT } },
    });
    await prisma.liveSession.update({ where: { id: s.id }, data: { currentEntryId: entry.id } });
    const event: LiveEvent = { type: 'display', entry: toEntry(entry), displayed: { item: displayed.item, children: displayed.children } };
    liveHub.broadcast(s.id, event);
    if (agendaRow) {
      await prisma.liveSessionAgendaItem.update({ where: { id: agendaRow.id }, data: { presentedAt: new Date() } });
      await broadcastAgenda(s.id);
    }
    return { entry: event.entry, displayed: event.displayed };
  });

  // Démarrer (host) : PREPARED → LIVE
  fastify.post<{ Params: { id: string } }>('/:id/start', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== request.user.userId) return reply.forbidden('Réservé à l\'animateur');
    if (s.status !== 'PREPARED') return reply.conflict('Séance déjà démarrée ou terminée');
    const liveAt = new Date();
    await prisma.liveSession.update({ where: { id: s.id }, data: { status: 'LIVE', liveAt } });
    liveHub.broadcast(s.id, { type: 'started', liveAt: liveAt.toISOString() });
    return { liveAt: liveAt.toISOString() };
  });

  // Préparation : ajouter (host/présentateur, avec accès à la source)
  fastify.post<{ Params: { id: string } }>('/:id/agenda', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await roleOf(s.id, userId))) return reply.forbidden('Seuls l\'animateur et les présentateurs modifient la préparation');
    if (s.status === 'ENDED') return reply.conflict('Séance terminée');
    const body = agendaAddSchema.parse(request.body);
    const src = await resolveSource(prisma, userId, body.sourceItemId, body.sourceSpaceId);
    if (!src) return reply.notFound('Élément introuvable');
    const max = await prisma.liveSessionAgendaItem.aggregate({ where: { sessionId: s.id }, _max: { position: true } });
    const rows: Array<{ id: string; title: string | null }> = [src];
    if (body.includeChildren) {
      const children = await prisma.item.findMany({
        where: { parentId: src.id, spaceId: src.spaceId }, orderBy: { position: 'asc' }, select: { id: true, title: true },
      });
      rows.push(...children);
    }
    let position = (max?._max?.position ?? -1) + 1;
    for (const row of rows) {
      await prisma.liveSessionAgendaItem.create({
        data: {
          sessionId: s.id, presenterId: userId, sourceItemId: row.id, sourceSpaceId: src.spaceId,
          title: row.title || 'Sans titre', position: position++,
        },
      });
    }
    return broadcastAgenda(s.id);
  });

  // Nombre de sous-éléments directs d'un item source (pour proposer de les ajouter à la préparation)
  fastify.get<{ Params: { id: string }; Querystring: { sourceItemId?: string } }>('/:id/source-children', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await roleOf(s.id, userId))) return reply.forbidden('Réservé à l\'animateur et aux présentateurs');
    if (!request.query.sourceItemId) return reply.badRequest('sourceItemId requis');
    const src = await resolveSource(prisma, userId, request.query.sourceItemId);
    if (!src) return reply.notFound('Élément introuvable');
    const count = await prisma.item.count({ where: { parentId: src.id, spaceId: src.spaceId } });
    return { count };
  });

  // Préparation : retirer (auteur de la ligne ou host)
  fastify.delete<{ Params: { id: string; agendaId: string } }>('/:id/agenda/:agendaId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    const row = await prisma.liveSessionAgendaItem.findFirst({ where: { id: request.params.agendaId, sessionId: s.id } });
    if (!row) return reply.notFound('Ligne introuvable');
    if (s.hostId !== userId && row.presenterId !== userId) return reply.forbidden('Vous ne pouvez retirer que vos propres éléments');
    await prisma.liveSessionAgendaItem.delete({ where: { id: row.id } });
    return broadcastAgenda(s.id);
  });

  // Préparation : réordonner (host : tout ; présentateur : ses lignes entre leurs positions)
  fastify.put<{ Params: { id: string } }>('/:id/agenda/order', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (!(await roleOf(s.id, userId))) return reply.forbidden('Réservé à l\'animateur et aux présentateurs');
    const { ids } = agendaOrderSchema.parse(request.body);
    const rows = await prisma.liveSessionAgendaItem.findMany({ where: { sessionId: s.id }, orderBy: { position: 'asc' } });
    if (ids.length !== rows.length || new Set(ids).size !== ids.length || !rows.every((r: any) => ids.includes(r.id))) {
      return reply.badRequest('La liste doit contenir toutes les lignes de la préparation, une seule fois');
    }
    if (s.hostId !== userId) {
      const moved = rows.some((r: any, i: number) => r.presenterId !== userId && ids[i] !== r.id);
      if (moved) return reply.forbidden('Vous ne pouvez déplacer que vos propres éléments');
    }
    await prisma.$transaction(ids.map((id, position) => prisma.liveSessionAgendaItem.update({ where: { id }, data: { position } })));
    return broadcastAgenda(s.id);
  });

  // Sous-items de l'élément courant pas encore révélés (animateur seul — demande Thomas 2026-10-10)
  fastify.get<{ Params: { id: string } }>('/:id/pending-children', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== userId) return reply.forbidden('Réservé à l\'animateur');
    const copy = await currentCopy(s);
    if (!copy?.sourceItemId || !copy.sourceSpaceId) return [];
    if (!(await checkSpaceAccess(prisma, userId, copy.sourceSpaceId))) return [];
    const revealed = await prisma.item.findMany({ where: { parentId: copy.id }, select: { sourceItemId: true } });
    const revealedIds = new Set(revealed.map((r: any) => r.sourceItemId));
    const children = await prisma.item.findMany({
      where: { parentId: copy.sourceItemId, spaceId: copy.sourceSpaceId }, orderBy: { position: 'asc' }, select: { id: true, title: true },
    });
    return children.filter((c: any) => !revealedIds.has(c.id)).map((c: any) => ({ sourceItemId: c.id, title: c.title || 'Sans titre' }));
  });

  // Révéler un sous-item de l'élément courant (animateur seul, LIVE)
  fastify.post<{ Params: { id: string } }>('/:id/reveal', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== userId) return reply.forbidden('Réservé à l\'animateur');
    if (s.status !== 'LIVE') return reply.conflict('Séance non démarrée ou terminée');
    const { sourceItemId } = revealSchema.parse(request.body);
    const copy = await currentCopy(s);
    if (!copy?.sourceItemId || !copy.sourceSpaceId) return reply.badRequest('Aucun élément affiché');
    const child = await prisma.item.findUnique({ where: { id: sourceItemId }, select: { id: true, parentId: true, spaceId: true } });
    if (!child || child.parentId !== copy.sourceItemId) return reply.badRequest('Ce n\'est pas un sous-élément de l\'élément affiché');
    if (!(await checkSpaceAccess(prisma, userId, child.spaceId))) return reply.notFound('Élément source introuvable');
    let revealed;
    try {
      revealed = await revealChildInSession(prisma, {
        parentCopyId: copy.id, sourceChildId: child.id, sourceSpaceId: child.spaceId, sessionSpaceId: s.spaceId, userId,
      });
    } catch (err) {
      if (err instanceof SessionCopyError) return reply.notFound(err.message);
      throw err;
    }
    liveHub.broadcast(s.id, { type: 'reveal', parentItemId: copy.id, child: revealed });
    return { child: revealed };
  });

  // Suite d'une séance terminée (animateur) : nouvelle séance préparée liée à la précédente
  fastify.post<{ Params: { id: string } }>('/:id/suite', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = request.user.userId;
    const prev = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!prev) return reply.notFound('Séance introuvable');
    if (prev.hostId !== userId) return reply.forbidden('Réservé à l\'animateur');
    if (prev.status !== 'ENDED') return reply.conflict('Seule une séance terminée peut avoir une suite');
    if (await prisma.liveSession.findUnique({ where: { previousSessionId: prev.id } })) return reply.conflict('Cette séance a déjà une suite');
    if (await ongoingIn(prev.parentSpaceId)) return reply.conflict(ONGOING_MESSAGE);
    const parent = await prisma.space.findUnique({ where: { id: prev.parentSpaceId } });
    if (!parent) return reply.notFound('Espace parent introuvable');
    const body = suiteSchema.parse(request.body ?? {});

    const space = await prisma.space.create({
      data: {
        name: await uniqueName(parent.id, body.name ?? new Date().toISOString().slice(0, 10)), type: 'GROUP',
        communityId: parent.communityId, parentId: parent.id, visibility: 'PRIVATE',
        memberships: { create: { userId, role: 'OWNER' } },
      },
    });
    const next = await prisma.liveSession.create({
      data: { spaceId: space.id, parentSpaceId: parent.id, hostId: userId, previousSessionId: prev.id, roles: { create: { userId, role: 'HOST' } } },
    });

    // Présentateurs repris (et membres du nouvel espace)
    const roles = await prisma.liveSessionRole.findMany({ where: { sessionId: prev.id, role: 'PRESENTER' } });
    const candidates = (roles ?? []).map((r: any) => r.userId).filter((id: string) => id !== userId);
    const presenterIds: string[] = [];
    for (const id of candidates) if (await isParentMember(prisma, id, parent.id)) presenterIds.push(id);
    if (presenterIds.length > 0) {
      await prisma.liveSessionRole.createMany({ data: presenterIds.map((id: string) => ({ sessionId: next.id, userId: id, role: 'PRESENTER' })) });
      for (const id of presenterIds) await prisma.spaceMembership.create({ data: { userId: id, spaceId: space.id, role: 'MEMBER' } });
    }

    // Préparation : seulement les éléments non présentés, même ordre et même présentateur
    const agenda = await prisma.liveSessionAgendaItem.findMany({ where: { sessionId: prev.id }, orderBy: { position: 'asc' } });
    const remaining = (agenda ?? []).filter((a: any) => !a.presentedAt);
    if (remaining.length > 0) {
      await prisma.liveSessionAgendaItem.createMany({
        data: remaining.map((a: any, position: number) => ({
          sessionId: next.id, presenterId: a.presenterId, sourceItemId: a.sourceItemId, sourceSpaceId: a.sourceSpaceId, title: a.title, position,
        })),
      });
    }

    // Éléments déjà présentés : recopiés dans le nouvel espace
    await cloneSessionCopies(prisma, { fromSpaceId: prev.spaceId, toSpaceId: space.id });

    return reply.status(201).send(await loadState(next.id, userId));
  });

  // Terminer (host)
  fastify.post<{ Params: { id: string } }>('/:id/end', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const s = await prisma.liveSession.findUnique({ where: { id: request.params.id } });
    if (!s) return reply.notFound('Séance introuvable');
    if (s.hostId !== request.user.userId) return reply.forbidden('Réservé à l\'animateur');
    const endedAt = new Date();
    await prisma.liveSession.update({ where: { id: s.id }, data: { status: 'ENDED', endedAt } });
    liveHub.broadcast(s.id, { type: 'ended', endedAt: endedAt.toISOString() });
    return { endedAt: endedAt.toISOString() };
  });

  // Flux SSE (exempté du rate-limit global : une connexion longue par participant)
  fastify.get<{ Params: { id: string } }>('/:id/stream', { preHandler: [fastify.authenticate], config: { rateLimit: false } }, async (request, reply) => {
    const userId = request.user.userId;
    const s = await sessionForMember(reply, { id: request.params.id }, userId);
    if (!s) return;
    const user: LiveUser = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });

    // hijack : on écrit nous-mêmes ; recopier les headers déjà posés (CORS, helmet)
    reply.hijack();
    const raw = reply.raw;
    for (const [k, v] of Object.entries(reply.getHeaders())) if (v !== undefined) raw.setHeader(k, v as any);
    raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    raw.write(': connected\n\n');

    const send = (event: LiveEvent) => { raw.write(`data: ${JSON.stringify(event)}\n\n`); };
    const unsubscribe = liveHub.subscribe(s.id, user, send);
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), HEARTBEAT_MS);
    request.raw.on('close', () => { clearInterval(heartbeat); unsubscribe(); });
  });
};
