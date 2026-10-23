# ARCHITECTURE.md — Référence technique SPOK

> Lire au démarrage de chaque session. Source de vérité pour les patterns de code récurrents.

---

## Zones fragiles — ne pas toucher sans lire

| Zone | Fichier | Invariant critique |
|------|---------|-------------------|
| **MindMap** | `MindMapView.tsx` | Edges recalculés via `onInit` ; portails à placement fixe. Ne pas modifier le cycle de layout sans vérifier les edges et portails. |
| **Navigation globale** | `GlobalNavBar.tsx` (remplace l'ancien `MainMenu.tsx`, supprimé) | Bandeau Bootstrap plein hauteur. Jamais de hamburger/dropdown. Jamais de logique `layoutMode` avec mesure de largeur (CSS `md:` uniquement). Détail complet : skill `spok-layout`. |
| **Sidebar / Layout** | `Layout.tsx` (remplace l'ancien `Sidebar.tsx`, supprimé) | Style Notion/Linear. Ne pas réintroduire de sidebar compacte. 3 mécanismes de collapse indépendants (collapsed/width/mobile-open) + zone z-index fragile (pas d'`overflow-hidden` sur le header). Détail complet : skill `spok-layout`. |
| **Auth/Token** | `lib/api.ts`, `AuthProvider.tsx` | Refresh proactif avant expiration. Ne pas simplifier sans comprendre le cycle complet. |

---

## Stores Zustand

| Store | Fichier | Contenu |
|-------|---------|---------|
| `useAuthStore` | `stores/auth.ts` | `user`, `accessToken`, `refreshToken`, `isAuthenticated` — **persisté localStorage** |
| `useSpaceStore` | `stores/space.ts` | `currentSpace`, `includeChildrenSpaceIds` (quels espaces incluent leurs enfants) — persisté |
| `useCommunityStore` | `stores/community.ts` | `currentCommunity` — persisté |
| `useViewModeStore` | `stores/viewMode.ts` | `mode` (vue active), `allowedViews` — persisté |
| `useThemeStore` | `stores/theme.ts` | `theme` light/dark — sync avec préférences utilisateur via API |
| `useDashboardTabStore` | `stores/dashboardTab.ts` | `tab` (onglet dashboard actif) — persisté |
| `useNotificationPanelStore` | `stores/notificationPanel.ts` | `open` (menu de la cloche) — volatil ; ouvrable depuis l'accueil (pas de page /notifications) |

⚠️ `selection.ts` existait pour la multi-sélection — **supprimé**, ne pas le recréer.

---

## Hooks TanStack Query — conventions

### QueryKeys

```ts
['space', spaceId]                                    // espace courant
['items', spaceId, filter, statusFilter, viewMode, checkedDescendantIds]  // items filtrés
['items', spaceId, 'all', checkedDescendantIds]       // tous les items (sans filtre)
['item', spaceId, itemId]                             // item individuel
```

### Pattern standard

```ts
// Lecture
const { data, isLoading } = useQuery({
  queryKey: ['items', spaceId, params],
  queryFn: () => itemsApi.list(spaceId, params),
  enabled: !!spaceId,
});

// Écriture
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (data) => itemsApi.create(spaceId, data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    queryClient.invalidateQueries({ queryKey: ['space', spaceId] }); // itemCount
  },
});
```

### Hooks existants (`apps/web/src/hooks/`)

| Hook | QueryKey | Usage |
|------|----------|-------|
| `useItems(spaceId, params)` | `['items', spaceId, params]` | Items d'un espace avec filtres |
| `useItem(spaceId, itemId)` | `['item', spaceId, itemId]` | Item individuel |
| `useCreateItem` / `useUpdateItem` / `useDeleteItem` | — | Mutations items |
| `useSpaces()` | `['spaces']` | Liste des espaces |
| `useReferentiels(spaceId)` | `['referentiels', spaceId]` | Statuts/types configurés |
| `useMenuItems()` | `['menu-items']` | Items de navigation |
| `useProcessNodes(spaceId)` | `['process-nodes', spaceId]` | Positions du canevas de la vue Process ; `place` / `remove` optimistes (retirer ≠ supprimer l'item) |
| `useArticle(spaceId, articleId)` | `['article', spaceId, articleId]` | Blocs d'un article (table `article_blocks`, routes `item-article.ts`) ; `updateBlock` / `reorder` optimistes, `removeBlock` retire la référence (≠ supprimer l'élément) ; 409 `LESS_VISIBLE` renvoyé à l'appelant |
| `useLiveSession(spaceId, { stream })` | `['live-session', spaceId]` | Séance live d'un espace de séance (404 = pas une séance). Flux SSE (`lib/liveStream.ts`) seulement avec `stream: true` — réservé à `LiveSessionHost` (un flux par onglet) ; événements appliqués sur le cache, refetch à chaque reconnexion |

---

## Pattern d'une vue dans SpacePage

### Props systématiquement passées depuis SpacePage

```tsx
<MaVueView
  items={deferredItems}                    // Item[] — filtrés et déférés
  spaceId={spaceId}
  spaceName={space?.name}
  spaceRole={space?.role}                  // 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  canEdit={canEdit}                        // boolean — false si VIEWER
  canEditItem={canEditItem}                // (item) => boolean — per-item permissions
  referentiels={referentiels}              // statuts, types, couleurs configurés
  onEdit={setEditingItemId}
  onDelete={actions.handleDelete}
  onUpdateStatus={(id, status) => ...}
  onAddChild={handleAddChild}
  onMove={actions.handleMove}
  onNewItem={canEdit ? handleNewItem : undefined}
  onStartTour={() => startViewTour(viewMode)}
  pulseHelp={pulseHelp}
  filter={filter}                          // 'ALL' | ItemType
  onFilterChange={setFilter}
  statusFilter={statusFilter}              // 'ALL' | statusId
  onStatusFilterChange={setStatusFilter}
  totalItemCount={allItemsData?.data?.length ?? ...}
  filteredItemCount={itemsData?.total ?? ...}
/>
```

### Structure type d'un composant vue

```tsx
interface MaVueProps {
  items: Item[];
  spaceId?: string;
  spaceRole?: string;
  canEdit?: boolean;
  referentiels?: SpaceReferentiels;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onNewItem?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (f: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (s: string) => void;
  totalItemCount?: number;
  filteredItemCount?: number;
}

export function MaVueView({ items, canEdit, onNewItem, filter, onFilterChange, ... }: MaVueProps) {
  return (
    <div className="flex flex-col h-full">
      <ViewToolbar
        viewMode="ma-vue"
        canEdit={canEdit}
        onNewItem={onNewItem}
        filter={filter}
        onFilterChange={onFilterChange}
        totalItemCount={totalItemCount}
        filteredItemCount={filteredItemCount}
        ...
      />
      <div className="flex-1 overflow-auto">
        {/* contenu de la vue */}
      </div>
    </div>
  );
}
```

---

## Structure SpacePage (aperçu)

`apps/web/src/pages/SpacePage.tsx` — composant central, ~1800 lignes.

**State principal :**
- `filter` / `statusFilter` — type/statut actif (partagé toutes vues)
- `viewMode` — via `useViewModeStore`
- `editingItemId` — item ouvert en modale
- `checkedDescendantIds` — espaces enfants inclus dans les vues arborescentes

**Queries principales :**
- `itemsData` — items filtrés (type + statut + vue) via `useQuery(['items', spaceId, ...])`
- `allItemsData` — tous les items (sans filtre type/statut) — pour MindMap, PERT, Timeline
- `space` — espace courant via `useQuery(['space', spaceId])`

**`isHighlightMode`** : true si la vue est arborescente (mindmap, pert, tree, timeline, text) → le filtre type/statut ne retire pas les items, il les dim/highlight.

**`actions`** : objet regroupant tous les handlers (handleDelete, handleMove, handleInlineUpdate…) — défini via `useMemo` pour éviter les re-renders.

---

## API Fastify — conventions routes

```
apps/api/src/routes/
  auth.ts          → /auth/*
  spaces.ts        → /spaces/*
  items.ts         → /spaces/:spaceId/items/*
  relations.ts     → /spaces/:spaceId/relations/*
  tags.ts          → /spaces/:spaceId/tags/*
  live-sessions.ts → /live-sessions/* (séances live : création, join, présentateurs, display, end, flux SSE /:id/stream)
  admin/           → /admin/*
```

Pattern handler :

```ts
fastify.get('/spaces/:spaceId/items', { preHandler: [authenticate] }, async (request, reply) => {
  const { spaceId } = request.params;
  const userId = request.user.id;
  // vérifier membership avant d'accéder aux données
  const membership = await prisma.spaceMembership.findUnique({ where: { spaceId_userId: { spaceId, userId } } });
  if (!membership) return reply.status(403).send({ error: 'Forbidden' });
  ...
});
```

---

⚠️ **Garde d'accès dans une fonction `async`** : ne jamais y faire `return reply.forbidden(...)` / `return reply.notFound(...)`. `reply` est « thenable » : la promesse se résout à `undefined`, l'appelant croit l'accès accordé et la route continue d'écrire après l'erreur (faille de la vue Process, corrigée 2026-10-21, cc944eb). Envoyer l'erreur puis renvoyer un booléen ou `null` (modèles : `denied()` de `process-nodes.ts`, `sessionForMember()` de `live-sessions.ts`), et tester qu'aucune écriture n'a lieu après le refus.

---

## @spok/shared — exports clés

```ts
import { VIEW_REGISTRY, DEFAULT_MENU_ITEMS, DEFAULT_REFERENTIELS } from '@spok/shared';
import type { Item, ItemType, Space, SpaceReferentiels, AuthUser } from '@spok/shared';
```

⚠️ Après modification de `@spok/shared` ou `@spok/database` : toujours `pnpm build:packages` puis redémarrer le dev.

---

## Séances de présentation en direct (étape 1 « Socle », 2026-10-10)

- **Modèle** : `LiveSession` (1:1 avec son espace dédié, sous-espace PRIVATE d'un espace de communauté), `LiveSessionRole` (HOST/PRESENTER), `LiveSessionEntry` (journal DISPLAY/JOIN, indépendant de l'organisation de l'espace). Champs `Item.lockedAt/sourceItemId/sourceSpaceId` pour les copies.
- **Temps réel** : SSE + hub en mémoire (`apps/api/src/utils/liveHub.ts`) — valable pour UNE instance d'API. Plusieurs instances → relais PostgreSQL LISTEN/NOTIFY derrière la même interface.
- **Verrou** : `apps/api/src/utils/itemLock.ts` — toute nouvelle route qui écrit le contenu d'un item doit appeler `isLocked()`. Seuls `parentId`/`tagIds` passent en PATCH ; move/reorder/relations/contributions restent libres.
- **Web** : séance active = store `useActiveLiveSessionStore` (`stores/activeLiveSession.ts`, seul `spaceId` persisté). `LiveSessionHost` (monté dans `App.tsx`) ouvre l'unique flux et affiche la fenêtre flottante sur toutes les pages (portail, jamais dans `Layout.tsx`) ; `SpacePage` affiche le bandeau et fait de l'espace ouvert la séance active ; bouton « Séances » via le slot `liveSessionsSlot` de `SpaceToolbar` ; section « Séance » du menu contextuel ajoutée par `itemMenuGroups` (`lib/liveItemActions.ts`).
- **Étape 2 (2026-10-10)** : statut `PREPARED` avant `LIVE` ; programme `LiveSessionAgendaItem` (liens vers les sources, ordre : animateur = tout, présentateur = ses lignes) ; affichage sans sous-items, révélés un par un (`/pending-children`, `/reveal`) ; une nouvelle copie se range sous la copie de son parent d'origine déjà présenté.
