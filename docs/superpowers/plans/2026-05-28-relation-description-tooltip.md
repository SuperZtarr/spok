# Relation Description Tooltip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher une icône `MessageCircle` au milieu de chaque flèche de relation qui possède un `label`, et montrer ce label dans une vignette au survol de l'icône ; rendre la description éditable via une `<Textarea>` dans `ItemEditModal`.

**Architecture:** Deux nouveaux composants partagés (`RelationTooltip`, `RelationCommentIcon`) utilisés dans 6 vues. Les vues SVG natif (PERT, EgoNetwork, Timeline) utilisent `<foreignObject>` + portal. MindMap utilise un custom edge React Flow. Graph et RelationsMap utilisent `onLinkHover` de react-force-graph-2d + overlay DOM. Aucun changement de schéma ni d'API.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react, @xyflow/react (React Flow), react-force-graph-2d

---

### Task 1 : Composant `RelationTooltip`

**Files:**
- Create: `apps/web/src/components/RelationTooltip.tsx`

- [ ] **Créer le composant**

```tsx
// apps/web/src/components/RelationTooltip.tsx
import { createPortal } from 'react-dom';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  blocks:  { label: 'Bloque',    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  depends: { label: 'Dépend de', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  relates: { label: 'Lié à',     color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

interface RelationTooltipProps {
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
  x: number;
  y: number;
}

export function RelationTooltip({ label, relationType, fromTitle, toTitle, x, y }: RelationTooltipProps) {
  const config = TYPE_LABELS[relationType] ?? { label: relationType, color: 'bg-muted text-muted-foreground' };
  return createPortal(
    <div
      className="fixed z-[9999] max-w-[280px] rounded-lg border bg-popover shadow-lg p-3 text-sm pointer-events-none"
      style={{ left: x + 12, top: y - 8 }}
    >
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${config.color}`}>
        {config.label}
      </span>
      <p className="text-xs text-muted-foreground mb-2 truncate">
        {fromTitle} → {toTitle}
      </p>
      <p className="text-sm leading-snug whitespace-pre-wrap">{label}</p>
    </div>,
    document.body
  );
}
```

- [ ] **Commit**

```bash
git add apps/web/src/components/RelationTooltip.tsx
git commit -m "feat: composant RelationTooltip"
```

---

### Task 2 : Composant `RelationCommentIcon`

**Files:**
- Create: `apps/web/src/components/RelationCommentIcon.tsx`

- [ ] **Créer le composant**

```tsx
// apps/web/src/components/RelationCommentIcon.tsx
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { RelationTooltip } from './RelationTooltip';

interface RelationCommentIconProps {
  x: number;
  y: number;
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
}

// Version DOM — utilisée dans les overlays ForceGraph2D
export function RelationCommentIcon({ x, y, label, relationType, fromTitle, toTitle }: RelationCommentIconProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  if (!label) return null;
  return (
    <>
      <div
        className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
        style={{ left: x - 10, top: y - 10, pointerEvents: 'auto' }}
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
      >
        <MessageCircle className="w-3 h-3 text-muted-foreground" />
      </div>
      {tooltip && (
        <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
      )}
    </>
  );
}

// Version SVG — utilisée dans les vues SVG natives via <foreignObject>
export function RelationCommentIconSvg({ x, y, label, relationType, fromTitle, toTitle }: RelationCommentIconProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  if (!label) return null;
  return (
    <foreignObject x={x - 10} y={y - 10} width={20} height={20} style={{ overflow: 'visible' }}>
      <div
        className="flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
        onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setTooltip(null)}
      >
        <MessageCircle className="w-3 h-3 text-muted-foreground" />
      </div>
      {tooltip && (
        <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
      )}
    </foreignObject>
  );
}
```

- [ ] **Commit**

```bash
git add apps/web/src/components/RelationCommentIcon.tsx
git commit -m "feat: composant RelationCommentIcon (DOM + SVG)"
```

---

### Task 3 : `ItemEditModal` — Textarea pour label de relation

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx`

Le champ `label` de relation apparaît deux fois : en mode ajout (ligne ~1428) et en mode édition (ligne ~1452). Dans les deux cas, remplacer `<Input>` par `<Textarea>`.

- [ ] **Mode ajout — remplacer l'Input**

Trouver (ligne ~1428) :
```tsx
<Input value={newRelationLabel} onChange={(e) => setNewRelationLabel(e.target.value)} placeholder="Commentaire (optionnel)" className="text-sm" />
```
Remplacer par :
```tsx
<textarea
  value={newRelationLabel}
  onChange={(e) => setNewRelationLabel(e.target.value)}
  placeholder="Justification de la relation (optionnel)"
  rows={2}
  className="w-full text-sm px-3 py-1.5 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
/>
```

- [ ] **Mode édition — remplacer l'Input**

Trouver (ligne ~1452) :
```tsx
<Input value={editRelationLabel} onChange={(e) => setEditRelationLabel(e.target.value)} placeholder="Commentaire (optionnel)" className="text-xs h-7" />
```
Remplacer par :
```tsx
<textarea
  value={editRelationLabel}
  onChange={(e) => setEditRelationLabel(e.target.value)}
  placeholder="Justification de la relation (optionnel)"
  rows={2}
  className="w-full text-xs px-2 py-1 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
/>
```

- [ ] **Affichage en lecture — ajouter icône MessageCircle**

Trouver les deux blocs d'affichage `relation.label` en lecture (lignes ~1479 et ~1493) :
```tsx
{relation.label && <p className="text-xs text-muted-foreground italic pl-1">{relation.label}</p>}
```
Remplacer chacun par :
```tsx
{relation.label && (
  <p className="text-xs text-muted-foreground italic pl-1 line-clamp-2" title={relation.label}>
    {relation.label}
  </p>
)}
```

- [ ] **Ajouter import MessageCircle** en haut du fichier dans les imports lucide existants.

- [ ] **Commit**

```bash
git add apps/web/src/components/ItemEditModal.tsx
git commit -m "feat: textarea pour description de relation dans ItemEditModal"
```

---

### Task 4 : `PertView` — Icône sur les flèches

**Files:**
- Modify: `apps/web/src/components/views/PertView.tsx`

- [ ] **Importer `RelationCommentIconSvg`** en haut du fichier :

```tsx
import { RelationCommentIconSvg } from '../RelationCommentIcon';
```

- [ ] **Modifier `renderArrow`** pour ajouter l'icône au milieu du chemin Bézier.

Le midpoint d'une courbe de Bézier cubique `M x1,y1 C cx1,y1 cx2,y2 x2,y2` approximé : `mx = (x1 + x2) / 2`, `my = (y1 + y2) / 2`.

Trouver dans `renderArrow` (ligne ~303) le `return (` et modifier le contenu du `<g>` :

```tsx
const mx = (x1 + x2) / 2;
const my = (y1 + y2) / 2;
const fromItem = items.find(i => i.id === rel.fromItemId);
const toItem = items.find(i => i.id === rel.toItemId);

return (
  <g key={key}>
    <path
      d={pathD}
      fill="none" stroke={stroke} strokeWidth={strokeWidth}
      markerEnd={`url(#arrow-${isCritical ? 'critical' : 'normal'})`}
      strokeDasharray={proxied ? '5 3' : undefined}
    />
    {!proxied && canEdit && (onDeleteRelation || onUpdateRelation) && (
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
        onClick={() => {
          const sourceItem = items.find(i => i.id === rel.fromItemId);
          const targetItem = items.find(i => i.id === rel.toItemId);
          setEditingRelation({
            relationId: rel.id,
            fromItemId: rel.fromItemId,
            toItemId: rel.toItemId,
            type: rel.type,
            label: rel.label || '',
            sourceName: sourceItem?.title || '',
            targetName: targetItem?.title || '',
          });
          setEditRelationType(rel.type);
        }}
      >
        <title>Cliquer pour modifier</title>
      </path>
    )}
    {rel.label && !proxied && (
      <RelationCommentIconSvg
        x={mx} y={my}
        label={rel.label}
        relationType={rel.type}
        fromTitle={fromItem?.title || rel.fromItemId}
        toTitle={toItem?.title || rel.toItemId}
      />
    )}
  </g>
);
```

- [ ] **Commit**

```bash
git add apps/web/src/components/views/PertView.tsx
git commit -m "feat: icone description sur fleches PERT"
```

---

### Task 5 : `EgoNetworkView` — Icône sur les lignes de relation

**Files:**
- Modify: `apps/web/src/components/views/EgoNetworkView.tsx`

- [ ] **Ajouter `label` au type `Edge` local**

Trouver (ligne ~40) :
```ts
type: 'relation' | 'hierarchy';
```
Remplacer par :
```ts
type: 'relation' | 'hierarchy';
label?: string;
relationId?: string;
```

- [ ] **Propager `label` lors de la construction des edges de relation**

Trouver (ligne ~123) :
```ts
for (const rel of relations) {
  addEdge(rel.fromItemId, rel.toItemId, 'relation');
}
```
Remplacer par :
```ts
for (const rel of relations) {
  const key = [rel.fromItemId, rel.toItemId].sort().join('--');
  if (!edgeSet.has(key)) {
    edgeSet.set(key, { from: rel.fromItemId, to: rel.toItemId, type: 'relation', label: rel.label ?? undefined, relationId: rel.id });
  }
}
```

Note : `addEdge` ne supporte pas encore `label`. Modifier aussi `addEdge` pour accepter des champs supplémentaires ou bypasser `addEdge` comme ci-dessus pour les relations.

- [ ] **Importer `RelationCommentIconSvg`** :

```tsx
import { RelationCommentIconSvg } from '../RelationCommentIcon';
```

- [ ] **Récupérer `itemMap` dans le rendu** (il est déjà dans le `useMemo` → `{ nodes, edges, itemMap }`).

- [ ] **Ajouter l'icône dans le rendu des edges**

Trouver (ligne ~338) le rendu des edges :
```tsx
{edges.map((edge, i) => {
  const from = posMap.get(edge.from);
  const to = posMap.get(edge.to);
  if (!from || !to) return null;
  return (
    <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y} ... />
  );
})}
```
Remplacer par :
```tsx
{edges.map((edge, i) => {
  const from = posMap.get(edge.from);
  const to = posMap.get(edge.to);
  if (!from || !to) return null;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const fromItem = itemMap.get(edge.from);
  const toItem = itemMap.get(edge.to);
  return (
    <g key={i}>
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke={edge.type === 'hierarchy' ? '#94a3b8' : '#a855f7'}
        strokeWidth={edge.type === 'hierarchy' ? 1.5 : 1}
        strokeOpacity={0.4}
        strokeDasharray={edge.type === 'relation' ? '4 2' : undefined}
      />
      {edge.type === 'relation' && edge.label && (
        <RelationCommentIconSvg
          x={mx} y={my}
          label={edge.label}
          relationType="relates"
          fromTitle={fromItem?.title || edge.from}
          toTitle={toItem?.title || edge.to}
        />
      )}
    </g>
  );
})}
```

- [ ] **Commit**

```bash
git add apps/web/src/components/views/EgoNetworkView.tsx
git commit -m "feat: icone description sur aretes EgoNetwork"
```

---

### Task 6 : `TimelineView` — Icône sur les flèches de dépendance

**Files:**
- Modify: `apps/web/src/components/views/TimelineView.tsx`

- [ ] **Importer `RelationCommentIconSvg`** :

```tsx
import { RelationCommentIconSvg } from '../RelationCommentIcon';
```

- [ ] **Ajouter `label`, `fromTitle`, `toTitle` dans `dependencyArrows`**

Trouver (ligne ~592) le type du tableau `arrows` :
```ts
const arrows: { fromX: number; fromY: number; toX: number; toY: number; type: string; relationId: string; fromItemId: string; toItemId: string }[] = [];
```
Remplacer par :
```ts
const arrows: { fromX: number; fromY: number; toX: number; toY: number; type: string; relationId: string; fromItemId: string; toItemId: string; label: string; fromTitle: string; toTitle: string }[] = [];
```

Trouver (ligne ~614) le `arrows.push(...)` :
```ts
arrows.push({ fromX, fromY, toX, toY, type: rel.type, relationId: rel.id, fromItemId: rel.fromItemId, toItemId: rel.toItemId });
```
Remplacer par :
```ts
arrows.push({
  fromX, fromY, toX, toY,
  type: rel.type,
  relationId: rel.id,
  fromItemId: rel.fromItemId,
  toItemId: rel.toItemId,
  label: rel.label ?? '',
  fromTitle: fromItem.title,
  toTitle: toItem.title,
});
```

- [ ] **Ajouter l'icône dans le rendu SVG des flèches**

Trouver (ligne ~1083) le bloc `return (` dans `dependencyArrows.map(...)` :
```tsx
return (
  <g key={idx}>
    {/* Visible arrow */}
    <path d={path} ... />
    {/* Invisible wider clickable path */}
    ...
  </g>
);
```

Ajouter avant la fermeture `</g>` :

```tsx
{arrow.label && (() => {
  const mx = (arrow.fromX + arrow.toX) / 2;
  const my = (arrow.fromY + arrow.toY) / 2;
  return (
    <RelationCommentIconSvg
      x={mx} y={my}
      label={arrow.label}
      relationType={arrow.type}
      fromTitle={arrow.fromTitle}
      toTitle={arrow.toTitle}
    />
  );
})()}
```

- [ ] **Commit**

```bash
git add apps/web/src/components/views/TimelineView.tsx
git commit -m "feat: icone description sur fleches Timeline"
```

---

### Task 7 : `MindMapView` — Custom edge React Flow

**Files:**
- Create: `apps/web/src/components/views/RelationEdge.tsx`
- Modify: `apps/web/src/components/views/MindMapView.tsx`
- Modify: `apps/web/src/components/views/mindmap-layout.ts`

- [ ] **Créer `RelationEdge.tsx`**

```tsx
// apps/web/src/components/views/RelationEdge.tsx
import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { MessageCircle } from 'lucide-react';
import { RelationTooltip } from '../RelationTooltip';

export function RelationEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  style, markerEnd, data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);
  const label = (data?.label as string) ?? '';
  const relationType = (data?.relationType as string) ?? 'relates';
  const fromTitle = (data?.fromTitle as string) ?? '';
  const toTitle = (data?.toTitle as string) ?? '';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            className="absolute flex items-center justify-center w-5 h-5 rounded-full bg-background border border-border cursor-default"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: 'all' }}
            onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
            onMouseMove={(e) => setTooltip({ x: e.clientX, y: e.clientY })}
            onMouseLeave={() => setTooltip(null)}
          >
            <MessageCircle className="w-3 h-3 text-muted-foreground" />
          </div>
          {tooltip && (
            <RelationTooltip label={label} relationType={relationType} fromTitle={fromTitle} toTitle={toTitle} x={tooltip.x} y={tooltip.y} />
          )}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
```

- [ ] **Modifier `mindmap-layout.ts`** — passer `fromTitle` et `toTitle` dans les edge data.

Trouver (ligne ~335) le `relationEdges.push(...)` et modifier `data` :
```ts
data: {
  relationId: relation.id,
  type: relation.type,
  label: relation.label || '',
  fromItemId: relation.fromItemId,
  relationType: relation.type,
  fromTitle: relation.fromItem?.title || relation.fromItemId,
  toTitle: relation.toItem?.title || relation.toItemId,
},
```

Note : `relation.fromItem` et `relation.toItem` sont déjà inclus via l'API (voir `items.ts` l.192-196). Si absent, fallback sur l'id.

- [ ] **Modifier `MindMapView.tsx`** — déclarer `edgeTypes` et l'utiliser.

Ajouter hors du composant (avant `function MindMapView`) :
```tsx
import { RelationEdge } from './RelationEdge';

const EDGE_TYPES = { relation: RelationEdge };
```

Dans le rendu `<ReactFlow>`, ajouter :
```tsx
edgeTypes={EDGE_TYPES}
```

Modifier la construction des relation edges dans `mindmap-layout.ts` (ligne ~340) pour utiliser `type: 'relation'` au lieu de `type: 'default'`.

- [ ] **Commit**

```bash
git add apps/web/src/components/views/RelationEdge.tsx apps/web/src/components/views/MindMapView.tsx apps/web/src/components/views/mindmap-layout.ts
git commit -m "feat: icone description sur edges MindMap (custom edge React Flow)"
```

---

### Task 8 : `GraphView` et `RelationsMapView` — Overlay sur ForceGraph2D

**Files:**
- Modify: `apps/web/src/components/views/GraphView.tsx`
- Modify: `apps/web/src/components/views/RelationsMapView.tsx`

Les deux vues utilisent `react-force-graph-2d` qui rend sur canvas. L'approche : `onLinkHover` donne le lien survolé, `onMouseMove` sur le conteneur donne la position écran.

- [ ] **Modifier `GraphView.tsx`**

Ajouter les imports :
```tsx
import { useState, useCallback } from 'react'; // déjà importé probablement
import { RelationTooltip } from '../RelationTooltip';
import { MessageCircle } from 'lucide-react';
```

Ajouter dans le type du link (lors de la construction de `graphData`) les champs `label`, `relationType`, `fromTitle`, `toTitle`. Chercher où les liens sont construits (probablement dans un `useMemo` qui construit `graphData`) et ajouter :
```ts
label: rel.label ?? '',
relationType: rel.type,
fromTitle: item.title,      // item source
toTitle: targetItem.title,  // item cible
```

Ajouter le state dans le composant :
```tsx
const [hoveredLink, setHoveredLink] = useState<any>(null);
const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
```

Sur le conteneur wrapper du `<ForceGraph2D>`, ajouter :
```tsx
onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
```

Sur `<ForceGraph2D>`, ajouter :
```tsx
onLinkHover={(link) => setHoveredLink(link ?? null)}
```

Après `<ForceGraph2D>`, dans le même conteneur `relative` :
```tsx
{hoveredLink?.label && (
  <RelationTooltip
    label={hoveredLink.label}
    relationType={hoveredLink.relationType ?? 'relates'}
    fromTitle={hoveredLink.fromTitle ?? ''}
    toTitle={hoveredLink.toTitle ?? ''}
    x={mousePos.x}
    y={mousePos.y}
  />
)}
```

- [ ] **Même modification dans `RelationsMapView.tsx`**

Même pattern : ajouter `label`, `relationType`, `fromTitle`, `toTitle` dans la construction des liens (chercher le bloc `relationsFrom` / `relationsTo` lignes ~89-110), puis le même state + `onLinkHover` + `onMouseMove` + `RelationTooltip`.

- [ ] **Commit**

```bash
git add apps/web/src/components/views/GraphView.tsx apps/web/src/components/views/RelationsMapView.tsx
git commit -m "feat: tooltip description sur liens GraphView et RelationsMapView"
```

---

### Task 9 : Vérification typecheck

- [ ] **Lancer le typecheck**

```bash
pnpm typecheck
```

Corriger toute erreur de type avant de continuer. Les erreurs les plus probables :
- `label` absent du type `ItemRelation` dans `@spok/shared` → vérifier que le type inclut `label?: string | null`
- `data` non typé dans `RelationEdge` → le cast `as string` suffit
- `edgeTypes` non accepté → vérifier la version de `@xyflow/react`

- [ ] **Commit des corrections si nécessaire**

```bash
git add -p
git commit -m "fix: types apres ajout description relation"
```

---

### Vérification finale

- [ ] Lancer le dev : `pnpm dev:start`
- [ ] Ouvrir un espace avec des relations ayant un `label` existant
- [ ] Vérifier dans `ItemEditModal` : le champ label est une textarea
- [ ] Saisir une description sur une relation, sauvegarder
- [ ] Ouvrir la vue PERT → icône `MessageCircle` visible sur la flèche → survol → tooltip
- [ ] Répéter pour Timeline, EgoNetwork, MindMap
- [ ] Ouvrir Graph et RelationsMap → tooltip au survol du lien (pas d'icône sur canvas)
