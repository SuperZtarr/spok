import { useQuery } from '@tanstack/react-query';
import { graphApi } from '../lib/api';

export function useGraphData(
  level: 'space' | 'community' | 'global',
  entityId: string | undefined,
  linkTypes: string[],
  communityIds?: string[]
) {
  return useQuery({
    queryKey: ['graph', level, entityId, linkTypes, communityIds],
    queryFn: () => {
      if (level === 'space' && entityId) {
        return graphApi.space(entityId, linkTypes);
      }
      if (level === 'community' && entityId) {
        return graphApi.community(entityId, linkTypes);
      }
      return graphApi.global(linkTypes, communityIds);
    },
    enabled: level === 'global' || !!entityId,
  });
}
