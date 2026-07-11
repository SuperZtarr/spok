/* Feed d'activité (/activity) : éléments non lus groupés communauté > espace, avec mute. */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Loader2 } from 'lucide-react';
import { activityApi, communitiesApi } from '../lib/api';
import { ItemEditModal } from '../components/ItemEditModal';
import { CommunityCard } from '../components/ui/CommunityCard';
import { SpaceCard } from '../components/ui/SpaceCard';
import { ItemCard } from '../components/ui/ItemCard';

export function ActivityPage() {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: communitiesData } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });
  const communities = communitiesData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['activity'],
    queryFn: () => activityApi.feed(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markViewed = useMutation({
    mutationFn: activityApi.markViewed,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activity'] }),
  });

  const muteCommunity = useMutation({
    mutationFn: ({ id, muted }: { id: string; muted: boolean }) =>
      communitiesApi.setMuted(id, muted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });

  function handleOpenItem(itemId: string, spaceId: string) {
    markViewed.mutate(itemId);
    setSelectedItemId(itemId);
    setSelectedSpaceId(spaceId);
  }

  const groups = (data as any)?.groups ?? [];
  const total = (data as any)?.total ?? 0;

  const communityById = new Map(communities.map(c => [c.id, c]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-semibold">Activité récente</h1>
        {total > 0 && (
          <span className="bg-primary text-primary-foreground text-xs rounded-full px-2 py-0.5 font-medium">
            {total}
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune activité non vue</p>
          <p className="text-xs mt-1 opacity-60">Les éléments modifiés par d'autres apparaissent ici</p>
        </div>
      ) : (
        groups.map((group: any) => {
          const community = { ...group.community, ...(communityById.get(group.community.id) ?? {}) };
          return (
            <div key={group.community.id} className="space-y-2">
              <div className="max-w-xs">
                <CommunityCard
                  community={community}
                  onMute={(muted) => muteCommunity.mutate({ id: group.community.id, muted })}
                  isMutePending={muteCommunity.isPending}
                />
              </div>

              {/* Espaces de la communauté */}
              <div className="ml-4 border border-border rounded-xl bg-muted/30 p-3 space-y-3">
                {group.spaces.map((spaceGroup: any) => (
                  <div key={spaceGroup.space.id} className="space-y-2">
                    <div className="max-w-xs">
                      <SpaceCard space={spaceGroup.space} />
                    </div>

                    {/* Items de l'espace */}
                    {spaceGroup.items.length > 0 && (
                      <div className="border border-border rounded-lg bg-background p-2 flex flex-wrap gap-2">
                        {spaceGroup.items.map((item: any) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            onClick={() => handleOpenItem(item.id, item.spaceId)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Sous-espaces */}
                    {spaceGroup.children?.length > 0 && (
                      <div className="ml-4 border border-border rounded-xl bg-muted/20 p-2 space-y-2">
                        {spaceGroup.children.map((childGroup: any) => (
                          <div key={childGroup.space.id} className="space-y-2">
                            <div className="max-w-xs">
                              <SpaceCard space={childGroup.space} />
                            </div>
                            {childGroup.items.length > 0 && (
                              <div className="border border-border rounded-lg bg-background p-2 flex flex-wrap gap-2">
                                {childGroup.items.map((item: any) => (
                                  <ItemCard
                                    key={item.id}
                                    item={item}
                                    onClick={() => handleOpenItem(item.id, item.spaceId)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {selectedItemId && selectedSpaceId && (
        <ItemEditModal
          isOpen={true}
          itemId={selectedItemId}
          spaceId={selectedSpaceId}
          allItems={[]}
          onClose={() => { setSelectedItemId(null); setSelectedSpaceId(null); }}
          onDelete={() => {
            setSelectedItemId(null);
            setSelectedSpaceId(null);
            queryClient.invalidateQueries({ queryKey: ['activity'] });
          }}
        />
      )}
    </div>
  );
}
