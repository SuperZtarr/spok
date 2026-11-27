/*
 * Export brut réimportable d'un espace et de ses sous-espaces, et son import (décision Thomas 2026-11-27, registre
 * @spok/shared rawExport.ts, document types/rawExport.ts). Routes : routes/raw-export.ts.
 *
 * Export (buildRawExport) : espaces lisibles de l'arbre (readableSpaceTree : un sous-espace inaccessible est sauté avec
 * sa descendance), éléments avec tags, références externes, contenus, question et options, blocs d'article, couloirs et
 * places de process, relations et contributions. Toute référence vers un élément hors de l'export est retirée (rien ne
 * fuit des espaces non exportés). Jamais : données sécurisées, votes, réactions, historique, membres.
 *
 * Import (importRawDocument) : TOUJOURS une copie — nouveaux identifiants, rien n'est écrasé ni fusionné.
 *   - destination : racine d'une communauté ou sous un espace existant (droits vérifiés par la route) ;
 *   - l'auteur de l'import devient propriétaire de chaque espace créé ; visibilité et vue par défaut reprises ;
 *   - personnes rapprochées par e-mail parmi les MEMBRES de la destination seulement (communauté, sinon espace parent :
 *     le fichier est fourni par l'utilisateur, il ne doit ni attribuer des données à un compte quelconque ni sonder les
 *     e-mails de la base) ; sans correspondance : auteur → celui qui importe, assigné → assigné en saisie
 *     libre (son nom), décideur d'une question → aucun ; listées dans le compte rendu (unmatchedUsers) ;
 *   - tags rapprochés par nom parmi ceux visibles depuis la destination, sinon créés comme tags de l'espace racine importé ;
 *   - références vers des éléments absents du fichier abandonnées et comptées (dropped) ; type inconnu → Élément ;
 *   - fichiers (contenus, ancienne adresse, images des descriptions et contributions) du stockage actif recopiés sous
 *     items/<nouvel id>/ AVANT la transaction : la donnée importée ne partage jamais un fichier avec la source (sinon sa
 *     suppression enverrait à la corbeille le fichier de la source — cas d'un local branché sur le stockage de prod).
 *     Adresse hors du stockage actif : gardée telle quelle (jamais supprimée par SPOK). Copies orphelines en cas d'échec
 *     de la transaction : ramassées par la page Volumétrie (fichiers orphelins).
 *   - écriture en une transaction (tout ou rien) ; dryRun = aperçu, rien n'est écrit ni copié.
 * Ne pas réutiliser ces fonctions pour un déplacement ou une fusion : elles ne gardent aucun lien avec la source.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  RAW_EXPORT_FORMAT_ID, RAW_EXPORT_VERSION, RELATION_TYPES, HORIZON_ORDER, DEFAULT_ITEM_TYPE, isItemType,
  ITEM_CONTENT_KIND_DEFS,
  type RawExportDocument, type RawExportFileFormat, type RawImportReport, type RawExportItem,
} from '@spok/shared';
import { rawExportFromXml, rawExportToXml } from './rawExportXml.js';
import { isR2Configured, isR2Url, copyR2Object, storageUrlForKey } from './r2.js';
import { storageKeysInText } from './storageTrash.js';
import { spaceTagScope, communityScope, findTagByName, type TagScope } from './tagScope.js';
import { nextSiblingPosition } from './spaceOrder.js';

/** Erreur de contenu du fichier (message montré tel quel à l'utilisateur) */
export class RawImportError extends Error {}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const newId = () => 'c' + randomUUID().replace(/-/g, '').slice(0, 24);

// ─── Export ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Espaces de l'arbre lisibles par l'appelant, racine d'abord (un espace illisible est sauté avec sa descendance) */
export async function readableSpaceTree(prisma: any, rootId: string, canRead: (spaceId: string) => Promise<boolean>): Promise<string[]> {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    const children = await prisma.space.findMany({ where: { parentId: ids[i] }, select: { id: true } });
    for (const c of children) if (!ids.includes(c.id) && await canRead(c.id)) ids.push(c.id);
  }
  return ids;
}

export async function buildRawExport(prisma: any, spaceIds: string[], opts: { includeEmails: boolean }): Promise<RawExportDocument> {
  const spaces = await prisma.space.findMany({
    where: { id: { in: spaceIds } },
    select: { id: true, parentId: true, name: true, description: true, visibility: true, defaultView: true, position: true },
  });
  const rootId = spaceIds[0];
  const items = await prisma.item.findMany({
    where: { spaceId: { in: spaceIds } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      tags: { select: { tagId: true } },
      externalRefs: { orderBy: { position: 'asc' }, select: { value: true } },
      contents: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      question: true,
      questionOptions: { orderBy: { position: 'asc' } },
      articleBlocks: { orderBy: { position: 'asc' } },
      processLanes: { orderBy: { position: 'asc' } },
      processNodes: true,
    },
  });
  const itemIds = new Set<string>(items.map((i: any) => i.id));
  const inSet = (id: string | null | undefined) => !!id && itemIds.has(id);

  const relations = itemIds.size === 0 ? [] : await prisma.itemRelation.findMany({
    where: { fromItemId: { in: [...itemIds] }, toItemId: { in: [...itemIds] } },
  });
  const contributions = itemIds.size === 0 ? [] : await prisma.contribution.findMany({
    where: { itemId: { in: [...itemIds] } }, orderBy: { createdAt: 'asc' },
  });

  const tagIds = new Set<string>(items.flatMap((i: any) => i.tags.map((t: any) => t.tagId)));
  const tags = tagIds.size === 0 ? [] : await prisma.tag.findMany({ where: { id: { in: [...tagIds] } }, select: { id: true, name: true, color: true } });

  const userIds = new Set<string>();
  for (const i of items) {
    userIds.add(i.createdById);
    if (i.assignedToId) userIds.add(i.assignedToId);
    if (i.question?.decidedById) userIds.add(i.question.decidedById);
  }
  for (const c of contributions) userIds.add(c.authorId);
  const users = userIds.size === 0 ? [] : await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true, email: true } });

  const exportedItems: RawExportItem[] = items.map((i: any) => {
    const laneIds = new Set<string>(i.processLanes.filter((l: any) => inSet(l.itemId)).map((l: any) => l.id));
    const hasProcess = i.processLanes.length > 0 || i.processNodes.length > 0;
    return {
      id: i.id, spaceId: i.spaceId, parentId: inSet(i.parentId) ? i.parentId : null, type: i.type, title: i.title,
      description: i.description ?? null, legacyContent: i.content ?? null, url: i.url ?? null, status: i.status ?? null,
      priority: i.priority ?? null, position: i.position, dueDate: iso(i.dueDate), startDate: iso(i.startDate), endDate: iso(i.endDate),
      manualHorizon: i.manualHorizon ?? null, horizonSetAt: iso(i.horizonSetAt), createdAt: iso(i.createdAt)!, updatedAt: iso(i.updatedAt)!,
      createdById: i.createdById, assignedToId: i.assignedToId ?? null, assignedToName: i.assignedToName ?? null,
      tagIds: i.tags.map((t: any) => t.tagId),
      externalRefs: i.externalRefs.map((r: any) => r.value),
      contents: i.contents.map((c: any) => ({
        kind: c.kind, url: c.url ?? null, name: c.name ?? null, mimeType: c.mimeType ?? null, size: c.size ?? null, xml: c.xml ?? null,
        previewUrl: c.previewUrl ?? null, excerpt: c.excerpt ?? null, value: c.value ?? null, position: c.position,
      })),
      question: i.question || i.questionOptions.length > 0 ? {
        multiple: i.question?.multiple ?? false, chosenOptionId: i.question?.chosenOptionId ?? null,
        answerText: i.question?.answerText ?? null, note: i.question?.note ?? null,
        decidedById: i.question?.decidedById ?? null, decidedAt: iso(i.question?.decidedAt),
        options: i.questionOptions.map((o: any) => ({ id: o.id, label: o.label, position: o.position, refItemId: inSet(o.refItemId) ? o.refItemId : null })),
      } : null,
      article: i.articleBlocks.length > 0 ? {
        blocks: i.articleBlocks.filter((b: any) => inSet(b.itemId))
          .map((b: any) => ({ itemId: b.itemId, position: b.position, width: b.width, align: b.align, beside: b.beside })),
      } : null,
      process: hasProcess ? {
        lanes: i.processLanes.filter((l: any) => inSet(l.itemId))
          .map((l: any) => ({ id: l.id, itemId: l.itemId, position: l.position, x: l.x ?? null, y: l.y ?? null })),
        nodes: i.processNodes.filter((n: any) => inSet(n.itemId))
          .map((n: any) => ({ itemId: n.itemId, x: n.x, y: n.y, laneId: n.laneId && laneIds.has(n.laneId) ? n.laneId : null })),
      } : null,
    };
  });

  const root = spaces.find((s: any) => s.id === rootId);
  return {
    format: RAW_EXPORT_FORMAT_ID,
    version: RAW_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    source: { spaceId: rootId, spaceName: root?.name ?? '' },
    // Racine d'abord, parent de la racine retiré (l'export commence à cet espace)
    spaces: spaceIds.map((id) => spaces.find((s: any) => s.id === id)).filter(Boolean).map((s: any) => ({
      id: s.id, parentId: s.id === rootId ? null : s.parentId, name: s.name, description: s.description ?? null,
      visibility: s.visibility ?? null, defaultView: s.defaultView ?? null, position: s.position,
    })),
    users: users.map((u: any) => ({ id: u.id, name: u.name, email: opts.includeEmails ? u.email : null })),
    tags: tags.map((t: any) => ({ id: t.id, name: t.name, color: t.color ?? null })),
    items: exportedItems,
    relations: relations.map((r: any) => ({ fromItemId: r.fromItemId, toItemId: r.toItemId, type: r.type, label: r.label ?? null })),
    contributions: contributions.map((c: any) => ({
      id: c.id, itemId: c.itemId, parentId: c.parentId ?? null, authorId: c.authorId, content: c.content,
      reactionType: c.reactionType ?? null, createdAt: iso(c.createdAt)!,
    })),
  };
}

/** Document → texte du fichier dans le format demandé */
export function serializeRawExport(doc: RawExportDocument, format: RawExportFileFormat): string {
  return format === 'xml' ? rawExportToXml(doc) : JSON.stringify(doc, null, 2);
}

// ─── Lecture et contrôle d'un fichier ────────────────────────────────────────────────────────────────────────────────

const str = z.string();
const nstr = z.string().nullable().default(null);
const nnum = z.number().nullable().default(null);

const contentSchema = z.object({
  kind: str, url: nstr, name: nstr, mimeType: nstr, size: nnum, xml: nstr, previewUrl: nstr, excerpt: nstr, value: nstr,
  position: z.number().default(0),
});

const itemSchema = z.object({
  id: str, spaceId: str, parentId: nstr, type: str.default(DEFAULT_ITEM_TYPE), title: str, description: nstr,
  legacyContent: z.unknown().default(null), url: nstr, status: nstr, priority: nnum, position: z.number().default(0),
  dueDate: nstr, startDate: nstr, endDate: nstr, manualHorizon: nstr, horizonSetAt: nstr,
  createdAt: nstr, updatedAt: nstr, createdById: nstr, assignedToId: nstr, assignedToName: nstr,
  tagIds: z.array(str).default([]), externalRefs: z.array(str).default([]), contents: z.array(contentSchema).default([]),
  question: z.object({
    multiple: z.boolean().default(false), chosenOptionId: nstr, answerText: nstr, note: nstr, decidedById: nstr, decidedAt: nstr,
    options: z.array(z.object({ id: str, label: str, position: z.number().default(0), refItemId: nstr })).default([]),
  }).nullable().default(null),
  article: z.object({
    blocks: z.array(z.object({
      itemId: str, position: z.number().default(0), width: str.default('full'), align: str.default('center'), beside: z.boolean().default(false),
    })).default([]),
  }).nullable().default(null),
  process: z.object({
    lanes: z.array(z.object({ id: str, itemId: str, position: z.number().default(0), x: nnum, y: nnum })).default([]),
    nodes: z.array(z.object({ itemId: str, x: z.number(), y: z.number(), laneId: nstr })).default([]),
  }).nullable().default(null),
});

const documentSchema = z.object({
  format: z.literal(RAW_EXPORT_FORMAT_ID),
  version: z.number(),
  exportedAt: str.default(''),
  source: z.object({ spaceId: str.default(''), spaceName: str.default('') }).default({}),
  spaces: z.array(z.object({
    id: str, parentId: nstr, name: str.min(1), description: nstr, visibility: nstr, defaultView: nstr, position: z.number().default(0),
  })).min(1),
  users: z.array(z.object({ id: str, name: str.default(''), email: nstr })).default([]),
  tags: z.array(z.object({ id: str, name: str.min(1), color: nstr })).default([]),
  items: z.array(itemSchema).default([]),
  relations: z.array(z.object({ fromItemId: str, toItemId: str, type: str, label: nstr })).default([]),
  contributions: z.array(z.object({
    id: str, itemId: str, parentId: nstr, authorId: nstr, content: str, reactionType: nstr, createdAt: nstr,
  })).default([]),
});

export type ParsedRawDocument = z.infer<typeof documentSchema>;

/** Texte d'un fichier → document contrôlé. Lève RawImportError avec un message lisible. */
export function parseRawDocument(text: string, format: RawExportFileFormat): ParsedRawDocument {
  let raw: unknown;
  try {
    raw = format === 'xml' ? rawExportFromXml(text) : JSON.parse(text);
  } catch (e) {
    throw new RawImportError(`Fichier ${format.toUpperCase()} illisible : ${(e as Error).message}`);
  }
  const fmt = (raw as { format?: unknown } | null)?.format;
  if (fmt !== RAW_EXPORT_FORMAT_ID) throw new RawImportError('Ce fichier n\'est pas un export « Données brutes » de SPOK');
  const version = (raw as { version?: unknown }).version;
  if (typeof version === 'number' && version > RAW_EXPORT_VERSION) {
    throw new RawImportError(`Fichier produit par une version plus récente de SPOK (format ${version}) : mettez SPOK à jour avant de l'importer`);
  }
  const parsed = documentSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new RawImportError(`Fichier incomplet ou invalide (${first.path.join('.') || 'document'} : ${first.message})`);
  }
  const doc = parsed.data;
  const spaceIds = new Set(doc.spaces.map((s) => s.id));
  const roots = doc.spaces.filter((s) => !s.parentId || !spaceIds.has(s.parentId));
  if (roots.length !== 1) throw new RawImportError('Le fichier doit contenir un seul espace racine');
  const orphan = doc.items.find((i) => !spaceIds.has(i.spaceId));
  if (orphan) throw new RawImportError(`L'élément « ${orphan.title} » appartient à un espace absent du fichier`);
  if (new Set(doc.items.map((i) => i.id)).size !== doc.items.length) throw new RawImportError('Identifiants d\'éléments en double dans le fichier');
  return doc;
}

// ─── Import ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Rangs de profondeur (0 = sans parent connu) : création parent avant enfant, sans boucle */
function depthOrder<T extends { id: string; parentId: string | null }>(rows: T[]): T[][] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const depth = new Map<string, number>();
  const depthOf = (r: T, seen: Set<string>): number => {
    if (depth.has(r.id)) return depth.get(r.id)!;
    const parent = r.parentId ? byId.get(r.parentId) : undefined;
    const d = parent && !seen.has(parent.id) ? depthOf(parent, new Set(seen).add(r.id)) + 1 : 0;
    depth.set(r.id, d);
    return d;
  };
  const levels: T[][] = [];
  for (const r of rows) (levels[depthOf(r, new Set([r.id]))] ??= []).push(r);
  return levels.filter(Boolean);
}

const toDate = (s: string | null | undefined) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export interface RawImportContext {
  userId: string;
  /** Communauté de destination (null : espace sans communauté — sous un parent qui n'en a pas) */
  communityId: string | null;
  /** Espace parent de destination ; null = racine de la communauté */
  parentSpaceId: string | null;
  dryRun: boolean;
}

export async function importRawDocument(prisma: any, doc: ParsedRawDocument, ctx: RawImportContext): Promise<RawImportReport> {
  const knownKinds = new Set<string>(ITEM_CONTENT_KIND_DEFS.map((d) => d.id));
  const relationTypes = new Set<string>(RELATION_TYPES);
  const horizons = new Set<string>(HORIZON_ORDER);
  const visibilities = new Set(['OPEN', 'READONLY', 'PRIVATE']);
  const itemIdsInFile = new Set(doc.items.map((i) => i.id));
  const report: RawImportReport = {
    dryRun: ctx.dryRun, rootSpaceId: null, rootSpaceName: '', exportedAt: doc.exportedAt,
    created: { spaces: doc.spaces.length, items: doc.items.length, relations: 0, contributions: doc.contributions.length, contents: 0, tags: 0 },
    dropped: { relations: 0, articleBlocks: 0, processPlaces: 0, optionRefs: 0 },
    unmatchedUsers: [], copiedFiles: 0,
  };

  // Personnes : par e-mail, parmi les membres de la destination SEULEMENT (communauté, sinon espace parent) — le fichier
  // vient de l'utilisateur : sans cette borne, il attribuerait des éléments à n'importe quel compte et sonderait les e-mails
  const fileUsers = new Map(doc.users.map((u) => [u.id, u]));
  const emails = doc.users.map((u) => u.email).filter((e): e is string => !!e);
  const memberOfDestination = ctx.communityId
    ? { communityMemberships: { some: { communityId: ctx.communityId } } }
    : ctx.parentSpaceId ? { memberships: { some: { spaceId: ctx.parentSpaceId } } } : null;
  const found = emails.length === 0 || !memberOfDestination ? [] : await prisma.user.findMany({
    where: { email: { in: emails, mode: 'insensitive' }, ...memberOfDestination }, select: { id: true, email: true },
  });
  const byEmail = new Map<string, string>(found.map((u: any) => [u.email.toLowerCase(), u.id]));
  const userMap = new Map<string, string>();
  const referenced = new Set<string>([
    ...doc.items.flatMap((i) => [i.createdById, i.assignedToId, i.question?.decidedById]),
    ...doc.contributions.map((c) => c.authorId),
  ].filter((v): v is string => !!v));
  for (const id of referenced) {
    const u = fileUsers.get(id);
    const match = u?.email ? byEmail.get(u.email.toLowerCase()) : undefined;
    if (match) userMap.set(id, match);
    else report.unmatchedUsers.push(u?.name || id);
  }
  report.unmatchedUsers = [...new Set(report.unmatchedUsers)].sort((a, b) => a.localeCompare(b, 'fr'));

  // Identifiants neufs
  const spaceMap = new Map(doc.spaces.map((s) => [s.id, newId()]));
  const itemMap = new Map(doc.items.map((i) => [i.id, newId()]));
  const contribMap = new Map(doc.contributions.map((c) => [c.id, newId()]));
  const root = doc.spaces.find((s) => !s.parentId || !spaceMap.has(s.parentId))!;
  report.rootSpaceName = root.name;

  // Tags : visibles depuis la destination (par nom), sinon créés sur l'espace racine importé
  const scope: TagScope = ctx.parentSpaceId ? await spaceTagScope(prisma, ctx.parentSpaceId) : communityScope(ctx.communityId);
  const usedTagIds = new Set(doc.items.flatMap((i) => i.tagIds));
  const tagMap = new Map<string, string>();
  const tagsToCreate: { id: string; name: string; color: string | null }[] = [];
  const createdByName = new Map<string, string>();
  for (const t of doc.tags.filter((t) => usedTagIds.has(t.id))) {
    const existing = await findTagByName(prisma, scope, t.name);
    if (existing) { tagMap.set(t.id, existing.id); continue; }
    const key = t.name.trim().toLowerCase();
    if (!createdByName.has(key)) {
      const id = newId();
      createdByName.set(key, id);
      tagsToCreate.push({ id, name: t.name.trim(), color: t.color });
    }
    tagMap.set(t.id, createdByName.get(key)!);
  }
  report.created.tags = tagsToCreate.length;

  // Références abandonnées (éléments absents du fichier)
  for (const r of doc.relations) {
    if (!itemIdsInFile.has(r.fromItemId) || !itemIdsInFile.has(r.toItemId) || !relationTypes.has(r.type) || r.fromItemId === r.toItemId) report.dropped.relations++;
  }
  const relationRows = doc.relations
    .filter((r) => itemIdsInFile.has(r.fromItemId) && itemIdsInFile.has(r.toItemId) && relationTypes.has(r.type) && r.fromItemId !== r.toItemId)
    .map((r) => ({ fromItemId: itemMap.get(r.fromItemId)!, toItemId: itemMap.get(r.toItemId)!, type: r.type, label: r.label }));
  report.created.relations = relationRows.length;
  for (const i of doc.items) {
    report.dropped.articleBlocks += (i.article?.blocks ?? []).filter((b) => !itemIdsInFile.has(b.itemId)).length;
    report.dropped.processPlaces += (i.process?.nodes ?? []).filter((n) => !itemIdsInFile.has(n.itemId)).length
      + (i.process?.lanes ?? []).filter((l) => !itemIdsInFile.has(l.itemId)).length;
    report.dropped.optionRefs += (i.question?.options ?? []).filter((o) => o.refItemId && !itemIdsInFile.has(o.refItemId)).length;
  }
  report.created.contents = doc.items.reduce((n, i) => n + i.contents.filter((c) => knownKinds.has(c.kind)).length, 0);

  // Fichiers du stockage actif : recopiés sous le nouvel élément (aperçu : comptés seulement)
  const storageActive = isR2Configured();
  const copyCache = new Map<string, string>();
  const copyUrl = async (url: string | null, newItemId: string): Promise<string | null> => {
    if (!url || !storageActive || !isR2Url(url)) return url;
    report.copiedFiles++;
    if (ctx.dryRun) return url;
    const cacheKey = `${newItemId}|${url}`;
    if (!copyCache.has(cacheKey)) copyCache.set(cacheKey, await copyR2Object(url, newItemId));
    return copyCache.get(cacheKey)!;
  };
  const copyTextFiles = async (text: string | null, newItemId: string): Promise<string | null> => {
    if (!text || !storageActive) return text;
    let out = text;
    for (const key of [...new Set(storageKeysInText(text))]) {
      const url = storageUrlForKey(key);
      const copied = await copyUrl(url, newItemId);
      if (copied && copied !== url) out = out.split(url).join(copied);
    }
    return out;
  };

  const itemRows: Record<string, unknown>[] = [];
  const contentRows: Record<string, unknown>[] = [];
  for (const i of doc.items) {
    const id = itemMap.get(i.id)!;
    const assignee = i.assignedToId ? userMap.get(i.assignedToId) : undefined;
    const lostAssignee = i.assignedToId && !assignee ? (fileUsers.get(i.assignedToId)?.name || null) : null;
    itemRows.push({
      id, spaceId: spaceMap.get(i.spaceId)!, parentId: i.parentId && itemMap.has(i.parentId) ? itemMap.get(i.parentId)! : null,
      type: isItemType(i.type) ? i.type : DEFAULT_ITEM_TYPE, title: i.title,
      description: await copyTextFiles(i.description, id), content: i.legacyContent ?? undefined, url: await copyUrl(i.url, id),
      status: i.status, priority: i.priority, position: i.position,
      dueDate: toDate(i.dueDate), startDate: toDate(i.startDate), endDate: toDate(i.endDate),
      manualHorizon: i.manualHorizon && horizons.has(i.manualHorizon) ? i.manualHorizon : null, horizonSetAt: toDate(i.horizonSetAt),
      createdAt: toDate(i.createdAt) ?? undefined,
      createdById: (i.createdById && userMap.get(i.createdById)) || ctx.userId,
      assignedToId: assignee ?? null,
      assignedToName: assignee ? null : (i.assignedToName ?? lostAssignee),
      assignedAt: assignee ? new Date() : null, assignedById: assignee ? ctx.userId : null,
    });
    for (const c of i.contents.filter((c) => knownKinds.has(c.kind))) {
      contentRows.push({
        itemId: id, kind: c.kind, url: await copyUrl(c.url, id), name: c.name, mimeType: c.mimeType, size: c.size, xml: c.xml,
        previewUrl: await copyUrl(c.previewUrl, id), excerpt: c.excerpt, value: c.value, position: c.position, createdById: ctx.userId,
      });
    }
  }
  const contributionRows: (Record<string, unknown> & { id: string; parentId: string | null })[] = [];
  for (const c of doc.contributions) {
    if (!itemMap.has(c.itemId)) { report.created.contributions--; continue; }
    const itemId = itemMap.get(c.itemId)!;
    contributionRows.push({
      id: contribMap.get(c.id)!, itemId, parentId: c.parentId && contribMap.has(c.parentId) ? contribMap.get(c.parentId)! : null,
      authorId: (c.authorId && userMap.get(c.authorId)) || ctx.userId, content: (await copyTextFiles(c.content, itemId)) ?? '',
      reactionType: c.reactionType, createdAt: toDate(c.createdAt) ?? undefined,
    });
  }

  if (ctx.dryRun) return report;

  await prisma.$transaction(async (tx: any) => {
    // Espaces, parent avant enfant ; l'auteur de l'import en est propriétaire
    const rootPosition = await nextSiblingPosition(tx, ctx.parentSpaceId, ctx.communityId);
    type SpaceRow = ParsedRawDocument['spaces'][number] & { id: string; parentId: string | null };
    const spaceRows = doc.spaces.map((s) => (s.id === root.id ? { ...s, parentId: null } : s)) as SpaceRow[];
    for (const level of depthOrder(spaceRows)) {
      for (const s of level) {
        const id = spaceMap.get(s.id)!;
        await tx.space.create({
          data: {
            id, name: s.name, description: s.description, type: 'GROUP', communityId: ctx.communityId,
            parentId: s.id === root.id ? ctx.parentSpaceId : spaceMap.get(s.parentId!)!,
            position: s.id === root.id ? rootPosition : s.position,
            visibility: s.visibility && visibilities.has(s.visibility) ? s.visibility : null,
            defaultView: s.defaultView,
            memberships: { create: { userId: ctx.userId, role: 'OWNER' } },
          },
        });
      }
    }
    if (tagsToCreate.length) {
      await tx.tag.createMany({ data: tagsToCreate.map((t) => ({ ...t, spaceId: spaceMap.get(root.id)! })) });
    }
    // Éléments, parent avant enfant
    for (const level of depthOrder(itemRows as any[])) await tx.item.createMany({ data: level });

    const tagRows = doc.items.flatMap((i) => [...new Set(i.tagIds.map((t) => tagMap.get(t)).filter((t): t is string => !!t))]
      .map((tagId) => ({ itemId: itemMap.get(i.id)!, tagId })));
    if (tagRows.length) await tx.itemTag.createMany({ data: tagRows, skipDuplicates: true });
    const refRows = doc.items.flatMap((i) => i.externalRefs.map((value, position) => ({ itemId: itemMap.get(i.id)!, value, position })));
    if (refRows.length) await tx.itemExternalRef.createMany({ data: refRows });
    if (contentRows.length) await tx.itemContent.createMany({ data: contentRows });

    // Questions et options
    for (const i of doc.items.filter((i) => i.question)) {
      const q = i.question!;
      const optionMap = new Map(q.options.map((o) => [o.id, newId()]));
      if (q.options.length) {
        await tx.questionOption.createMany({
          data: q.options.map((o) => ({
            id: optionMap.get(o.id)!, itemId: itemMap.get(i.id)!, label: o.label, position: o.position,
            refItemId: o.refItemId && itemMap.has(o.refItemId) ? itemMap.get(o.refItemId)! : null,
          })),
        });
      }
      await tx.question.create({
        data: {
          itemId: itemMap.get(i.id)!, multiple: q.multiple, answerText: q.answerText, note: q.note,
          chosenOptionId: q.chosenOptionId ? optionMap.get(q.chosenOptionId) ?? null : null,
          decidedById: q.decidedById ? userMap.get(q.decidedById) ?? null : null, decidedAt: toDate(q.decidedAt),
        },
      });
    }

    // Blocs d'article et places de process (vers des éléments du fichier seulement)
    const blockRows = doc.items.flatMap((i) => (i.article?.blocks ?? []).filter((b) => itemMap.has(b.itemId)).map((b) => ({
      articleId: itemMap.get(i.id)!, itemId: itemMap.get(b.itemId)!, position: b.position, width: b.width, align: b.align,
      beside: b.beside, addedById: ctx.userId,
    })));
    if (blockRows.length) await tx.articleBlock.createMany({ data: blockRows, skipDuplicates: true });
    const laneMap = new Map<string, string>();
    const laneRows = doc.items.flatMap((i) => (i.process?.lanes ?? []).filter((l) => itemMap.has(l.itemId)).map((l) => {
      const id = newId();
      laneMap.set(l.id, id);
      return { id, processId: itemMap.get(i.id)!, itemId: itemMap.get(l.itemId)!, position: l.position, x: l.x, y: l.y, addedById: ctx.userId };
    }));
    if (laneRows.length) await tx.processLane.createMany({ data: laneRows, skipDuplicates: true });
    const nodeRows = doc.items.flatMap((i) => (i.process?.nodes ?? []).filter((n) => itemMap.has(n.itemId)).map((n) => ({
      processId: itemMap.get(i.id)!, itemId: itemMap.get(n.itemId)!, x: n.x, y: n.y,
      laneId: n.laneId ? laneMap.get(n.laneId) ?? null : null, addedById: ctx.userId,
    })));
    if (nodeRows.length) await tx.processNode.createMany({ data: nodeRows, skipDuplicates: true });

    if (relationRows.length) await tx.itemRelation.createMany({ data: relationRows, skipDuplicates: true });
    for (const level of depthOrder(contributionRows)) await tx.contribution.createMany({ data: level });
  }, { timeout: 120_000, maxWait: 10_000 });

  report.rootSpaceId = spaceMap.get(root.id)!;
  return report;
}
