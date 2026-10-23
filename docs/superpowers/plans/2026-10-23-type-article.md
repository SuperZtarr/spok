# Type d'élément « Article » — plan de mise en œuvre

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un nouveau type d'élément ARTICLE qui présente, en une page continue et mise en page, des éléments existants (notes, images, schémas, liens) qu'il référence.

**Architecture:** L'article est un Item de type ARTICLE ; ses blocs sont des lignes d'une nouvelle table `article_blocks` (référence ordonnée vers un Item + réglages de mise en page + auteur de la référence). L'API résout les blocs à la lecture en appliquant les droits de la personne qui a ajouté chaque référence ; le web affiche une page de lecture `/spaces/:spaceId/articles/:itemId` avec un mode édition (réordonner, régler, ajouter, retirer, écrire).

**Tech Stack:** Prisma (PostgreSQL, `db push`), Fastify + zod, React + TanStack Query + @dnd-kit/sortable, Tailwind, Vitest.

**Spec:** description validée par Thomas en chat le 2026-10-23 (pas de fichier spec — préférence « no-spec-docs ») ; résumé repris ci-dessous dans « Exigences ».

## Exigences (spec validée)

- Type ARTICLE : élément SPOK normal (statut, dates, tags, contributions, relations). Sa description sert de chapeau.
- Composition : liste ordonnée de **références** vers des éléments existants, qui restent où ils sont ; un même élément peut être dans plusieurs articles. « Ajouter un texte » crée une NOTE dans l'espace de l'article et l'insère. Réordonner (glisser), retirer une référence sans supprimer l'élément.
- Mise en page « flux de blocs » : largeur `full` | `wide` | `medium` ; pour IMAGE et DIAGRAM, position `center` | `left` | `right` (gauche / droite = habillage par le texte suivant). Structure extensible aux colonnes plus tard.
- Note : texte modifiable directement dans l'article ; autres blocs : ouverture de leur fiche.
- Lecture : page continue, propre à l'écran, sur mobile et à l'impression / PDF.
- Droits : l'auteur référence tout élément qu'il peut lire (tous espaces / communautés) ; le lecteur de l'article voit le contenu des blocs **sans accès à l'élément source** (ni fiche, ni contributions, ni relations, sauf s'il y a accès par ailleurs) ; le droit est évalué **à la lecture**, sur la personne qui a ajouté la référence — perdu → « contenu indisponible » ; à l'ajout d'un élément **moins visible** que l'article → avertissement (pas d'interdiction).
- Hors périmètre : colonnes, zone libre, modèles d'article, outils MCP de blocs.

## Global Constraints

- Aucun commit ni push pendant l'exécution : Thomas les demande (« commit et push » → skill spok-deploy, un commit par fonctionnalité). Les étapes « Vérifier » remplacent les commits.
- Toute modification de code passe par la skill `spok-dev` ; tout fichier créé ou modifié reçoit un en-tête `/* ... */` (raison d'être, params clés, règles d'usage) ; règle de gestion → `apps/web/src/lib/businessRules.ts`.
- Vérifications pendant le dev : test du fichier touché + typecheck du seul paquet touché (`cd apps/web && npx tsc --noEmit -p .`, `cd apps/api && npx tsc --noEmit -p .`). Tests API depuis la racine : `pnpm exec vitest run --project api <fichier>` ; web : `pnpm exec vitest run --project web <fichier>`. TNR complète et typecheck des 5 paquets : seulement à la MEP.
- Après tout changement de `packages/shared` ou du schéma : `pnpm build:packages`, `pnpm db:generate`, `pnpm db:push` (base locale uniquement, port 25432).
- Libellés : type « Articles » / « Article » (court « Art »), couleur `border-teal-400` / `bg-teal-50`, icône lucide `Newspaper`.
- Valeurs de mise en page exactes : largeurs `full` `wide` `medium`, positions `center` `left` `right` ; défauts `full` + `center`.
- Textes visibles en français, lus depuis la fiche d'aide (jamais en dur dans les composants), cf. skill spok-doc couche 3.

## Review Focus

1. **Contenu d'un bloc dont l'auteur de la référence a perdu l'accès** : la réponse JSON ne doit contenir ni titre ni description ni url (pas seulement masqués à l'écran) → test Task 3 `unavailable block leaks nothing`.
2. **Lecteur anonyme d'un article public référençant un élément privé** : il voit le contenu, mais `canOpen=false` et aucun identifiant d'espace source n'est renvoyé → test Task 3 `anonymous reader sees content without source access`.
3. **Communauté aux référentiels personnalisés (enregistrés avant ARTICLE)** : le type doit apparaître quand même (fusion avec les défauts) → test Task 1 `custom referentiels get ARTICLE from defaults`.
4. **Référencer un ARTICLE (dont lui-même)** : refus 400, pas d'imbrication ni de cycle → test Task 4 `rejects article references`.
5. **Même élément ajouté deux fois au même article** : refus 409 → test Task 4 `rejects duplicate reference`.

---

### Task 1: Type ARTICLE dans tout le système

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (enum ItemType, après `DIAGRAM`)
- Modify: `packages/shared/src/types/item.ts:7`, `packages/shared/src/constants/index.ts` (liste des types), `packages/shared/src/constants/defaultReferentiels.ts` (entrée `ARTICLE`, `order: 11`)
- Modify: `apps/api/src/routes/items.ts:43,59,78` (3 `z.enum`), `packages/mcp-core/src/tools.ts:28`, `packages/mcp-core/src/instructions.ts:11` (« ARTICLE (assemble des éléments existants en une page ; ses blocs ne se gèrent pas par MCP) »)
- Modify: `apps/web/src/constants/ui.ts` (TYPE_ICONS `Newspaper`, labels ×2, groupe `deliverables`, filtre de type)
- Create: `apps/api/src/utils/referentiels.ts` — `withDefaultTypeLabels`
- Modify: `apps/api/src/routes/referentiels.ts`, `apps/api/src/routes/community-referentiels.ts` (lecture) : appliquer `withDefaultTypeLabels`
- Test: `apps/api/src/utils/referentiels.test.ts`

**Interfaces:**
- Produces: `ItemType` inclut `'ARTICLE'` ; `withDefaultTypeLabels(r: SpaceReferentiels): SpaceReferentiels` (ajoute chaque type par défaut absent de `r.typeLabels`, ne modifie jamais un type présent).

- [ ] **Step 1: Test `custom referentiels get ARTICLE from defaults`** — `withDefaultTypeLabels({ statuses: [...], typeLabels: { NOTE: {...label:'Idées'} } })` → `typeLabels.ARTICLE` égal à `DEFAULT_TYPE_LABELS.ARTICLE` et `typeLabels.NOTE.label === 'Idées'`.
- [ ] **Step 2: Lancer le test** — `pnpm exec vitest run --project api apps/api/src/utils/referentiels.test.ts` → FAIL (module absent).
- [ ] **Step 3: Implémenter** l'ajout du type partout (liste ci-dessus) et `withDefaultTypeLabels`, branché sur les deux lectures de référentiels.
- [ ] **Step 4: Régénérer et vérifier** — `pnpm build:packages && pnpm db:generate && pnpm db:push` ; test → PASS ; typecheck api et web OK ; dans l'appli locale, créer un élément de type Article depuis « Nouveau » (communauté Test SPOK).

### Task 2: Table des blocs et règle « moins visible »

**Files:**
- Modify: `packages/database/prisma/schema.prisma` — modèle `ArticleBlock` (`@@map("article_blocks")`) + relations inverses sur `Item` (`articleBlocks`, `referencedIn`) et `User` (`articleBlocksAdded`)
- Create: `apps/api/src/utils/articleVisibility.ts`
- Create: `packages/shared/src/types/article.ts` (+ export dans l'index des types)
- Test: `apps/api/src/utils/articleVisibility.test.ts`

**Interfaces:**
- Produces (schéma) : `ArticleBlock { id cuid, articleId → Item (onDelete Cascade), itemId → Item (onDelete Cascade), position Int, width String @default("full"), align String @default("center"), addedById String? → User (onDelete SetNull), createdAt }`, `@@unique([articleId, itemId])`, `@@index([itemId])`.
- Produces (shared) : `ArticleBlockWidth = 'full' | 'wide' | 'medium'`, `ArticleBlockAlign = 'center' | 'left' | 'right'`, `ArticleBlockView = { id: string; position: number; width: ArticleBlockWidth; align: ArticleBlockAlign; available: boolean; item: null | { id: string; type: ItemType; title: string; description: string | null; url: string | null; canOpen: boolean; canEdit: boolean; spaceId: string | null } }` (`spaceId` non nul seulement si `canOpen`), `ArticleView = { articleId: string; blocks: ArticleBlockView[]; canEditArticle: boolean }`.
- Produces (api) : `type VisibilityInfo = { spaceId: string; visibility: string; communityId: string | null; communityVisibility: string | null }` ; `isLessVisible(article: VisibilityInfo, ref: VisibilityInfo): boolean`.

Règle `isLessVisible` (portée : 0 = espace privé, 1 = membres de la communauté seulement — espace non privé dans une communauté privée, 2 = public — espace non privé dans une communauté non privée) : vrai si `portée(ref) < portée(article)`, ou si les deux ont la portée 1 dans des communautés différentes, ou si `ref` a la portée 0 et un autre espace que l'article.

- [ ] **Step 1: Tests `isLessVisible`** — privé → article ouvert : vrai ; même espace privé : faux ; READONLY communauté publique → article OPEN communauté publique : faux ; communauté privée A → article communauté privée B : vrai ; public → article privé : faux.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** le modèle Prisma, les types partagés et `isLessVisible`.
- [ ] **Step 4: Vérifier** — `pnpm build:packages && pnpm db:generate && pnpm db:push` ; tests PASS ; typecheck api.

### Task 3: Lecture d'un article (API)

**Files:**
- Create: `apps/api/src/routes/item-article.ts` — `itemArticleReadRoutes` (enregistré dans `itemsRoutes`, portée à authentification facultative, comme `GET /`)
- Modify: `apps/api/src/routes/items.ts` (enregistrement)
- Test: `apps/api/src/routes/item-article.test.ts` (style de `item-merge-ownership.test.ts` : `buildApp`, prisma simulé, `getTestToken`)

**Interfaces:**
- Consumes: `checkSpaceAccess`, `filterReadableSpaceIds`, `canMemberManageItem` ; `ArticleView`.
- Produces: `GET /spaces/:spaceId/items/:id/article` → `ArticleView`. 404 si l'article est illisible pour le lecteur ou n'est pas de type ARTICLE. Blocs triés par `position`. Pour chaque bloc : `available = addedById non nul && filterReadableSpaceIds(addedById, [ref.spaceId], false)` (jamais le mode admin de l'auteur) ; si indisponible, `item: null`. `canOpen` = le lecteur lit l'espace source (`filterReadableSpaceIds(reader, …, request.isAdminMode)`) ; `canEdit` = le lecteur est OWNER de l'espace source ou MEMBER avec `canMemberManageItem` (et élément non verrouillé). `canEditArticle` = même règle sur l'article. Lectures groupées : une requête des items référencés, un `filterReadableSpaceIds` par auteur distinct.

- [ ] **Step 1: Tests** — `returns blocks in order with content` ; `unavailable block leaks nothing` (auteur sans accès → `available:false`, `item:null`, aucun titre de l'élément dans `res.body`) ; `anonymous reader sees content without source access` (article public, élément privé lisible par l'auteur → contenu présent, `canOpen:false`, `spaceId:null`) ; `404 for non-article item`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** la route.
- [ ] **Step 4: Vérifier** — tests PASS ; typecheck api.

### Task 4: Composition d'un article (API)

**Files:**
- Modify: `apps/api/src/routes/item-article.ts` — `itemArticleWriteRoutes` (enregistré dans `authInstance` de `itemsRoutes`)
- Test: `apps/api/src/routes/item-article.test.ts`

**Interfaces:**
- Consumes: Task 3 (construction d'un `ArticleBlockView`), `isLessVisible`, `getEffectiveVisibilities`.
- Produces (toutes : 403 si le demandeur ne peut pas modifier l'article — même règle que `canEditArticle` —, 403 si l'article est verrouillé) :
  - `POST /spaces/:spaceId/items/:id/article/blocks` body `{ itemId: string; position?: number; confirmLessVisible?: boolean }` → 201 `ArticleBlockView`. 400 si l'élément est de type ARTICLE ; 409 `{ code: 'DUPLICATE_REFERENCE' }` si déjà dans l'article ; 403 si le demandeur ne lit pas l'élément (`filterReadableSpaceIds(user, …, false)`) ; 409 `{ code: 'LESS_VISIBLE', message }` si `isLessVisible` et pas `confirmLessVisible`. `position` absente = fin ; insertion = décalage des suivants. `addedById` = demandeur.
  - `POST …/article/texts` body `{ position?: number }` → 201 `ArticleBlockView` : crée en transaction une NOTE (titre « Texte », description vide, espace et créateur = article / demandeur) et son bloc.
  - `PATCH …/article/blocks/:blockId` body `{ width?: ArticleBlockWidth; align?: ArticleBlockAlign }` → 200 `ArticleBlockView`.
  - `PUT …/article/order` body `{ blockIds: string[] }` (tous les blocs de l'article, sinon 400) → 200 `ArticleView`, positions 0..n-1 en transaction.
  - `DELETE …/article/blocks/:blockId` → 204 ; l'élément référencé n'est jamais supprimé.

- [ ] **Step 1: Tests** — `adds a reference at the end` ; `rejects article references` (ARTICLE ou l'article lui-même → 400) ; `rejects duplicate reference` (409 DUPLICATE_REFERENCE) ; `asks confirmation when less visible` (409 LESS_VISIBLE puis 201 avec `confirmLessVisible:true`) ; `refuses unreadable item` (403) ; `member cannot edit someone else's article` (403, aucune écriture) ; `add text creates a note in the article space` ; `reorder requires all blocks` (400) ; `delete keeps the referenced item`.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** les routes ; zod pour les corps (`z.enum(['full','wide','medium'])`, `z.enum(['center','left','right'])`).
- [ ] **Step 4: Vérifier** — tests PASS ; typecheck api ; essai `curl` sur l'API locale (compte seed admin@spok.app) : créer un article, ajouter 2 références, réordonner, lire.

### Task 5: Page de lecture (web)

**Files:**
- Modify: `apps/web/src/lib/api.ts` — `articlesApi` (get, addBlock, addText, updateBlock, reorder, removeBlock) ; `ApiError` code `LESS_VISIBLE` exploité en Task 6
- Create: `apps/web/src/hooks/useArticle.ts` — queryKey `['article', spaceId, itemId]` (convention ARCHITECTURE.md)
- Create: `apps/web/src/pages/ArticlePage.tsx`, `apps/web/src/components/article/ArticleBlock.tsx`, `apps/web/src/components/article/articleLayout.ts`
- Create: `apps/web/src/pages/help/article.help.ts` (+ registre `PAGE_HELP['article']`)
- Modify: `apps/web/src/App.tsx` (route `spaces/:spaceId/articles/:itemId`, `PAGE_NAMES`), `apps/web/src/components/ItemEditModal.tsx` (type ARTICLE : bouton « Ouvrir l'article » dans la section média)
- Test: `apps/web/src/components/article/articleLayout.test.ts`

**Interfaces:**
- Consumes: `ArticleView`, `ArticleBlockView` (Task 2), route Task 3.
- Produces: `blockClasses(block: Pick<ArticleBlockView,'width'|'align'>, type: ItemType): string` (largeur : `full` = 100 %, `wide` = 85 %, `medium` = 60 %, centré ; `left`/`right` seulement pour IMAGE et DIAGRAM : flottant avec marge, 45 % max ; sous 640 px, aucun flottant et 100 %) ; `<ArticleBlock block editing={false} />` rend : NOTE → description HTML ; IMAGE / DIAGRAM → `<img src={url}>` + légende = titre ; LINK → carte titre + url (lien externe) ; autre type → titre + description ; `available:false` → encart « contenu indisponible » (texte de la fiche) ; titre cliquable vers la fiche seulement si `canOpen`.

- [ ] **Step 1: Tests `blockClasses`** — `full/center` ; `medium/left` sur IMAGE flottant ; `left` sur NOTE ignoré (centré) ; classes de repli mobile présentes.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** client, hook, page (en-tête : titre et chapeau de l'article, bouton « Imprimer » = `window.print()` avec feuille `@media print` qui masque le cadre de l'appli), bloc, route, entrée depuis la fiche, fiche d'aide (« ? » `PageHelpButton pageKey="article"`, conseils, tour sur l'en-tête et le premier bloc).
- [ ] **Step 4: Vérifier** — tests PASS ; aide `pnpm exec vitest run --project web apps/web/src/help` ; typecheck web ; à l'écran : article lu en desktop, en 375 px (`resize_window` mobile) et en aperçu d'impression ; en anonyme sur communauté passée temporairement OPEN : contenu d'un élément privé visible, pas de lien vers sa fiche.

### Task 6: Mode édition (web)

**Files:**
- Create: `apps/web/src/components/article/ArticleEditor.tsx`, `apps/web/src/components/article/ArticleItemPicker.tsx`
- Modify: `apps/web/src/pages/ArticlePage.tsx` (bascule Lire / Composer si `canEditArticle`), `apps/web/src/components/article/ArticleBlock.tsx` (`editing`), `apps/web/src/pages/help/article.help.ts` (hints, tour du mode Composer), `apps/web/src/lib/businessRules.ts`
- Test: `apps/web/src/components/article/articleLayout.test.ts` (ordre local après glisser : `moveBlock(ids, from, to)`)

**Interfaces:**
- Consumes: `articlesApi` (Task 5), routes Task 4.
- Produces: `moveBlock(ids: string[], from: number, to: number): string[]` (pur, dans `articleLayout.ts`).

Comportements : réordonner par `@dnd-kit/sortable` (poignée), envoi de `PUT order` avec mise à jour optimiste et retour à l'état serveur en cas d'erreur ; barre de bloc : largeur (3 boutons), position (3 boutons, seulement IMAGE / DIAGRAM), « Retirer de l'article » (`HelpHint` : « l'élément n'est pas supprimé »), « Ouvrir la fiche » si `canOpen` ; note : `RichTextEditor` sur place si `canEdit`, enregistrement au blur par `itemsApi.update` de la note (espace source), sinon lecture seule ; « Ajouter un élément » ouvre `ArticleItemPicker` (`searchApi.advanced` `types: 'items'`, exclut ARTICLE et les éléments déjà présents) ; sur 409 `LESS_VISIBLE` → `ConfirmModal` (texte de la fiche : l'élément sera visible par tous les lecteurs de l'article) puis renvoi avec `confirmLessVisible:true` ; « Ajouter un texte » entre deux blocs et en fin. Règles `article-blocks-references`, `article-reader-sees-blocks`, `article-less-visible-warning` dans `businessRules.ts`.

- [ ] **Step 1: Test `moveBlock`** — `moveBlock(['a','b','c'],0,2)` → `['b','c','a']` ; indices hors bornes → liste inchangée.
- [ ] **Step 2: Lancer** → FAIL.
- [ ] **Step 3: Implémenter** l'éditeur, le sélecteur, la confirmation, les rappels fonctionnels (`HelpHint` sur Retirer, Ajouter un élément, Ajouter un texte, réglages).
- [ ] **Step 4: Vérifier** — tests PASS ; aide ; typecheck web ; à l'écran (admin puis bob@spok.app, membre) : ajouter une image d'un autre espace, un élément privé (avertissement), un texte, réordonner, changer largeur et position, retirer ; bob ne voit pas « Composer » sur l'article d'un autre.

### Task 7: Spec SPOK et journal

**Files:**
- SPOK : item « Article [ArticlePage] » dans l'espace Items (`cmnssg2zf00dnx6kktkjmqfq4`, après `get_space_conventions`), statut `to_validate`, contenu = section « Exigences » de ce plan + routes et fichiers ; mettre à jour « Types d'items [enum ItemType] » (`cmnq9cdtl003s5yz293mlb05a`)
- Modify: `docs/ARCHITECTURE.md` (table `article_blocks`, queryKey `['article', …]`), `docs/MODELE-DONNEES.md` (modèle et relation), `docs/TODO.md`, `docs/session-journal.md`

- [ ] **Step 1: Mettre à jour** la spec SPOK et les docs listées.
- [ ] **Step 2: Vérifier** — `node scripts/check-doc-headers.mjs` OK ; journal : ce qui est fait, vérifié, « NON COMMITÉ ».
