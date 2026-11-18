/*
 * Registre des catégories de la recherche avancée (GET /search/advanced, page Recherche) — SEULE source des
 * catégories (centralisation des référentiels, skill spok-dev § 1 bis, 2026-11-18 : elles étaient recopiées dans
 * SearchPage, la route API, le type des totaux et l'aide). Une entrée par catégorie porte TOUTES ses propriétés ;
 * tout le reste en est dérivé, jamais recopié :
 * - SearchCategory, SEARCH_CATEGORIES (validation API z.enum), DEFAULT_SEARCH_TYPES (valeur par défaut de ?types=) ;
 * - searchCategoriesShown : sections affichées selon les filtres d'items et la connexion (API et page) ;
 * - boutons, titres de section, « Voir les … autres », bandeau de retour (SearchPage, icônes via web constants/viewIcons) ;
 * - textes qui énumèrent les catégories (searchCategoriesPhrase : sous-titre de la page, fiche d'aide search).
 * Ordre du registre = ordre des boutons et des sections. Cohérence : apps/web/src/lib/searchCategories.test.ts.
 * Ajouter une catégorie : une entrée ici, puis sa section dans la route API et dans SearchPage.
 */

export interface SearchCategoryDefinition {
  /** Valeur de ?types= et clé de la réponse (tableau de résultats et totals) */
  id: string;
  /** Libellé du bouton et du titre de section */
  label: string;
  /** Nom au pluriel dans les phrases (« Voir les 11 autres items », aide) */
  noun: string;
  /** Nom d'icône Lucide (composant résolu par apps/web/src/constants/viewIcons) */
  icon: string;
  /** Section gardée quand un filtre d'item (type, statut, priorité, tag) est actif — filtrée via son item */
  keptUnderItemFilter: boolean;
  /** Catégorie réservée aux connectés (règle search-users-scope) : ni bouton ni résultat pour un visiteur */
  signedInOnly: boolean;
}

export const SEARCH_CATEGORY_REGISTRY = [
  { id: 'communities', label: 'Communautes', noun: 'communautés', icon: 'Building2', keptUnderItemFilter: false, signedInOnly: false },
  { id: 'spaces', label: 'Espaces', noun: 'espaces', icon: 'FolderKanban', keptUnderItemFilter: false, signedInOnly: false },
  { id: 'items', label: 'Items', noun: 'items', icon: 'FileText', keptUnderItemFilter: true, signedInOnly: false },
  { id: 'users', label: 'Utilisateurs', noun: 'utilisateurs', icon: 'Users', keptUnderItemFilter: false, signedInOnly: true },
  { id: 'contributions', label: 'Contributions', noun: 'contributions', icon: 'MessageSquare', keptUnderItemFilter: true, signedInOnly: false },
] as const satisfies readonly SearchCategoryDefinition[];

export type SearchCategory = typeof SEARCH_CATEGORY_REGISTRY[number]['id'];

/** Ids des catégories, dans l'ordre du registre (z.enum côté API). */
export const SEARCH_CATEGORIES = SEARCH_CATEGORY_REGISTRY.map((c) => c.id) as [SearchCategory, ...SearchCategory[]];

/** Valeur par défaut de ?types= : toutes les catégories. */
export const DEFAULT_SEARCH_TYPES = SEARCH_CATEGORIES.join(',');

export function isSearchCategory(id: string): id is SearchCategory {
  return (SEARCH_CATEGORIES as readonly string[]).includes(id);
}

export function getSearchCategory(id: SearchCategory): SearchCategoryDefinition {
  return SEARCH_CATEGORY_REGISTRY.find((c) => c.id === id)!;
}

/**
 * Catégories réellement affichées parmi celles demandées : sous filtre d'item, seules celles gardées
 * (keptUnderItemFilter) ; sans connexion, aucune réservée aux connectés (signedInOnly). Ids inconnus écartés.
 */
export function searchCategoriesShown(
  ids: Iterable<string>,
  { itemFiltersActive, signedIn }: { itemFiltersActive: boolean; signedIn: boolean },
): SearchCategory[] {
  return [...ids].filter(isSearchCategory).filter((id) => {
    const c = getSearchCategory(id);
    return (!itemFiltersActive || c.keptUnderItemFilter) && (signedIn || !c.signedInOnly);
  });
}

/** Noms au pluriel en phrase : « communautés, espaces, items, utilisateurs et contributions ». */
export function searchCategoriesPhrase(filter: (c: SearchCategoryDefinition) => boolean = () => true): string {
  const nouns = SEARCH_CATEGORY_REGISTRY.filter(filter).map((c) => c.noun);
  return nouns.length <= 1 ? nouns.join('') : `${nouns.slice(0, -1).join(', ')} et ${nouns[nouns.length - 1]}`;
}
