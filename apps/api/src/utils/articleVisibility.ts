/*
 * Règle « moins visible » d'un article (spec Article 2026-10-23) : à l'ajout d'une référence, avertir si l'élément
 * référencé atteint moins de lecteurs que l'article (ses lecteurs le verront quand même — l'article publie ses blocs).
 * Portée : 0 = espace privé ; 1 = membres de la communauté seulement (espace non privé, communauté privée) ;
 * 2 = public (espace non privé, communauté non privée). VisibilityInfo se construit depuis getEffectiveVisibilities.
 * Avertissement seulement — jamais une interdiction (décision Thomas).
 */

export type VisibilityInfo = {
  spaceId: string;
  visibility: string;
  communityId: string | null;
  communityVisibility: string | null;
};

function reach(v: VisibilityInfo): 0 | 1 | 2 {
  if (v.visibility === 'PRIVATE') return 0;
  return v.communityVisibility && v.communityVisibility !== 'PRIVATE' ? 2 : 1;
}

export function isLessVisible(article: VisibilityInfo, ref: VisibilityInfo): boolean {
  const a = reach(article);
  const r = reach(ref);
  if (r < a) return true;
  if (r === 1 && a === 1 && ref.communityId !== article.communityId) return true;
  if (r === 0 && ref.spaceId !== article.spaceId) return true;
  return false;
}
