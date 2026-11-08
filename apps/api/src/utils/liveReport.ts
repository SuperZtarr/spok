/*
 * Compte-rendu d'une séance de présentation en direct (décision Thomas 2026-11-08) : une Note (type NOTE, jamais
 * DOCUMENT — DOCUMENT porte des pièces jointes) « Compte-rendu — <nom de l'espace de séance> », créée dans l'espace de
 * séance à la clôture (/end) ou après coup (/:id/report), rattachée par LiveSession.reportItemId.
 * - Instantané figé : rien ne se met à jour tout seul ; « Régénérer » (animateur) réécrit tout ce qui précède le titre
 *   « Décisions » et CONSERVE ce titre et tout ce qui suit (les décisions écrites après coup ne sont jamais perdues).
 *   Titre « Décisions » supprimé par l'utilisateur → une section vide est remise à la fin.
 * - Contenu : en-tête (date, horaires et durée liveAt → endedAt, animateur, présentateurs, participants = entrées JOIN),
 *   déroulé dans l'ordre des premiers affichages (DISPLAY) avec réaffichages, sous-éléments révélés, relations de la
 *   copie (une copie naît sans relation : toutes ont été ajoutées dans la séance) et commentaires écrits entre liveAt et
 *   endedAt ; préparation non présentée (+ suite si elle existe) ; éléments créés dans l'espace pendant la séance.
 * - Questions (type QUESTION, 2026-11-08) : section « Questions » après le déroulé — chaque question présentée (copie),
 *   dans l'ordre de présentation, avec son issue (statut + option retenue / réponse écrite, précision, qui et quand,
 *   lue dans la table questions de la copie) et le décompte des votes par option, avec les noms (déjà visibles de tous
 *   sur la question). Une question Reportée renvoie à la suite si elle existe. Libellés d'issue : DEFAULT_STATUSES.
 * - Heures en Europe/Paris (le serveur tourne en UTC).
 * - buildReportHtml et mergeDecisions sont pures (testées seules) ; generateLiveReport lit la base et écrit la Note.
 * La Note est lue par TOUS les membres de l'espace de séance (participants, invités) : rien qui leur soit caché ailleurs.
 * Donc pas de titres de la préparation non présentée (un nombre seulement — ils ne voient que le déjà présenté) et,
 * pour une relation vers un élément d'un autre espace, « un élément d'un autre espace » au lieu de son titre.
 */
import { DEFAULT_STATUSES, QUESTION_STATUS } from '@spok/shared';

const TZ = 'Europe/Paris';
const timeFmt = new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const DECISIONS_HEADING = '<h2>Décisions</h2>';
const DECISIONS_RE = /<h2[^>]*>\s*Décisions\s*<\/h2>/i;

/** Libellés des relations vues depuis la copie : [sortante, entrante] (mêmes mots que constants/relationTypes.ts du web). */
const RELATION_LABELS: Record<string, [string, string]> = {
  blocks: ['bloque', 'bloqué par'],
  implements: ['permet', 'permis par'],
  drives: ['entraîne', 'entraîné par'],
  relates: ['lié à', 'lié à'],
};

export interface ReportDisplay {
  at: Date;
  title: string;
  presenter: string;
  redisplays: Date[];
  children: string[];
  relations: string[];
  comments: Array<{ at: Date; author: string; text: string }>;
}

export interface ReportQuestion {
  title: string;
  /** Statut de la copie (question_open / _decided / _postponed / _no_conclusion) */
  status: string | null;
  /** Option retenue (libellé) ou autre réponse écrite, si la question est tranchée */
  answer: string | null;
  note: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  options: Array<{ label: string; voters: string[] }>;
}

export interface ReportData {
  liveAt: Date | null;
  endedAt: Date | null;
  host: string;
  presenters: string[];
  participants: string[];
  displays: ReportDisplay[];
  /** Nombre de lignes de préparation jamais affichées (pas leurs titres : la Note est lue par les participants). */
  notPresented: number;
  suiteName: string | null;
  created: Array<{ title: string; author: string }>;
  /** Questions présentées, dans l'ordre de présentation */
  questions?: ReportQuestion[];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Texte brut d'un commentaire (HTML de l'éditeur ou texte) : balises retirées, entités courantes décodées. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export const formatTime = (d: Date) => timeFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

const list = (names: string[]) => (names.length ? names.map(esc).join(', ') : 'aucun');
const li = (inner: string) => `<li><p>${inner}</p></li>`;

/** Partie générée du compte-rendu (sans la section « Décisions »). */
export function buildReportHtml(d: ReportData): string {
  const parts: string[] = [];
  const day = d.liveAt ?? d.endedAt;
  const timing = d.liveAt && d.endedAt
    ? ` · <strong>Horaires :</strong> ${formatTime(d.liveAt)} → ${formatTime(d.endedAt)} (${formatDuration(d.endedAt.getTime() - d.liveAt.getTime())})`
    : '';
  parts.push(`<p><strong>Date :</strong> ${day ? formatDate(day) : '—'}${timing}</p>`);
  parts.push(`<p><strong>Animateur :</strong> ${esc(d.host)}</p>`);
  parts.push(`<p><strong>Présentateurs :</strong> ${list(d.presenters)}</p>`);
  parts.push(`<p><strong>Participants :</strong> ${list(d.participants)}</p>`);

  parts.push('<h2>Déroulé</h2>');
  if (d.displays.length === 0) {
    parts.push('<p>Aucun élément présenté.</p>');
  } else {
    const items = d.displays.map((x) => {
      const again = x.redisplays.length ? ` ; réaffiché à ${x.redisplays.map(formatTime).join(', ')}` : '';
      const head = `<strong>${formatTime(x.at)} — ${esc(x.title)}</strong> (présenté par ${esc(x.presenter)}${again})`;
      const details: string[] = [];
      if (x.children.length) details.push(li(`Sous-éléments révélés : ${x.children.map(esc).join(', ')}`));
      if (x.relations.length) details.push(li(`Relations : ${x.relations.map(esc).join(' ; ')}`));
      for (const c of x.comments) details.push(li(`Commentaire de ${esc(c.author)} (${formatTime(c.at)}) : ${esc(c.text)}`));
      return `<li><p>${head}</p>${details.length ? `<ul>${details.join('')}</ul>` : ''}</li>`;
    });
    parts.push(`<ol>${items.join('')}</ol>`);
  }

  if (d.questions?.length) {
    parts.push('<h2>Questions</h2>');
    const label = (id: string | null) => DEFAULT_STATUSES.find((x) => x.id === (id || QUESTION_STATUS.OPEN))?.label ?? id ?? '';
    const items = d.questions.map((q) => {
      const answer = q.status === QUESTION_STATUS.DECIDED && q.answer ? ` : ${esc(q.answer)}` : '';
      const suite = q.status === QUESTION_STATUS.POSTPONED && d.suiteName ? ` (reprise dans la suite « ${esc(d.suiteName)} »)` : '';
      const note = q.note ? ` — ${esc(q.note)}` : '';
      const head = `<strong>${esc(q.title)}</strong> — ${esc(label(q.status))}${answer}${suite}${note}`;
      const details: string[] = [];
      const voted = q.options.filter((o) => o.voters.length);
      details.push(li(voted.length
        ? `Votes : ${q.options.map((o) => `${esc(o.label)} ${o.voters.length}${o.voters.length ? ` (${o.voters.map(esc).join(', ')})` : ''}`).join(' ; ')}`
        : 'Aucun vote'));
      if (q.decidedBy && q.status && q.status !== QUESTION_STATUS.OPEN) {
        details.push(li(`Issue notée par ${esc(q.decidedBy)}${q.decidedAt ? ` à ${formatTime(q.decidedAt)}` : ''}`));
      }
      return `<li><p>${head}</p><ul>${details.join('')}</ul></li>`;
    });
    parts.push(`<ul>${items.join('')}</ul>`);
  }

  if (d.notPresented > 0) {
    parts.push('<h2>Non présentés</h2>');
    const n = d.notPresented;
    const suite = d.suiteName ? ` ; ${n > 1 ? 'ils sont repris' : 'il est repris'} dans la suite « ${esc(d.suiteName)} »` : '';
    parts.push(`<p>${n} élément${n > 1 ? 's' : ''} de la préparation ${n > 1 ? 'n\'ont' : 'n\'a'} pas été présenté${n > 1 ? 's' : ''}${suite}.</p>`);
  }

  if (d.created.length) {
    parts.push('<h2>Créés pendant la séance</h2>');
    parts.push(`<ul>${d.created.map((c) => li(`${esc(c.title)} (${esc(c.author)})`)).join('')}</ul>`);
  }
  return parts.join('');
}

/** Ajoute la section « Décisions » : celle de la version précédente (titre et tout ce qui suit), sinon une vide. */
export function mergeDecisions(generated: string, previous: string | null | undefined): string {
  const m = previous ? DECISIONS_RE.exec(previous) : null;
  return generated + (m && previous ? previous.slice(m.index) : `${DECISIONS_HEADING}<p></p>`);
}

const nameOf = (u: { name?: string | null } | null | undefined) => u?.name || 'Inconnu';

/** Lit la séance (terminée) et rassemble les données du compte-rendu. */
async function loadReportData(prisma: any, s: any): Promise<ReportData> {
  const liveAt: Date | null = s.liveAt ? new Date(s.liveAt) : null;
  const endedAt: Date | null = s.endedAt ? new Date(s.endedAt) : null;
  const during = liveAt ? { gte: liveAt, lte: endedAt ?? new Date() } : null;

  const entries: any[] = s.entries ?? [];
  const displays: Array<ReportDisplay & { itemId: string | null }> = [];
  const byItem = new Map<string, ReportDisplay>();
  for (const e of entries.filter((x) => x.kind === 'DISPLAY')) {
    const known = e.itemId ? byItem.get(e.itemId) : undefined;
    if (known) { known.redisplays.push(new Date(e.createdAt)); continue; }
    const d = {
      itemId: e.itemId ?? null, at: new Date(e.createdAt), title: e.itemTitle || 'Sans titre', presenter: nameOf(e.user),
      redisplays: [], children: [], relations: [], comments: [],
    };
    displays.push(d);
    if (e.itemId) byItem.set(e.itemId, d);
  }
  const copyIds = [...byItem.keys()];

  if (copyIds.length) {
    const [children, relations, comments] = await Promise.all([
      prisma.item.findMany({
        where: { parentId: { in: copyIds }, spaceId: s.spaceId, lockedAt: { not: null } },
        select: { parentId: true, title: true }, orderBy: { position: 'asc' },
      }),
      prisma.itemRelation.findMany({
        where: { OR: [{ fromItemId: { in: copyIds } }, { toItemId: { in: copyIds } }] },
        include: { fromItem: { select: { id: true, title: true, spaceId: true } }, toItem: { select: { id: true, title: true, spaceId: true } } },
      }),
      during
        ? prisma.contribution.findMany({
            where: { itemId: { in: copyIds }, createdAt: during },
            include: { author: { select: { name: true } } }, orderBy: { createdAt: 'asc' },
          })
        : [],
    ]);
    for (const c of children ?? []) byItem.get(c.parentId)?.children.push(c.title || 'Sans titre');
    for (const r of relations ?? []) {
      const [out, inc] = RELATION_LABELS[r.type] ?? [r.type, r.type];
      const from = byItem.get(r.fromItemId);
      const to = byItem.get(r.toItemId);
      // Titre de l'autre bout seulement s'il est dans l'espace de séance (un autre espace peut être fermé aux lecteurs)
      const other = (it: any) => (it?.spaceId === s.spaceId ? `« ${it.title || 'Sans titre'} »` : 'un élément d\'un autre espace');
      if (from) from.relations.push(`${out} ${other(r.toItem)}`);
      if (to) to.relations.push(`${inc} ${other(r.fromItem)}`);
    }
    for (const c of comments ?? []) {
      const text = plainText(c.content ?? '');
      if (text) byItem.get(c.itemId)?.comments.push({ at: new Date(c.createdAt), author: nameOf(c.author), text });
    }
  }

  // Questions présentées : issue (table questions de la copie) et votes par option, dans l'ordre de présentation
  const questions: ReportQuestion[] = [];
  if (copyIds.length) {
    const qItems = (await prisma.item.findMany({
      where: { id: { in: copyIds }, type: 'QUESTION' },
      select: { id: true, title: true, status: true },
    })) ?? [];
    if (qItems.length) {
      const qIds = qItems.map((q: any) => q.id);
      const [rows, options, votes] = await Promise.all([
        prisma.question.findMany({ where: { itemId: { in: qIds } }, include: { decidedBy: { select: { name: true } } } }),
        prisma.questionOption.findMany({ where: { itemId: { in: qIds } }, orderBy: { position: 'asc' } }),
        prisma.questionVote.findMany({ where: { itemId: { in: qIds } }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
      ]);
      const byId = new Map(qItems.map((q: any) => [q.id, q]));
      for (const d of displays) {
        const q: any = d.itemId ? byId.get(d.itemId) : null;
        if (!q) continue;
        const row = (rows ?? []).find((r: any) => r.itemId === q.id);
        const opts = (options ?? []).filter((o: any) => o.itemId === q.id);
        const chosen = row?.chosenOptionId ? opts.find((o: any) => o.id === row.chosenOptionId) : null;
        questions.push({
          title: q.title || 'Sans titre',
          status: q.status ?? null,
          answer: chosen?.label ?? row?.answerText ?? null,
          note: row?.note ?? null,
          decidedBy: row?.decidedBy ? nameOf(row.decidedBy) : null,
          decidedAt: row?.decidedAt ? new Date(row.decidedAt) : null,
          options: opts.map((o: any) => ({
            label: o.label,
            voters: (votes ?? []).filter((v: any) => v.optionId === o.id).map((v: any) => nameOf(v.user)),
          })),
        });
      }
    }
  }

  const created = during
    ? ((await prisma.item.findMany({
        where: {
          spaceId: s.spaceId, lockedAt: null, createdAt: during,
          ...(s.reportItemId ? { id: { not: s.reportItemId } } : {}),
        },
        include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: 'asc' },
      })) ?? [])
    : [];

  const roles: any[] = s.roles ?? [];
  const participants = new Map<string, string>();
  for (const e of entries) if (e.kind === 'JOIN' && e.user) participants.set(e.userId ?? e.user.id, nameOf(e.user));

  return {
    liveAt, endedAt,
    host: nameOf(s.host),
    presenters: roles.filter((r) => r.role === 'PRESENTER').map((r) => nameOf(r.user)),
    participants: [...participants.values()],
    displays: displays.map(({ itemId: _id, ...d }) => d),
    notPresented: (s.agenda ?? []).length,
    suiteName: s.nextSession?.space?.name ?? null,
    created: created.map((c: any) => ({ title: c.title || 'Sans titre', author: nameOf(c.createdBy) })),
    questions,
  };
}

/**
 * Crée le compte-rendu d'une séance terminée, ou le régénère s'il existe (décisions conservées).
 * userId = auteur de l'écriture (l'animateur). Retourne l'id de la Note. Lève une erreur si la séance n'est pas terminée.
 */
export async function generateLiveReport(prisma: any, sessionId: string, userId: string): Promise<string> {
  const s = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: {
      space: { select: { name: true } },
      host: { select: { id: true, name: true } },
      roles: { include: { user: { select: { id: true, name: true } } } },
      entries: { include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      agenda: { where: { presentedAt: null }, select: { id: true } },
      nextSession: { select: { space: { select: { name: true } } } },
    },
  });
  if (!s) throw new Error('Séance introuvable');
  if (s.status !== 'ENDED') throw new Error('Le compte-rendu se génère sur une séance terminée');

  const generated = buildReportHtml(await loadReportData(prisma, s));
  const existing = s.reportItemId
    ? await prisma.item.findFirst({ where: { id: s.reportItemId, spaceId: s.spaceId }, select: { id: true, description: true } })
    : null;
  if (existing) {
    await prisma.item.update({
      where: { id: existing.id },
      data: { description: mergeDecisions(generated, existing.description), updatedById: userId },
    });
    return existing.id;
  }
  const note = await prisma.item.create({
    data: {
      type: 'NOTE', title: `Compte-rendu — ${s.space?.name ?? 'Séance'}`,
      description: mergeDecisions(generated, null), spaceId: s.spaceId, createdById: userId,
    },
  });
  await prisma.liveSession.update({ where: { id: s.id }, data: { reportItemId: note.id } });
  return note.id;
}
