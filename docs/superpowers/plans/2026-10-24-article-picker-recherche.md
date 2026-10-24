# Recherche d'éléments à ajouter dans un article — plan d'implémentation

> **Pour l'exécutant :** exécution inline (superpowers:executing-plans), une tâche après l'autre. Étapes en cases à cocher.
> **Jamais de commit** depuis cette session : le lot fini est inscrit dans « PRÊT POUR MEP » de `docs/session-journal.md`.

**Objectif :** le sélecteur « Ajouter un élément » du mode Composer trouve d'abord ce qu'on cherche : pertinence sur
le titre, texte visible (pas le HTML), communauté de l'article par défaut, extrait qui montre pourquoi ça correspond,
récents de l'espace avant de taper.

**Constat (code, 2026-10-24) :** le sélecteur appelle `/search/advanced` (page Recherche), qui fait un `contains` sur
le HTML brut des descriptions (« st » trouve tous les `style=`), trie par communauté › espace › récence (pas par
pertinence) et coupe à 30 résultats tous espaces confondus. La page Recherche n'est pas modifiée par ce plan.

**Architecture :** route dédiée `GET /spaces/:spaceId/items/:id/article/candidates` (écritures d'article, donc
réservée à qui peut composer). Deux requêtes Prisma larges (titre ; puis description/adresse), puis tri et filtre en
mémoire par une fonction pure (`rankArticleCandidates`) qui travaille sur le texte sans balises. Le sélecteur web
appelle cette route.

**Pile :** Fastify + Prisma, React + TanStack Query, Vitest.

## Contraintes globales

- Candidats = éléments des espaces que le demandeur peut LIRE, évalués **hors mode admin** (même règle que l'ajout
  d'un bloc, qui refuse en 403 un élément illisible hors mode admin).
- Exclus : type `ARTICLE`, l'article lui-même, les éléments déjà dans l'article.
- Portée `community` (défaut) : espaces de la communauté de l'article ∩ lisibles ; article dans un espace sans
  communauté → son espace seul. Portée `all` : tous les espaces lisibles.
- Classement : 0 = titre qui commence par le terme, 1 = titre qui le contient, 2 = texte visible de la description ou
  adresse qui le contient ; à rang égal : espace de l'article, puis même communauté, puis `updatedAt` décroissant.
  Comparaison insensible à la casse et aux accents (`normalize('NFD')`, diacritiques retirés).
- Correspondance seulement dans le HTML (balise, attribut) → **pas** un résultat.
- Au plus 30 résultats. Terme vide → 15 éléments les plus récents de l'espace de l'article (même exclusions).
- Extrait : 120 caractères max autour de la première occurrence dans le texte visible, `…` aux coupures ; seulement
  pour le rang 2 ; le web met le terme en gras sans injecter de HTML (découpe en segments texte).
- En-tête `/* */` sur chaque fichier touché ; vérifications ciblées seulement.

## Points de vigilance

1. Terme d'un caractère : accepté (le web garde 2 caractères minimum pour lancer la recherche) — test tâche 1.
2. Description avec entités (`&nbsp;`, `&amp;`) : décodées avant comparaison — test tâche 1.
3. Plus de 300 correspondances brutes dans les descriptions : on garde les 300 plus récentes avant filtrage (borne de
   coût) ; les correspondances de titre ne sont jamais coupées par cette borne (requête à part) — test tâche 2.
4. Élément déjà ajouté entre deux recherches : exclu par l'API à chaque appel — test tâche 2.
5. Mode admin actif : ne propose pas d'éléments que l'ajout refuserait — test tâche 2.

---

### Tâche 1 : classement des candidats (fonction pure)

**Fichiers :**
- Créer : `apps/api/src/utils/articleCandidates.ts`
- Test : `apps/api/src/utils/articleCandidates.test.ts`

**Interfaces :**
- Produit :
  - `type CandidateRow = { id: string; type: string; title: string; description: string | null; url: string | null; spaceId: string; updatedAt: Date; space: { name: string; communityId: string | null; community: { name: string } | null } }`
  - `plainText(html: string | null): string` — balises retirées, entités courantes décodées, espaces compactés.
  - `rankArticleCandidates(term: string, rows: CandidateRow[], ctx: { articleSpaceId: string; articleCommunityId: string | null }, limit = 30): ArticleCandidate[]`

- [ ] **Étape 1 : tests en échec** :
  - `plainText('<p style="color:red">Bonjour&nbsp;le&amp;monde</p>')` → `'Bonjour le&monde'`.
  - terme `'st'`, ligne dont seule la description `<p style="x">abc</p>` contient « st » → exclue.
  - ordre : `'Plan B'` (titre commence) avant `'Mon plan'` (titre contient) avant un élément dont seul le texte contient
    « plan » ; à rang égal, l'espace de l'article avant un autre espace de la même communauté, avant une autre
    communauté, puis le plus récent.
  - `'éte'` trouve le titre `'Été 2026'` (accents et casse ignorés).
  - rang 2 → `snippet` contient le terme, ≤ 121 caractères avec `…` ; rangs 0 et 1 → `snippet: null`.
  - `limit` respecté ; terme d'un caractère accepté.
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/utils/articleCandidates.test.ts` → échec.
- [ ] **Étape 3 : implémenter** (type `ArticleCandidate` de la tâche 2 importé de `@spok/shared`).
- [ ] **Étape 4 :** même commande → vert.

### Tâche 2 : route des candidats et type partagé

**Fichiers :**
- Modifier : `packages/shared/src/types/article.ts` (type `ArticleCandidate`)
- Modifier : `apps/api/src/routes/items.ts` (helper `allReadableSpaceIds`, extrait de `search.ts`)
- Modifier : `apps/api/src/routes/search.ts` (utilise `allReadableSpaceIds`, comportement inchangé)
- Modifier : `apps/api/src/routes/item-article.ts` (route `GET /:id/article/candidates` dans `itemArticleWriteRoutes`)
- Test : `apps/api/src/routes/item-article.test.ts` ; `apps/api/src/routes/search.test.ts` doit rester vert

**Interfaces :**
- Consomme : `rankArticleCandidates`, `CandidateRow` (tâche 1) ; `requireArticleEditor` (existant).
- Produit :
  - `type ArticleCandidate = { id: string; type: ItemType; title: string; spaceId: string; spaceName: string; communityName: string | null; snippet: string | null }`
  - `allReadableSpaceIds(prisma: any, userId: string | undefined): Promise<string[]>` = espaces directs + communautés
    de l'utilisateur + espaces GROUP des communautés non privées filtrés par `filterReadableSpaceIds` (lignes 63-71
    actuelles de `search.ts`, hors branche admin).
  - `GET /spaces/:spaceId/items/:id/article/candidates?q=&scope=community|all` → `{ items: ArticleCandidate[] }`
    (`scope` absent ou inconnu = `community`).

- [ ] **Étape 1 : tests en échec** (`item-article.test.ts`, describe composition) :
  - `q='plan'` : renvoie les titres dans l'ordre de `rankArticleCandidates` ; exclut ARTICLE, l'article et les
    éléments déjà dans ses blocs.
  - `scope` absent : la requête Prisma est limitée aux espaces de la communauté de l'article ∩ lisibles ;
    `scope=all` : à tous les espaces lisibles.
  - mode admin (`x-admin-mode`) : `allReadableSpaceIds` appelé tel quel (pas de « tout lisible »).
  - requête description : `take: 300`, `orderBy: { updatedAt: 'desc' }` ; requête titre sans cette borne commune.
  - `q` vide : 15 récents de l'espace de l'article.
  - non-éditeur : 403 (comme les autres écritures).
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/routes/item-article.test.ts apps/api/src/routes/search.test.ts` → échec des nouveaux seulement.
- [ ] **Étape 3 : implémenter** le type, le helper, son usage dans `search.ts`, la route (requête titre `take: 100`,
  requête description/adresse `take: 300` excluant les ids déjà trouvés par titre, puis `rankArticleCandidates`).
  En-têtes de `item-article.ts`, `search.ts`, `items.ts` complétés.
- [ ] **Étape 4 :** même commande → vert ; `pnpm build:packages` ; `pnpm --filter @spok/api typecheck`.

### Tâche 3 : sélecteur web

**Fichiers :**
- Modifier : `apps/web/src/lib/api.ts` (`articlesApi.candidates`)
- Modifier : `apps/web/src/components/article/ArticleItemPicker.tsx`
- Modifier : `apps/web/src/components/article/ArticleEditor.tsx` (passe `spaceId`, `articleId` au sélecteur)
- Créer : `apps/web/src/components/article/highlight.ts` + `highlight.test.ts`

**Interfaces :**
- Consomme : route et type `ArticleCandidate` (tâche 2).
- Produit : `articlesApi.candidates(spaceId: string, articleId: string, params: { q: string; scope: 'community' | 'all' }) => Promise<{ items: ArticleCandidate[] }>` ;
  `highlightSegments(text: string, term: string): { text: string; match: boolean }[]` (insensible casse/accents).

- [ ] **Étape 1 : test en échec** `highlight.test.ts` : `highlightSegments('Le Plan B', 'plan')` →
  `[{text:'Le ',match:false},{text:'Plan',match:true},{text:' B',match:false}]` ; `'Été'` avec `'ete'` → un segment
  `match: true` ; terme vide → un seul segment `match: false`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/highlight.test.ts` → échec.
- [ ] **Étape 3 : implémenter** `highlightSegments`, `articlesApi.candidates`, puis le sélecteur : props
  `spaceId`, `articleId` ajoutées (`excludeIds` retiré, l'API exclut) ; requête dès l'ouverture (terme vide = récents),
  recherche lancée à partir de 2 caractères avec 250 ms de délai ; bascule « Cette communauté / Partout »
  (défaut communauté, remise à « communauté » à chaque ouverture) ; extrait sous le titre avec le terme en gras
  (`<strong>` via segments, aucun `dangerouslySetInnerHTML`) ; titre en gras sur la partie trouvée ; libellé
  « Récents de cet espace » quand le terme est vide. Textes dans `article.help.ts` (`hints.pickerScope`,
  `hints.pickerRecent`, `addItem` mis à jour).
- [ ] **Étape 4 :** `pnpm exec vitest run --project web apps/web/src/components/article` → vert ;
  `cd apps/web && npx tsc --noEmit -p .` → sans erreur.

### Tâche 4 : documentation et vérification

- [ ] **Étape 1 :** `apps/web/src/lib/businessRules.ts` : règle `article-picker-relevance` (classement, texte visible,
  portée, exclusions, hors mode admin) ; spec SPOK « Article [ArticlePage] » (`cmvl3yeg00007blc1uqcbuf0n`, espace Items) :
  paragraphe Composer complété, `to_validate`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/help` → vert.
- [ ] **Étape 3 :** à l'écran si Docker démarre : terme « st », « plan », mot présent seulement dans un texte, bascule
  Partout, ouverture sans terme.
- [ ] **Étape 4 :** journal + « PRÊT POUR MEP » (fichiers exacts ; `search.ts` et `items.ts` = extraction du helper).
