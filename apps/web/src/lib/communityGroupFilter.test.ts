/* Tests du filtre des communautés par groupe personnel (lib/communityGroupFilter.ts). */
import { describe, it, expect } from 'vitest';
import { filterCommunitiesByGroup, resolveActiveGroup, groupIdOfCommunity } from './communityGroupFilter';

const communities = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
const groups = [
  { id: 'g1', name: 'Pro', order: 0, communityIds: ['c1'] },
  { id: 'g2', name: 'Perso', order: 1, communityIds: ['c2'] },
];

describe('communityGroupFilter', () => {
  it('keeps everything for "all"', () => {
    expect(filterCommunitiesByGroup(communities, groups, 'all')).toEqual(communities);
  });

  it('keeps the communities of the active group', () => {
    expect(filterCommunitiesByGroup(communities, groups, 'g2')).toEqual([{ id: 'c2' }]);
  });

  it('keeps communities in no group for "ungrouped"', () => {
    expect(filterCommunitiesByGroup(communities, groups, 'ungrouped')).toEqual([{ id: 'c3' }]);
  });

  it('falls back to "all" when the active group no longer exists', () => {
    expect(resolveActiveGroup('gone', groups)).toBe('all');
    expect(filterCommunitiesByGroup(communities, groups, 'gone')).toEqual(communities);
  });

  it('finds the group of a community', () => {
    expect(groupIdOfCommunity('c1', groups)).toBe('g1');
    expect(groupIdOfCommunity('c3', groups)).toBeNull();
  });
});
