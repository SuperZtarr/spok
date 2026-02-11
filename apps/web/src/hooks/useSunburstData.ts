import { useQuery } from '@tanstack/react-query';
import { graphApi } from '../lib/api';

export function useSunburstData(communityIds?: string[]) {
  return useQuery({
    queryKey: ['sunburst', communityIds],
    queryFn: () => graphApi.sunburst(communityIds),
  });
}
