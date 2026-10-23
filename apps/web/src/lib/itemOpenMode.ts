/* Mode d'ouverture de la modale item : « Afficher » (lecture, ItemReadView) ou « Modifier » / « Fiche » (ItemEditModal).
 * - Menu des items : « Afficher » → 'read', « Ouvrir » → 'edit' (itemMenuGroups.ts)
 * - Adresse : ?item=<id>&mode=lecture rouvre l'item en lecture (lien partageable) ; sans mode = défaut
 * - Défaut (aucun mode demandé, ex. clic simple dans une vue) : 'edit' si l'espace est modifiable par l'utilisateur,
 *   'read' sinon (visiteur anonyme ou membre en lecture seule) — règle businessRules « item-open-mode-default ».
 * Ne pas lire `mode` ailleurs qu'ici : parseItemMode / itemUrl sont la seule source du format d'URL. */

export type ItemOpenMode = 'read' | 'edit';

export const ITEM_MODE_PARAM = 'mode';
const READ_VALUE = 'lecture';

/** Valeur du paramètre d'URL → mode ; undefined si absent ou inconnu (le défaut s'applique). */
export function parseItemMode(value: string | null | undefined): ItemOpenMode | undefined {
  if (value === READ_VALUE) return 'read';
  if (value === 'edition') return 'edit';
  return undefined;
}

/** Adresse d'un item dans son espace, avec le mode s'il est demandé. */
export function itemUrl(spaceId: string, itemId: string, mode?: ItemOpenMode): string {
  const base = `/spaces/${spaceId}/content?item=${itemId}`;
  return mode === 'read' ? `${base}&${ITEM_MODE_PARAM}=${READ_VALUE}` : base;
}

/** Mode effectif à l'ouverture : celui demandé, sinon lecture pour qui ne peut pas modifier l'espace. */
export function resolveItemMode(requested: ItemOpenMode | undefined, canEditSpace: boolean): ItemOpenMode {
  return requested ?? (canEditSpace ? 'edit' : 'read');
}
