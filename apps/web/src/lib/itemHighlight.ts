/*
 * Critères Types et Statuts de la barre d'espace (choix multiple, 2026-11-05) : seule comparaison utilisée par les
 * vues en Aperçu, à ne pas recopier dans une vue. Un élément correspond s'il a l'un des types cochés ET l'un des
 * statuts cochés (règle filter-multi-choice de businessRules.ts). Le statut 'undefined' désigne un élément sans statut.
 * Paramètres : la liste des valeurs cochées (undefined si rien n'est coché) et la valeur de l'élément.
 */

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
