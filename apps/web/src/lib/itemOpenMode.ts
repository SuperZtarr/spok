/* Mode d'ouverture de la modale item : « Afficher » (lecture, ItemReadView), « Modifier » / « Fiche » (ItemEditModal) ou,
 * pour un article que l'on peut modifier, « Composer » (ses blocs, ArticleEditor dans la fiche).
 * - Menu des items : « Afficher » → 'read', « Ouvrir » → 'edit' (itemMenuGroups.ts)
 * - Adresse : ?item=<id>&mode=lecture rouvre l'item en lecture (lien partageable), &mode=composition en Composer
 *   (lien « Composer » de la page d'un article) ; sans mode = défaut
 * - Défaut (aucun mode demandé, ex. clic simple dans une vue) : 'edit' si l'espace est modifiable par l'utilisateur,
 *   'read' sinon (visiteur anonyme ou membre en lecture seule) — règle businessRules « item-open-mode-default ».
 * articlePageUrl : adresse de la page de lecture d'un article ; on y va avec { state: { from } } pour que son
 * « Retour à l'espace » ramène à la vue d'origine (articleReturnState).
 * Ne pas lire `mode` ailleurs qu'ici : parseItemMode / itemUrl sont la seule source du format d'URL. */

export type ItemOpenMode = 'read' | 'edit' | 'compose';

export const ITEM_MODE_PARAM = 'mode';
const READ_VALUE = 'lecture';
const COMPOSE_VALUE = 'composition';

/** Valeur du paramètre d'URL → mode ; undefined si absent ou inconnu (le défaut s'applique). */
export function parseItemMode(value: string | null | undefined): ItemOpenMode | undefined {
  if (value === READ_VALUE) return 'read';
  if (value === 'edition') return 'edit';
  if (value === COMPOSE_VALUE) return 'compose';
  return undefined;
}

/** Adresse d'un item dans son espace, avec le mode s'il est demandé. */
export function itemUrl(spaceId: string, itemId: string, mode?: ItemOpenMode): string {
  const base = `/spaces/${spaceId}/content?item=${itemId}`;
  if (mode === 'read') return `${base}&${ITEM_MODE_PARAM}=${READ_VALUE}`;
  if (mode === 'compose') return `${base}&${ITEM_MODE_PARAM}=${COMPOSE_VALUE}`;
  return base;
}

/** Mode effectif à l'ouverture : celui demandé, sinon lecture pour qui ne peut pas modifier l'espace. */
export function resolveItemMode(requested: ItemOpenMode | undefined, canEditSpace: boolean): ItemOpenMode {
  return requested ?? (canEditSpace ? 'edit' : 'read');
}

/** Adresse de la page de lecture d'un article. */
export function articlePageUrl(spaceId: string, articleId: string): string {
  return `/spaces/${spaceId}/articles/${articleId}`;
}

/** État de navigation vers cette page : l'adresse à retrouver avec son « Retour à l'espace ». */
export function articleReturnState(from: { pathname: string; search: string }): { from: string } {
  return { from: `${from.pathname}${from.search}` };
}
