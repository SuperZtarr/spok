/* Mode d'ouverture de la fiche d'un élément : Lire ('read', ItemReadView), Modifier ('edit'), Composer ('compose' :
 * atelier d'un article ou d'un process, dans la fiche en plein écran — retour dans la fiche décidé par Thomas
 * 2026-11-26 pour garder les barres des vues).
 * - Menus : « Lire » → 'read', « Modifier » → 'edit', « Composer » → 'compose' (itemMenuGroups.ts)
 * - Adresse : ?item=<id>&mode=lecture | composition rouvre la fiche dans ce mode (lien partageable) ; sans mode = défaut.
 * - Composer un article ou un process se fait sur sa page : articleComposeUrl / processComposeUrl (mode=composition),
 *   isComposing ; sans ce paramètre, la page est en lecture (« Lire »).
 * - Défaut (aucun mode demandé, ex. clic simple dans une vue) : 'edit' si l'espace est modifiable par l'utilisateur,
 *   'read' sinon (visiteur anonyme ou membre en lecture seule) — règle businessRules « item-open-mode-default ».
 * articlePageUrl : adresse de la page de lecture d'un article ; on y va avec { state: { from } } pour que son
 * « Retour à l'espace » ramène à la vue d'origine (articleReturnState).
 * processPageUrl : canevas d'un élément Process (vue Process de son espace, ?process=<id>, SpacePage).
 * itemShareUrl : lien court et complet d'un élément (https://…/items/<id>, « Copier le lien » de la fiche) ; la page
 * /items/:itemId (ItemLinkPage) retrouve l'espace puis redirige vers itemUrl — règle item-share-link.
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

/** Lien court et complet d'un élément, à partager : l'espace est retrouvé à l'ouverture (ItemLinkPage). */
export function itemShareUrl(itemId: string, origin: string = window.location.origin): string {
  return `${origin}/items/${itemId}`;
}

/** Mode effectif à l'ouverture : celui demandé, sinon lecture pour qui ne peut pas modifier l'espace. */
export function resolveItemMode(requested: ItemOpenMode | undefined, canEditSpace: boolean): ItemOpenMode {
  return requested ?? (canEditSpace ? 'edit' : 'read');
}

/** Adresse de la page de lecture d'un article. */
export function articlePageUrl(spaceId: string, articleId: string): string {
  return `/spaces/${spaceId}/articles/${articleId}`;
}

/** Page d'un article ouverte en composition (bouton « Composer » de la fiche et de la page, 2026-11-26). */
export function articleComposeUrl(spaceId: string, articleId: string): string {
  return `${articlePageUrl(spaceId, articleId)}?${ITEM_MODE_PARAM}=${COMPOSE_VALUE}`;
}

/** La page d'un article ou le canevas d'un process est-il demandé en composition ? (paramètre de son adresse) */
export function isComposing(value: string | null | undefined): boolean {
  return value === COMPOSE_VALUE;
}
/** @deprecated nom d'origine (page Article) — utiliser isComposing */
export const isArticleComposing = isComposing;

/** Canevas d'un élément Process en composition (2026-11-26) ; sans mode = consultation (« Lire »). */
export function processComposeUrl(spaceId: string, processId: string): string {
  return `${processPageUrl(spaceId, processId)}&${ITEM_MODE_PARAM}=${COMPOSE_VALUE}`;
}

/** Canevas d'un élément Process (2026-11-21) : vue Process de son espace, process ouvert par ?process=. */
export function processPageUrl(spaceId: string, processId: string): string {
  return `/spaces/${spaceId}?view=process&process=${processId}`;
}

/** État de navigation vers cette page : l'adresse à retrouver avec son « Retour à l'espace ». */
export function articleReturnState(from: { pathname: string; search: string }): { from: string } {
  return { from: `${from.pathname}${from.search}` };
}
