import { useQuery } from '@tanstack/react-query';
import { graphApi } from '../lib/api';

export function useSunburstData(communityIds?: string[], spaceId?: string, additionalSpaceIds?: string[]) {
  return useQuery({
    queryKey: ['sunburst', spaceId || null, communityIds, additionalSpaceIds],
    queryFn: () => graphApi.sunburst(
      spaceId ? undefined : communityIds,
      spaceId,
      additionalSpaceIds
    ),
  });
}
