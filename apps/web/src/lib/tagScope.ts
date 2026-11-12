/* Portée des tags côté interface (règle tag-scope de lib/businessRules.ts ; source API : utils/tagScope.ts).
 * Un tag est global, de la communauté, ou d'un espace (proposé aussi dans ses sous-espaces). Les listes de tags
 * (sélecteur de la fiche, palette de la vue Tags, filtre Tags de la barre) les regroupent dans cet ordre.
 * - tagScopeOf(tag) : portée, d'après tag.scope (GET /spaces/:id/tags), à défaut isGlobalTag / isCommunityTag.
 * - groupTagsByScope(tags) : groupes non vides { scope, label, tags } — globaux, communauté, espace — triés par nom ;
 *   dans le groupe Espace, les tags de l'espace courant avant ceux hérités d'un parent.
 * - tagScopeBadge(tag) : petit libellé (« global », « communauté », « cet espace », « espace « Parent » »).
 * Ne pas recalculer la portée ailleurs : passer par ces fonctions.
 */
import type { Tag, TagScope } from '@spok/shared';

export const TAG_SCOPE_LABELS: Record<TagScope, string> = { global: 'Globaux', community: 'Communauté', space: 'Espace' };
const ORDER: TagScope[] = ['global', 'community', 'space'];

export function tagScopeOf(tag: Tag): TagScope {
  if (tag.scope) return tag.scope;
  if (tag.isGlobalTag) return 'global';
  if (tag.isCommunityTag || tag.communityId) return 'community';
  if (tag.spaceId) return 'space';
  return tag.isGlobalTag === false ? 'community' : 'global';
}

const byName = (a: Tag, b: Tag) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

export function groupTagsByScope<T extends Tag>(tags: T[]): { scope: TagScope; label: string; tags: T[] }[] {
  return ORDER.map((scope) => {
    const list = tags.filter((t) => tagScopeOf(t) === scope);
    list.sort(scope === 'space' ? (a, b) => Number(!!a.inherited) - Number(!!b.inherited) || byName(a, b) : byName);
    return { scope, label: TAG_SCOPE_LABELS[scope], tags: list };
  }).filter((g) => g.tags.length > 0);
}

export function tagScopeBadge(tag: Tag): string {
  const scope = tagScopeOf(tag);
  if (scope === 'global') return 'global';
  if (scope === 'community') return 'communauté';
  return tag.inherited && tag.spaceName ? `espace « ${tag.spaceName} »` : 'cet espace';
}
