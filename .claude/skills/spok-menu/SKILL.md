---
name: spok-menu
description: Use when adding, modifying or understanding the view menu in SPOK spaces. Triggers when a view is missing, a new view needs to be added, or the menu structure needs to change.
---

# spok-menu — Système de menu des vues SPOK

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

## Erreurs fréquentes

| Erreur | Cause | Fix |
|--------|-------|-----|
| Vue absente du menu | Pas dans `DEFAULT_MENU_ITEMS` ou accès insuffisant | Ajouter + `pnpm build:packages` |
| TS error sur `VIEW_DESCRIPTIONS` | Clé manquante dans le Record | Ajouter l'entrée |
| Icône absente (fallback List) | Icône non dans `ICONS` map de `MainMenu.tsx` | Ajouter import + entrée dans ICONS |
| Vue non rendue | Cas manquant dans SpacePage | Ajouter le ternaire |
| Dropdown Espaces ne s'ouvre pas | `spaceRenderSections` vide (accès public, items user-only) | Normal pour utilisateurs non connectés |
