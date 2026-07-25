# Indices visuels des règles de gestion (mode dev) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher, en mode dev uniquement, une icône d'indice au survol sur les boutons type/statut de la modale d'item, montrant la règle de gestion qui s'applique à ce bouton — et fournir cette même donnée comme documentation consultable pour Claude.

**Architecture:** Un fichier de données typé (`businessRules.ts`) fait office de source unique (UI + documentation). Un composant `RuleHint` fait le lookup et le rendu conditionnel (dev uniquement, seulement si une règle matche). Intégration ponctuelle dans `ItemEditModal.tsx` sur les boutons desktop de type et de statut.

**Tech Stack:** React + TypeScript, Tailwind (classes `group`/`group-hover` pour le tooltip CSS pur, pas de librairie externe), lucide-react pour l'icône.

**Tests:** Pas de suite automatisée — conformément à la spec ([docs/superpowers/specs/2026-07-25-business-rules-hints-design.md](../specs/2026-07-25-business-rules-hints-design.md), section "Tests"), c'est un composant d'affichage dev-only sans logique métier. Vérification par typecheck + contrôle manuel dans le navigateur à la fin.

**Commits:** Pas de commit automatique entre les tâches — règle du projet (CLAUDE.md) : jamais de commit sans demande explicite de l'utilisateur. Chaque tâche se termine par une vérification (typecheck), pas par un commit.

---

### Task 1: Fichier de données des règles

**Files:**
- Create: `apps/web/src/lib/businessRules.ts`

- [ ] **Step 1: Créer le fichier avec les types et les 4 règles initiales**

```ts
/* Registre des règles de gestion implicites (type/statut/priorité), consulté par RuleHint (UI dev) et par Claude comme documentation vivante. */

export interface ItemBusinessRule {
  id: string;
  category: 'type' | 'status' | 'priority';
  appliesToValues: string[];
  trigger: string;
  effect: string;
  location: string;
}

export interface PageBusinessRule {
  id: string;
  page: string;
  trigger: string;
  effect: string;
  location: string;
}

export const ITEM_BUSINESS_RULES: ItemBusinessRule[] = [
  {
    id: 'default-type-undefined',
    category: 'type',
    appliesToValues: ['UNDEFINED'],
    trigger: "Création d'un item",
    effect: 'Type initialisé à UNDEFINED ("Non défini")',
    location: 'apps/web/src/pages/SpacePage.tsx:470,502,517',
  },
  {
    id: 'status-clear-dates',
    category: 'status',
    appliesToValues: ['undefined'],
    trigger: 'Statut = "Non défini"',
    effect: 'Vide les dates de début et de fin',
    location: 'apps/web/src/components/ItemEditModal.tsx:1084',
  },
  {
    id: 'status-autofill-start',
    category: 'status',
    appliesToValues: ['todo', 'in_progress', 'to_validate', 'scheduled', 'late'],
    trigger: 'Statut choisi (≠ "Non défini"), date de début vide',
    effect: "Remplit la date de début à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1088',
  },
  {
    id: 'status-autofill-end-terminal',
    category: 'status',
    appliesToValues: ['done', 'cancelled'],
    trigger: 'Statut = "Terminé"/"Annulé", date de fin vide',
    effect: "Remplit la date de fin à aujourd'hui",
    location: 'apps/web/src/components/ItemEditModal.tsx:1087',
  },
];

export const PAGE_BUSINESS_RULES: PageBusinessRule[] = [];
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur (fichier non encore importé nulle part, donc juste une vérification de syntaxe/types du fichier lui-même).

---

### Task 2: Composant RuleHint

**Files:**
- Create: `apps/web/src/components/ui/RuleHint.tsx`

- [ ] **Step 1: Créer le composant**

```tsx
/* Icône d'indice (mode dev uniquement) : affiche au survol les règles de gestion (businessRules.ts) liées à un bouton type/statut/priorité. Ne rend rien en prod ni si aucune règle ne matche. */
import { Info } from 'lucide-react';
import { ITEM_BUSINESS_RULES } from '../../lib/businessRules';

interface RuleHintProps {
  category: 'type' | 'status' | 'priority';
  value: string;
}

export function RuleHint({ category, value }: RuleHintProps) {
  if (!import.meta.env.DEV) return null;
  const rules = ITEM_BUSINESS_RULES.filter(
    (r) => r.category === category && r.appliesToValues.includes(value)
  );
  if (rules.length === 0) return null;
  return (
    <span className="group relative inline-flex items-center ml-1">
      <Info className="w-3 h-3 text-indigo-400" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50 w-max max-w-[240px] rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg text-left normal-case font-normal">
        <ul className="list-disc pl-3 space-y-0.5">
          {rules.map((r) => (
            <li key={r.id}>{r.effect}</li>
          ))}
        </ul>
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur.

---

### Task 3: Intégration dans ItemEditModal

**Files:**
- Modify: `apps/web/src/components/ItemEditModal.tsx:28` (imports)
- Modify: `apps/web/src/components/ItemEditModal.tsx:1035-1039` (boutons type)
- Modify: `apps/web/src/components/ItemEditModal.tsx:1091-1093` (boutons statut)

- [ ] **Step 1: Ajouter l'import**

Après la ligne `import { TagBadge } from './ui/TagBadge';` (ligne 28), ajouter :

```ts
import { RuleHint } from './ui/RuleHint';
```

- [ ] **Step 2: Ajouter RuleHint sur les boutons de type**

Remplacer :

```tsx
                              <button key={key} type="button" onClick={() => setType(key as ItemType)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${isSelected ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current text-gray-900` : 'opacity-60 hover:opacity-100'}`}>
                                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                                {config.labelShort}
                              </button>
```

par :

```tsx
                              <button key={key} type="button" onClick={() => setType(key as ItemType)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${isSelected ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current text-gray-900` : 'opacity-60 hover:opacity-100'}`}>
                                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                                {config.labelShort}
                                <RuleHint category="type" value={key} />
                              </button>
```

- [ ] **Step 3: Ajouter RuleHint sur les boutons de statut**

Remplacer :

```tsx
                            className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${isSelected ? `${s.borderColor} font-semibold shadow-sm ring-2 ring-offset-1 ring-current` : `${s.borderColor} opacity-60 hover:opacity-100`}`}>
                            {s.label}
                          </button>
```

par :

```tsx
                            className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${isSelected ? `${s.borderColor} font-semibold shadow-sm ring-2 ring-offset-1 ring-current` : `${s.borderColor} opacity-60 hover:opacity-100`}`}>
                            {s.label}
                            <RuleHint category="status" value={s.id} />
                          </button>
```

- [ ] **Step 4: Vérifier le typecheck**

Run: `pnpm --filter @spok/web typecheck`
Expected: pas d'erreur.

---

### Task 4: Vérification manuelle

- [ ] **Step 1: Ouvrir un item en mode dev**

Dans le navigateur (dev server déjà lancé), ouvrir un item existant ou en créer un nouveau.

- [ ] **Step 2: Vérifier les boutons de type**

Le bouton "Non défini" du sélecteur de type doit afficher une petite icône `Info` ; survoler l'icône doit montrer le tooltip "Type initialisé à UNDEFINED (\"Non défini\")". Les autres boutons de type ne doivent afficher aucune icône.

- [ ] **Step 3: Vérifier les boutons de statut**

- "Non défini" → icône avec tooltip "Vide les dates de début et de fin"
- "À faire", "En cours", "À valider", "Planifié", "En retard" → icône avec tooltip "Remplit la date de début à aujourd'hui"
- "Terminé", "Annulé" → icône avec tooltip "Remplit la date de fin à aujourd'hui"

- [ ] **Step 4: Vérifier l'absence en prod**

Confirmer que `import.meta.env.DEV` est bien `false` en build de production (comportement déjà utilisé ailleurs dans le code, ex. `Layout.tsx:689` — pas de build de prod à faire ici, juste confirmer que le composant retourne `null` quand `import.meta.env.DEV` est falsy, ce que Step 1 du Task 2 couvre déjà par lecture du code).

---

## Self-review

- **Couverture spec** : les 4 règles, la structure à deux tableaux, le composant dev-only, l'intégration ciblée boutons type+statut — tout est couvert. `PAGE_BUSINESS_RULES` créé vide comme prévu (hors périmètre de peuplement).
- **Pas de placeholder** : chaque step contient le code exact à écrire.
- **Cohérence des types** : `ItemBusinessRule`/`PageBusinessRule` définis en Task 1, réutilisés tels quels (import `ITEM_BUSINESS_RULES`) en Task 2, aucune divergence de nom.
