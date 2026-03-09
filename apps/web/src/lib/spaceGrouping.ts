/**
 * Utility to group spaces by community for display in selects and lists.
 */

interface SpaceWithCommunity {
  id: string;
  name: string;
  communityId?: string | null;
  community?: { id: string; name: string } | null;
  [key: string]: any;
}

export interface SpaceGroup<T extends SpaceWithCommunity = SpaceWithCommunity> {
  label: string;
  communityId: string | null;
  spaces: T[];
}

/**
 * Groups spaces by community. Personal spaces (no community) go first.
 */
export function groupSpacesByCommunity<T extends SpaceWithCommunity>(spaces: T[]): SpaceGroup<T>[] {
  const communityMap = new Map<string, { label: string; spaces: T[] }>();
  const personal: T[] = [];

  for (const space of spaces) {
    if (space.communityId && space.community) {
      if (!communityMap.has(space.communityId)) {
        communityMap.set(space.communityId, { label: space.community.name, spaces: [] });
      }
      communityMap.get(space.communityId)!.spaces.push(space);
    } else if (space.communityId) {
      // Has communityId but no community object loaded — group under ID
      if (!communityMap.has(space.communityId)) {
        communityMap.set(space.communityId, { label: 'Communauté', spaces: [] });
      }
      communityMap.get(space.communityId)!.spaces.push(space);
    } else {
      personal.push(space);
    }
  }

  const groups: SpaceGroup<T>[] = [];
  if (personal.length > 0) {
    groups.push({ label: 'Espaces personnels', communityId: null, spaces: personal });
  }
  for (const [communityId, group] of communityMap) {
    groups.push({ label: group.label, communityId, spaces: group.spaces });
  }
  return groups;
}
