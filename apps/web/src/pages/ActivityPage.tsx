import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, FolderOpen, BellOff, Bell, Loader2, Building2 } from 'lucide-react';
import { activityApi, communitiesApi } from '../lib/api';
import { ItemEditModal } from '../components/ItemEditModal';
import { TYPE_LABELS } from '../constants/ui';
import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';

const STATUS_COLOR_MAP = buildStatusColorMap();
const STATUS_LABEL_MAP = buildStatusLabelMap();

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function CommunityBanner({ community }: { community: { id: string; name: string; avatarUrl?: string | null; coverUrl?: string | null } }) {
  return (
    <div className="relative rounded-xl overflow-hidden border border-border bg-card">
      {community.coverUrl ? (
        <div className="aspect-[3/1] overflow-hidden">
          <img src={community.coverUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[3/1] bg-gradient-to-r from-primary/20 to-primary/5" />
      )}
      <div className="absolute -bottom-4 left-4">
        {community.avatarUrl ? (
          <img src={community.avatarUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" />
        ) : community.coverUrl ? (
          <img src={community.coverUrl} alt="" className="w-12 h-12 rounded-xl border-4 border-background object-cover shadow" style={{ objectPosition: 'top right' }} />
        ) : (
          <div className="w-12 h-12 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
      <div className="px-4 pt-6 pb-3">
        <p className="font-semibold text-sm">{community.name}</p>
      </div>
    </div>
  );
}

function SpaceBanner({ space }: { space: { id: string; name: string; avatarUrl?: string | null; coverUrl?: string | null } }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border bg-card">
      {space.coverUrl ? (
        <div className="h-24 overflow-hidden">
          <img src={space.coverUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5" />
      )}
      <div className="p-3 flex items-center gap-3">
        {space.avatarUrl ? (
          <img src={space.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
        ) : space.coverUrl ? (
          <img src={space.coverUrl} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" style={{ objectPosition: 'top right' }} />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
        )}
        <p className="font-medium text-sm">{space.name}</p>
      </div>
    </div>
  );
}

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

  const mutedCommunityIds = new Set(communities.filter(c => (c as any).muted).map(c => c.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
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
          const isMuted = mutedCommunityIds.has(group.community.id);
          return (
            <div key={group.community.id} className="space-y-3">
              {/* Community banner */}
              <div className="relative">
                <CommunityBanner community={group.community} />
                <button
                  onClick={() => muteCommunity.mutate({ id: group.community.id, muted: !isMuted })}
                  className={`absolute top-2 right-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    isMuted
                      ? 'bg-black/40 text-white/70 border-white/20'
                      : 'bg-black/30 text-white/80 border-white/20 hover:bg-black/50'
                  }`}
                  title={isMuted ? 'Réactiver' : 'Ignorer cette communauté'}
                >
                  {isMuted ? <BellOff className="w-3 h-3" /> : <Bell className="w-3 h-3" />}
                  {isMuted ? 'Muté' : 'Muter'}
                </button>
              </div>

              {/* Spaces */}
              {group.spaces.map((spaceGroup: any) => (
                <div key={spaceGroup.space.id} className="ml-3 space-y-1.5">
                  {/* Space banner */}
                  <SpaceBanner space={spaceGroup.space} />

                  {/* Items grid */}
                  <div className="flex flex-wrap gap-2">
                    {spaceGroup.items.map((item: any) => (
                      <div
                        key={item.id}
                        className="w-48 flex-shrink-0 bg-card border border-border rounded-lg p-3 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col gap-1.5"
                        onClick={() => handleOpenItem(item.id, item.spaceId)}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wide leading-none">
                            {TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] ?? item.type}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(item.activityAt)}
                          </span>
                        </div>
                        <p className="font-medium text-sm line-clamp-2 leading-snug">{item.title}</p>
                        <div className="flex items-center gap-1.5 mt-auto flex-wrap">
                          {item.status && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR_MAP[item.status] ?? 'bg-muted text-muted-foreground'}`}>
                              {STATUS_LABEL_MAP[item.status] ?? item.status}
                            </span>
                          )}
                          {item.updatedBy && (
                            <span className="text-xs text-muted-foreground truncate">{item.updatedBy.name}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
