/* Vue d'ouverture d'un espace : sa vue par défaut (Space.defaultView) si elle est réglée, sinon celle du contexte
 * de sa communauté (Community.context), sinon la Liste — décision Thomas 2026-10-24 (des communautés d'une centaine
 * d'espaces s'ouvraient toutes en Liste, vue jamais utilisée).
 * - resolveSpaceDefaultView(defaultView, communityContext) : pur, seul calcul de ce repli — SpacePage (ouverture),
 *   SpaceCard et barre latérale (liens ?view=), SpaceSettingsPage (option « Selon la communauté »).
 * - contextDefaultView(context) : vue du contexte seul (libellé de l'option des paramètres).
 * Le contexte enregistré de la communauté fait foi, pas la bascule manuelle Forum / Projet / Tous de l'en-tête :
 * la vue d'ouverture est la même pour tous les membres. Règle businessRules « space-default-view-by-context ». */

import type { CommunityContext } from '@spok/shared';

/** Vue d'ouverture par contexte de communauté — Forum : Discussions, Projet : Gantt, JDR : Carte mentale */
export const CONTEXT_DEFAULT_VIEW: Record<CommunityContext, string> = {
  FORUM: 'thread',
  PROJECT: 'timeline',
  JDR: 'mindmap',
};

/** Repli quand ni l'espace ni sa communauté n'en décident (communauté neutre, espace personnel) */
export const FALLBACK_SPACE_VIEW = 'list';

export function contextDefaultView(context: string | null | undefined): string {
  return (context && CONTEXT_DEFAULT_VIEW[context as CommunityContext]) || FALLBACK_SPACE_VIEW;
}

export function resolveSpaceDefaultView(defaultView: string | null | undefined, communityContext: string | null | undefined): string {
  return defaultView || contextDefaultView(communityContext);
}

/** Lien vers un espace (barre latérale, cartes) : ?view= porte sa vue d'ouverture quand l'espace ou sa communauté en
 * décide ; sans l'un ni l'autre, pas de ?view (SpacePage garde alors la vue en cours, comme avant). */
export function spaceHref(space: { id: string; defaultView?: string | null; communityId?: string | null }, contexts: Map<string, string | null>): string {
  const context = space.communityId ? contexts.get(space.communityId) : null;
  const view = space.defaultView || (context ? CONTEXT_DEFAULT_VIEW[context as CommunityContext] : undefined);
  return `/spaces/${space.id}${view ? `?view=${view}` : ''}`;
}
