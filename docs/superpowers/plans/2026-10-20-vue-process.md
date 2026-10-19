# Vue Process (chantier A) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une vue d'espace « Process » : canevas libre où l'on pose les items de l'espace à la main, puis où on les relie par de vraies relations SPOK, pour passer d'un brainstorm à un enchaînement de tâches.

**Architecture:** Positions stockées en base dans une table `process_nodes` (une ligne = un item placé dans le process de son espace, x/y), partagées entre membres. Front : composant `ProcessView` sur `@xyflow/react` (déjà utilisé par la MindMap), panneau « non placés » à gauche, liens créés via une modale de relation extraite en composant partagé.

**Tech Stack:** Prisma/PostgreSQL, Fastify + zod, React + TanStack Query, `@xyflow/react` 12, Vitest.

**Spec:** design validé en chat le 2026-10-20 (pas de fichier spec, cf. mémoire `feedback_no_spec_docs`). Résumé :
- Vue d'espace, un seul process par espace (multi-process : abandonné pour cette version).
- Page vide au départ ; items non placés dans un panneau latéral (recherche) ; glisser vers le canevas pour placer ; « Retirer du process » renvoie au panneau sans supprimer.
- Positions libres, jamais recalculées, partagées entre membres.
- Double-clic sur le vide = crée une **NOTE** à cet endroit et ouvre sa modale d'édition (conversion en tâche via le type, dans la modale).
- Tirer d'un item vers un autre = modale de relation habituelle → vraie relation SPOK. Toutes les relations entre items placés sont affichées. Clic sur un lien = modale de modification.
- Pas de formes graphiques, uniquement des items.
- Chantiers B (modèles qui retiennent le process) et C (instanciation planifiée) : hors périmètre.

## Global Constraints

- Tout fichier créé ou modifié reçoit un commentaire d'en-tête (raison d'être, params clés, règles d'usage) — CLAUDE.md.
- Ne pas modifier `MindMapView.tsx`, `PertView.tsx`, `TimelineView.tsx`, `ItemEditModal.tsx` (zones fragiles) : la modale de relation est extraite en **copie** partagée, la migration des 4 vues existantes est un suivi séparé.
- Types de relation : source unique `apps/web/src/constants/relationTypes.ts` (`RELATION_TYPE_LIST`, `getRelationMeta`, `isOfficialRelationType`).
- Écritures (placer/déplacer/retirer) réservées aux rôles OWNER/MEMBER (et mode admin via `checkSpaceAccess(..., request.isAdminMode)`) ; lecture pour tout accès à l'espace.
- Clé de vue : `process` ; libellé `Process` ; icône Lucide `Workflow` ; catégorie `planning`, `order: 6`, `access: 'user'`.
- Après modification de `@spok/shared` ou `@spok/database` : `pnpm build:packages` puis redémarrer le dev.
- Pas de suite TNR complète ni typecheck 5 paquets avant le moment du déploiement : ne lancer que les tests du fichier touché et le typecheck du paquet touché.
- Aucun commit sans demande explicite de Thomas : les étapes « Commit » de ce plan sont **regroupées et différées** à sa demande.

## Review Focus

1. Item placé puis supprimé (ou déplacé vers un autre espace) : il disparaît du canevas, aucun nœud fantôme ni erreur — couvert par `splitPlaced` (Task 3) et `onDelete: Cascade` (Task 1) ; déplacement d'espace : la ligne `process_nodes` garde l'ancien `spaceId`, `splitPlaced` l'ignore car l'item n'est plus dans la liste.
2. VIEWER qui glisse un nœud : rien ne doit être écrit ni perdu silencieusement — nœuds non déplaçables (`nodesDraggable={canEdit}`), panneau non glissable, API 403 (Task 2).
3. Relation entre un item placé et un item non placé : pas de flèche orpheline — `buildProcessEdges` (Task 3).
4. Relation de type hors liste officielle : ignorée, pas de crash — `buildProcessEdges` (Task 3).
5. PUT sur un item d'un autre espace (id forgé) : 404, aucune ligne créée — Task 2.

---

### Task 1: Modèle `ProcessNode`

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (après `model Item`, + relations inverses sur `Item` et `Space`)
- Modify: `apps/api/src/test/helpers.ts` (ajouter `processNode: mockModel()` dans `createMockPrisma`)
- Modify: `docs/MODELE-DONNEES.md` (section du nouveau modèle)

**Interfaces:**
- Produces: `prisma.processNode` avec champs `id, spaceId, itemId, x, y, updatedAt`, unique composé `spaceId_itemId`.

- [ ] **Step 1: Ajouter le modèle**

```prisma
// Position d'un item sur le canevas de la vue Process de son espace (2026-10-20).
// Une ligne = item placé ; absence de ligne = item « non placé ». Partagé entre membres.
model ProcessNode {
  id        String   @id @default(cuid())
  spaceId   String
  space     Space    @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  itemId    String
  item      Item     @relation(fields: [itemId], references: [id], onDelete: Cascade)
  x         Float
  y         Float
  updatedAt DateTime @updatedAt

  @@unique([spaceId, itemId])
  @@index([spaceId])
  @@map("process_nodes")
}
```
Relations inverses : `processNodes ProcessNode[]` sur `Item` et sur `Space`.

- [ ] **Step 2: Générer et pousser le schéma**

Run: `pnpm db:generate; pnpm db:push; pnpm build:packages`
Expected: « Your database is now in sync », build sans erreur.

- [ ] **Step 3: Mock Prisma** — ajouter `processNode: mockModel(),` dans `createMockPrisma` (`helpers.ts`), et mettre à jour son commentaire d'en-tête si besoin.

- [ ] **Step 4: Doc modèle** — ajouter `ProcessNode` dans `docs/MODELE-DONNEES.md` (même format que les modèles voisins).

---

### Task 2: Routes API `/spaces/:spaceId/process-nodes`

**Files:**
- Create: `apps/api/src/routes/process-nodes.ts`
- Create: `apps/api/src/routes/process-nodes.test.ts`
- Modify: `apps/api/src/index.ts` (import + `await app.register(processNodesRoutes, { prefix: '/spaces' });` à côté de `spacePreferencesRoutes`)

**Interfaces:**
- Consumes: `checkSpaceAccess(prisma, userId, spaceId, isAdminMode)` exporté par `routes/items.ts` (retourne `null` ou `{ role }`).
- Produces:
  - `GET /spaces/:spaceId/process-nodes` → `200 Array<{ itemId: string; x: number; y: number }>`
  - `PUT /spaces/:spaceId/process-nodes/:itemId` body `{ x: number; y: number }` (zod, `z.number().finite()`) → `200 { itemId, x, y }` (upsert sur `spaceId_itemId`)
  - `DELETE /spaces/:spaceId/process-nodes/:itemId` → `204` (`deleteMany`, idempotent)
  - Erreurs : pas d'accès → 404 `Space not found` ; rôle ni OWNER ni MEMBER sur PUT/DELETE → 403 ; PUT sur item absent de `spaceId` (`prisma.item.findFirst({ where: { id, spaceId } })` null) → 404 `Item not found`.

- [ ] **Step 1: Écrire les tests (échouent)** — app construite comme `item-templates.test.ts` (Fastify + sensible + mock prisma + jwtPlugin + `processNodesRoutes` sous `/spaces`). Cas, `spaceMembership.findUnique` mocké pour le rôle :
  - `GET renvoie les positions du space` : `processNode.findMany` → `[{ itemId: 'i1', x: 10, y: 20 }]` ⇒ 200, body identique, `findMany` appelé avec `where: { spaceId: 's1' }`.
  - `GET sans accès → 404`.
  - `PUT upsert la position` : membre MEMBER, `item.findFirst` → `{ id: 'i1' }` ⇒ 200 `{ itemId: 'i1', x: 1.5, y: -3 }`, `upsert` appelé avec `where: { spaceId_itemId: { spaceId: 's1', itemId: 'i1' } }`.
  - `PUT par un VIEWER → 403`, `upsert` non appelé.
  - `PUT sur item d'un autre espace → 404`, `upsert` non appelé.
  - `PUT avec x non numérique → 400`.
  - `DELETE retire le nœud → 204`, `deleteMany` appelé avec `{ where: { spaceId: 's1', itemId: 'i1' } }`.

- [ ] **Step 2: Lancer** — Run: `pnpm --filter @spok/api exec vitest run src/routes/process-nodes.test.ts` — Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter `processNodesRoutes: FastifyPluginAsync`** dans `process-nodes.ts` (preHandler `fastify.authenticate` sur chaque route, comme `space-preferences.ts`). Pas d'audit log : c'est de la mise en page, pas une donnée métier.

- [ ] **Step 4: Relancer** — même commande — Expected: PASS (7 tests). Puis `pnpm --filter @spok/api exec tsc --noEmit` — Expected: 0 erreur.

---

### Task 3: Logique pure du canevas (`process-utils.ts`)

**Files:**
- Create: `apps/web/src/components/views/process-utils.ts`
- Create: `apps/web/src/components/views/process-utils.test.ts`

**Interfaces:**
- Produces:
  - `type ProcessPosition = { itemId: string; x: number; y: number }`
  - `splitPlaced(items: Item[], positions: ProcessPosition[]): { placed: Array<{ item: Item; x: number; y: number }>; unplaced: Item[] }` — `unplaced` dans l'ordre d'entrée ; positions dont l'item est absent ignorées.
  - `buildProcessEdges(relations: ItemRelation[], placedIds: Set<string>): Edge[]` (`Edge` de `@xyflow/react`) — une arête par relation dont `fromItemId` et `toItemId` sont placés et dont le type est officiel ; `id: 'rel-' + relation.id`, `source/target`, `type: 'smoothstep'`, `markerEnd` flèche, `style.stroke` = `getRelationMeta(type).hex`, `label` = `relation.label` s'il existe, `data: { relationId, type, label }`.
  - `filterUnplaced(unplaced: Item[], query: string): Item[]` — filtre insensible à la casse et aux accents sur `title` ; query vide = tout.

- [ ] **Step 1: Tests (échouent)**
  - `splitPlaced sépare placés et non placés` : items `[a,b,c]`, positions `[{itemId:'b',x:1,y:2}]` ⇒ `placed` = `[{item:b,x:1,y:2}]`, `unplaced` = `[a,c]`.
  - `splitPlaced ignore une position d'item disparu` : positions `[{itemId:'zz',x:0,y:0}]` ⇒ `placed` = `[]`.
  - `buildProcessEdges ne garde que les relations entre items placés` : relations a→b, a→c, placés `{a,b}` ⇒ 1 arête `source:'a', target:'b'`.
  - `buildProcessEdges ignore un type non officiel` : type `'foo'` ⇒ `[]`.
  - `buildProcessEdges colore selon le type` : type `'blocks'` ⇒ `style.stroke === getRelationMeta('blocks').hex`, `data.relationId` = id de la relation.
  - `filterUnplaced ignore casse et accents` : titres `['Réunion', 'Budget']`, query `'reu'` ⇒ `['Réunion']`.

- [ ] **Step 2: Lancer** — Run: `pnpm --filter @spok/web exec vitest run src/components/views/process-utils.test.ts` — Expected: FAIL.

- [ ] **Step 3: Implémenter** les 3 fonctions (normalisation accents : `normalize('NFD').replace(/\p{Diacritic}/gu, '')`, ou l'utilitaire existant s'il y en a un dans `lib/`).

- [ ] **Step 4: Relancer** — Expected: PASS (6 tests).

---

### Task 4: Accès API web + hook `useProcessNodes`

**Files:**
- Modify: `apps/web/src/lib/api.ts` (nouvel objet `processApi`, à côté de `itemsApi`)
- Create: `apps/web/src/hooks/useProcessNodes.ts`
- Modify: `docs/ARCHITECTURE.md` (ligne dans le tableau « Hooks existants » + queryKey)

**Interfaces:**
- Consumes: routes de la Task 2 ; `ProcessPosition` (Task 3).
- Produces:
  - `processApi.list(spaceId): Promise<ProcessPosition[]>`, `processApi.place(spaceId, itemId, x, y): Promise<ProcessPosition>`, `processApi.remove(spaceId, itemId): Promise<void>`.
  - `useProcessNodes(spaceId: string | undefined): { positions: ProcessPosition[]; isLoading: boolean; place: (itemId: string, x: number, y: number) => void; remove: (itemId: string) => void }` — queryKey `['process-nodes', spaceId]` ; `place`/`remove` en mise à jour optimiste du cache (`setQueryData`), rollback + toast d'erreur existant du projet en cas d'échec, `invalidateQueries` en `onSettled`.

- [ ] **Step 1: Implémenter `processApi`** via `fetchApi` (même style que `userApi.updatePreferences`).
- [ ] **Step 2: Implémenter `useProcessNodes`** selon le « Pattern standard » d'ARCHITECTURE.md.
- [ ] **Step 3: Typecheck** — Run: `pnpm --filter @spok/web exec tsc --noEmit` — Expected: 0 erreur.

---

### Task 5: Modales de relation partagées

**Files:**
- Create: `apps/web/src/components/relations/RelationCreateDialog.tsx`
- Create: `apps/web/src/components/relations/RelationEditDialog.tsx`

**Interfaces:**
- Produces:
  - `RelationCreateDialog({ sourceTitle: string; targetTitle: string; onSelect: (type: string, label?: string) => void; onCancel: () => void })`
  - `RelationEditDialog({ sourceTitle: string; targetTitle: string; type: string; label: string; onSave: (type: string, label: string) => void; onDelete: () => void; onCancel: () => void })`

- [ ] **Step 1: Extraire** le rendu des deux modales de `MindMapView.tsx` (l. ~1565-1700 : « Type de relation » et « Modifier la relation ») en **copie** dans ces deux composants, avec `RELATION_TYPE_LIST` comme source, `useDialogFocus` sur le panneau, `useEscapeKey(onCancel)`, `DevModalBadge name="RelationCreateDialog"` / `"RelationEditDialog"`, et les classes `dark:` (la version MindMap de création n'en a pas sur le fond). Suppression dans l'édition : `ConfirmModal` destructif existant. `MindMapView.tsx` n'est **pas** modifié.
- [ ] **Step 2: Typecheck** web — Expected: 0 erreur.

---

### Task 6: Composant `ProcessView` (+ nœud et panneau)

**Files:**
- Create: `apps/web/src/components/views/ProcessView.tsx`
- Create: `apps/web/src/components/views/ProcessNode.tsx`
- Create: `apps/web/src/components/views/ProcessUnplacedPanel.tsx`

**Interfaces:**
- Consumes: `useProcessNodes` (Task 4), `splitPlaced` / `buildProcessEdges` / `filterUnplaced` (Task 3), dialogs (Task 5), `buildItemMenuGroups` + `ItemActionMenu`, `getTypeIcon`, `getStatusColor`/`tailwindBgToHex` (comme `mindmap-layout.ts`), `NewItemButton`, `ViewHelpButton`, `EmptyHelp`.
- Produces: `ProcessView(props: ProcessViewProps)` avec
  ```ts
  interface ProcessViewProps extends ItemMenuCallbacks {
    items: Item[];
    relations: ItemRelation[];
    spaceId: string;
    referentiels?: SpaceReferentiels;
    canEdit?: boolean;
    canEditItem?: (item: Item) => boolean;
    highlightType?: string; highlightStatus?: string; searchMatchIds?: Set<string> | null;
    onCreateNote?: () => Promise<{ id: string }>;   // crée une NOTE vide et ouvre sa modale
    onNewItem?: () => void;
    onCreateRelation?: (fromId: string, toId: string, type: string, label?: string) => void;
    onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string }) => void;
    onDeleteRelation?: (itemId: string, relationId: string) => void;
    onStartTour?: () => void; pulseHelp?: boolean;
  }
  ```
  (aligner les signatures `onUpdateRelation`/`onDeleteRelation` sur celles de `useSpaceActions.ts`).

- [ ] **Step 1: `ProcessNode`** — nœud xyflow custom : carte (icône du type, titre tronqué 2 lignes, pastille couleur du statut), `Handle` source à droite et target à gauche (masqués si `!canEdit`), `ItemActionMenu` (trigger MoreVertical) avec `buildItemMenuGroups(...)` + `extraSections: [{ actions: [{ id: 'process-remove', label: 'Retirer du process', icon: Undo2, onClick }] }]`, double-clic = `onEdit(id)`, opacité réduite si l'item ne matche pas highlight/recherche. `data-tour="process-node"` sur le premier nœud, `data-help-zone="process:noeud"`.
- [ ] **Step 2: `ProcessUnplacedPanel`** — colonne 260 px repliable : champ de recherche (`filterUnplaced`), liste des items non placés (icône + titre), chaque ligne `draggable={canEdit}` avec `dataTransfer.setData('application/spok-item-id', id)`. Compteur dans l'en-tête. Message si vide : « Tous les items sont placés ». `data-tour="process-unplaced"`, `data-help-zone="process:panneau"`.
- [ ] **Step 3: `ProcessView`** — en-tête `#view-header` : `NewItemButton` (si `canEdit && onNewItem`), flex-1, `ViewHelpButton`. Corps : panneau + `ReactFlow` (dans `ReactFlowProvider`) avec `nodeTypes={{ process: ProcessNode }}`, `zoomOnDoubleClick={false}`, `nodesDraggable={canEdit}`, `nodesConnectable={canEdit}`, `fitView` au premier rendu seulement, `Controls` + `Background`. Comportements :
  - drop d'un item du panneau → `screenToFlowPosition` → `place(id, x, y)` ;
  - `onNodeDragStop` → `place(id, x, y)` ;
  - double-clic sur le pane (cible `.react-flow__pane`, `canEdit`) → mémoriser la position flow, `await onCreateNote()` → `place(created.id, x, y)` ;
  - `onConnect` (source ≠ target) → `RelationCreateDialog` → `onCreateRelation` ;
  - `onEdgeClick` → `RelationEditDialog` → `onUpdateRelation` / `onDeleteRelation` ;
  - « Retirer du process » → `remove(id)`.
  État vide (aucun item placé) : `EmptyHelp` au centre du canevas. `data-tour="process-canvas"`, `data-help-zone="process:canevas"`.
- [ ] **Step 4: Typecheck** web — Expected: 0 erreur.

---

### Task 7: Branchement de la vue (registre, SpacePage, aide)

**Files:**
- Modify: `packages/shared/src/constants/viewRegistry.ts` (entrée `process`)
- Modify: `apps/web/src/stores/viewMode.ts` (`ViewMode` += `'process'`)
- Modify: `apps/web/src/constants/viewIcons.ts` et `apps/web/src/pages/SpaceToolbar.tsx` (`VIEW_ICON_MAP`) : import + entrée `Workflow` ; ajouter `'process'` à la liste de classes de la l. 273 ; ajouter `'process'` à `MOBILE_HIDDEN_VIEWS`
- Modify: `apps/web/src/pages/SpacePage.tsx` : `'process'` dans `isHighlightMode` (filtres = surbrillance, pas de retrait) ; branche `viewMode === 'process'` avant `'pert'`, mêmes props que PERT (`items={filterBySearch(allItemsData?.data)}`, `relations` comme PERT) + `onCreateNote={() => createItemMutation.mutateAsync({ type: 'NOTE', title: '', status: '' }).then((c: any) => { setEditingItemId(c.id); return c; })}`
- Modify: `apps/web/src/components/SpaceExportButton.tsx` si `getFormats` doit exclure CSV/Excel pour `process` (aligner sur `pert` : PNG/PDF seulement, sinon laisser le défaut)
- Create: `apps/web/src/components/views/help/process.help.ts` + enregistrement dans `help/index.ts`
- Modify: `apps/web/src/lib/businessRules.ts` (règles : un process par espace ; double-clic = NOTE ; retirer ≠ supprimer ; positions partagées)

**Interfaces:**
- Consumes: `ProcessView` (Task 6).

- [ ] **Step 1: Registre** — `{ id: 'process', label: 'Process', icon: 'Workflow', category: 'planning', order: 6, visible: true, access: 'user' }`, puis `pnpm build:packages`.
- [ ] **Step 2: ViewMode, icônes, SpaceToolbar, SpacePage, export** comme listé ci-dessus.
- [ ] **Step 3: Fiche d'aide** `process.help.ts` (modèle `pert.help.ts`) : `title: 'Process'`, `summary: 'Un canevas libre pour poser les items de l\'espace et les relier en enchaînement.'`, `short`, `empty: 'Le process est vide. Glissez un item depuis le panneau de gauche, ou double-cliquez sur le canevas pour noter une idée.'`, `tips` (glisser depuis le panneau ; double-clic = nouvelle note ; tirer d'un bord à l'autre = relation ; clic sur une flèche = la modifier ; « Retirer du process » ne supprime pas), `zones` `canevas`/`noeud`/`panneau`, `tour` ≥ 5 étapes dont 3 pointées (`process-canvas`, `process-unplaced`, `process-node`) + `...SPACE_TOOLBAR_STEPS`.
- [ ] **Step 4: Tests ciblés** — Run: `pnpm --filter @spok/web exec vitest run src/help/coverage.test.ts src/components/views/process-utils.test.ts` — Expected: PASS. Puis typecheck web — 0 erreur.

---

### Task 8: Vérification navigateur + doc SPOK

- [ ] **Step 1:** Skill `testing-protocol`, puis dans le navigateur intégré sur le dev local, dans un espace de test : ouvrir la vue Process (vide) ; glisser 3 items du panneau ; recharger → positions conservées ; déplacer un nœud, recharger ; double-cliquer sur le vide → modale d'une NOTE, l'enregistrer → nœud à l'endroit cliqué ; relier deux nœuds → modale de relation → flèche colorée, visible aussi dans la vue PERT ; cliquer la flèche → modifier/supprimer ; « Retirer du process » → l'item revient dans le panneau ; supprimer un item placé → disparaît du canevas ; console sans erreur.
- [ ] **Step 2:** Doc SPOK (skill `spok-doc`) : créer l'item de doc de la vue Process dans l'espace de doc produit (statut `to_validate`) et mentionner `ProcessNode` dans la doc du modèle de données.
- [ ] **Step 3:** `docs/session-journal.md` mis à jour ; proposer à Thomas le commit (non fait sans sa demande).
