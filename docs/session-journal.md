# Session Journal - SPOK

---

## Historique des sessions precedentes (resume)

### Fonctionnalites implementees
- **Vue Graphe force-directed** : 3 niveaux (espace, communaute, global), filtres communautes, noeuds structurels — commits `61878ae`, etc.
- **Vue Sunburst** : visualisation D3.js hierarchique dans le Dashboard — commit `518a5dc`
- **Vue MindMap** : layout etoile, groupement natif ReactFlow, zones projet draggables, zoom projet — commits `717b916`, `0128134`, `b000057`, `00d7fd0`
- **Vue Timeline/Gantt** : centrage, sticky, relations, enfants + mode compact (masquer items sans date) — commits `700fbf2`, `197f76b`
- **Hierarchie d'espaces** : parentId, arborescence sidebar, validation circulaire
- **Communautes publiques/privees** : isPublic, listing public, rejoindre — commit `e8576d4`
- **Optimistic locking** : detection conflits 409, dialogue resolution champ par champ
- **Upload images R2** : drag & drop, sharp WebP, Cloudflare R2
- **Landing page publique** : hero, fonctionnalites, vues
- **Page admin Stats** : totaux, series temporelles, repartition par type — commits `5a2b108`, `09aa5c3`
- **Couleurs de type** : referentiels appliques partout (Kanban, Liste, Sequence, recherche)
- **Breadcrumb ItemEditModal** : fil d'Ariane cliquable
- **Password reset** : tokens, email Resend, page de reset

### Corrections et infra
- Fix nginx workers OOM Railway (`worker_processes 2`) — commits `3f285c2`, `02e002c`
- Fix build prod (useEffect manquant) — commit `487be18`
- Fix type BUG dans validation Zod — commit `1d3ae00`
- Fix tooltips titres tronques — commit `2511734`
- Fix pre-selection communaute — commit `81bbfde`
- Fix dev-start.ps1 pour worktrees — commit `6413ba6`
- Fix restauration items supprimes — commits `596125f`, `3d63987`
- Fix endDate activites prod (planningelement) — script one-shot
- **Dockerisation complete du dev** : API + Web + PostgreSQL en conteneurs, hot reload via volumes — commit `0e4dcb0`

### Decisions d'architecture
- **Workflow Git** : ne plus merger/pusher sans accord explicite de l'utilisateur. Commiter sur branche worktree, tester en local, puis merge sur demande.
- **Dev Docker** : `pnpm dev:start` lance 3 conteneurs (postgres:25432, api:3001, web:3000). Utilise `node-linker=hoisted` + symlinks manuels pour compatibilite pnpm/Docker.
- **Prod Railway** : push sur `origin/master` declenche le deploiement automatique.

---

#### [2025-02-15] - Fix build Railway après unification ItemActionMenu

**Demande :** Correction automatique suite à l'échec du build Railway (commit 282d58f)
**Actions réalisées :**
- Supprimé l'import inutilisé `CheckSquare` dans `TypesView.tsx`
- Supprimé l'import inutilisé `X` dans `SpaceSettingsPage.tsx`
- Commit `1e97a24`, merge fast-forward dans master, push origin
**État :** TERMINÉ

---
