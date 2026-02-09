import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { communitiesApi } from '../lib/api';
import { GraphView } from '../components/views/GraphView';

export function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();

  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  const handleNodeClick = (itemId: string, spaceId: string) => {
    navigate(`/spaces/${spaceId}`, { state: { openItemId: itemId } });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-6 py-3 border-b flex items-center gap-3">
        <h1 className="text-lg font-semibold">
          {community?.name || 'Communaute'}
        </h1>
        <span className="text-sm text-muted-foreground">— Graphe</span>
      </div>
      <div className="flex-1 min-h-0">
        <GraphView
          level="community"
          entityId={communityId}
          communityId={communityId}
          communityName={community?.name}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}
