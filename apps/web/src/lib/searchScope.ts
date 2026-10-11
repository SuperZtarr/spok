/*
 * Portée par défaut de la recherche (/search) selon la page d'où on la lance :
 * dans un espace → ?spaceId=, dans une communauté → ?communityId=, ailleurs → aucune.
 * Basé uniquement sur le pathname (pas sur le store communauté persisté, qui resterait
 * actif depuis l'accueil). Utilisé par les boutons Recherche du bandeau et du menu mobile.
 */

/** Route /search avec la portée déduite du pathname courant. */
export function buildSearchRoute(pathname: string): string {
  const space = pathname.match(/^\/spaces\/([^/]+)/);
  if (space) return `/search?spaceId=${encodeURIComponent(space[1])}`;
  const community = pathname.match(/^\/communities\/([^/]+)/);
  if (community) return `/search?communityId=${encodeURIComponent(community[1])}`;
  return '/search';
}

/** Résout la route d'une entrée de menu : seule l'entrée « search » reçoit la portée. */
export function resolveMenuRoute(key: string, route: string, pathname: string): string {
  return key === 'search' ? buildSearchRoute(pathname) : route;
}
