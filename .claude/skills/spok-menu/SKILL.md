---
name: spok-menu
description: Use when adding, modifying or understanding any menu or toolbar in SPOK — navigation menu, view toolbars, contextual menus (right-click / MoreVertical on items), export dropdowns, or settings menus for spaces/communities. Triggers when a view is missing, a new view needs to be added, a toolbar button needs to be added/moved/removed, the contextual menu needs a new action, or any menu component needs changes. Always read this skill before touching menus or toolbars.
---

# spok-menu — Menus et Toolbars SPOK

## Architecture réelle

Le menu de navigation est piloté par la table **`MenuItem`** (base de données), via `DEFAULT_MENU_ITEMS` dans `@spok/shared` comme fallback.

```
DEFAULT_MENU_ITEMS (shared/constants/menuDefaults.ts)
    ↓ (fallback si pas en DB)
Table MenuItem (PostgreSQL)
    ↓ GET /menu-items
useMenuItems() hook
    ↓
MainMenu.tsx → menu affiché dans le Layout
```

⚠️ `ViewModeSelector.tsx` existe mais est **inutilisé** (remplacé par `MainMenu`). Ne pas toucher.
⚠️ `viewDefaults.ts` / `useViewConfig()` / `AppConfig` sont un système **parallèle et séparé** — il sert au composant ViewModeSelector qui n'est pas rendu.

## Fichiers clés

| Rôle | Fichier |
|------|---------|
| Items de menu par défaut | `packages/shared/src/constants/menuDefaults.ts` |
| Types MenuItem | `packages/shared/src/types/menuItem.ts` |
| Rendu du menu principal | `apps/web/src/components/MainMenu.tsx` |
| Hook de chargement | `apps/web/src/hooks/useMenuItems.ts` |
| Rendu de la vue dans l'espace | `apps/web/src/pages/SpacePage.tsx` |
| Type `ViewMode` | `apps/web/src/stores/viewMode.ts` |
| Descriptions/tips des vues | `apps/web/src/constants/viewDescriptions.ts` |

## Structure du menu espace (desktop)

Quand l'utilisateur est dans un espace (`/spaces/:id/*`), `MainMenu` affiche :

1. **Global** — dropdown : Accueil, Communautés, Espaces, Sunburst, Carte mentale, Graphe global, Liens
2. **Personnel** — dropdown : Tableau de bord, Tâches, Profil
3. **Espaces** — dropdown multi-colonnes (bouton unique remplaçant les 4 anciens) :
   - Lien "Présentation" → `/spaces/:id`
   - 4 colonnes : Basique | Types | Planification | Exploration
4. **Administration** — dropdown admin (visible si adminMode actif)
5. **Divers** — dropdown : Recherche, Contact, Plan du site, Déconnexion

Hors espace (homepage, etc.) : les sections `basic`, `itemTypes`, `planning`, `exploration` sont masquées.

### Implémentation clés dans `MainMenu.tsx`

- `SPACE_SECTION_IDS = ['basic', 'itemTypes', 'planning', 'exploration']` — les 4 sections groupées
- Bouton virtuel `'__espaces__'` — clé utilisée dans `sectionButtonRefs` et `openSection`
- `openSectionDropdown('__espaces__')` → `menuWidth = 600` (vs 220 pour les autres)
- `renderEspacesDropdownContent()` — génère le dropdown multi-colonnes avec "Présentation"
- Portal conditionné par `openSection && (currentSection || openSection === '__espaces__')`

## Ajouter une nouvelle vue — checklist complète

### 1. Shared — déclarer le menu item

```ts
// packages/shared/src/constants/menuDefaults.ts
{ id: '', key: 'ma-vue', label: 'Ma Vue', icon: 'IconName',
  section: 'basic',           // basic | itemTypes | planning | exploration
  sectionLabel: 'Basique',
  sectionOrder: 2,            // 0=global 1=personal 2=basic 3=itemTypes 4=planning 5=exploration 6=admin 7=misc
  route: null, viewMode: 'ma-vue',
  order: 8, visible: true, access: 'user' },
```

**Sections valides :** `basic` | `itemTypes` | `planning` | `exploration`
**access :** `public` | `user` | `admin`
**Icons :** noms Lucide. Vérifier que l'icône est importée dans `MainMenu.tsx` (ICONS map).

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
'ma-vue': {
  title: 'Titre affiché',
  description: 'Description courte.',
  tips: ['Tip 1', 'Tip 2'],
},
```

⚠️ `VIEW_DESCRIPTIONS` est un `Record<ViewMode, ...>` strict — TypeScript échoue si une clé manque.

### 4. Web — créer le composant vue

```ts
// apps/web/src/components/views/MaVueView.tsx
```

Pattern : copier `TodoView.tsx` comme base.

### 5. Web — intégrer dans SpacePage

```ts
// apps/web/src/pages/SpacePage.tsx
import { MaVueView } from '../components/views/MaVueView';

// Dans le bloc ternaire (avant viewMode === 'thread') :
) : viewMode === 'ma-vue' ? (
  <MaVueView items={...} onEdit={...} ... />
```

### 6. Rebuild et vérif

```bash
pnpm build:packages   # OBLIGATOIRE — shared modifié
cd apps/web && npx tsc --noEmit
```

⚠️ Après `pnpm build:packages`, redémarrer le dev — le HMR ne recharge pas les modules shared compilés.

## Modifier un item existant (label, icône, ordre, visibilité)

**Via l'admin UI** : `/admin/menu` — interface graphique.

**Via le code** : modifier `DEFAULT_MENU_ITEMS` dans `menuDefaults.ts`. Ne s'applique qu'aux nouvelles installations ou si la DB est vide.

---

## Standards des toolbars de vue

### Architecture

Deux niveaux de toolbar :

1. **`ViewToolbar`** (`apps/web/src/components/ui/ViewToolbar.tsx`) — composant réutilisable pour la majorité des vues
2. **Toolbar interne** — pour les vues complexes (MindMap, PERT, Timeline) qui ont des boutons spécifiques ; elles embarquent `FilterToolbar` directement

### Ordre canonique des boutons (gauche → droite)

```
[Aide] [Nouveau] [Réduire/Étendre] [Tri] [boutons spécifiques vue] | [Lumière/Filtre] → flex-1 spacer ← [Count] [Export] [Historique] [Paramètres]
```

| Zone | Boutons | Notes |
|------|---------|-------|
| Gauche | Aide, Nouveau, Réduire/Étendre, Tri, boutons vue | Dans cet ordre |
| Séparateur `|` | `<div className="h-4 w-px bg-border mx-1" />` | Avant FilterToolbar |
| FilterToolbar | Lumière ou Filtre | Avec ou sans séparateur selon contexte |
| Spacer | `<div className="flex-1" />` | Pousse le reste à droite |
| Droite | Count, Export, Historique, Paramètres | Count avant Export |

### Composant `ViewToolbar` — vues standard

Utilisé par : ListView, KanbanView, ThreadView, TextDocView, MembersView, RecentView, CalendarView, LinksView, ImagesView, DocumentsView, BugsView, TodoView, PlanningView, CrossTableView, BurndownView, SequenceView, GraphView, SunburstView.

Props clés :
- `viewMode` — obligatoire, détermine si l'export est rendu (`showExport = !['pert','timeline','mindmap']`)
- `canEdit + onNewItem` — affiche le bouton Nouveau
- `treeSortValue + onTreeSortChange` — affiche `TreeSortButton`
- `isExpanded + onToggleExpand` — affiche `CollapseToggleButton`
- `isHighlightMode` — passe en mode "Lumière" (jaune) vs "Filtre" (bleu) dans FilterToolbar
- `totalItemCount + filteredItemCount` — count affiché par FilterToolbar

### Composant `FilterToolbar` — règles

- Le count (`X éléments`) est **toujours dans FilterToolbar** avec `ml-auto` — ne pas l'afficher en doublon ailleurs
- **Exception** : dans les toolbars internes (MindMap, PERT, Timeline), le count est un `<span>` placé **après le spacer `flex-1`** et FilterToolbar est appelé **sans** `totalItemCount`
- `isHighlightMode={true}` → bouton jaune "Lumière" (ne filtre pas les items, les dim/highlight)
- `isHighlightMode={false}` (défaut) → bouton bleu "Filtre" (filtre les items de la liste)
- Les dropdowns Types/Statuts ne s'affichent que si `onFilterChange`/`onStatusFilterChange` sont passés

### Toolbar interne (MindMap, PERT, Timeline)

Ces vues ont leurs propres boutons spécifiques (ex: MindMap : Réduire, Réorganiser, Tout voir, Légende). Elles appellent `FilterToolbar` et gèrent le count manuellement :

```tsx
{/* Toolbar interne */}
<div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
  <ViewHelpButton ... />
  {canEdit && onNewItem && <button ...>Nouveau</button>}
  <div className="h-4 w-px bg-border mx-1" />
  {/* boutons spécifiques */}
  <div className="h-4 w-px bg-border mx-1" />
  <FilterToolbar filter={filter} onFilterChange={onFilterChange}
    statusFilter={statusFilter} onStatusFilterChange={onStatusFilterChange}
    referentiels={referentiels} isHighlightMode={true} />
  {/* NE PAS passer totalItemCount à FilterToolbar ici */}
  <div className="flex-1" />
  {totalItemCount !== undefined && (
    <span className="text-xs text-muted-foreground flex-shrink-0">
      {totalItemCount} élément{totalItemCount !== 1 ? 's' : ''}
    </span>
  )}
  <ExportDropdownButton ... />
  {/* Historique, Paramètres */}
</div>
```

### Style des boutons

Tous les boutons de toolbar suivent ce pattern :

```
className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
```

- Bouton **Nouveau** uniquement : `bg-secondary text-secondary-foreground hover:bg-secondary/80`
- Boutons icône seule (Historique, Paramètres) : `h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`
- Icônes : `w-3.5 h-3.5` pour les boutons texte, `w-4 h-4` pour les boutons icône seule
- Labels : `<span className="hidden sm:inline">Label</span>` pour masquer sur mobile

### Séparateurs

```tsx
<div className="h-4 w-px bg-border mx-1" />  // entre groupes logiques
```

Groupes dans ViewToolbar : [Aide/Nouveau/Tri/Réduire] | [FilterToolbar] [Export/Historique/Paramètres]

### Règles à ne pas violer

- **Ne jamais afficher le count deux fois** dans la même toolbar
- **Ne jamais ajouter un filtre type/statut local** si FilterToolbar est déjà présent dans la même toolbar
- `showExport` dans ViewToolbar exclut automatiquement pert/timeline/mindmap — ces vues gèrent leur propre export via `ExportDropdownButton`
- Toujours passer `filteredItemCount` pour que FilterToolbar puisse afficher `X/Y éléments` quand un filtre est actif

---

## Menu contextuel des items

### Composants

| Fichier | Rôle |
|---------|------|
| `apps/web/src/components/ui/ItemActionMenu.tsx` | Composant menu contextuel (trigger MoreVertical + dropdown portal) |
| `apps/web/src/lib/itemMenuGroups.ts` | Logique de construction des groupes d'actions |

### Architecture

`ItemActionMenu` est un composant générique qui prend `groups: ItemActionGroup[]`. Il gère :
- Positionnement via `createPortal` (évite les problèmes de z-index / overflow)
- Ouverture au hover (mouseenter/mouseleave avec délai 200ms)
- Sous-menus (hover sur l'item → sous-menu à droite, ou gauche si débordement)
- Fermeture sur Escape, scroll, clic extérieur

Le trigger par défaut est un bouton `MoreVertical` (`p-1 rounded hover:bg-accent`).

### Structure des groupes (ordre dans `buildItemMenuGroups`)

```
Groupe 1 — Ajouter    : Ajouter un enfant, Dupliquer vers...
Groupe 2 — Ouvrir     : Ouvrir, Ouvrir dans un nouvel onglet
Groupe 3 — Modifier   : Modifier, Absorber, Éclater, Fusionner
Groupe 4 — Organiser  : M'assigner, Modifier le statut (sous-menu), Déplacer vers...
Groupe 5 — Danger     : Convertir en espace, Supprimer (variant danger = rouge)
extraSections         : sections supplémentaires passées en options (ex: Export dans ListView)
```

⚠️ `canEdit = false` supprime tous les groupes sauf "Ouvrir".

### Ajouter une action au menu contextuel

```ts
// itemMenuGroups.ts — ajouter dans le bon groupe ou extraOrganise/extraChildren
{ id: 'mon-action', label: 'Mon action', icon: IconName, onClick: () => callback(itemId) }
```

Pour une action dans une vue spécifique, passer via `options.extraSections` ou `options.extraOrganise` lors de l'appel à `buildItemMenuGroups`.

### Style des items du menu

- Item normal : `w-full px-3 py-1.5 text-sm flex items-center gap-2 text-foreground hover:bg-accent`
- Item danger : `text-red-600 hover:bg-red-50 dark:hover:bg-red-950`
- Item disabled : `opacity-50 cursor-not-allowed`
- Icône : `w-4 h-4 flex-shrink-0`
- Séparateur entre groupes : `<div className="border-t my-1" />`
- Label de groupe : `px-3 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider`

---

## Export Dropdown

### Composant

`apps/web/src/components/ui/ExportDropdownButton.tsx` — bouton "Exporter" avec dropdown portal.

Style du trigger : `inline-flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-input`

Différence avec les autres boutons toolbar : ce bouton a une `border border-input` (plus visible).

Usage :
```tsx
<ExportDropdownButton
  disabled={exporting}
  groups={[
    { options: [
      { label: 'CSV (.csv)', onClick: () => exportCSV(...) },
      { label: 'Excel (.xlsx)', onClick: () => exportExcel(...) },
    ]},
    { options: [
      { label: 'PNG', onClick: () => exportPNG(...) },
    ]},
  ]}
/>
```

Groupes séparés par `<div className="h-px bg-border mx-2 my-1" />`.

---

## Menus des espaces et communautés

### Settings

- `SpaceSettingsPage.tsx` — accessible via `/spaces/:id/settings` (OWNER uniquement)
- `CommunitySettingsPage.tsx` — accessible via `/communities/:id/settings`

Bouton Paramètres dans les toolbars : icône `Settings`, visible uniquement si `spaceRole === 'OWNER'`.

### Toolbar Dashboard

`apps/web/src/components/DashboardToolbar.tsx` — toolbar spécifique au tableau de bord.

- Alignée à droite (`justify-end`)
- Contient : slot `actions` (React.ReactNode) + bouton Aide
- Pas de `ViewToolbar` — ne pas migrer vers ViewToolbar (comportement différent)

---

## Erreurs fréquentes

| Erreur | Cause | Fix |
|--------|-------|-----|
| Vue absente du menu | Pas dans `DEFAULT_MENU_ITEMS` ou accès insuffisant | Ajouter + `pnpm build:packages` |
| TS error sur `VIEW_DESCRIPTIONS` | Clé manquante dans le Record | Ajouter l'entrée |
| Icône absente (fallback List) | Icône non dans `ICONS` map de `MainMenu.tsx` | Ajouter import + entrée dans ICONS |
| Vue non rendue | Cas manquant dans SpacePage | Ajouter le ternaire |
| Dropdown Espaces ne s'ouvre pas | `spaceRenderSections` vide (accès public, items user-only) | Normal pour utilisateurs non connectés |
| Menu contextuel hors écran | Portal mal positionné | `ItemActionMenu` gère ça automatiquement — ne pas recréer un menu custom |
| Action manquante selon rôle | `canEdit` non passé | Passer `canEdit` dans `options` à `buildItemMenuGroups` |
