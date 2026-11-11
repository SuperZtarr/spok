/*
 * Critères Types, Statuts et Tags de la barre d'espace (choix multiple, 2026-11-05 ; Tags 2026-11-11) : seule
 * comparaison utilisée par les vues et par SpacePage, à ne pas recopier dans une vue. Un élément correspond s'il a
 * l'un des types cochés ET l'un des statuts cochés ET l'un des tags cochés (règle filter-multi-choice de
 * businessRules.ts). Le statut 'undefined' désigne un élément sans statut ; le tag NO_TAG un élément sans tag.
 * Paramètres : la liste des valeurs cochées (undefined si rien n'est coché) et la valeur de l'élément.
 * Tags : appliqués par SpacePage (filterBySearch en Filtre, searchMatchIds en Aperçu), jamais dans une vue.
 */

/** Valeur du choix « Sans tag » du filtre Tags */
export const NO_TAG = '__none__';

/** L'élément répond à tous les critères posés. Faux si aucun critère n'est posé : rien à mettre en évidence. */
export function matchesCriteria(
  types: string[] | undefined,
  statuses: string[] | undefined,
  type: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!types && !statuses) return false;
  return (!types || matchesType(types, type)) && (!statuses || matchesStatus(statuses, status));
}

export function matchesType(types: string[] | undefined, type: string | null | undefined): boolean {
  return !!types && !!type && types.includes(type);
}

export function matchesStatus(statuses: string[] | undefined, status: string | null | undefined): boolean {
  if (!statuses) return false;
  return status ? statuses.includes(status) : statuses.includes('undefined');
}

/** L'élément porte l'un des tags cochés (NO_TAG : il n'en porte aucun). Faux si rien n'est coché. */
export function matchesTags(tagIds: string[] | undefined, itemTags: Array<{ id: string }> | null | undefined): boolean {
  if (!tagIds) return false;
  if (!itemTags || itemTags.length === 0) return tagIds.includes(NO_TAG);
  return itemTags.some((t) => tagIds.includes(t.id));
}
