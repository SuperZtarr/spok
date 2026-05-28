# Spec — Description de relation avec icône et vignette au survol

**Date** : 2026-05-28  
**Scope** : Champ description sur `ItemRelation`, édition dans la modale, icône + tooltip dans toutes les vues graphiques

---

## Contexte

`ItemRelation` possède un champ `label String?` déjà persisté et exposé via l'API. Il est affiché dans `ItemEditModal` comme un `<Input>` texte court. L'objectif est de l'enrichir : textarea dans la modale, et dans les vues graphiques, une icône `MessageCircle` apparaît au milieu de la flèche quand une description existe — le tooltip s'affiche au survol de cette icône.

**Aucun changement de schéma ni de migration** — on réutilise `label`.

---

## 1. Composant partagé `RelationTooltip`

Fichier : `apps/web/src/components/RelationTooltip.tsx`

Props :
```ts
interface RelationTooltipProps {
  label: string;
  relationType: string;  // "blocks" | "depends" | "relates"
  fromTitle: string;
  toTitle: string;
  x: number;             // position écran (px)
  y: number;
}
```

Rendu : `<div>` en `position: fixed`, `z-index: 9999`, fond `bg-popover`, ombre `shadow-lg`, bord arrondi, max-width 280px.  
Contenu :
- Badge type (ex: "Bloque") — couleur selon le type
- Ligne "Source → Cible" en petit gris
- Texte `label` en corps principal

---

## 2. Composant `RelationCommentIcon`

Fichier : `apps/web/src/components/RelationCommentIcon.tsx`

Ce composant est l'icône cliquable/hoverable positionnée au milieu d'une flèche.

Props :
```ts
interface RelationCommentIconProps {
  x: number;              // coordonnée écran ou SVG
  y: number;
  label: string;
  relationType: string;
  fromTitle: string;
  toTitle: string;
  svgMode?: boolean;      // true → rendu via <foreignObject> dans SVG
}
```

Comportement :
- Rendu uniquement si `label` non vide
- Icône `MessageCircle` (lucide-react), taille 14px, couleur `text-muted-foreground`, fond `bg-background` arrondi pour lisibilité sur la flèche
- `onMouseEnter` → affiche `RelationTooltip` à la position `(x + 12, y - 8)` (légèrement décalé)
- `onMouseLeave` → cache le tooltip
- Le tooltip est rendu via un state local dans `RelationCommentIcon` lui-même — pas besoin de state dans les vues parentes

**Mode SVG** (`svgMode: true`) : le composant s'enveloppe dans un `<foreignObject>` centré en `(x - 8, y - 8)` taille 16×16, pour s'intégrer dans un `<svg>`.

**Mode DOM** (défaut) : `<div>` en `position: absolute` ou `fixed` selon le contexte.

---

## 3. Modal — `ItemEditModal`

Fichier : `apps/web/src/components/ItemEditModal.tsx`

Changements sur le champ `label` (relation) :
- `<Input>` → `<Textarea>` avec `rows={3}`, `resize="vertical"`
- Placeholder : `"Justification de la relation (optionnel)"`
- Identique dans les deux modes : ajout (`newRelationLabel`) et édition (`editRelationLabel`)
- Affichage en lecture : icône `MessageCircle` à côté du nom de l'item lié si `label` non vide, texte italic tronqué à 2 lignes en dessous

---

## 4. Vues SVG natif — PERT, EgoNetwork, Timeline

**Principe** : calculer le point médian de chaque flèche SVG, y placer `<RelationCommentIcon svgMode>` via `<foreignObject>`.

**PERT** (`PertView.tsx`) :
- Chaque edge SVG a déjà un objet `relation` avec `label`, `type`, `fromItem.title`, `toItem.title`
- Calculer le midpoint du `<path>` (via `path.getTotalLength() / 2` ou approximation des points de contrôle Bézier)
- Ajouter `<RelationCommentIcon svgMode x={mx} y={my} ... />` dans le même `<g>` que la flèche

**EgoNetwork** (`EgoNetworkView.tsx`) :
- Propager `label` dans l'objet `Edge` local (actuellement `{ from, to, type }` → ajouter `label?`)
- Midpoint = `(x1+x2)/2, (y1+y2)/2`
- Même pattern `<RelationCommentIcon svgMode>`

**Timeline** (`TimelineView.tsx`) :
- Ajouter `label` dans le tableau `dependencyArrows` (depuis `rel.label`)
- Midpoint de la flèche SVG = milieu du chemin dessiné
- `<RelationCommentIcon svgMode>`

---

## 5. Vues React Flow — MindMap

**Mécanisme** : custom edge type `RelationEdge`.

Fichier : `apps/web/src/components/views/RelationEdge.tsx`
- Composant React Flow custom edge
- Reçoit `data: { label?, relationType, fromTitle, toTitle }`
- Utilise `getBezierPath` pour obtenir le midpoint de l'edge (`midX`, `midY`)
- Rend `<RelationCommentIcon x={midX} y={midY} ... />` via `<EdgeLabelRenderer>` (composant React Flow standard pour les labels sur edges)

Dans `MindMapView` :
- `edgeTypes = { relation: RelationEdge }` défini hors composant (stable)
- Edges de relation reçoivent `type: 'relation'` et `data.label`, `data.fromTitle`, `data.toTitle`
- Edges de hiérarchie inchangés

---

## 6. Vues ForceGraph2D — Graph, RelationsMap

`react-force-graph-2d` rend sur canvas — impossible d'y insérer du DOM. Le midpoint des liens est calculable depuis les coordonnées des nœuds source/target exposées dans le graphe.

**Approche** : overlay React positionné en `absolute` sur le canvas, recalculé à chaque tick du graphe.

```ts
// Tick du graphe (onEngineTick ou useEffect sur les nodes)
const icons = links
  .filter(l => l.label)
  .map(l => ({
    ...l,
    sx: graphRef.current.graph2ScreenCoords(l.source.x, l.source.y),
    tx: graphRef.current.graph2ScreenCoords(l.target.x, l.target.y),
  }))
  .map(l => ({
    ...l,
    mx: (l.sx.x + l.tx.x) / 2,
    my: (l.sx.y + l.tx.y) / 2,
  }));
setLinkIcons(icons);
```

Les `<RelationCommentIcon>` sont rendus dans un `<div>` overlay `absolute inset-0 pointer-events-none` (sauf sur les icônes elles-mêmes où `pointer-events: auto`).

---

## Données disponibles

L'API retourne déjà `label` sur les relations dans les endpoints `/spaces/:id/items`. Vérifier que `label` est bien inclus dans les `select` Prisma existants (probable, mais à confirmer).

---

## Ce qui est hors scope

- Édition depuis la vignette (read-only)
- Markdown dans le label
- Chord View, Bubble View (pas de flèches de relation)

---

## Fichiers impactés

| Fichier | Nature du changement |
|---|---|
| `ItemEditModal.tsx` | Input → Textarea pour label |
| `RelationTooltip.tsx` | Nouveau composant |
| `RelationCommentIcon.tsx` | Nouveau composant (icône + tooltip intégré) |
| `PertView.tsx` | Midpoint + RelationCommentIcon sur edges SVG |
| `EgoNetworkView.tsx` | Ajout label dans Edge local + RelationCommentIcon |
| `TimelineView.tsx` | Ajout label dans dependencyArrows + RelationCommentIcon |
| `MindMapView.tsx` | Passage à RelationEdge custom type |
| `RelationEdge.tsx` | Nouveau custom edge React Flow |
| `GraphView.tsx` | Overlay icônes sur canvas ForceGraph2D |
| `RelationsMapView.tsx` | Overlay icônes sur canvas ForceGraph2D |
