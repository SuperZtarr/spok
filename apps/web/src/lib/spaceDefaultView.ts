/* Vue d'ouverture d'un espace : sa vue par défaut (Space.defaultView) si elle est réglée, sinon celle du contexte
 * de sa communauté (Community.context), sinon la Liste — décision Thomas 2026-10-24 (des communautés d'une centaine
 * d'espaces s'ouvraient toutes en Liste, vue jamais utilisée).
 * - resolveSpaceDefaultView(defaultView, communityContext) : pur, seul calcul de ce repli — SpacePage (ouverture),
 *   SpaceCard et icônes de la barre latérale, SpaceSettingsPage (option « Selon la communauté »).
 * - openingView(...) : vue affichée à l'ouverture — gardée d'un espace à l'autre dans la même communauté, vue
 *   d'ouverture sinon (2026-11-13). spaceHref n'ajoute plus de ?view= (il imposait la vue d'ouverture à chaque clic).
 * - contextDefaultView(context) : vue du contexte seul (libellé de l'option des paramètres).
 * Le contexte enregistré de la communauté fait foi, pas la bascule manuelle Forum / Projet / Tous de l'en-tête :
 * la vue d'ouverture est la même pour tous les membres. Règle businessRules « space-default-view-by-context ».
 * knownViewOr(view) : vue retirée du registre (ex. « bugs », « overview » supprimée le 2026-11-13) → Liste ; appliquée
 * par SpacePage à l'ouverture. La présentation d'un espace est la page /spaces/:id/overview. */

import { VIEW_REGISTRY, DEFAULT_INTERFACE_MODE, getInterfaceMode, modeForContext } from '@spok/shared';

/** Repli quand ni l'espace ni sa communauté n'en décident (communauté neutre, espace personnel) : vue d'ouverture du
 *  mode Tous dans le registre des modes. */
export const FALLBACK_SPACE_VIEW: string = getInterfaceMode(DEFAULT_INTERFACE_MODE).openingView;

/** Vue d'ouverture du contexte d'une communauté : champ openingView de son mode dans MODE_REGISTRY (@spok/shared,
 *  2026-11-13) — jamais de table locale. */
export function contextDefaultView(context: string | null | undefined): string {
  return getInterfaceMode(modeForContext(context)).openingView;
}

/** La vue si elle existe encore (registre des vues), sinon la Liste — vue retirée (« bugs », 2026-11-11) dans une
 *  adresse, la vue mémorisée ou Space.defaultView : pas de migration, on ouvre la Liste. */
export function knownViewOr(view: string | null | undefined): string {
  return view && VIEW_REGISTRY.some((v) => v.id === view) ? view : FALLBACK_SPACE_VIEW;
}

export function resolveSpaceDefaultView(defaultView: string | null | undefined, communityContext: string | null | undefined): string {
  return defaultView || contextDefaultView(communityContext);
}

/** Vue affichée à l'ouverture d'un espace (décision Thomas 2026-11-13 : la vue est gardée d'un espace à l'autre
 *  dans la même communauté) — par priorité :
 *  1. ?view= de l'adresse (lien explicite, rechargement) ;
 *  2. la vue en cours, si l'espace précédent était dans la même communauté (ou personnel → personnel) ;
 *  3. la vue d'ouverture de l'espace (resolveSpaceDefaultView) : premier espace ouvert, ou autre communauté.
 *  Le résultat passe par knownViewOr (vue retirée → Liste). Pur : SpacePage fournit la communauté précédente. */
export function openingView(args: {
  urlView: string | null | undefined;
  currentView: string | null | undefined;
  previousCommunityId: string | null | undefined; // undefined = aucun espace ouvert avant dans cet onglet
  communityId: string | null;
  defaultView: string | null | undefined;
  communityContext: string | null | undefined;
}): string {
  const sameCommunity = args.previousCommunityId !== undefined && args.previousCommunityId === args.communityId;
  return knownViewOr(
    args.urlView || (sameCommunity ? args.currentView : null) || resolveSpaceDefaultView(args.defaultView, args.communityContext),
  );
}

/** Communauté du dernier espace ouvert dans l'onglet (null = espace personnel, undefined = aucun). Survit au démontage
 *  de SpacePage (fiche, paramètres, article puis retour) ; non persisté : un nouvel onglet repart de la vue d'ouverture. */
let lastOpenedCommunityId: string | null | undefined;
export const getLastOpenedCommunityId = (): string | null | undefined => lastOpenedCommunityId;
export const setLastOpenedCommunityId = (id: string | null): void => { lastOpenedCommunityId = id; };

/** Lien vers un espace (barre latérale) : jamais de ?view= depuis le 2026-11-13 — la vue se décide à l'ouverture
 *  (openingView) : gardée dans la même communauté, vue d'ouverture ailleurs. `contexts` n'est plus lu (signature
 *  conservée pour les appelants de Layout). */
export function spaceHref(space: { id: string; defaultView?: string | null; communityId?: string | null }, _contexts?: Map<string, string | null>): string {
  return `/spaces/${space.id}`;
}
