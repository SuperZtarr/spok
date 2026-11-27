/*
 * Filtre des communautés par groupe personnel (2026-11-27) — fonctions pures, partagées par la sidebar (Layout) et
 * la liste des communautés (CommunityListView), testées dans communityGroupFilter.test.ts.
 * - resolveActiveGroup : 'all' si le groupe actif n'existe plus (supprimé, autre appareil).
 * - filterCommunitiesByGroup : garde les communautés du groupe actif ; 'ungrouped' = rangées dans aucun groupe.
 * - groupIdOfCommunity : groupe d'une communauté (null = non classée).
 * Règle de gestion : businessRules.ts, « community-groups ».
 */
import type { CommunityGroup } from './api';
import type { CommunityGroupFilterValue } from '../stores/communityGroupFilter';

export function resolveActiveGroup(active: CommunityGroupFilterValue, groups: CommunityGroup[]): CommunityGroupFilterValue {
  if (active === 'all' || active === 'ungrouped') return active;
  return groups.some((g) => g.id === active) ? active : 'all';
}

export function groupIdOfCommunity(communityId: string, groups: CommunityGroup[]): string | null {
  return groups.find((g) => g.communityIds.includes(communityId))?.id ?? null;
}

export function filterCommunitiesByGroup<T extends { id: string }>(
  communities: T[],
  groups: CommunityGroup[],
  active: CommunityGroupFilterValue,
): T[] {
  const resolved = resolveActiveGroup(active, groups);
  if (resolved === 'all') return communities;
  if (resolved === 'ungrouped') {
    const grouped = new Set(groups.flatMap((g) => g.communityIds));
    return communities.filter((c) => !grouped.has(c.id));
  }
  const ids = new Set(groups.find((g) => g.id === resolved)?.communityIds ?? []);
  return communities.filter((c) => ids.has(c.id));
}
