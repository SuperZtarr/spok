---
name: spok-menu
description: Use when adding, modifying or understanding the view menu in SPOK spaces. Triggers when a view is missing, a new view needs to be added, or the menu structure needs to change.
---

# spok-menu — Système de menu des vues SPOK

## Architecture

Le menu des vues d'espace est **piloté par la base de données** (table `AppConfig`), pas hardcodé. Une config par défaut existe dans `@spok/shared` et s'applique si aucune config n'est sauvegardée.

```
DEFAULT_VIEW_CONFIG (shared)
    ↓ (si pas de config en DB)
AppConfig table (key: 'views')
    ↓ GET /config/views (merge auto des nouvelles vues)
useViewConfig() hook
    ↓
ViewModeSelector → menu affiché
```

## Fichiers clés

| Rôle | Fichier |
|------|---------|
| Config par défaut des vues | `packages/shared/src/constants/viewDefaults.ts` |
| Type `ViewMode` + array `VIEW_MODES` | `apps/web/src/stores/viewMode.ts` |
| Descriptions/tips des vues | `apps/web/src/constants/viewDescriptions.ts` |
| API config (public + admin) | `apps/api/src/routes/admin/config.ts` |
| Rendu du menu | `apps/web/src/components/ViewModeSelector.tsx` |
| Hook de chargement | `apps/web/src/hooks/useViewConfig.ts` |
| Rendu de la vue dans l'espace | `apps/web/src/pages/SpacePage.tsx` |

## Ajouter une nouvelle vue — checklist complète

### 1. Shared — déclarer la vue par défaut

```ts
// packages/shared/src/constants/viewDefaults.ts
{ id: 'ma-vue', label: 'Ma Vue', icon: 'IconName', category: 'basic', order: 29, visible: true, access: 'user' },
```

**Catégories valides :** `basic` | `planning` | `exploration` | `itemTypes`

**Icons :** noms Lucide (ex: `Clock`, `List`, `Share2`). Vérifier que l'icône est importée dans `ViewModeSelector.tsx`.

> Le GET `/config/views` fusionne automatiquement les nouvelles vues des defaults dans la config DB existante — pas besoin de reset.

### 2. Web — type TypeScript

```ts
// apps/web/src/stores/viewMode.ts
export type ViewMode = '...' | 'ma-vue';

// Dans VIEW_MODES :
{ value: 'ma-vue', label: 'Ma Vue', icon: 'IconName', category: 'basic' },
```

### 3. Web — description de la vue

```ts
// apps/web/src/constants/viewDescriptions.ts
// Dans VIEW_DESCRIPTIONS: Record<ViewMode, ViewDescription>
'ma-vue': {
  title: 'Titre affiché',
  description: 'Description courte.',
  tips: ['Tip 1', 'Tip 2'],
},
```

⚠️ `ViewMode` est un `Record` strict — TypeScript échoue si une valeur manque.

### 4. Web — créer le composant

```ts
// apps/web/src/components/views/MaVueView.tsx
// Props minimales (pattern TodoView) :
interface MaVueViewProps {
  items: Item[] | undefined;
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}
```

### 5. Web — intégrer dans SpacePage

```ts
// apps/web/src/pages/SpacePage.tsx

// Import :
import { MaVueView } from '../components/views/MaVueView';

// Dans le bloc ternaire (ajouter avant viewMode === 'thread') :
) : viewMode === 'ma-vue' ? (
  <MaVueView
    items={filterBySearch(itemsData?.data)}
    currentSpaceId={spaceId}
    portalGroups={portalGroups}
    onEdit={setEditingItemId}
    onDelete={actions.handleDelete}
    onUpdateStatus={(id, status) => actions.handleInlineUpdate(id, { status })}
    onAddChild={handleAddChild}
    onMoveToSpace={(id) => setMoveItemId(id)}
    onDuplicateToSpace={(id) => setDuplicateItemId(id)}
    onConvertToSpace={actions.handleConvertToSpace}
    onSelfAssign={handleSelfAssign}
    onMerge={actions.handleMerge}
    onAbsorbChildren={actions.handleAbsorbChildren}
    onSplitDescription={actions.handleSplitDescription}
    referentiels={referentiels}
    canEdit={canEdit}
  />
```

### 6. Rebuild et vérif

```bash
pnpm build:packages   # OBLIGATOIRE — shared modifié, l'API ne voit pas la nouvelle vue sans ça
cd apps/web && npx tsc --noEmit   # vérif TypeScript
```

⚠️ **Après `pnpm build:packages`, redémarrer le dev** (`pnpm dev:stop` puis `pnpm dev:start`) — le hot-reload tsx ne recharge pas les modules shared compilés. La nouvelle vue reste invisible dans le menu jusqu'au redémarrage de l'API.

## Modifier une vue existante (label, icône, ordre, visibilité)

**Via l'admin UI** : `/admin/views` — interface graphique, pas besoin de toucher au code.

**Via le code** : modifier `DEFAULT_VIEW_CONFIG` dans `viewDefaults.ts`. Ne s'applique qu'aux nouvelles installations ou après reset.

## Erreurs fréquentes

| Erreur | Cause | Fix |
|--------|-------|-----|
| Vue absente du menu | Pas dans `DEFAULT_VIEW_CONFIG` | Ajouter + `pnpm build:packages` |
| TS error sur `VIEW_DESCRIPTIONS` | Clé manquante dans le Record | Ajouter l'entrée |
| Icône absente | Icône non importée dans `ViewModeSelector.tsx` | Vérifier les imports ligne ~1-65 |
| Vue non rendue | Cas manquant dans SpacePage | Ajouter le ternaire |
| Nouvelle vue invisible après déploiement | Config déjà en DB, default non pris en compte | Le merge auto (`GET /config/views`) le gère depuis la correction du 2026-04-16 |
