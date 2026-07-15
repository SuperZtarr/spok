# MindMap Layout Incrémental — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le recalcul global du layout MindMap sur changement structurel : ajout/suppression/déplacement d'item = ré-éventail local du/des parent(s) concerné(s) uniquement, relations = arêtes seules. Layout complet réservé au premier rendu et au bouton « Réorganiser ».

**Architecture:** Un nouveau module pur `mindmap-incremental.ts` calcule le diff entre deux listes d'items (ajouts, suppressions, reparentages, relations, parents affectés) — testable en Vitest. `MindMapView.tsx` consomme ce diff dans son effect structurel et route les ajustements vers le ré-éventail local existant (`reorganizeRef`). Les fabriques de nœud/arête sont extraites de `calculateLayout` pour être réutilisées par le chemin incrémental.

**Tech Stack:** React 18, @xyflow/react (React Flow), Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-15-mindmap-incremental-layout-design.md`

**⚠️ Règles projet qui priment sur le template :**
- Zone fragile (cf. CLAUDE.md) : le pattern `reorganizeRef.current` (capture du closure courant) est obligatoire ; ne pas toucher `placePortalItem` ni le placement des portails.
- **Aucun commit sans demande explicite de Thomas** — les étapes « Commit » ci-dessous sont des points de commit *proposés*, à n'exécuter que sur son ordre.
- Vérifications lourdes (TNR complet, typecheck 5 paquets) : uniquement au moment du déploiement. Pendant le dev : seulement le fichier de test concerné + `pnpm --filter @spok/web exec tsc --noEmit`.
- Tout fichier créé/modifié reçoit/conserve un commentaire d'en-tête (raison d'être, params clés, règles d'usage).

---

## Comportement cible (rappel spec)

| Événement | Traitement |
|---|---|
| Ajout d'enfant | Nœud créé près du parent, puis ré-éventail local des enfants du parent |
| Suppression | Retrait nœuds/arêtes + purge `savedPositions` + ré-éventail local des frères restants (ils se resserrent) |
| Reparentage | Ré-éventail local chez l'ancien ET le nouveau parent ; plus AUCUN effacement de branches |
| Relation créée/supprimée/modifiée | Arêtes seules, aucun repositionnement |
| Contenu (titre, statut…) | Patch data en place (existant, conservé) |
| Repli/dépli, portails, focus | Inchangé : recalcul complet avec `applyPositions` (comme aujourd'hui) |
| Racine de l'espace (`__space__`) | **Pas de ré-éventail** (ça déplacerait des branches entières) : ajout racine placé à un angle libre, suppression racine = simple retrait |
| Item racine d'un portail | Ré-éventail du nœud portail `child-space-<spaceId>` (déjà géré par `reorganizeRef`) |

---

## File Structure

- **Create:** `apps/web/src/components/views/mindmap-incremental.ts` — fonctions pures de diff (aucun import React)
- **Create:** `apps/web/src/components/views/mindmap-incremental.test.ts` — tests Vitest
- **Modify:** `apps/web/src/components/views/mindmap-layout.ts` — extraction `buildMindmapNode`, `buildTreeEdge`, `buildRelationEdge` (réutilisées par `calculateLayout` ET le chemin incrémental)
- **Modify:** `apps/web/src/components/views/MindMapView.tsx` — signatures, effect structurel, `onNodeDragStop`

---

### Task 1: Module de diff pur `mindmap-incremental.ts` (TDD)

**Files:**
- Create: `apps/web/src/components/views/mindmap-incremental.ts`
- Test: `apps/web/src/components/views/mindmap-incremental.test.ts`

- [ ] **Step 1.1: Écrire les tests (rouges)**

```ts
/* Tests du diff incrémental MindMap : détection ajouts/suppressions/reparentages/relations
 * et calcul des parents à ré-éventailler. */
import { describe, it, expect } from 'vitest';
import { diffItems, diffRelations, initialPositionForNew } from './mindmap-incremental';

const item = (id: string, parentId: string | null = null, spaceId = 'S1') =>
  ({ id, parentId, spaceId }) as any;

describe('diffItems', () => {
  it('détecte un ajout et marque son parent comme affecté', () => {
    const prev = [item('a'), item('b', 'a')];
    const next = [item('a'), item('b', 'a'), item('c', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.addedIds).toEqual(['c']);
    expect(d.deletedIds).toEqual([]);
    expect(d.reparented).toEqual([]);
    expect(d.affectedParentIds).toEqual(['a']);
  });

  it('détecte une suppression et marque le parent (les frères se resserrent)', () => {
    const prev = [item('a'), item('b', 'a'), item('c', 'a')];
    const next = [item('a'), item('b', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.deletedIds).toEqual(['c']);
    expect(d.affectedParentIds).toEqual(['a']);
  });

  it('détecte un reparentage et marque les DEUX parents', () => {
    const prev = [item('a'), item('b'), item('x', 'a')];
    const next = [item('a'), item('b'), item('x', 'b')];
    const d = diffItems(prev, next, 'S1');
    expect(d.reparented).toEqual([{ id: 'x', oldParentId: 'a', newParentId: 'b' }]);
    expect(d.affectedParentIds.sort()).toEqual(['a', 'b']);
  });

  it('ne ré-éventaille jamais la racine de l’espace courant', () => {
    const prev = [item('a')];
    const next = [item('a'), item('b')]; // ajout à la racine
    const d = diffItems(prev, next, 'S1');
    expect(d.addedIds).toEqual(['b']);
    expect(d.affectedParentIds).toEqual([]);
  });

  it('un item racine d’un autre espace (portail) affecte le nœud portail', () => {
    const prev = [item('a')];
    const next = [item('a'), item('p1', null, 'S2')];
    const d = diffItems(prev, next, 'S1');
    expect(d.affectedParentIds).toEqual(['child-space-S2']);
  });

  it('un parent supprimé en cascade n’est pas dans les parents affectés', () => {
    const prev = [item('a'), item('b', 'a'), item('c', 'b')];
    const next = [item('a')]; // b et c supprimés ensemble
    const d = diffItems(prev, next, 'S1');
    expect(d.deletedIds.sort()).toEqual(['b', 'c']);
    expect(d.affectedParentIds).toEqual(['a']); // pas 'b'
  });

  it('un déplacement racine → parent marque seulement le nouveau parent', () => {
    const prev = [item('a'), item('x')];
    const next = [item('a'), item('x', 'a')];
    const d = diffItems(prev, next, 'S1');
    expect(d.affectedParentIds).toEqual(['a']);
  });
});

describe('diffRelations', () => {
  const withRel = (id: string, rels: any[]) => ({ id, parentId: null, relationsFrom: rels }) as any;
  const rel = (id: string, from: string, to: string, type = 'relates', label: string | null = null) =>
    ({ id, fromItemId: from, toItemId: to, type, label });

  it('détecte une relation ajoutée', () => {
    const prev = [withRel('a', [])];
    const next = [withRel('a', [rel('r1', 'a', 'b')])];
    const d = diffRelations(prev, next);
    expect(d.added.map(r => r.id)).toEqual(['r1']);
    expect(d.removedIds).toEqual([]);
  });

  it('détecte une relation supprimée', () => {
    const prev = [withRel('a', [rel('r1', 'a', 'b')])];
    const next = [withRel('a', [])];
    const d = diffRelations(prev, next);
    expect(d.removedIds).toEqual(['r1']);
  });

  it('une relation modifiée (type/label) est retirée puis ré-ajoutée', () => {
    const prev = [withRel('a', [rel('r1', 'a', 'b', 'relates')])];
    const next = [withRel('a', [rel('r1', 'a', 'b', 'blocks')])];
    const d = diffRelations(prev, next);
    expect(d.removedIds).toEqual(['r1']);
    expect(d.added.map(r => r.id)).toEqual(['r1']);
  });
});

describe('initialPositionForNew', () => {
  it('place un enfant près de son parent (le ré-éventail suit)', () => {
    const pos = initialPositionForNew('a', { x: 100, y: 50 }, 0, 1);
    expect(Math.hypot(pos.x - 100, pos.y - 50)).toBeLessThan(300);
  });

  it('place un ajout racine sur le cercle RADIAL_STEP autour du centre', () => {
    const pos = initialPositionForNew('__space__', undefined, 2, 5);
    expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(420, 0);
  });
});
```

- [ ] **Step 1.2: Vérifier que les tests échouent**

Run: `pnpm --filter @spok/web exec vitest run src/components/views/mindmap-incremental.test.ts`
Expected: FAIL — module `./mindmap-incremental` introuvable.

- [ ] **Step 1.3: Implémenter le module**

```ts
/**
 * Diff incrémental de la MindMap : calcule ce qui a changé entre deux listes d'items
 * (ajouts, suppressions, reparentages, relations) et quels parents doivent être
 * ré-éventaillés localement — SANS recalcul global du layout (cf. spec 2026-07-15).
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
```

- [ ] **Step 1.4: Vérifier que les tests passent**

Run: `pnpm --filter @spok/web exec vitest run src/components/views/mindmap-incremental.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 1.5: Point de commit proposé** *(uniquement sur demande explicite de Thomas)*

```bash
git add apps/web/src/components/views/mindmap-incremental.ts apps/web/src/components/views/mindmap-incremental.test.ts
git commit -m "feat: module de diff incrémental pour la MindMap"
```

---

### Task 2: Extraction des fabriques nœud/arête dans `mindmap-layout.ts`

Refactor pur (aucun changement de comportement) : `calculateLayout` construit ses nœuds mindmap, arêtes parent-enfant et arêtes de relation inline. On extrait trois fonctions exportées pour que le chemin incrémental produise des objets strictement identiques. **Ne pas toucher `placePortalItem` ni `buildPortalNodesAndEdges`** (zone fragile, data légèrement différente, hors périmètre).

**Files:**
- Modify: `apps/web/src/components/views/mindmap-layout.ts`

- [ ] **Step 2.1: Extraire `buildMindmapNode`**

Ajouter après `getBestHandles` (le corps est le contenu actuel de la boucle `getAllItems(rootDatum).forEach` de `calculateLayout`, lignes ~239-289) :

```ts
/** Fabrique un nœud mindmap ReactFlow pour un item — utilisée par calculateLayout ET le chemin incrémental (les deux doivent produire des data identiques). `position` est la position déjà ajustée (coin haut-gauche). */
export function buildMindmapNode(
  item: TreeItem,
  position: { x: number; y: number },
  statuses: StatusConfig[],
  collapsedIds: Set<string>,
  callbacks: MindMapCallbacks,
  options: MindMapLayoutOptions,
  isRoot: boolean,
): Node {
  const { onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse, onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab, onTogglePin, onSavePosition } = callbacks;
  const { hasPortalSupport, statusOptions, highlightType, highlightStatus, searchMatchIds, canEdit, canEditItem, pinnedIdsSet, currentSpaceId, portalSpaceNames } = options;
  const statusColor = getStatusColor(item.status, statuses);
  const hexColor = tailwindBgToHex(statusColor);
  return {
    id: item.id,
    type: 'mindmap',
    position,
    data: {
      label: item.title,
      item,
      statusColor,
      hexColor,
      textColor: getContrastTextColor(hexColor),
      onEdit, onDelete, onUpdateStatus, onAddChild, onAddPortal, onToggleCollapse,
      onReorganizeChildren, onMoveToSpace, onDuplicateToSpace, onConvertToSpace,
      onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpenInNewTab,
      statusOptions,
      isRoot,
      hasChildren: item.children.length > 0,
      isCollapsed: collapsedIds.has(item.id),
      childCount: countDescendants(item),
      hasPortalSupport,
      isHighlighted: (highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false),
      isDimmed: (highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false),
      isSearchMatch: !!(searchMatchIds && searchMatchIds.has(item.id)),
      isDropTarget: false,
      canEdit: canEdit !== false && (canEditItem ? canEditItem(item) : true),
      isPinned: pinnedIdsSet?.has(item.id) || false,
      onTogglePin: onTogglePin || (() => {}),
      onSavePosition,
      isPortal: !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId),
      portalSpaceName: (currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId) ? portalSpaceNames?.get(item.spaceId) : undefined,
    },
  };
}
```

Puis remplacer dans `calculateLayout` la construction inline par :

```ts
  getAllItems(rootDatum).forEach(datum => {
    const item = datum.item!;
    const pos = nodePositionMap.get(datum.id);
    if (!pos) return;
    const isRoot = !item.parentId || !nodePositionMap.has(item.parentId);
    const adjustedPos = { x: pos.x - 75, y: pos.y - 20 };
    nodes.push(buildMindmapNode(item, adjustedPos, statuses, collapsedIds, callbacks, options, isRoot));
    // ... (arête parent, voir Step 2.2)
  });
```

- [ ] **Step 2.2: Extraire `buildTreeEdge`**

Corps = construction actuelle de l'arête parent-enfant dans la même boucle (lignes ~292-320) :

```ts
/** Arête hiérarchique parent→enfant, style dégressif selon la profondeur du sous-arbre. Utilisée par calculateLayout ET le chemin incrémental. Les positions sont les positions ajustées des nœuds. */
export function buildTreeEdge(
  effectiveParentId: string,
  item: TreeItem,
  parentPos: { x: number; y: number },
  childPos: { x: number; y: number },
): Edge {
  const { sourceHandle, targetHandle } = getBestHandles(parentPos, childPos);
  const depth = maxDepth(item);
  const isRootEdge = effectiveParentId === SPACE_NODE_ID;
  return {
    id: `${effectiveParentId}-${item.id}`,
    source: effectiveParentId,
    target: item.id,
    sourceHandle,
    targetHandle,
    type: 'default',
    style: {
      stroke: isRootEdge ? 'hsl(var(--primary))' : '#94a3b8',
      strokeWidth: isRootEdge ? 4 : Math.max(1.5, Math.min(4, 1.5 + depth * 0.8)),
      opacity: isRootEdge ? 0.9 : Math.max(0.5, Math.min(0.9, 0.5 + depth * 0.15)),
    },
  };
}
```

Et dans `calculateLayout` :

```ts
    const effectiveParentId = (item.parentId && nodePositionMap.has(item.parentId))
      ? item.parentId
      : SPACE_NODE_ID;
    const parentPos = nodePositionMap.get(effectiveParentId);
    if (parentPos) {
      edges.push(buildTreeEdge(
        effectiveParentId, item,
        { x: parentPos.x - 75, y: parentPos.y - 20 },
        adjustedPos,
      ));
    }
```

- [ ] **Step 2.3: Extraire `buildRelationEdge`**

Corps = construction actuelle dans la boucle relations de `calculateLayout` (lignes ~336-356) :

```ts
/** Arête de relation (pointillé violet). `handles` optionnels — recalculés ensuite par recalculateEdgeHandles. */
export function buildRelationEdge(
  relation: { id: string; type: string; label?: string | null; fromItemId: string; toItemId: string; fromItem?: { title?: string }; toItem?: { title?: string } },
  handles: { sourceHandle: string; targetHandle: string } = { sourceHandle: 'right-source', targetHandle: 'left' },
): Edge {
  return {
    id: `relation-${relation.id}`,
    source: relation.fromItemId,
    target: relation.toItemId,
    ...handles,
    type: 'relation',
    animated: true,
    style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '5,5' },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
    data: {
      relationId: relation.id,
      type: relation.type,
      label: relation.label || '',
      fromItemId: relation.fromItemId,
      fromTitle: relation.fromItem?.title || relation.fromItemId,
      toTitle: relation.toItem?.title || relation.toItemId,
    },
    label: relation.label ? undefined : relationEdgeLabel(relation.type, relation.label),
    labelStyle: { fontSize: 10, fill: '#8b5cf6' },
    labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
  };
}
```

Et dans `calculateLayout`, la boucle relations devient :

```ts
  items.forEach(item => {
    item.relationsFrom?.forEach(relation => {
      if (nodeIds.has(relation.fromItemId) && nodeIds.has(relation.toItemId)) {
        const sourcePos = nodePositionMap.get(relation.fromItemId);
        const targetPos = nodePositionMap.get(relation.toItemId);
        const handles = sourcePos && targetPos
          ? getBestHandles(sourcePos, targetPos)
          : undefined;
        relationEdges.push(buildRelationEdge(relation as any, handles));
      }
    });
  });
```

- [ ] **Step 2.4: Typecheck scoped**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 2.5: Point de commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/components/views/mindmap-layout.ts
git commit -m "refactor: extraction buildMindmapNode/buildTreeEdge/buildRelationEdge (aucun changement de comportement)"
```

---

### Task 3: Réécriture de l'effect structurel dans `MindMapView.tsx`

**Files:**
- Modify: `apps/web/src/components/views/MindMapView.tsx` (imports, refs ~l.147-150, signatures ~l.557-570, effect ~l.573-647)

- [ ] **Step 3.1: Imports et refs**

Ajouter aux imports :

```ts
import { diffItems, diffRelations, initialPositionForNew } from './mindmap-incremental';
import { buildMindmapNode, buildTreeEdge, buildRelationEdge } from './mindmap-layout';
```

Remplacer les refs de détection (l.147-150) :

```ts
  const prevStructureRef = useRef<string>('');
  const prevRelationsRef = useRef<string>('');
  const prevDepsRef = useRef<string>('');
  const prevItemsRef = useRef<ItemWithRelations[]>([]);
```

(`prevItemIdsRef` et `prevItemSigsRef` sont supprimées — remplacées par `prevItemsRef` + `diffItems`.)

- [ ] **Step 3.2: Nouvelles signatures**

Remplacer `structureSignature` et `depsSignature` (l.557-570) :

```ts
  // Signature structurelle : id + parentId suffisent (les relations ont leur propre signature,
  // le nombre d'enfants est couvert par les ids des enfants eux-mêmes).
  const structureSignature = useMemo(
    () => items.map(i => `${i.id}:${i.parentId || ''}`).sort().join('|'),
    [items]
  );

  // Relations à part : leur changement ne touche que les arêtes, jamais le layout.
  const relationsSignature = useMemo(
    () => items
      .flatMap(i => (i.relationsFrom || []).map(r => `${r.id}:${r.type}:${r.label || ''}`))
      .sort().join('|'),
    [items]
  );

  // Deps nécessitant un recalcul complet : repli/dépli, focus, portails.
  // items.length en est RETIRÉ : ajout/suppression passe par le chemin incrémental.
  const depsSignature = `${[...collapsedIds].sort().join(',')}|${displayName}|${portals.map(p => p.id).join(',')}`;
```

- [ ] **Step 3.3: Réécrire l'effect**

Remplacer intégralement l'effect l.573-647 par :

```ts
  // Mise à jour des nœuds. Quatre chemins :
  //  1. premier rendu OU deps (repli, focus, portails) → layout complet + applyPositions (inchangé)
  //  2. changement structurel (ajout/suppression/reparentage) → INCRÉMENTAL : diff + ré-éventail
  //     local des parents affectés — la carte ne bouge jamais globalement (spec 2026-07-15)
  //  3. changement de relations seules → arêtes seules
  //  4. contenu seul → patch data en place
  useEffect(() => {
    const isFirstRender = prevStructureRef.current === '';
    const isStructuralChange = prevStructureRef.current !== structureSignature;
    const isRelationChange = prevRelationsRef.current !== relationsSignature;
    const isDepsChange = prevDepsRef.current !== depsSignature;
    prevStructureRef.current = structureSignature;
    prevRelationsRef.current = relationsSignature;
    prevDepsRef.current = depsSignature;
    const prevItems = prevItemsRef.current;
    prevItemsRef.current = items;

    // --- Chemin 1 : layout complet (premier rendu, repli/dépli, portails, focus) ---
    if (isFirstRender || isDepsChange) {
      const { nodes: newNodes, edges: newEdges, relationEdges, rootArcEnd, arcStart } = calculateLayout(tree, items, statuses, collapsedIds, displayName, items.length, layoutCallbacks, layoutOptions);
      const positionedNodes = applyPositions(newNodes);

      const { portalNodes, portalEdges, portalRelationEdges } = buildPortalNodesAndEdges({
        positionedNodes, portals, portalItemsBySpace, childSpaces, communitySpaces,
        portalSpaceNames, statuses, collapsedIds, items, callbacks: layoutCallbacks,
        options: layoutOptions, removePortal, savedPositions: savedPositions.current, rootArcEnd, arcStart,
      }, relationEdges);

      const allNodes = [...positionedNodes, ...portalNodes];
      const edgePosMap = new Map(allNodes.map(n => [n.id, n.position]));
      const currentRelationEdges = [...relationEdges, ...portalRelationEdges];
      lastRelationEdgesRef.current = recalculateEdgeHandles(currentRelationEdges, edgePosMap);
      const allEdges = recalculateEdgeHandles([...newEdges, ...(showRelations ? currentRelationEdges : []), ...portalEdges], edgePosMap);
      setNodes(allNodes);
      setEdges(allEdges);
      if (!userHasInteracted.current) setTimeout(() => fitView({ padding: 0.1 }), 50);
      return;
    }

    const itemMap = new Map(items.map(i => [i.id, i]));

    // Patch des data d'un nœud mindmap existant (contenu + badges structure).
    const refreshNodeData = (n: Node): Node => {
      if (n.type === 'space') {
        return n.data?.itemCount === items.length ? n : { ...n, data: { ...n.data, itemCount: items.length } };
      }
      if (n.type !== 'mindmap') return n;
      const item = itemMap.get(n.id);
      if (!item) return n;
      const treeNode = findTreeNode(fullTree, n.id);
      const statusColor = getStatusColor(item.status, statuses);
      const hexColor = tailwindBgToHex(statusColor);
      return {
        ...n,
        data: {
          ...n.data,
          label: item.title,
          item: treeNode ?? item,
          statusColor,
          hexColor,
          textColor: getContrastTextColor(hexColor),
          hasChildren: treeNode ? treeNode.children.length > 0 : false,
          childCount: treeNode ? countDescendants(treeNode) : 0,
          isCollapsed: collapsedIds.has(item.id),
          isHighlighted: (layoutOptions.highlightType ? item.type === layoutOptions.highlightType : false) || (layoutOptions.highlightStatus ? (layoutOptions.highlightStatus === 'undefined' ? !item.status : item.status === layoutOptions.highlightStatus) : false),
          isDimmed: (layoutOptions.highlightType ? item.type !== layoutOptions.highlightType : false) || (layoutOptions.highlightStatus ? (layoutOptions.highlightStatus === 'undefined' ? !!item.status : item.status !== layoutOptions.highlightStatus) : false) || (layoutOptions.searchMatchIds ? !layoutOptions.searchMatchIds.has(item.id) : false),
          isSearchMatch: !!(layoutOptions.searchMatchIds && layoutOptions.searchMatchIds.has(item.id)),
        },
      };
    };

    // --- Chemin 4 : contenu seul ---
    if (!isStructuralChange && !isRelationChange) {
      setNodes(nds => nds.map(refreshNodeData));
      return;
    }

    // --- Chemins 2 et 3 : incrémental ---
    const relDiff = diffRelations(prevItems, items);

    if (isStructuralChange) {
      const diff = diffItems(prevItems, items, spaceId);
      const deletedSet = new Set(diff.deletedIds);

      // Purge des positions sauvegardées des items supprimés
      let positionsDirty = false;
      for (const id of diff.deletedIds) {
        if (savedPositions.current[id]) { delete savedPositions.current[id]; positionsDirty = true; }
      }
      if (positionsDirty) savePositions();

      setNodes(currentNodes => {
        const absPositions = getAbsolutePositions(currentNodes);
        const existingIds = new Set(currentNodes.map(n => n.id));

        // 1. Retirer les nœuds supprimés
        let nextNodes = currentNodes.filter(n => !deletedSet.has(n.id));

        // 2. Créer les nœuds ajoutés (si visibles : parent présent et non replié)
        const rootCount = fullTree.length;
        const addedNodes: Node[] = [];
        for (const id of diff.addedIds) {
          if (existingIds.has(id)) continue;
          const item = itemMap.get(id);
          if (!item) continue;
          if (item.parentId && collapsedIds.has(item.parentId)) continue; // caché sous un repli
          const treeNode = findTreeNode(fullTree, id);
          if (!treeNode) continue; // item d'un autre espace non affiché (portail absent)
          const parentNodeId = item.parentId
            || (item.spaceId && item.spaceId !== spaceId ? `child-space-${item.spaceId}` : '__space__');
          if (parentNodeId !== '__space__' && !absPositions.has(parentNodeId)) continue; // parent hors canevas
          const siblingIndex = fullTree.findIndex(r => r.id === id);
          const pos = initialPositionForNew(parentNodeId, absPositions.get(parentNodeId), Math.max(siblingIndex, 0), Math.max(rootCount, 1));
          addedNodes.push(buildMindmapNode(treeNode, pos, statuses, collapsedIds, layoutCallbacks, layoutOptions, parentNodeId === '__space__'));
        }
        nextNodes = [...nextNodes, ...addedNodes];

        // 3. Rafraîchir les data de tous les nœuds (badges enfants, item à jour…)
        nextNodes = nextNodes.map(refreshNodeData);

        // 4. Arêtes : supprimées, reparentées, ajoutées, relations
        const newAbsPositions = getAbsolutePositions(nextNodes);
        setEdges(currentEdges => {
          let nextEdges = currentEdges.filter(e =>
            !deletedSet.has(e.source) && !deletedSet.has(e.target)
            && !relDiff.removedIds.some(rid => e.data?.relationId === rid));

          // Reparentés : l'id d'arête encode le parent → retirer l'ancienne, créer la nouvelle
          for (const r of diff.reparented) {
            nextEdges = nextEdges.filter(e => !(e.target === r.id && !e.data?.relationId));
            const treeNode = findTreeNode(fullTree, r.id);
            const childPos = newAbsPositions.get(r.id);
            if (!treeNode || !childPos) continue;
            const parentNodeId = r.newParentId && newAbsPositions.has(r.newParentId) ? r.newParentId : '__space__';
            const parentPos = newAbsPositions.get(parentNodeId);
            if (parentPos) nextEdges.push(buildTreeEdge(parentNodeId, treeNode, parentPos, childPos));
          }

          // Ajoutés : arête depuis le parent
          for (const n of addedNodes) {
            const treeNode = findTreeNode(fullTree, n.id);
            if (!treeNode) continue;
            const item = itemMap.get(n.id)!;
            const parentNodeId = item.parentId
              || (item.spaceId && item.spaceId !== spaceId ? `child-space-${item.spaceId}` : '__space__');
            const parentPos = newAbsPositions.get(parentNodeId);
            const childPos = newAbsPositions.get(n.id);
            if (parentPos && childPos) nextEdges.push(buildTreeEdge(parentNodeId, treeNode, parentPos, childPos));
          }

          // Relations ajoutées
          const relationEdgesToAdd = relDiff.added
            .filter(rel => newAbsPositions.has(rel.fromItemId) && newAbsPositions.has(rel.toItemId))
            .map(rel => buildRelationEdge(rel));
          lastRelationEdgesRef.current = recalculateEdgeHandles(
            [...lastRelationEdgesRef.current.filter(e => !relDiff.removedIds.includes(e.data?.relationId as string)
              && !deletedSet.has(e.source) && !deletedSet.has(e.target)), ...relationEdgesToAdd],
            newAbsPositions,
          );
          if (showRelations) nextEdges = [...nextEdges, ...recalculateEdgeHandles(relationEdgesToAdd, newAbsPositions)];

          return recalculateEdgeHandles(nextEdges, newAbsPositions);
        });
        return nextNodes;
      });

      // 5. Ré-éventail local différé des parents affectés (après commit du state,
      //    reorganizeRef lit getNodes() — pattern closure courant obligatoire)
      if (diff.affectedParentIds.length > 0) {
        setTimeout(() => {
          for (const pid of diff.affectedParentIds) reorganizeRef.current(pid);
        }, 0);
      }
      return;
    }

    // --- Chemin 3 : relations seules ---
    setNodes(currentNodes => {
      const absPositions = getAbsolutePositions(currentNodes);
      const relationEdgesToAdd = relDiff.added
        .filter(rel => absPositions.has(rel.fromItemId) && absPositions.has(rel.toItemId))
        .map(rel => buildRelationEdge(rel));
      lastRelationEdgesRef.current = recalculateEdgeHandles(
        [...lastRelationEdgesRef.current.filter(e => !relDiff.removedIds.includes(e.data?.relationId as string)), ...relationEdgesToAdd],
        absPositions,
      );
      setEdges(currentEdges => {
        let nextEdges = currentEdges.filter(e => !relDiff.removedIds.some(rid => e.data?.relationId === rid));
        if (showRelations) nextEdges = [...nextEdges, ...recalculateEdgeHandles(relationEdgesToAdd, absPositions)];
        return nextEdges;
      });
      return currentNodes;
    });
  }, [tree, items, statuses, collapsedIds, displayName, layoutCallbacks, layoutOptions, setNodes, setEdges, portals, communitySpaces, childSpaces, removePortal, applyPositions, portalItemsBySpace, portalSpaceNames, spaceId, fitView, structureSignature, relationsSignature, depsSignature, fullTree, showRelations, savePositions]);
```

- [ ] **Step 3.4: Mettre à jour le commentaire d'en-tête du fichier**

```ts
/**
 * Vue Carte mentale (React Flow + d3 radial tree).
 * Invariants critiques : savedPositions.current persiste les positions manuelles entre
 * recalculs ; reorganizeRef.current capture le closure courant (pattern obligatoire).
 * Layout incrémental (spec 2026-07-15) : le layout complet ne s'exécute qu'au premier
 * rendu, sur changement de deps (repli/portails/focus) et au bouton « Réorganiser » ;
 * tout changement structurel (ajout/suppression/reparentage) est traité par diff
 * (mindmap-incremental.ts) + ré-éventail local des seuls parents affectés.
 * Toggle relations : lastRelationEdgesRef met en cache les edges de relation pour
 * les ajouter/retirer sans déclencher de recalcul de layout.
 */
```

- [ ] **Step 3.5: Typecheck scoped**

Run: `pnpm --filter @spok/web exec tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 3.6: Point de commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/components/views/MindMapView.tsx
git commit -m "feat: MindMap layout incrémental — ré-éventail local au lieu du recalcul global"
```

---

### Task 4: Nettoyage `onNodeDragStop` — suppression de l'effacement de branches

**Files:**
- Modify: `apps/web/src/components/views/MindMapView.tsx` (~l.912-975)

- [ ] **Step 4.1: Supprimer les helpers d'effacement**

Supprimer intégralement le bloc commenté « Reparentage : le rayon/angle radial… » et les fonctions `movedSubtreeIds`, `findRootBranch`, `clearBranchPositions`, `clearAffectedBranches` (l.912-954). Le ré-éventail local déclenché par le diff (Task 3) les remplace.

- [ ] **Step 4.2: Simplifier les deux appels**

Le bloc drop-sur-cible devient :

```ts
      const target = intersecting.find(n => n.type !== 'portal' && n.id !== draggedNode.id);
      if (target && onMove && canEdit !== false) {
        if (target.id === '__space__') {
          const draggedItem = items.find(i => i.id === draggedNode.id);
          if (draggedItem?.parentId) {
            onMove(draggedNode.id, null, 0);
          }
        } else {
          const isDescendant = (parentId: string, childId: string): boolean => {
            const child = items.find(i => i.id === childId);
            if (!child || !child.parentId) return false;
            if (child.parentId === parentId) return true;
            return isDescendant(parentId, child.parentId);
          };
          if (!isDescendant(draggedNode.id, target.id)) {
            onMove(draggedNode.id, target.id, 0);
          }
        }
      } else {
        // ... bloc existant inchangé (sauvegarde positions + reorder angulaire)
      }
```

Vérifier que `collapsedIds` et `fullTree` ne sont plus utilisés dans `onNodeDragStop` et purger le tableau de dépendances du `useCallback` en conséquence.

- [ ] **Step 4.3: Typecheck scoped + tests du module**

Run: `pnpm --filter @spok/web exec tsc --noEmit ; pnpm --filter @spok/web exec vitest run src/components/views/mindmap-incremental.test.ts`
Expected: 0 erreur, tests PASS.

- [ ] **Step 4.4: Point de commit proposé** *(uniquement sur demande explicite)*

```bash
git add apps/web/src/components/views/MindMapView.tsx
git commit -m "feat: reparentage MindMap sans effacement de branches (ré-éventail local)"
```

---

### Task 5: Vérification manuelle en réel

Invoquer la skill `testing-protocol` puis dérouler dans le navigateur intégré (dev local, espace de test avec ≥ 15 items sur 3 niveaux + 1 portail) :

- [ ] **5.1 Ajout d'un enfant** (menu contextuel « Ajouter un enfant ») → seuls les frères du même parent bougent (resserrage en éventail), le reste de la carte est immobile, l'arête est correcte.
- [ ] **5.2 Suppression d'une feuille** → le nœud disparaît, les frères se resserrent, rien d'autre ne bouge.
- [ ] **5.3 Suppression d'un item avec enfants** → sous-arbre retiré, frères resserrés, pas de re-layout global.
- [ ] **5.4 Drag-reparentage entre deux branches** → l'ancienne et la nouvelle branche se ré-éventaillent localement chacune autour de leur position actuelle ; AUCUNE branche ne saute à l'autre bout de l'écran.
- [ ] **5.5 Création puis suppression d'une relation** → l'arête apparaît/disparaît, aucun nœud ne bouge ; toggle « Relations » toujours fonctionnel.
- [ ] **5.6 Modification de titre/statut** → patch en place (inchangé).
- [ ] **5.7 Repli/dépli, bouton « Réorganiser », épinglage** → comportements existants conservés (le reset respecte les épinglés ; le repli garde les positions sauvegardées).
- [ ] **5.8 Portail : ajout d'un item racine dans l'espace portail** → ré-éventail du nœud portail seul.
- [ ] **5.9 Console navigateur** : aucune erreur React Flow (edges orphelins, handles manquants).

Si un point échoue : invoquer `superpowers:systematic-debugging`, ne pas rustiner.

---

### Task 6: Documentation et clôture

- [ ] **6.1** Mettre à jour l'item de doc SPOK « MindMapView » (status `to_validate`, description du nouveau comportement). ⚠️ Le login MCP SPOK échouait en 401 au moment de la rédaction du plan — si toujours cassé, le signaler à Thomas au lieu de sauter l'étape silencieusement.
- [ ] **6.2** `docs/session-journal.md` : entrée dans EN COURS (spec + plan + résultat des vérifications).
- [ ] **6.3** Sur demande explicite de Thomas : commits (points proposés ci-dessus), mise à jour `docs/TODO.md` (date + hash), push via la skill `spok-deploy`.

---

## Self-Review (fait à la rédaction)

- **Couverture spec :** ajout→T1+T3, suppression avec resserrage→T1+T3+T5.2, reparentage sans saut→T3+T4, relations→T1+T3, contenu/repli inchangés→T3 (chemins 1 et 4), racine sans ré-éventail→T1 (test dédié)+T3, portails→T1 (test)+T5.8, épinglés→inchangé (reorganizeRef les respecte déjà, vérifié T5.7).
- **Placeholders :** aucun — chaque étape de code contient le code.
- **Cohérence des types :** `diffItems/diffRelations/initialPositionForNew` (T1) utilisés avec les mêmes signatures en T3 ; `buildMindmapNode/buildTreeEdge/buildRelationEdge` (T2) idem.
- **Risque connu assumé :** le ré-éventail différé (`setTimeout(0)` après `setNodes`) suppose que `getNodes()` de React Flow est à jour au tick suivant — c'est le même pattern que les `setTimeout(fitView)` existants ; vérifié en T5.
