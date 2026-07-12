---
name: spok-menu
description: Use when adding, modifying or understanding any menu or toolbar in SPOK — navigation menu, view toolbars, contextual menus (right-click / MoreVertical on items), export dropdowns, or settings menus for spaces/communities. Triggers when a view is missing, a new view needs to be added, a toolbar button needs to be added/moved/removed, the contextual menu needs a new action, or any menu component needs changes. Always read this skill before touching menus or toolbars.
---

# spok-menu — Menus et Toolbars SPOK

## Règle absolue — documentation dans le code

**Tout fichier créé ou modifié dans cette session reçoit un commentaire en tête** :
- Raison d'être du composant/hook/utilitaire
- Props ou params clés et leur rôle
- Règles d'usage (où l'utiliser, ce qu'on ne doit pas faire)

Format : bloc `/* ... */` avant les imports. Non négociable, au même titre que le TS check.

## Architecture réelle

Il n'y a **pas de table MenuItem** en base. Le menu est défini en code par **`MENU_REGISTRY`** (`@spok/shared`), avec des overrides (visible/access) stockés en JSON dans **`AppConfig`** (clé `menu_overrides`).

```
MENU_REGISTRY (shared/constants/menuDefaults.ts, généré depuis VIEW_REGISTRY)
    + overrides AppConfig "menu_overrides" (routes/admin/menu.ts)
    ↓ GET /menu-items
useMenuItems() hook
    ↓
GlobalNavBar.tsx → bandeau de navigation (sections global/personal/admin/misc)
SpaceToolbar    → sélecteur de vues d'espace (sections basic/itemTypes/planning/exploration)
```

⚠️ **Constaté 2026-07-12** : `MainMenu.tsx` n'existe plus — remplacé par `GlobalNavBar.tsx` (bandeau, map d'icônes `NAV_ICONS`, masquage par mode d'interface via `MODE_GLOBAL_EXCLUDED`). Les sections d'espace (`basic`/`itemTypes`/`planning`/`exploration`) sont rendues par SpaceToolbar, plus par le menu. Les mentions `MainMenu.tsx` plus bas dans cette skill (structure `__espaces__`, dropdown multi-colonnes) décrivent l'ancienne architecture — à vérifier contre le code avant usage.

⚠️ `ViewModeSelector.tsx` existe mais est **inutilisé**. Ne pas toucher.
⚠️ `viewDefaults.ts` / `useViewConfig()` / `AppConfig` sont un système **parallèle et séparé** — il sert au composant ViewModeSelector qui n'est pas rendu.

## Fichiers clés

| Rôle | Fichier |
|------|---------|
| Items de menu par défaut | `packages/shared/src/constants/menuDefaults.ts` |
| Types MenuItem | `packages/shared/src/types/menuItem.ts` |
| Rendu du menu principal | `apps/web/src/components/GlobalNavBar.tsx` (icônes : map `NAV_ICONS`) |
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
// packages/shared/src/constants/menuDefaults.ts (MENU_REGISTRY) — ou viewRegistry.ts si c'est une vue
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

**Via le code** : modifier `MENU_REGISTRY` dans `menuDefaults.ts` (ou `VIEW_REGISTRY` dans `viewRegistry.ts` pour les vues). S'applique partout, sauf si un override AppConfig `menu_overrides` (posé via /admin/menu) écrase visible/access pour cette clé.

---

## Standards des toolbars de vue

### Architecture globale — DÉCISION 2026-06-13

`SpaceToolbar` est divisée en deux sections de code distinctes. Chaque vue a un `ViewHeader` dans sa propre zone de contenu.

```
SpacePage
├── SpaceToolbar
│   ├── #view-selector   — sélecteur de vue
│   └── #global-toolbar  — toujours visible, toutes les vues
└── <VueActive>
    ├── #view-header     — header de contenu, contrôles vue-spécifiques uniquement
    └── <contenu>
```

#### `#global-toolbar` — ordre gauche→droite

```
[Filtre: Types|Statuts|Recherche]  [Highlight: Types|Statuts|Recherche]  [Position | A→Z à plat | A→Z par groupe]  → flex-1 ←  [Count] [Export] [Historique] [Paramètres]
```

| Zone | Contenu | Comportement |
|------|---------|--------------|
| **Filtre** | Types · Statuts · Barre de recherche | Réduit la liste d'items |
| **Highlight** | Types · Statuts · Barre de recherche | Dim/highlight sans filtrer |
| **Ordre** | 3 boutons inline : Position \| A→Z à plat \| A→Z par groupe | Pas de dropdown |
| Spacer | `<div className="flex-1" />` | |
| **Droite** | Count · Historique · Paramètres | Dans cet ordre |

- Filtre et Highlight : **discrets** si vide, **foncés** si critère actif
- Ordre : bouton actif = foncé
- **Pas de bouton "Lumière"** — Filtre et Highlight sont deux blocs permanents et distincts
- Les états (filter, highlight, ordre) sont dans `SpacePage`, pas dans les vues

#### `#view-header` — header de chaque vue

Deux zones :

```
[Nouveau] [boutons spécifiques vue]   →flex-1→   [Légende?] [Aide] [Export]
```

| Zone | Bouton | Présence | Notes |
|------|--------|----------|-------|
| Gauche | **Nouveau** | Vues éditables | Crée un item dans le contexte de la vue |
| Gauche | **Boutons vue** | Spécifiques | ex: collapse MindMap, hide-deferred Gantt, zoom PERT… |
| Droite | **Légende** | Optionnel | Uniquement si la vue a une légende (PERT, MindMap, Timeline…) |
| Droite | **Aide** | Toutes les vues | Ouvre le tour / tooltip d'aide |
| Droite | **Export** | Toutes les vues | Formats spécifiques à la vue (CSV, Excel, SVG, PNG…) |

- **Ne contient jamais** : Types, Statuts, Recherche, Lumière, Ordre, Count, Historique, Paramètres — tout ça est dans `#global-toolbar`

### Style des boutons d'état actif/inactif

- **Inactif (aucun critère)** : `text-muted-foreground hover:bg-accent hover:text-foreground`
- **Actif (critère appliqué)** : `bg-accent text-foreground font-semibold`

### Style des boutons de toolbar

```
className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
```

- Bouton **Nouveau** : `bg-secondary text-secondary-foreground hover:bg-secondary/80`
- Boutons icône seule (Historique, Paramètres) : `h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`
- Icônes : `w-3.5 h-3.5` pour les boutons texte, `w-4 h-4` pour les boutons icône seule
- Labels : `<span className="hidden sm:inline">Label</span>` pour masquer sur mobile

### Séparateurs

```tsx
<div className="h-4 w-px bg-border mx-1" />  // entre groupes logiques
```

### ViewHeader — structure type

```tsx
<div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0" id="view-header">
  {/* boutons SPÉCIFIQUES à cette vue uniquement */}
</div>
```

### Règles absolues

- **Ne jamais dupliquer** Filtre, Highlight ou Ordre dans un `#view-header`
- **Ne jamais afficher le count deux fois**
- Si un filtre est actif et qu'on change de vue, il reste visible dans `#global-toolbar`

### Composants legacy (ne plus utiliser pour nouveaux développements)

- `ViewToolbar` — remplacé par `#global-toolbar` dans `SpaceToolbar`
- `FilterToolbar` — remplacé par les blocs Filtre/Highlight dans `#global-toolbar`
- `TreeSortButton` (dropdown) — remplacé par les 3 boutons inline Ordre dans `#global-toolbar`
- Bouton "Lumière" — supprimé

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
