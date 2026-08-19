---
name: spok-layout
description: Use when adding, modifying or understanding the global app shell — sidebar (espaces/communautés), top header, GlobalNavBar (bandeau de navigation globale), or responsive/mobile layout behavior. Triggers when a bug touches the sidebar, the header, dropdown z-index/clipping, sidebar width/collapse, mobile slide-over, or when "MainMenu"/"Sidebar.tsx" are mentioned (renamed files, see below). Always read this skill before touching Layout.tsx or GlobalNavBar.tsx.
---

# spok-layout — Sidebar, header et navigation globale

## Fichiers réels (les noms historiques ont changé)

`MainMenu.tsx` et `Sidebar.tsx` **n'existent plus**. Toute doc/mémoire qui les cite encore est obsolète :

| Rôle | Fichier réel |
|------|--------------|
| Layout racine (sidebar + header + `<Outlet/>`) | `apps/web/src/components/Layout.tsx` (~1300 lignes) |
| Bandeau de navigation globale (row 2 du header, desktop uniquement) | `apps/web/src/components/GlobalNavBar.tsx` |
⚠️ **`AdminLayout.tsx` existe toujours sur disque mais n'est plus utilisé** (vérifié dans `App.tsx` : commentaire *"AdminLayout removed — admin pages now inside main Layout"*, aucun import actif). Les pages `/admin/*` sont rendues dans le `Layout.tsx` principal comme le reste de l'app — ne pas supposer qu'un fix sur `Layout.tsx`/`GlobalNavBar.tsx` doit être reporté manuellement sur `AdminLayout.tsx` : ce fichier est mort, à confirmer avant suppression plutôt qu'à maintenir en double.

## Décisions de design à préserver (régressions passées)

Ces deux refontes ont explicitement remplacé des patterns identifiés comme sources de bugs récurrents. Ne pas revenir en arrière sans le savoir :

- **GlobalNavBar — commit `518657a`** : remplace l'ancien `MainMenu.tsx` (dropdowns/hamburger/panneaux expand) par un bandeau plein hauteur de boutons plats, message de commit explicite : *« Suppression logique hamburger/dropdowns/expanded (source de régression) »*. → **Ne jamais réintroduire de dropdown/hamburger pour la nav globale.**
- **Sidebar — commit `9088d3e`** : style Notion/Linear — logo toujours visible (même en mode communauté immersif), titres de section sans majuscules forcées, en-têtes de communauté sans bordure (icône réglages seulement au hover), padding compact, séparateurs `/50` discrets, communautés repliées par défaut avec auto-expand/collapse sur navigation. → **Ne pas réintroduire de bordures autour des lignes d'espace, ni un auto-expand-all des communautés.**
  - ⚠️ **Fond sidebar changé le 2026-08-19** (refonte esthétique "Dense technique", décision explicite de Thomas, pas une régression) : le fond blanc d'origine de ce commit a été remplacé par `bg-muted` — voir "Fond chrome (sidebar/header/toolbar)" ci-dessous. Les autres points de ce commit (pas de bordures, pas d'auto-expand-all, logo visible) restent valables tels quels.

## Sidebar (Layout.tsx) — 3 mécanismes de collapse indépendants, ne pas les confondre

1. **`sidebarCollapsed`** (bool, `localStorage['spok-sidebar-collapsed']`) — masque tout le panneau (`md:w-0 md:overflow-hidden md:border-r-0`). Toggle via le bouton flottant.
2. **`sidebarWidth`** (nombre, clampé `[160, 400]`, `localStorage['spok-sidebar-width']`, défaut 208) — largeur redimensionnable par drag sur le handle (`w-1 cursor-col-resize`).
3. **`sidebarOpen`** (bool, non persisté) — slide-over mobile uniquement, fermé automatiquement à chaque navigation.

Séparément : `expandedSpaceIds` / `expandedCommunityIds` (Set persistés) pour le pliage par nœud de l'arbre.

⚠️ **Piège vécu (`e58ee08`)** : `sidebarWidth` et la largeur réelle de l'`<aside>` doivent rester la seule source de vérité. Le bouton de toggle flottant se positionne via `left: sidebarWidth - 12` — toute contrainte `max-width` concurrente sur desktop (ex. `max-w-[320px]` sans préfixe `md:`) désynchronise le bouton de la bordure réelle de la sidebar dès que `sidebarWidth` dépasse cette limite. Toujours utiliser `md:max-w-none` pour lever le plafond mobile sur desktop.

## Responsive — CSS only, jamais de JS layoutMode

Toute la logique responsive passe par les classes Tailwind `md:` — **aucun hook de mesure de largeur, aucun `layoutMode` calculé en JS**. Ne pas en introduire.

- Sidebar mobile : `fixed md:relative`, `w-[85vw] max-w-[320px] md:max-w-none`, slide via `translate-x-0`/`-translate-x-full`, toujours `md:translate-x-0` sur desktop.
- Overlay mobile : `fixed inset-0 bg-black/50 z-40 md:hidden`.
- `GlobalNavBar` : `hidden md:flex` — **invisible sur mobile**, remplacé par une grille d'icônes de nav rapide intégrée à la sidebar mobile (`md:hidden`, 4 colonnes).
- Hamburger (`md:hidden`) et bouton fermeture (X, `md:hidden`) : mobile uniquement.

## Z-index / stacking context — zone la plus fragile du fichier

Le commentaire en tête de `Layout.tsx` porte déjà l'invariant le plus critique : **pas de `overflow-hidden` sur la row 1 du header** — ça clippe les dropdowns absolus (NotificationBell, GlobalSearch). Régression vécue et corrigée par `2e703f0`.

Piles de contexte actuelles (ne pas modifier sans comprendre l'empilement complet) :
- Overlay mobile : `z-40`
- `<aside>` : `fixed md:relative z-50 md:z-auto`
- Bouton toggle flottant : `fixed z-30`
- `<header>` : `relative z-30` (ajouté par `630ac21` — sans ça, le header perd sa priorité d'empilement quand un ancêtre est `overflow-auto`, du contenu de page peut passer devant)
- Row 1 du header (titre) : `relative isolate` + image de cover `-z-10` (calé par `015eb92` — **`isolate` piège les enfants dans un nouveau stacking context : un dropdown absolu à l'intérieur peut se faire passer devant par un sibling avec son propre z-index**, piège récurrent sur ce fichier)

## Fond chrome (sidebar/header/toolbar) — refonte esthétique 2026-08-19

Piste "Dense technique" choisie par Thomas via mockups Claude Design : la "chrome" de l'app (sidebar + header + `SpaceToolbar`) doit visuellement se distinguer du contenu (blanc/quasi-noir).

- `<aside>` (Layout.tsx) et `<header>` (Layout.tsx) : `bg-muted`, **sans variante `dark:`** — laisser la cascade CSS faire le travail via `--muted` qui est déjà défini différemment dans `:root` et `.dark` (`index.css`). Ne pas réintroduire un `dark:bg-background` sur l'`<aside>` : ça désassortit la sidebar du header en mode sombre (vécu le 2026-08-19, corrigé).
- `SpaceToolbar.tsx` (conteneur racine) : `bg-muted/60`, même logique.
- Le corps de page/contenu (`bg-background`) reste plus clair (clair) / plus sombre (sombre) que `--muted` dans les deux thèmes — c'est ce contraste qui crée la distinction chrome/contenu. Si un futur ajustement de palette change `--muted` ou `--background`, vérifier les DEUX thèmes (le mode par défaut suit `prefers-color-scheme`, donc un simple rechargement peut faire basculer le thème testé sans qu'on s'en aperçoive — forcer explicitement la classe `dark` sur `<html>` pour comparer, ne pas se fier à l'état "tel que chargé").
- Police globale : `IBM Plex Sans` (UI, `font-sans`) + `IBM Plex Mono` (métadonnées/badges, `font-mono`) — chargées via Google Fonts dans `index.html`, déclarées dans `tailwind.config.js` (`theme.extend.fontFamily`). `--radius` réduit à `0.25rem` (coins plus nets, cohérent avec la piste dense).

## Autres invariants vécus

- **Logo** : importé depuis `src/assets/logo.png` (pas `public/`) — `834ae71` a déplacé le fichier pour que Vite hash le nom au build et invalide le cache navigateur au déploiement. Ne pas repasser par `/public`.
- **Chargement sidebar** : requêtes espaces/communautés en `staleTime: Infinity`, **pas de `refetchInterval`, pas de refetch keyé sur `location.pathname`** — `619205a` a supprimé un polling 30s + un refetch à chaque navigation qui entraient en course et faisaient flickerer la liste. Les mutations invalident déjà les queries au bon endroit ; ne pas réintroduire de polling ou de refetch sur navigation.
- **`NAV_ICONS`** : deux maps *dupliquées indépendamment* (une dans `Layout.tsx`, une dans `GlobalNavBar.tsx`) — pas de source commune. Ajouter une icône des deux côtés si elle doit apparaître dans les deux endroits (menu sidebar mobile + bandeau desktop).
- **`SidebarDropContext`** (exporté par `Layout.tsx`) : contexte React pour le drag & drop item→espace, consommé par `SpaceTreeItem`. D'autres vues posent `dataTransfer` avec le type `application/x-spok-item` pour interopérer — ne pas renommer ce type MIME sans grep global.

## GlobalNavBar — logique de filtrage

`GlobalNavBar` affiche les sections de `useMenuItems()` **hors** :
- `SPACE_SECTIONS` (`basic`, `itemTypes`, `planning`, `exploration`) — rendues par `SpaceToolbar`, pas ici
- `admin` — rendu dans le pied de sidebar (`Layout.tsx`), gated par `useAdminMode()`
- `EXCLUDED_KEYS` (`profile`) — géré par l'avatar/modale du header
- `MODE_GLOBAL_EXCLUDED[interfaceMode]` — masque certains items selon le mode d'interface actif (forum/projet/exploration/tous)

Une section qui n'a plus aucun item après filtrage ne rend rien (`return null`).

## Erreurs fréquentes

| Symptôme | Cause probable | Fix |
|----------|-----------------|-----|
| Dropdown (notifications, recherche) invisible ou non cliquable | `overflow-hidden` réintroduit sur la row 1 du header | Retirer — la cover image utilise déjà `absolute inset-0`, ne déborde pas |
| Dropdown passe derrière `SpaceToolbar` | Stacking context `isolate` sur row 1 mal géré avec le z-index de la cover image | Vérifier `isolate` + `-z-10` sur la cover, cf. `015eb92` |
| Bouton toggle sidebar mal aligné passé une certaine largeur | `max-w-[...]` sans préfixe `md:` sur l'`<aside>` | Utiliser `md:max-w-none` |
| Sidebar qui flickers / liste d'espaces qui se recharge sans raison | Polling ou refetch keyé sur la route réintroduit | `staleTime: Infinity`, compter sur l'invalidation des mutations |
| Icône absente dans un seul des deux emplacements (sidebar mobile vs bandeau desktop) | `NAV_ICONS` mis à jour d'un seul côté | Ajouter l'entrée dans les deux maps (`Layout.tsx` ET `GlobalNavBar.tsx`) |
| Fix appliqué à Layout/GlobalNavBar ne s'applique pas à `/admin/*` | `AdminLayout.tsx` est indépendant, ne partage aucune logique | Reporter le fix manuellement si le même bug s'y produit |
| Sidebar et header pas assortis en mode sombre alors qu'ils le sont en clair | Classe `dark:` explicite sur un seul des deux éléments qui override la cascade normale | Retirer les overrides `dark:` ponctuels sur `bg-*`, laisser `--muted`/`--background` (`index.css`) porter la différence entre thèmes |
