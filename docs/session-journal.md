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
