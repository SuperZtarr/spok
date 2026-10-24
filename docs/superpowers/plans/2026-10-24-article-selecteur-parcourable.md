# Article : sélecteur d'éléments à parcourir — plan d'implémentation

> **Pour l'exécutant :** exécution inline (superpowers:executing-plans). Étapes en cases à cocher.
> **Jamais de commit** : le lot est inscrit dans « PRÊT POUR MEP » de `docs/session-journal.md`. Il remplace le
> sélecteur des lots « recherche d'éléments » et « ajout groupé », non encore déployés : à pousser avec eux.

**Objectif :** dans le mode Composer, voir ce qui est à disposition au lieu de deviner quoi chercher : parcourir les
espaces et l'arbre de leurs éléments, filtrer par type, chercher, cocher plusieurs éléments et les ajouter d'un coup ;
le processus de l'espace se choisit dans la même fenêtre.

**Décisions (Thomas, 2026-10-24) :** fenêtre à deux colonnes — espaces (avec nombre d'éléments, espace de l'article
choisi à l'ouverture, portée Cette communauté / Partout) | éléments de l'espace en arbre dépliable, type et statut ;
filtres par type en pastilles ; la recherche filtre (classement par pertinence existant), dans tous les espaces avec
« Partout » ; sélection multiple « Ajouter (n) » dans l'ordre de l'arbre, options « avec ses enfants » / « ce qui en
découle » sur la sélection ; éléments déjà présents grisés « déjà ajouté » ; onglet « Processus » si l'espace en a un ;
le bouton séparé « Processus » disparaît.

**Architecture :** deux routes de lecture pour le parcours (`browse/spaces`, `browse/items`) ; la source d'ajout
groupé `cluster` devient `items` (plusieurs éléments) ; la route `processes` est remplacée par l'info processus de
`browse/spaces` ; les candidats acceptent la portée `space` et n'excluent plus les éléments présents (le web les grise).
Web : `ArticleBrowser` remplace `ArticleItemPicker` et `ArticleProcessPicker` ; arbre calculé par une fonction pure.

## Contraintes globales

- Lisibilité **hors mode admin** partout (comme l'ajout) ; toutes les routes exigent de pouvoir composer l'article.
- `browse/spaces?scope=community|all` → `ArticleBrowseSpace[]` = `{ spaceId; name; parentId: string | null;
  communityName: string | null; itemCount: number; process: { nodeCount: number; lanes: { id; title }[] } | null }`,
  espaces lisibles de la portée (`pickerSpaces`), triés par nom, `itemCount` sans les articles.
- `browse/items?spaceId=` → `{ items: ArticleBrowseItem[]; truncated: boolean }`, `ArticleBrowseItem = { id; type;
  title; status: string | null; statusLabel: string | null; parentId: string | null; position: number }` ; articles
  exclus ; 500 éléments au plus (tri `position`, puis `createdAt`) avec `truncated: true` au-delà ; espace illisible → 403.
- Source d'ajout groupé : `{ kind: 'items'; itemIds: string[] (1 à 100, ordre d'affichage); children; chain }`
  remplace `cluster` ; ordre = pour chaque id dans l'ordre reçu, `orderCluster(id, …)`, concaténés sans doublon ; le
  reste (filtrage, limite 100, moins visible, positions) inchangé. `process` inchangé.
- Candidats : `scope=space&spaceId=` en plus de `community` / `all` ; les éléments déjà présents ne sont plus exclus.
- Ajout : 1 élément coché sans option → ajout unitaire actuel (`addBlock`, confirmation moins visible) ; sinon aperçu
  + `ArticleBatchConfirm` + `addBatch`.
- Arbre : enfants sous leur parent (parent hors de la liste chargée → racine), frères par `position`, tous repliés
  sauf la racine ; avec un filtre de type ou une recherche, liste à plat des correspondances (avec le nom du parent).
- Textes dans `pages/help/article.help.ts` ; en-tête `/* */` sur chaque fichier ; vérifications ciblées seulement.

## Points de vigilance

1. Espace de plus de 500 éléments : `truncated` → message « 500 premiers éléments, cherchez pour les autres » — tests 1 et 3.
2. Sélection qui contient un parent et son enfant avec « avec ses enfants » : enfant une seule fois — test 1.
3. Changement d'espace avec une sélection en cours : la sélection est gardée (compteur global) — test 3.
4. Article dans un espace personnel (sans communauté) : portée communauté = cet espace seul — test 1.
5. Élément déjà présent coché impossible ; bouton « Ajouter » désactivé à 0 — test 3.

---

### Tâche 1 : API — parcours, source `items`, portée `space`

**Fichiers :** `packages/shared/src/types/article.ts` ; `apps/api/src/routes/item-article.ts` ;
`apps/api/src/routes/item-article.batch.test.ts` ; `apps/api/src/routes/item-article.test.ts` (candidats).

**Interfaces (produit) :** types `ArticleBrowseSpace`, `ArticleBrowseItem` ; `ArticleBatchSource` avec `items` au lieu
de `cluster` ; `ArticleProcessSummary` et la route `GET …/article/processes` supprimés ; `GET …/article/browse/spaces`,
`GET …/article/browse/items`.

- [ ] **Étape 1 : tests en échec** :
  - `browse/spaces` : espaces lisibles de la portée, `itemCount` (groupBy sans ARTICLE), `process` rempli seulement
    s'il y a des nœuds (couloirs triés, titrés) ; article sans communauté → son espace seul ; non-éditeur → 403.
  - `browse/items` : champs attendus, articles exclus, `statusLabel` des référentiels de l'espace, 501 éléments →
    500 + `truncated: true` ; espace illisible → 403.
  - batch `items` : `itemIds ['p','c']` avec `children` où `c` est enfant de `p` → `['p','c', …]` sans doublon ;
    101 ids → 400 (validation) ; les tests `cluster` existants passent à `items` avec un seul id.
  - candidats : `scope=space&spaceId=s2` → requête limitée à `s2` (∩ lisibles) ; un élément déjà présent est renvoyé.
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/routes/item-article.test.ts apps/api/src/routes/item-article.batch.test.ts` → échec des nouveaux.
- [ ] **Étape 3 : implémenter** (`browse/items` réutilise `statusesBySpace` ; `pickerSpaces` accepte `space`).
- [ ] **Étape 4 :** même commande + `apps/api/src/utils` → vert ; `pnpm build:packages` ; `pnpm --filter @spok/api typecheck`.

### Tâche 2 : arbre du sélecteur (fonction pure)

**Fichiers :** créer `apps/web/src/components/article/articleBrowserTree.ts` + `.test.ts`.

**Interfaces (produit) :**
- `type BrowserRow = { item: ArticleBrowseItem; depth: number; hasChildren: boolean; parentTitle: string | null }`
- `buildBrowserRows(items: ArticleBrowseItem[], expanded: Set<string>, types: Set<string>): BrowserRow[]` — arbre
  déplié selon `expanded` ; `types` non vide → liste à plat des éléments de ces types (profondeur 0, `parentTitle`).
- `orderSelection(selected: Set<string>, items: ArticleBrowseItem[], extra: string[]): string[]` — ids cochés dans
  l'ordre de l'arbre complet (préordre), puis ceux hors de la liste chargée (résultats de recherche) dans l'ordre `extra`.

- [ ] **Étape 1 : tests en échec** : arbre A > (B > D), C replié → `[A, C]` ; `expanded {A}` → `[A, B, C]` avec
  profondeurs 0/1/0 et `hasChildren` juste ; parent absent → racine ; filtre `{'IMAGE'}` → seules les images, à plat,
  `parentTitle` renseigné ; `orderSelection({C, B, X}, …, ['X'])` → `['B', 'C', 'X']`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/articleBrowserTree.test.ts` → échec.
- [ ] **Étape 3 :** implémenter.
- [ ] **Étape 4 :** même commande → vert.

### Tâche 3 : fenêtre `ArticleBrowser`

**Fichiers :**
- Créer : `apps/web/src/components/article/ArticleBrowser.tsx` + `ArticleBrowser.test.tsx`
- Supprimer : `ArticleItemPicker.tsx`, `ArticleProcessPicker.tsx`
- Modifier : `apps/web/src/lib/api.ts` (`browseSpaces`, `browseItems`, `candidates` avec `spaceId`, `processes` retiré),
  `ArticleEditor.tsx` (barre d'insertion : Élément / Texte ; orchestration), `pages/help/article.help.ts`

**Interfaces :**
- Props : `{ isOpen; onClose; spaceId; articleId; presentIds: Set<string>; onAdd(itemIds: string[], opts: { children: boolean; chain: boolean }); onAddProcess(source: { kind: 'process'; spaceId: string; laneId?: string }) }`.

- [ ] **Étape 1 : test en échec** `ArticleBrowser.test.tsx` (API simulée) : à l'ouverture, l'espace de l'article est
  choisi et ses éléments affichés en arbre ; cocher deux éléments puis « Ajouter (2) » → `onAdd` avec les ids dans
  l'ordre de l'arbre ; un élément présent est marqué « déjà ajouté » et sa case désactivée ; passer à un autre espace
  garde le compteur ; espace avec processus → onglet « Processus », clic sur un couloir → `onAddProcess` ; `truncated`
  → message `browserTruncated`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/ArticleBrowser.test.tsx` → échec.
- [ ] **Étape 3 :** implémenter (modale `size="xl"`, colonne espaces ~16rem, liste d'arbre défilante, pastilles de type
  construites depuis les types présents dans l'espace, recherche 250 ms dès 2 caractères via `candidates` — portée
  `space` par défaut, `all` si « Partout » — avec extrait surligné, options et bouton en pied) ; textes `browser*`
  ajoutés, `addProcess` / `pickerRecent` retirés ou réécrits, étape de tour `article-insert` mise à jour.
- [ ] **Étape 4 :** `pnpm exec vitest run --project web apps/web/src/components/article apps/web/src/help` → vert ;
  `cd apps/web && npx tsc --noEmit -p .` → sans erreur.

### Tâche 4 : documentation et vérification

- [ ] **Étape 1 :** `businessRules.ts` : `article-picker-relevance` et `article-batch-insert` réécrites (parcours,
  sélection multiple, présents grisés) ; spec SPOK « Article » : paragraphes sélecteur et ajout groupé, `to_validate`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/help` → vert.
- [ ] **Étape 3 :** à l'écran si Docker démarre : ouverture, arbre, filtre Images, recherche Partout, sélection
  multiple, onglet Processus.
- [ ] **Étape 4 :** journal ; « PRÊT POUR MEP » : nouveau lot qui remplace, pour le sélecteur, les fichiers des lots
  « recherche » et « ajout groupé » (à pousser ensemble, dans l'ordre : blocs, recherche, ajout groupé, sélecteur).
