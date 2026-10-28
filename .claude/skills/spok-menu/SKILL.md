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

⚠️ Supprimés le 2026-10-21 : `ViewModeSelector.tsx`, `useViewConfig`, `useGlobalPages`, `viewDefaults.ts`, `types/viewConfig.ts` et les routes `/config/*` et `/admin/config/*` (système parallèle qu'aucun écran ne lisait). Ne pas les réintroduire : la seule configuration du menu est `MENU_REGISTRY` + `menu_overrides`.

## Fichiers clés

| Rôle | Fichier |
|------|---------|
| Items de menu par défaut | `packages/shared/src/constants/menuDefaults.ts` |
| Types MenuItem | `packages/shared/src/types/menuItem.ts` |
| Rendu du menu principal | `apps/web/src/components/GlobalNavBar.tsx` (icônes : map `NAV_ICONS`) |
| Hook de chargement | `apps/web/src/hooks/useMenuItems.ts` |
| Rendu de la vue dans l'espace | `apps/web/src/pages/SpacePage.tsx` |
| Type `ViewMode` | `apps/web/src/stores/viewMode.ts` |
| Aide utilisateur des vues (fiche + tour) | `apps/web/src/components/views/help/<vue>.help.ts` (+ `help/`) |
| Aide utilisateur des pages et modales | `apps/web/src/pages/help/<page>.help.ts`, `components/help/<modale>.help.ts`, registre `help/pageHelp.ts` |
| Infobulles de la barre d'espace | `apps/web/src/help/spaceToolbar.hints.ts` (lues par `HelpHint`) |

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

### 3. Web — fiche d'aide utilisateur de la vue (OBLIGATOIRE)

`viewDescriptions.ts` et `viewTours.ts` n'existent plus (2026-10-14) : l'aide d'une vue est UNE fiche
`apps/web/src/components/views/help/ma-vue.help.ts` (type `HelpEntry`, `help/types.ts`) — titre, résumé,
conseils, tour guidé — enregistrée dans `components/views/help/index.ts` (`VIEW_HELP`, Record strict).

```ts
import type { HelpEntry } from '../../../help/types';
import { ITEM_MENU_STEP, SPACE_TOOLBAR_STEPS } from '../../../help/commonTourSteps';
export const help: HelpEntry = {
  title: 'Ma Vue', summary: 'À quoi elle sert.', tips: ['Geste 1', 'Geste 2'],
  tour: [ { popover: { title: 'Vue Ma Vue', description: '…' } },
          { element: '[data-tour="ma-vue-xxx"]', popover: { title: '…', description: '…', side: 'bottom' } },
          ...ITEM_MENU_STEP, ...SPACE_TOOLBAR_STEPS ],
};
```

Modèle de tour : intro → chaque commande propre à la vue (repère `data-tour` posé sur le bouton) → un élément du
contenu → ses gestes → barre commune (étapes partagées). `help/coverage.test.ts` échoue si la fiche manque ;
ajouter la vue à `FULL_TOUR_VIEWS` (≥ 5 étapes dont 3 pointées). Le bouton « ? » : `ViewHelpButton`, à droite du
`#view-header` (avant Export). Champ `empty` obligatoire (état vide affiché par `EmptyHelp`). Mode Aide : poser au
moins 2 zones `data-help-zone="<vue>:<zone>"` sur des éléments existants de la vue (conteneur, colonne, carte, panneau…)
et leurs textes dans le champ `zones` de la fiche — contrôlé par coverage.test (aucun texte orphelin).

**Page ou modale** (même principe, couche 3 du skill `spok-doc`) : fiche `pages/help/<page>.help.ts` ou
`components/help/<modale>.help.ts`, clé ajoutée à `PAGE_HELP` (`help/pageHelp.ts`), puis une ligne dans l'en-tête,
à droite du titre : `<PageHelpButton pageKey="<page>" />` — jamais `HelpButton` directement ni de bouton maison.
Tour d'une page : ≥ 2 étapes pointées (coverage.test). Ne pas poser le « ? » sur un panneau flottant de la page
(cas du graphe global : panneau en haut à droite → « ? » en haut à gauche). Aide d'un champ : clé dans `fields`
de la fiche + `<FieldHelp page="<page>" field="<clé>" />` sous le champ.

**Infobulle d'une commande de barre** : texte dans la fiche (`hints`) ou `help/spaceToolbar.hints.ts`, rendu par
`<HelpHint text={…}>` autour du bouton — pas de `title` natif en plus ; un bouton à icône seule garde son
`aria-label`. Un `Link` qui habille un `Button` porte l'`aria-label`, le bouton passe en `tabIndex={-1}` (un seul
arrêt clavier).

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

**Via l'admin UI** : `/admin/views` (ViewsConfigPage, menu Administration › Vues) — visible / accès (Tous, Connectés, Admins) de chaque page globale et vue d'espace, enregistré en surcharges `menu_overrides` (`GET /admin/menu`, `PUT /admin/menu/overrides`, seules les différences avec le code sont stockées ; section admin non modifiable). Libellé, icône, ordre et section restent dans le code.

**Via le code** : modifier `MENU_REGISTRY` dans `menuDefaults.ts` (ou `VIEW_REGISTRY` dans `viewRegistry.ts` pour les vues). S'applique partout, sauf si un override AppConfig `menu_overrides` (posé via /admin/views) écrase visible/access pour cette clé.

---

## Standards des toolbars de vue

### Architecture globale — DÉCISION 2026-06-13

`SpaceToolbar` est divisée en deux sections de code distinctes. Chaque vue a un `ViewHeader` dans sa propre zone de contenu.

```
SpacePage
├── SpaceToolbar
│   ├── #view-selector   — sélecteur de vue
│   ├── #global-toolbar  — toujours visible, toutes les vues
│   └── liveSessionBarSlot — 3e ligne, espace de séance uniquement : LiveSessionBar fourni par SpacePage
│                            (décision Thomas 2026-10-11 : dans la toolbar, jamais entre la toolbar et la vue)
└── <VueActive>
    ├── #view-header     — header de contenu, contrôles vue-spécifiques uniquement
    └── <contenu>
```

#### `#global-toolbar` — ordre gauche→droite

```
[Filtre: Types|Statuts|Recherche]  [Highlight: Types|Statuts|Recherche]  [Position | A→Z à plat | A→Z par groupe]  → flex-1 ←  [+ Nouveau] [Modèle] [Séances] [Count] [Historique] [Paramètres]
```

⚠️ **Décision Thomas 2026-10-28** : « Nouveau » et « Modèle » (insérer un modèle) sont dans `toolbar-actions` (SpaceToolbar),
en tête, **une seule fois pour toutes les vues**, tous deux bleus. Ils ne sont plus dans `#view-header` (remplace la
décision 2026-06-13). Toutes les vues créaient de toute façon avec la même action (`handleNewItem` de SpacePage).

| Zone | Contenu | Comportement |
|------|---------|--------------|
| **Filtre** | Types · Statuts · Barre de recherche | Réduit la liste d'items |
| **Highlight** | Types · Statuts · Barre de recherche | Dim/highlight sans filtrer |
| **Ordre** | 3 boutons inline : Position \| A→Z à plat \| A→Z par groupe | Pas de dropdown |
| Spacer | `<div className="flex-1" />` | |
| **Droite** | Nouveau · Modèle · Séances · Count · Historique · Paramètres | Dans cet ordre ; Nouveau / Modèle si `canEdit` |

- Filtre et Highlight : **discrets** si vide, **foncés** si critère actif
- Ordre : bouton actif = foncé
- **Pas de bouton "Lumière"** — Filtre et Highlight sont deux blocs permanents et distincts
- Les états (filter, highlight, ordre) sont dans `SpacePage`, pas dans les vues

#### `#view-header` — header de chaque vue

Deux zones :

```
[boutons spécifiques vue]   →flex-1→   [Légende?] [Aide] [Export]
```

| Zone | Bouton | Présence | Notes |
|------|--------|----------|-------|
| Gauche | **Boutons vue** | Spécifiques | ex: collapse MindMap, hide-deferred Gantt, zoom PERT… |
| Droite | **Légende** | Optionnel | Uniquement si la vue a une légende (PERT, MindMap, Timeline…) |
| Droite | **Aide** | Toutes les vues | Ouvre le tour / tooltip d'aide |
| Droite | **Export** | Toutes les vues | Formats spécifiques à la vue (CSV, Excel, SVG, PNG…) |

- **Ne contient jamais** : Nouveau, Modèle, Types, Statuts, Recherche, Lumière, Ordre, Count, Historique, Paramètres — tout ça est dans `#global-toolbar`

### Style des boutons d'état actif/inactif

- **Inactif (aucun critère)** : `text-muted-foreground hover:bg-accent hover:text-foreground`
- **Actif (critère appliqué)** : `bg-accent text-foreground font-semibold`

### Style des boutons de toolbar

```
className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
```

- Boutons **Nouveau** et **Modèle** : composants partagés `components/ui/NewItemButton.tsx` et `InsertTemplateButton.tsx`, même bleu (`PRIMARY_ACTION_CLASS`, décisions Thomas 2026-09-28 et 2026-10-28), rendus uniquement par `SpaceToolbar` — ne jamais les remettre dans une vue ni recopier leurs classes
- Boutons icône seule (Historique, Paramètres) : `h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors`
- Icônes : `w-3.5 h-3.5` pour les boutons texte, `w-4 h-4` pour les boutons icône seule
- Labels : `<span className="hidden sm:inline">Label</span>` pour masquer sur mobile

### Séparateurs

```tsx
<div className="h-4 w-px bg-border mx-1" />  // entre groupes logiques
```

### ViewHeader — structure type

```tsx
<div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0" id="view-header" data-devzone="contenu-barre-vue">
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

## Focus des modales — RÈGLE 2026-09-28

Socle : `hooks/useDialogFocus.ts` — appliqué par `ui/Modal.tsx` ; toute modale faite main (overlay `fixed inset-0`) l'appelle sur son panneau : `useDialogFocus(panelRef, isOpen)` + `ref` et `outline-none` sur le panneau. Tab piégé (modale du dessus seulement), focus rendu à l'élément d'origine à la fermeture.

Focus à l'ouverture :
| Cas | Cible |
|-----|-------|
| Création (item sans titre, espace, modèle…) | premier champ (`autoFocus`) |
| Item existant | le panneau (rien de modifiable par une frappe) |
| Recherche / sélection (Déplacer, Dupliquer, Fusionner…) | champ de recherche (`autoFocus`) |
| Confirmation destructive (suppression, quitter sans enregistrer, restauration d'audit) | **Annuler** (`data-autofocus`) |
| Confirmation non destructive (cascade, propagation de statut) | action principale (`data-autofocus`) |
| Conflit de modification | le panneau (aucun choix pré-sélectionné) |

`ConfirmModal` choisit seul : Annuler si `confirmVariant='destructive'` (défaut), sinon l'action. Focus visible : règle `:focus-visible` globale dans `index.css` — ne pas la neutraliser.

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
| TS error sur `VIEW_HELP` / test coverage rouge | Fiche d'aide manquante | Créer `components/views/help/<vue>.help.ts` + l'enregistrer dans l'index |
| Icône absente (fallback List) | Icône non dans `ICONS` map de `MainMenu.tsx` | Ajouter import + entrée dans ICONS |
| Vue non rendue | Cas manquant dans SpacePage | Ajouter le ternaire |
| Dropdown Espaces ne s'ouvre pas | `spaceRenderSections` vide (accès public, items user-only) | Normal pour utilisateurs non connectés |
| Menu contextuel hors écran | Portal mal positionné | `ItemActionMenu` gère ça automatiquement — ne pas recréer un menu custom |
| Action manquante selon rôle | `canEdit` non passé | Passer `canEdit` dans `options` à `buildItemMenuGroups` |
