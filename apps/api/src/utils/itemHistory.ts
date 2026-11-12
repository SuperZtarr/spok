/*
 * Historique d'un élément (fiche, règle item-history-members, 2026-11-12) : traduit les entrées du journal d'audit
 * qui le concernent en lignes lisibles (ItemHistoryLine), sans jamais exposer l'état brut enregistré.
 * - Item CREATE → « Créé » ; UPDATE → une ligne par champ changé (titre, type, statut, priorité, dates, parent,
 *   assigné, tags et références externes ajoutés/retirés, « Description modifiée ») ou contentChange (contenus, item-contents.ts) ;
 *   MOVE → parent changé ; BULK_MOVE → espace changé. Position seule, updatedAt… : ignorés (aucune ligne).
 * - ItemRelation ADD/UPDATE/DELETE_RELATION → relation vue depuis l'élément (« bloque » / « bloqué par »).
 * Les libellés viennent de `ctx` (statuts du référentiel, noms, titres) : l'appelant (routes/item-history.ts) ne
 * fournit le titre d'un élément ou le nom d'un espace que si le lecteur peut le lire — sinon un libellé neutre.
 * Entrées anciennes : tags et assigné n'y figurent pas (tracés depuis le 2026-11-12), rien n'est inventé.
 */
import { getItemTypeDef } from '@spok/shared';
import type { ItemHistoryLine } from '@spok/shared';

export interface HistoryLog {
  action: string;
  entity: string;
  entityId: string;
  changes: unknown;
}

export interface HistoryContext {
  itemId: string;
  statusLabel: (id: string) => string;
  userName: (id: string) => string | undefined;
  /** Titre d'un élément lisible par le lecteur, sinon undefined */
  itemTitle: (id: string) => string | undefined;
  /** Nom d'un espace lisible par le lecteur, sinon undefined */
  spaceName: (id: string) => string | undefined;
}

type State = Record<string, unknown>;

const PRIORITY_LABELS: Record<number, string> = { 1: 'Basse', 2: 'Normale', 3: 'Haute', 4: 'Urgente' };
const CONTENT_KIND_LABELS: Record<string, string> = { IMAGE: 'Image', FILE: 'Fichier', LINK: 'Lien', DIAGRAM: 'Schéma' };
const RELATION_FROM: Record<string, string> = { blocks: 'bloque', implements: 'permet', drives: 'entraîne', relates: 'lié à', parent: 'parent de' };
const RELATION_TO: Record<string, string> = { blocks: 'bloqué par', implements: 'permis par', drives: 'entraîné par', relates: 'lié à', parent: 'enfant de' };
const EMPTY_DESCRIPTIONS = new Set(['', '<p></p>', '<p><br></p>', '<p><br/></p>', '<p> </p>']);

/** Ids à résoudre avant de traduire (utilisateurs, éléments, espaces), pour une seule série de requêtes */
export function collectHistoryRefs(logs: HistoryLog[], itemId: string) {
  const userIds = new Set<string>();
  const itemIds = new Set<string>();
  const spaceIds = new Set<string>();
  for (const log of logs) {
    const { before, after } = states(log);
    for (const s of [before, after]) {
      if (typeof s.assignedToId === 'string') userIds.add(s.assignedToId);
      if (typeof s.parentId === 'string') itemIds.add(s.parentId);
      if (log.action === 'BULK_MOVE' && typeof s.spaceId === 'string') spaceIds.add(s.spaceId);
      if (log.entity === 'ItemRelation') {
        const other = s.fromItemId === itemId ? s.toItemId : s.fromItemId;
        if (typeof other === 'string') itemIds.add(other);
      }
    }
  }
  return { userIds: [...userIds], itemIds: [...itemIds], spaceIds: [...spaceIds] };
}

function states(log: HistoryLog): { before: State; after: State } {
  const c = (log.changes && typeof log.changes === 'object' ? log.changes : {}) as { before?: State; after?: State };
  return { before: c.before ?? {}, after: c.after ?? {} };
}

const has = (s: State, key: string) => Object.prototype.hasOwnProperty.call(s, key);

function formatDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value as string);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Paris' });
}

const quoted = (title: string | undefined) => (title ? `« ${title} »` : 'un élément non accessible');

/** Lignes d'une entrée du journal, vues depuis l'élément ctx.itemId ; [] = rien d'utile à montrer */
export function describeHistoryLog(log: HistoryLog, ctx: HistoryContext): ItemHistoryLine[] {
  const { before, after } = states(log);

  if (log.entity === 'ItemRelation') {
    const rel = has(after, 'type') ? after : before;
    const fromSelf = rel.fromItemId === ctx.itemId;
    const other = (fromSelf ? rel.toItemId : rel.fromItemId) as string | undefined;
    const verb = (type: unknown) => (fromSelf ? RELATION_FROM : RELATION_TO)[type as string] ?? String(type ?? '');
    const target = quoted(other ? ctx.itemTitle(other) : undefined);
    if (log.action === 'ADD_RELATION') return [{ label: 'Relation ajoutée', after: `${verb(after.type)} ${target}` }];
    if (log.action === 'DELETE_RELATION') return [{ label: 'Relation retirée', before: `${verb(before.type)} ${target}` }];
    if (before.type !== after.type) return [{ label: 'Relation modifiée', before: `${verb(before.type)} ${target}`, after: `${verb(after.type)} ${target}` }];
    return [];
  }

  if (log.entity !== 'Item') return [];

  if (log.action === 'CREATE') return [{ label: after.fromTemplateId ? 'Créé à partir d\'un modèle' : 'Créé' }];
  if (log.action === 'BULK_MOVE') {
    const name = typeof after.spaceId === 'string' ? ctx.spaceName(after.spaceId) : undefined;
    return [{ label: 'Déplacé vers un autre espace', after: name ?? null }];
  }

  const content = after.contentChange as { op?: string; kind?: string; name?: string | null; previousName?: string | null; urlChanged?: boolean; xmlChanged?: boolean } | undefined;
  if (content) {
    const kind = CONTENT_KIND_LABELS[content.kind ?? ''] ?? 'Contenu';
    const what = content.name ? `${kind} « ${content.name} »` : kind;
    switch (content.op) {
      case 'add': return [{ label: 'Contenu ajouté', after: what }];
      case 'remove': return [{ label: 'Contenu retiré', before: what }];
      case 'reorder': return [{ label: `Ordre des contenus modifié (${kind.toLowerCase()}s)` }];
      case 'update': {
        const lines: ItemHistoryLine[] = [];
        if (has(content, 'previousName')) lines.push({ label: `${kind} renommé`, before: content.previousName ?? null, after: content.name ?? null });
        if (content.urlChanged) lines.push({ label: `Adresse modifiée : ${what}` });
        if (content.xmlChanged) lines.push({ label: `Schéma modifié : ${what}` });
        return lines;
      }
      default: return [];
    }
  }

  const lines: ItemHistoryLine[] = [];
  const changed = (key: string) => has(before, key) && has(after, key) && !sameValue(before[key], after[key]);

  if (changed('title')) lines.push({ label: 'Titre', before: (before.title as string) || null, after: (after.title as string) || null });
  if (changed('type')) lines.push({ label: 'Type', before: typeLabel(before.type), after: typeLabel(after.type) });
  if (changed('status')) lines.push({ label: 'Statut', before: before.status ? ctx.statusLabel(before.status as string) : null, after: after.status ? ctx.statusLabel(after.status as string) : null });
  if (changed('priority')) lines.push({ label: 'Priorité', before: priorityLabel(before.priority), after: priorityLabel(after.priority) });
  for (const [key, label] of [['startDate', 'Début'], ['endDate', 'Fin'], ['dueDate', 'Échéance']] as const) {
    if (changed(key) && formatDate(before[key]) !== formatDate(after[key])) lines.push({ label, before: formatDate(before[key]), after: formatDate(after[key]) });
  }
  if (changed('parentId')) lines.push({ label: 'Parent', before: parentLabel(before.parentId, ctx), after: parentLabel(after.parentId, ctx) });
  if (changed('assignedToId') || changed('assignedToName')) {
    lines.push({ label: 'Assigné à', before: assigneeLabel(before, ctx), after: assigneeLabel(after, ctx) });
  }
  if (has(before, 'tags') && has(after, 'tags')) {
    const was = new Set((before.tags as string[]) ?? []);
    const now = new Set((after.tags as string[]) ?? []);
    for (const t of now) if (!was.has(t)) lines.push({ label: 'Tag ajouté', after: t });
    for (const t of was) if (!now.has(t)) lines.push({ label: 'Tag retiré', before: t });
  }
  if (has(before, 'externalRefs') && has(after, 'externalRefs')) {
    const was = new Set((before.externalRefs as string[]) ?? []);
    const now = new Set((after.externalRefs as string[]) ?? []);
    for (const r of now) if (!was.has(r)) lines.push({ label: 'Référence externe ajoutée', after: r });
    for (const r of was) if (!now.has(r)) lines.push({ label: 'Référence externe retirée', before: r });
  }
  if (has(before, 'description') && has(after, 'description') && normDescription(before.description) !== normDescription(after.description)) {
    lines.push({ label: 'Description modifiée' });
  }
  return lines;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i]);
  return (a ?? null) === (b ?? null);
}

const typeLabel = (type: unknown) => (type ? getItemTypeDef(type as string)?.label ?? String(type) : null);
const priorityLabel = (p: unknown) => (typeof p === 'number' ? PRIORITY_LABELS[p] ?? `P${p}` : null);
const normDescription = (d: unknown) => {
  const t = typeof d === 'string' ? d.trim() : '';
  return EMPTY_DESCRIPTIONS.has(t) ? '' : t;
};
const parentLabel = (id: unknown, ctx: HistoryContext) => (typeof id === 'string' ? quoted(ctx.itemTitle(id)) : 'aucun (racine)');
function assigneeLabel(s: State, ctx: HistoryContext): string | null {
  if (typeof s.assignedToId === 'string') return ctx.userName(s.assignedToId) ?? 'un utilisateur';
  return (s.assignedToName as string) || null;
}
