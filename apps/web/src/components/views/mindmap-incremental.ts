/**
 * Diff incrémental de la MindMap : calcule ce qui a changé entre deux listes d'items
 * (ajouts, suppressions, reparentages, relations) et quels parents doivent être
 * ré-éventaillés localement — SANS recalcul global du layout
 * (cf. docs/superpowers/specs/2026-07-15-mindmap-incremental-layout-design.md).
 * Fonctions pures, aucun import React : testables en Vitest.
 * Règles : jamais '__space__' dans affectedParentIds (on ne ré-éventaille pas la racine) ;
 * les items racine d'un autre espace remontent au nœud portail `child-space-<spaceId>`.
 */
import type { ItemWithRelations } from '@spok/shared';
import { RADIAL_STEP } from './mindmap-utils';

export interface ReparentedItem { id: string; oldParentId: string | null; newParentId: string | null }

export interface ItemsDiff {
  addedIds: string[];
  deletedIds: string[];
  reparented: ReparentedItem[];
  /** Parents à ré-éventailler : ids d'items réels ou `child-space-<spaceId>`. Jamais `__space__`. */
  affectedParentIds: string[];
}

type DiffInput = Pick<ItemWithRelations, 'id' | 'parentId' | 'spaceId'>;

export function diffItems(prev: DiffInput[], next: DiffInput[], currentSpaceId?: string): ItemsDiff {
  const prevMap = new Map(prev.map(i => [i.id, i]));
  const nextMap = new Map(next.map(i => [i.id, i]));

  const addedIds: string[] = [];
  const deletedIds: string[] = [];
  const reparented: ReparentedItem[] = [];

  for (const it of next) {
    const before = prevMap.get(it.id);
    if (!before) { addedIds.push(it.id); continue; }
    if ((before.parentId || null) !== (it.parentId || null)) {
      reparented.push({ id: it.id, oldParentId: before.parentId || null, newParentId: it.parentId || null });
    }
  }
  for (const it of prev) {
    if (!nextMap.has(it.id)) deletedIds.push(it.id);
  }

  // Parent effectif pour le ré-éventail : parentId réel, sinon nœud portail si l'item
  // vient d'un autre espace, sinon null (racine de l'espace courant : pas de ré-éventail).
  const resolveParent = (parentId: string | null | undefined, it: DiffInput): string | null => {
    if (parentId) return parentId;
    if (currentSpaceId && it.spaceId && it.spaceId !== currentSpaceId) return `child-space-${it.spaceId}`;
    return null;
  };

  const affected = new Set<string>();
  for (const id of addedIds) {
    const it = nextMap.get(id)!;
    const p = resolveParent(it.parentId, it);
    if (p) affected.add(p);
  }
  for (const id of deletedIds) {
    const it = prevMap.get(id)!;
    const p = resolveParent(it.parentId, it);
    if (p) affected.add(p);
  }
  for (const r of reparented) {
    const before = prevMap.get(r.id)!;
    const after = nextMap.get(r.id)!;
    const oldP = resolveParent(r.oldParentId, before);
    const newP = resolveParent(r.newParentId, after);
    if (oldP) affected.add(oldP);
    if (newP) affected.add(newP);
  }
  // Un parent lui-même supprimé (cascade) n'existe plus : rien à ré-éventailler chez lui.
  for (const id of deletedIds) affected.delete(id);

  return { addedIds, deletedIds, reparented, affectedParentIds: [...affected] };
}

export interface RelationRef {
  id: string;
  type: string;
  label?: string | null;
  fromItemId: string;
  toItemId: string;
}

export interface RelationsDiff { added: RelationRef[]; removedIds: string[] }

type RelDiffInput = Pick<ItemWithRelations, 'id' | 'relationsFrom'>;

function collectRelations(items: RelDiffInput[]): Map<string, RelationRef> {
  const map = new Map<string, RelationRef>();
  for (const it of items) {
    for (const r of it.relationsFrom || []) {
      map.set(r.id, { id: r.id, type: r.type, label: r.label, fromItemId: r.fromItemId, toItemId: r.toItemId });
    }
  }
  return map;
}

export function diffRelations(prev: RelDiffInput[], next: RelDiffInput[]): RelationsDiff {
  const prevRels = collectRelations(prev);
  const nextRels = collectRelations(next);
  const added: RelationRef[] = [];
  const removedIds: string[] = [];

  for (const [id, rel] of nextRels) {
    const before = prevRels.get(id);
    if (!before) { added.push(rel); continue; }
    if (before.type !== rel.type || (before.label || '') !== (rel.label || '')) {
      removedIds.push(id);
      added.push(rel);
    }
  }
  for (const id of prevRels.keys()) {
    if (!nextRels.has(id)) removedIds.push(id);
  }
  return { added, removedIds };
}

/**
 * Position provisoire d'un nœud ajouté, avant le ré-éventail local qui suit immédiatement.
 * Racine (`__space__`) : angle réparti sur le cercle RADIAL_STEP (pas de ré-éventail ensuite,
 * l'utilisateur ajuste à la main ou via « Réorganiser »).
 */
export function initialPositionForNew(
  parentNodeId: string,
  parentAbsPos: { x: number; y: number } | undefined,
  siblingIndex: number,
  rootCount: number,
): { x: number; y: number } {
  if (parentNodeId === '__space__') {
    const angle = -Math.PI / 2 + (siblingIndex * 2 * Math.PI) / Math.max(1, rootCount);
    return { x: RADIAL_STEP * Math.cos(angle), y: RADIAL_STEP * Math.sin(angle) };
  }
  const p = parentAbsPos || { x: 0, y: 0 };
  return { x: p.x + 140, y: p.y + 80 };
}
