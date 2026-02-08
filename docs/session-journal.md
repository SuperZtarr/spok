# Session Journal - SPOK

---

#### [2026-02-08 13:30] - Appliquer les couleurs de type des referentiels partout

**Demande :** Appliquer les couleurs spécifiques du referentiel (color/bgHover par type d'item) dans toute l'application, au lieu des couleurs generiques (primary, outline, muted-foreground).

**Actions realisees :**
- Cree `getTypeColor()` et `getTypeTextColor()` helpers dans `apps/web/src/constants/ui.ts`
  - `getTypeColor(type, typeLabels?)` retourne `{ color, bgHover }` depuis les referentiels ou les defaults
  - `getTypeTextColor(type, typeLabels?)` retourne la classe texte correspondante via mapping explicite (pour Tailwind JIT)
- Modifie `ItemEditModal.tsx` : boutons de type (edit + lecture seule) utilisent la bordure coloree du referentiel
- Modifie `SpacePage.tsx` : filtres toolbar + selecteur type nouveau item utilisent la bordure coloree
- Modifie `ListView.tsx` : badge type avec bordure coloree
- Modifie `KanbanView.tsx` : icone type coloree (propagation de referentiels aux sous-composants KanbanColumn/KanbanCard)
- Modifie `GlobalSearch.tsx` : badge type avec label traduit + couleur de fond
- Modifie `SequenceView.tsx` : icone type coloree

**Fichiers modifies :**
- `apps/web/src/constants/ui.ts`
- `apps/web/src/components/ItemEditModal.tsx`
- `apps/web/src/pages/SpacePage.tsx`
- `apps/web/src/components/views/ListView.tsx`
- `apps/web/src/components/views/KanbanView.tsx`
- `apps/web/src/components/GlobalSearch.tsx`
- `apps/web/src/components/views/SequenceView.tsx`

**Etat :** TERMINE
**Prochaine etape :** Verification visuelle puis commit si valide

---

#### [2026-02-08 ~15:00] - Investigation regression profil utilisateur en production

**Demande :** La modale profil utilisateur n'est plus accessible en production et l'avatar ne s'affiche plus.

**Investigation :**
- Verification exhaustive du code : Layout.tsx, UserProfileModal.tsx, Modal.tsx, routes API, stores — aucune modification par nos commits
- Build de production : compile sans erreur
- Git local et remote synchronises
- Fonctionne en dev, pas en prod

**Diagnostic :** Le service **web** sur Railway avait des deploiements "removed" — le frontend n'etait plus deploye. Cause probable : limites du plan Railway, nettoyage automatique ou probleme de facturation.

**Resolution :** Force redeploy via commit vide (`32734c3`). Le service web a ete redeploye et tout refonctionne.

**Etat :** TERMINE
**Lecon :** En cas de "regression" en prod uniquement, verifier d'abord l'etat des deploiements Railway avant d'investiguer le code.

---

#### [2026-02-08 ~16:00] - Fix nginx workers OOM sur Railway

**Demande :** Comprendre pourquoi 11 deploiements "removed" ce matin sur Railway (service web).

**Diagnostic :** Les logs montrent que nginx lancait ~47 worker processes (`worker_processes auto;` detecte tous les CPUs du host partage Railway). Cela causait un depassement memoire → Railway arretait le conteneur → retentait → boucle de "removed".

**Actions realisees :**
- Transforme `docker/nginx.conf` d'un simple `server` block en config nginx complete
- Ajout `worker_processes 2;` et `worker_connections 512;` pour limiter la memoire
- Modifie `docker/Dockerfile.web` : copie vers `/etc/nginx/nginx.conf` (au lieu de `conf.d/default.conf`)
- Ajout `error_log /dev/stderr` et `access_log /dev/stdout` pour visibilite dans Railway
- Commits : `3f285c2` (fix workers) + `02e002c` (ajout logs)

**Etat :** TERMINE
**Lecon :** Sur Railway, nginx `worker_processes auto` cree un worker par CPU du host partage (~47), causant un OOM. Toujours forcer `worker_processes 2` pour les conteneurs Railway.

---
