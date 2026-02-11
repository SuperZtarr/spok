import { useQuery } from '@tanstack/react-query';
import { graphApi } from '../lib/api';

export function useSunburstData(communityIds?: string[], spaceId?: string) {
  return useQuery({
    queryKey: ['sunburst', spaceId || null, communityIds],
    queryFn: () => graphApi.sunburst(
      spaceId ? undefined : communityIds,
      spaceId
    ),
  });
}
