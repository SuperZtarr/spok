# Blocs d'article : affichage selon le type et le contenu — plan d'implémentation

> **Pour l'exécutant :** exécution inline (superpowers:executing-plans), une tâche après l'autre. Étapes en cases à cocher.
> **Jamais de commit** depuis cette session : le lot fini est inscrit dans « PRÊT POUR MEP » de `docs/session-journal.md`.

**Objectif :** dans un article, chaque bloc affiche ce qui a du sens pour le type de l'élément référencé : contenu
d'abord, une ligne d'infos discrète si le type s'y prête, jamais de champ vide, jamais de bloc vide.

**Architecture :** l'API enrichit chaque bloc disponible (statut avec son libellé résolu dans l'espace d'origine,
priorité, dates) ; une fonction pure web calcule la ligne d'infos et l'adresse de l'icône du site ; `ArticleBlock`
applique le rendu par type. L'impression copie le DOM de la page : elle suit sans changement.

**Pile :** Fastify + Prisma (API), React + Tailwind (web), Vitest + Testing Library.

**Décisions (conversation du 2026-10-24, validées par Thomas) :**

| Type | Rendu |
|---|---|
| NOTE | Petit intertitre (titre de l'élément) puis le texte ; note vide : l'intertitre seul. En Composer, intertitre au-dessus de l'éditeur (son placeholder « Écrivez ici… » suffit) |
| DOCUMENT | Intertitre, texte, puis « 📎 nom du fichier » (lien) si `url` |
| IMAGE, DIAGRAM avec `url` | Image ; légende = titre en gras + description dans le même petit style grisé. Sans `url` : comme une note |
| LINK avec `url` | Carte : icône du site + titre + adresse ; description dessous si remplie |
| MEETING | Intertitre, ligne de date avec heures, texte |
| TASK, BUG | Intertitre, ligne « statut · Échéance … · priorité » (seulement le rempli), texte |
| PROJECT | Intertitre, ligne « du … au … · statut », texte |
| PERIOD | Intertitre, ligne « du … au … », texte |
| Autres (UNDEFINED, CONFIG…) | Intertitre, texte |

Jamais affichés : tags, assigné, contributions, relations, enfants. Pas de réglage par bloc (suite possible).

## Contraintes globales

- Un bloc indisponible (`available: false`) n'envoie toujours **rien** de son contenu (`item: null`).
- HTML toujours passé par `sanitizeHtml` (règle `user-html-sanitized`) ; adresses par `safeHref`.
- Intertitre commun à tous les types à titre : classe existante `font-semibold text-base mb-1`.
- Ligne d'infos : `text-xs text-muted-foreground`, séparateur ` · `.
- Libellé de statut : celui des référentiels de la communauté de l'espace d'origine (`Community.referentiels.statuses`),
  sinon `DEFAULT_STATUSES` ; statut `'undefined'` ou absent → pas de statut. Résolu par l'API (le lecteur peut ne pas
  avoir accès à l'espace d'origine).
- Priorité : libellé de `PRIORITIES` (`apps/web/src/constants/ui.ts`), côté web.
- Dates : `formatDate` / `formatDateTime` de `apps/web/src/lib/utils.ts` ; heures seulement pour MEETING.
- Icône du site : `https://<origine>/favicon.ico` calculée côté web (pas d'appel à `/url-meta`, qui a une faille SSRF
  traitée à part) ; échec de chargement → icône `ExternalLink` actuelle.
- En-tête `/* */` à jour sur chaque fichier touché ; vérifications ciblées seulement (pas de suite complète).

## Points de vigilance (non couverts par une tâche à part)

1. Dates invalides ou fin avant début : afficher ce qui est fourni, sans planter (test dans la tâche 2).
2. Élément d'un espace sans communauté (espace personnel) : libellés par défaut (test dans la tâche 1).
3. Adresse de lien non http(s) (`file:///` existe en prod) : pas d'icône, carte quand même (test tâche 2).
4. Note en Composer : l'intertitre ne doit pas être modifiable ni doubler l'éditeur (test tâche 3).
5. Bloc à droite / à gauche : la légende reste sous l'image, à sa largeur (vérif écran tâche 3).

---

### Tâche 1 : l'API envoie statut, priorité et dates des blocs

**Fichiers :**
- Modifier : `packages/shared/src/types/article.ts` (type `ArticleBlockView.item`)
- Modifier : `apps/api/src/routes/item-article.ts` (`REF_ITEM_SELECT`, `RefItem`, `resolveBlocks`)
- Test : `apps/api/src/routes/item-article.test.ts`

**Interfaces :**
- Produit : `ArticleBlockView.item` gagne `status: string | null`, `statusLabel: string | null`,
  `priority: number | null`, `startDate: string | null`, `endDate: string | null`, `dueDate: string | null`
  (dates ISO).

- [ ] **Étape 1 : tests en échec** dans `item-article.test.ts`, bloc `GET article` :
  - `it('envoie statut (avec libellé), priorité et dates d’un bloc')` : référence TASK `status: 'todo'`,
    `priority: 3`, `dueDate: new Date('2026-11-12T00:00:00Z')`, espace dont la communauté a des référentiels où
    `todo` a le libellé `'À lancer'` → `item.statusLabel === 'À lancer'`, `item.priority === 3`,
    `item.dueDate === '2026-11-12T00:00:00.000Z'`, `item.startDate === null`.
  - `it('statut undefined ou espace sans communauté → libellés par défaut ou null')` : `status: 'undefined'` →
    `status` et `statusLabel` null ; `status: 'done'` dans un espace sans communauté → libellé de `DEFAULT_STATUSES`.
  - Le test existant du bloc indisponible garde `item: null`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project api apps/api/src/routes/item-article.test.ts` → échec attendu.
- [ ] **Étape 3 : implémenter.** `REF_ITEM_SELECT` + `status, priority, startDate, endDate, dueDate` ; dans
  `resolveBlocks`, une requête `prisma.space.findMany({ where: { id: { in: spaceIds } }, select: { id: true,
  community: { select: { referentiels: true } } } })` puis `statusLabel` via la liste de statuts de l'espace
  (référentiels de la communauté sinon `DEFAULT_STATUSES`). Dates → `toISOString()` ou `null`. En-tête du fichier
  et du type partagé complétés.
- [ ] **Étape 4 :** même commande → vert ; `pnpm build:packages` puis typecheck API
  (`pnpm --filter @spok/api typecheck`).

### Tâche 2 : ligne d'infos et icône du site (fonctions pures)

**Fichiers :**
- Créer : `apps/web/src/components/article/articleBlockContent.ts`
- Test : `apps/web/src/components/article/articleBlockContent.test.ts`

**Interfaces :**
- Consomme : `ArticleBlockView['item']` (tâche 1).
- Produit : `blockMetaLine(item: NonNullable<ArticleBlockView['item']>): string | null` et
  `siteIconUrl(url: string | null): string | null`.

- [ ] **Étape 1 : tests en échec** :
  - MEETING début `2026-11-12T13:00Z`, fin `14:30Z` → contient la date et les deux heures (via `formatDateTime`).
  - TASK `statusLabel 'À faire'`, `dueDate`, `priority 4` → `'À faire · Échéance <date> · <libellé PRIORITIES 4>'`.
  - TASK sans aucun de ces champs → `null`.
  - PROJECT début + fin + statut → `'du <d1> au <d2> · <statut>'` ; seulement début → `'à partir du <d1>'` ;
    seulement fin → `'jusqu’au <d2>'`.
  - PERIOD début + fin → `'du <d1> au <d2>'` ; NOTE / DOCUMENT / IMAGE / LINK → `null`.
  - Date invalide (`'pas-une-date'`) → ignorée, pas d'exception.
  - `siteIconUrl('https://www.youtube.com/watch?v=x')` → `'https://www.youtube.com/favicon.ico'` ;
    `siteIconUrl('file:///C:/a.pdf')` → `null` ; `siteIconUrl(null)` → `null`.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/articleBlockContent.test.ts` → échec.
- [ ] **Étape 3 : implémenter** les deux fonctions (en-tête de fichier : rôle, règles du tableau ci-dessus).
- [ ] **Étape 4 :** même commande → vert.

### Tâche 3 : rendu par type dans `ArticleBlock`

**Fichiers :**
- Modifier : `apps/web/src/components/article/ArticleBlock.tsx`
- Test : `apps/web/src/components/article/ArticleBlock.test.tsx` (nouveau, rendu Testing Library, routeur mémoire)

**Interfaces :**
- Consomme : `blockMetaLine`, `siteIconUrl` (tâche 2) ; `fileNameFromUrl` (`apps/web/src/lib/itemClipboard.ts`, déjà exporté).

- [ ] **Étape 1 : tests en échec** :
  - NOTE : un intertitre avec le titre, puis le texte ; NOTE sans description → intertitre seul ;
    NOTE avec `children` → intertitre puis les `children`, un seul exemplaire du texte.
  - IMAGE avec `url` : `figcaption` contient le titre et le texte de la description.
  - TASK : la ligne d'infos est rendue (texte de `blockMetaLine`).
  - LINK : `img` dont `src` = `https://exemple.org/favicon.ico` ; après l'évènement `error` de l'image, l'icône
    de repli est présente.
  - DOCUMENT avec `url` `…/1729000000000-rapport.pdf` : lien « rapport.pdf ».
  - Bloc indisponible : encart inchangé.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/components/article/ArticleBlock.test.tsx` → échec.
- [ ] **Étape 3 : implémenter** le rendu du tableau des décisions ; intertitre et lien vers la fiche (`canOpen`)
  comme aujourd'hui ; en-tête du fichier réécrit.
- [ ] **Étape 4 :** même commande → vert ; `cd apps/web && npx tsc --noEmit -p .` → sans erreur.

### Tâche 4 : documentation et vérification

**Fichiers :**
- Modifier : `apps/web/src/pages/help/article.help.ts` (conseil sur ce que montre chaque type de bloc ; zone de bloc
  si elle décrit le rendu)
- Modifier : `apps/web/src/lib/businessRules.ts` (règle `article-block-display-by-type` : contenu d'abord, infos selon
  le type, jamais tags / assigné / contributions / relations / enfants, statut libellé dans l'espace d'origine)
- Spec SPOK « Article [ArticlePage] » (`cmvl3yeg00007blc1uqcbuf0n`, espace Items) : section « Rendu des blocs »
  (tableau ci-dessus), statut `to_validate`
- `docs/session-journal.md` : entrée EN COURS + lot « PRÊT POUR MEP » (fichiers exacts, tests, non vérifié)

- [ ] **Étape 1 :** mettre à jour la fiche d'aide, `businessRules.ts` et la spec.
- [ ] **Étape 2 :** `pnpm exec vitest run --project web apps/web/src/help` → vert.
- [ ] **Étape 3 :** à l'écran (dev local, si Docker démarre) : un article avec une note, une image à droite, un lien,
  une réunion, une tâche, un document ; lecture desktop, 375 px, impression.
- [ ] **Étape 4 :** journal + « PRÊT POUR MEP ».
