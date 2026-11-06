/*
 * Arbre des espaces publics d'une communauté, pour le plan du site (/sitemap).
 * Pourquoi : pour un connecté, GET /spaces renvoie aussi ses espaces privés et personnels ; un plan du site ne doit
 * lister que le contenu public, le même pour tous.
 * Visibilité effective : celle de l'espace, sinon celle de son parent, sinon celle de la communauté (même chaîne que
 * getEffectiveVisibilities côté API). Un espace dont le parent est masqué remonte à la racine.
 * Usage : affichage uniquement ; ne décide d'aucun droit, c'est l'API qui contrôle l'accès.
 */
export interface SiteSpaceInput {
  id: string;
  name: string;
  type?: string;
  parentId?: string | null;
  visibility?: string | null;
}

export interface PublicSpaceNode {
  id: string;
  name: string;
  children: PublicSpaceNode[];
}

/** Vrai si la visibilité est connue et n'est pas privée. */
export function isPublicVisibility(visibility?: string | null): boolean {
  return !!visibility && visibility !== 'PRIVATE';
}

/** Espaces publics d'une communauté en arborescence, dans l'ordre reçu de l'API. */
export function buildPublicSpaceTree(spaces: SiteSpaceInput[], communityVisibility?: string | null): PublicSpaceNode[] {
  const groupSpaces = spaces.filter((s) => s.type === undefined || s.type === 'GROUP');
  const byId = new Map(groupSpaces.map((s) => [s.id, s]));

  const effectiveVisibility = (space: SiteSpaceInput, seen: Set<string>): string | null | undefined => {
    if (space.visibility) return space.visibility;
    const parent = space.parentId ? byId.get(space.parentId) : undefined;
    if (!parent || seen.has(parent.id)) return communityVisibility;
    return effectiveVisibility(parent, seen.add(space.id));
  };

  const visible = groupSpaces.filter((s) => isPublicVisibility(effectiveVisibility(s, new Set())));
  const nodes = new Map(visible.map((s) => [s.id, { id: s.id, name: s.name, children: [] as PublicSpaceNode[] }]));
  const roots: PublicSpaceNode[] = [];
  for (const space of visible) {
    const node = nodes.get(space.id)!;
    const parentNode = space.parentId ? nodes.get(space.parentId) : undefined;
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  }
  return roots;
}
