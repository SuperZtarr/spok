# Article : ajouter une grappe ou un processus d'un coup — plan d'implémentation

> **Pour l'exécutant :** exécution inline (superpowers:executing-plans). Étapes en cases à cocher.
> **Jamais de commit** depuis cette session : le lot fini est inscrit dans « PRÊT POUR MEP » de `docs/session-journal.md`.

**Objectif :** en mode Composer, insérer en une fois plusieurs blocs ordonnés : un élément avec ses enfants et/ou la
chaîne d'éléments qui en découlent, ou le processus d'un espace (entier ou un couloir).

**Décisions (Thomas, 2026-10-24, lot 1) :** un bloc = un élément (aucun changement de base) ; insertion = photo de
la grappe au moment de l'ajout ; confirmation avec le compte ; éléments déjà présents ou illisibles sautés et comptés ;
avertissement « moins visible » une seule fois pour le lot ; 100 éléments au plus par ajout ; pas de schéma du
processus (lot 2 éventuel).

**Architecture :** fonctions pures d'ordre (`utils/articleBatch.ts`) ; deux routes d'écriture d'article — aperçu
(`POST …/article/batch/preview`) et insertion (`POST …/article/batch`) — partageant une même résolution de la source ;
une route de lecture des processus proposables (`GET …/article/processes`). Web : cases dans le sélecteur d'élément,
bouton « Processus » dans la barre d'insertion, une confirmation commune.

**Pile :** Fastify + Prisma, React + TanStack Query, Vitest.

## Contraintes globales

- Source : `{ kind: 'cluster'; itemId: string; children: boolean; chain: boolean }` ou
  `{ kind: 'process'; spaceId: string; laneId?: string }`.
- Ordre grappe : l'élément ; puis, si `children`, sa descendance en profondeur d'abord (chaque enfant suivi de ses
  propres enfants ; frères par `position` puis `createdAt`) ; puis, si `chain`, les éléments atteints en suivant les
  relations **sortantes** `blocks`, `implements`, `drives` (pas `relates`), en largeur d'abord, sans boucle, ceux déjà
  inclus étant ignorés.
- Ordre processus : couloirs par `position` ; pour chacun, l'élément du couloir puis ses éléments par `x` puis `y` ;
  puis (processus entier seulement) les éléments hors couloir par `x` puis `y`. `laneId` → ce couloir seul.
- Filtrage, dans cet ordre : type `ARTICLE` exclu, doublons retirés, éléments déjà dans l'article retirés, éléments
  d'espaces illisibles **hors mode admin** retirés (comme l'ajout unitaire). Chaque retrait est compté par motif.
- Plus de 100 éléments après filtrage → aperçu `tooMany: true`, insertion refusée en 400 `TOO_MANY`.
- Moins visible : au moins un élément moins visible que l'article (`isLessVisible`) → aperçu `lessVisible: true` ;
  insertion sans `confirmLessVisible` → 409 `LESS_VISIBLE`.
- Processus d'un espace illisible (hors mode admin) → 403. Couloir absent de cet espace → 404.
- Insertion : une transaction ; blocs aux positions `pos … pos+n-1` (fin par défaut), les suivants décalés de `n` ;
  `addedById` = demandeur ; réponse 201 `{ blocks: ArticleBlockView[] }` via `resolveBlocks`.
- Toutes ces routes exigent de pouvoir composer l'article (`requireArticleEditor`).
- En-tête `/* */` sur chaque fichier touché ; vérifications ciblées seulement.

## Points de vigilance

1. Boucle de relations (A → B → A) : chaîne finie, chaque élément une fois — test tâche 1.
2. Élément enfant dans un autre espace que son parent (données anciennes) : il suit la règle de lisibilité — test tâche 2.
3. Lot vide après filtrage (tout déjà présent) : aperçu `count: 0`, bouton de confirmation désactivé, insertion 400
   `EMPTY` — tests tâches 2 et 3.
4. Couloir dont l'élément est déjà dans l'article : ses membres sont quand même insérés — test tâche 1 (ordre) et 2.
5. Deux compositeurs simultanés : positions recalculées dans la transaction (`count` lu dedans) — test tâche 2.

---

### Tâche 1 : ordre des grappes et des processus (fonctions pures)

**Fichiers :** créer `apps/api/src/utils/articleBatch.ts` et `apps/api/src/utils/articleBatch.test.ts`.

**Interfaces (produit) :**
- `orderDescendants(rootId: string, items: { id: string; parentId: string | null; position: number; createdAt: Date }[]): string[]` (racine incluse en tête)
- `orderChain(rootId: string, relations: { fromItemId: string; toItemId: string; type: string }[]): string[]` (racine exclue)
- `orderCluster(rootId: string, descendants: string[] | null, chain: string[] | null): string[]` (racine, descendants sans la racine, puis chaîne sans doublon)
- `orderProcess(lanes: { id: string; itemId: string; position: number }[], nodes: { itemId: string; laneId: string | null; x: number; y: number }[], laneId?: string): string[]`

- [ ] **Étape 1 : tests en échec** :
  - descendance A > (B > D), C avec positions B=0, C=1 → `['A','B','D','C']` ; frères à position égale → `createdAt`.
  - chaîne A→B (drives), B→C (blocks), A→D (relates), C→A (implements) → `['B','C']` (relates ignoré, boucle finie).
  - `orderCluster('A', ['A','B'], ['B','X'])` → `['A','B','X']` ; `orderCluster('A', null, null)` → `['A']`.
  - processus : couloirs L2 (position 1, item `l2`) et L1 (position 0, item `l1`) ; nœuds n1 (L1, x 50), n2 (L1, x 10),
    n3 (L2, x 0), f1 (libre, x 5) → `['l1','n2','n1','l2','n3','f1']` ; avec `laneId = L2` → `['l2','n3']`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/utils/articleBatch.test.ts` → échec.
- [ ] **Étape 3 :** implémenter les quatre fonctions.
- [ ] **Étape 4 :** même commande → vert.

### Tâche 2 : routes d'aperçu, d'insertion et des processus

**Fichiers :**
- Modifier : `packages/shared/src/types/article.ts`
- Modifier : `apps/api/src/routes/item-article.ts` (3 routes dans `itemArticleWriteRoutes`, helper `resolveBatch`)
- Test : `apps/api/src/routes/item-article.test.ts` (describe « Article — ajout groupé »)

**Interfaces (produit, `@spok/shared`) :**
- `ArticleBatchSource` (cf. contraintes)
- `ArticleBatchPreview = { count: number; skipped: { present: number; unreadable: number; articles: number }; tooMany: boolean; lessVisible: boolean }`
- `ArticleProcessSummary = { spaceId: string; spaceName: string; communityName: string | null; nodeCount: number; lanes: { id: string; title: string }[] }`
- `POST /:id/article/batch/preview` body `{ source }` → `ArticleBatchPreview`
- `POST /:id/article/batch` body `{ source, position?, confirmLessVisible? }` → 201 `{ blocks: ArticleBlockView[] }` ;
  400 `TOO_MANY` / `EMPTY` ; 409 `LESS_VISIBLE`
- `GET /:id/article/processes?scope=community|all` → `ArticleProcessSummary[]` : espaces lisibles hors mode admin
  (`allReadableSpaceIds`, portée communauté de l'article par défaut comme les candidats) ayant au moins un
  `processNode`, couloirs triés par `position` avec le titre de leur élément.

- [ ] **Étape 1 : tests en échec** :
  - aperçu grappe avec enfants : compte = descendants lisibles non présents ; `skipped.present` / `unreadable` /
    `articles` justes.
  - aperçu de plus de 100 éléments → `tooMany: true` ; insertion → 400 `TOO_MANY`.
  - insertion processus : `articleBlock.createMany` reçoit les éléments dans l'ordre de `orderProcess`, positions à
    partir de `position`, `updateMany` décale les suivants de `n` (`count` lu dans la transaction).
  - moins visible : aperçu `lessVisible: true` ; insertion sans confirmation → 409 `LESS_VISIBLE` ; avec → 201.
  - lot vide → aperçu `count: 0`, insertion 400 `EMPTY`.
  - processus d'un espace illisible → 403 ; couloir d'un autre espace → 404.
  - `GET processes` : seuls les espaces lisibles avec au moins un nœud ; couloirs triés et titrés.
  - non-éditeur → 403 sur les trois routes.
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/routes/item-article.test.ts` → échec des nouveaux.
- [ ] **Étape 3 :** implémenter (schéma zod de la source en union discriminée sur `kind` ; `resolveBatch(prisma, ctx,
  source)` → `{ ordered, preview }` réutilisé par les deux routes ; descendance par parcours en largeur sur `parentId`
  dans l'espace de la racine puis `orderDescendants` ; chaîne par parcours des relations sortantes puis `orderChain`).
  En-têtes du type partagé et de la route complétés.
- [ ] **Étape 4 :** même commande → vert ; `pnpm build:packages` ; `pnpm --filter @spok/api typecheck`.

### Tâche 3 : interface du mode Composer

**Fichiers :**
- Modifier : `apps/web/src/lib/api.ts` (`articlesApi.previewBatch`, `addBatch`, `processes`)
- Modifier : `apps/web/src/hooks/useArticle.ts` (mutation `addBatch`, rafraîchissement comme `addBlock`)
- Modifier : `apps/web/src/components/article/ArticleItemPicker.tsx` (cases « Avec ses enfants », « Avec les éléments
  qui en découlent » ; `onPick(itemId, { children, chain })`)
- Créer : `apps/web/src/components/article/ArticleProcessPicker.tsx` (choix d'un processus puis « Tout le processus »
  ou un couloir ; portée Cette communauté / Partout comme le sélecteur d'élément)
- Créer : `apps/web/src/components/article/ArticleBatchConfirm.tsx` (aperçu → « N éléments seront ajoutés ici »,
  motifs des éléments sautés, avertissement moins visible si besoin, confirmation désactivée si `count` = 0 ou
  `tooMany`)
- Modifier : `apps/web/src/components/article/ArticleEditor.tsx` (bouton « Processus » dans `InsertBar`, orchestration :
  cases décochées = ajout unitaire actuel ; sinon aperçu + `ArticleBatchConfirm` ; processus idem)
- Modifier : `apps/web/src/pages/help/article.help.ts` (hints `addProcess`, `pickChildren`, `pickChain`,
  `batchConfirm`, `batchSkipped`, `batchTooMany`, `batchEmpty` ; conseil et étape de tour sur la barre d'insertion)
- Test : `apps/web/src/components/article/ArticleBatchConfirm.test.tsx`

- [ ] **Étape 1 : test en échec** `ArticleBatchConfirm.test.tsx` : aperçu `{ count: 12, skipped: { present: 2,
  unreadable: 1, articles: 0 }, tooMany: false, lessVisible: true }` → texte avec « 12 », motifs « 2 déjà présents »
  et « 1 illisible », avertissement visible, bouton actif ; `count: 0` → bouton désactivé ; `tooMany` → bouton
  désactivé et message `batchTooMany`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/ArticleBatchConfirm.test.tsx` → échec.
- [ ] **Étape 3 :** implémenter les fichiers ci-dessus ; confirmation envoie `confirmLessVisible: lessVisible`.
- [ ] **Étape 4 :** `pnpm exec vitest run --project web apps/web/src/components/article apps/web/src/help` → vert ;
  `cd apps/web && npx tsc --noEmit -p .` → sans erreur.

### Tâche 4 : documentation et vérification

- [ ] **Étape 1 :** `businessRules.ts` : règle `article-batch-insert` (sources, ordres, filtrage, 100 max, photo) ;
  spec SPOK « Article [ArticlePage] » (`cmvl3yeg00007blc1uqcbuf0n`) : paragraphe « Ajout groupé », `to_validate`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/help` → vert.
- [ ] **Étape 3 :** à l'écran si Docker démarre : grappe avec enfants, chaîne, processus entier, un couloir, lot
  partiellement déjà présent.
- [ ] **Étape 4 :** journal + « PRÊT POUR MEP » (fichiers exacts ; `item-article.ts`, `article.ts`,
  `ArticleItemPicker.tsx`, `article.help.ts` partagés avec les lots « Blocs d'article » et « recherche »).
