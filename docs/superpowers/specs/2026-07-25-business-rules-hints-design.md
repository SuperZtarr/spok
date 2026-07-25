# Spec — Indices visuels des règles de gestion (mode dev)

Date : 2026-07-25

## Contexte

Plusieurs comportements automatiques sont implémentés dans `ItemEditModal.tsx` et `SpacePage.tsx` (ex. : choisir un statut remplit automatiquement une date). Ces règles ne sont documentées nulle part, ce qui a mené à une confusion en session (une date "mystérieusement" remplie, alors qu'il s'agissait d'un comportement voulu).

Objectif : donner un moyen de consulter ces règles à deux publics —
1. **L'utilisateur en mode dev**, via un indice visuel directement sur les boutons concernés, pour distinguer un comportement normal (documenté) d'une anomalie.
2. **Claude**, via une structure de données facilement lisible (Read/Grep), pour éviter de re-découvrir ces règles à chaque session.

## Architecture

Un seul fichier TypeScript typé sert de source unique aux deux usages (UI + documentation), pour éviter la dérive entre un doc `.md` et le code réel.

### Fichier de données

`apps/web/src/lib/businessRules.ts`

```ts
export interface ItemBusinessRule {
  id: string;                          // slug unique, ex. 'status-clear-dates'
  category: 'type' | 'status' | 'priority';
  appliesToValues: string[];           // valeurs de bouton concernées (ex. ids de statut)
  trigger: string;                     // condition en langage naturel
  effect: string;                      // ce que la règle déclenche
  location: string;                    // fichier:lignes où c'est implémenté
}

export interface PageBusinessRule {
  id: string;
  page: string;                        // nom de la page/vue concernée
  trigger: string;
  effect: string;
  location: string;
}

export const ITEM_BUSINESS_RULES: ItemBusinessRule[] = [ /* voir "Règles initiales" */ ];

export const PAGE_BUSINESS_RULES: PageBusinessRule[] = [ /* vide au démarrage */ ];
```

Deux tableaux séparés (pas un champ `page?` optionnel sur une structure commune) car ce sont deux natures d'information différentes : un comportement d'interaction précis (bouton → effet) vs un comportement de filtrage/affichage à l'échelle d'une page.

### Composant UI

`apps/web/src/components/ui/RuleHint.tsx`

- Props : `category: 'type' | 'status' | 'priority'`, `value: string` (la valeur du bouton, ex. `'done'`)
- Cherche dans `ITEM_BUSINESS_RULES` toutes les règles où `category` correspond et `value` est dans `appliesToValues`
- Ne rend rien si :
  - `import.meta.env.DEV` est faux (jamais affiché en prod)
  - aucune règle ne correspond à ce bouton
- Sinon : icône `Info` (lucide-react) discrète, positionnée en overlay sur le coin du bouton, toujours visible (pas cachée derrière un survol du bouton parent) ; tooltip au survol de l'icône affichant le(s) `effect` (join si plusieurs règles matchent la même valeur)

### Points d'intégration

Dans `ItemEditModal.tsx`, sur les boutons desktop de type et de statut (pas la version `<Select>` mobile — le mode dev cible l'usage desktop) :

- Sélecteur de type (ligne ~1035) : `<RuleHint category="type" value={key} />` à côté de chaque bouton de type
- Sélecteur de statut (ligne ~1080) : `<RuleHint category="status" value={s.id} />` à côté de chaque bouton de statut

Le composant ne rendant rien s'il n'y a pas de règle, l'ajouter systématiquement sur tous les boutons de ces deux groupes ne pollue pas visuellement ceux qui n'ont pas de règle associée.

## Règles initiales (`ITEM_BUSINESS_RULES`)

| id | category | appliesToValues | trigger | effect | location |
|---|---|---|---|---|---|
| `default-type-undefined` | type | `['UNDEFINED']` | Création d'un item | Type initialisé à UNDEFINED ("Non défini") | `apps/web/src/pages/SpacePage.tsx:470,502,517` |
| `status-clear-dates` | status | `['undefined']` | Statut = "Non défini" | `startDate` et `endDate` vidés | `apps/web/src/components/ItemEditModal.tsx:1082-1084` |
| `status-autofill-start` | status | `['todo','in_progress','to_validate','scheduled','late']` | Statut choisi ≠ "Non défini", `startDate` vide | `startDate` auto-rempli à aujourd'hui | `apps/web/src/components/ItemEditModal.tsx:1088` |
| `status-autofill-end-terminal` | status | `['done','cancelled']` | Statut = "Terminé"/"Annulé", `endDate` vide | `endDate` auto-rempli à aujourd'hui | `apps/web/src/components/ItemEditModal.tsx:1087` |

`appliesToValues` pour `status-autofill-start` et `status-autofill-end-terminal` couvre les ids par défaut de `DEFAULT_STATUSES` (hors `undefined`/`done`/`cancelled` déjà couverts par les deux autres règles). Un espace avec des statuts personnalisés (référentiels custom) pourrait avoir des ids différents — non géré dans cette première itération (voir Limites).

`PAGE_BUSINESS_RULES` démarre vide : aucune règle de page identifiée à ce stade. La structure existe pour être alimentée au fil de l'eau, sans nouveau chantier de migration quand la première règle de page sera documentée.

## Composants et responsabilités

- `businessRules.ts` : uniquement des données statiques typées, aucune logique. Peut être importé côté web sans risque de cycle.
- `RuleHint.tsx` : lookup + rendu conditionnel + tooltip. Ne connaît pas la logique métier elle-même, seulement le texte qui la décrit.
- `ItemEditModal.tsx` : passe `category`/`value` à `RuleHint`, ne connaît pas le contenu des règles.

Séparation nette : ajouter/modifier une règle ne touche que `businessRules.ts` ; ajouter un nouveau point d'intégration ne touche que le composant consommateur, pas `RuleHint`.

## Erreurs / cas limites

- Référentiels de statut personnalisés par espace (ids hors `DEFAULT_STATUSES`) : le `RuleHint` ne matchera aucune règle, donc n'affiche simplement rien pour ces boutons — pas d'erreur, juste pas d'indice visuel. Comportement acceptable pour cette première itération.
- Plusieurs règles matchant la même valeur : leurs `effect` sont concaténés dans le tooltip (puce par règle).

## Tests

Pas de suite automatisée dédiée pour cette fonctionnalité (composant d'affichage dev-only, sans logique métier). Vérification manuelle : ouvrir la modale en dev, survoler les boutons concernés, confirmer que le tooltip affiche le bon texte et que rien ne s'affiche en build prod (`import.meta.env.DEV` faux).

## Hors périmètre (cette itération)

- Peupler `PAGE_BUSINESS_RULES`
- Couvrir les statuts personnalisés par espace
- Étendre `RuleHint` à d'autres vues que la modale (Kanban, Liste, etc.)
- Rendu sur la version mobile (`<Select>`)
