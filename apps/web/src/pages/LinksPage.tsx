import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, FolderOpen, Users, Globe, Loader2 } from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { SpaceWithRole } from '@spok/shared';

const API_URL = import.meta.env.VITE_API_URL || '';

interface LinkItem {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  spaceId: string;
}

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
}

function LinkTag({ link }: { link: LinkItem }) {
  const { data: meta } = useQuery<UrlMeta>({
    queryKey: ['url-meta', link.url],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/url-meta?url=${encodeURIComponent(link.url!)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { title: null, description: null, favicon: null };
      return res.json();
    },
    enabled: !!link.url,
    staleTime: 24 * 60 * 60 * 1000, // 24h cache
    retry: false,
  });

  const displayTitle = link.title || meta?.title || link.url;
  const tooltip = [meta?.description || link.description, link.url].filter(Boolean).join('\n');
  const faviconUrl = meta?.favicon;

  return (
    <a
      href={link.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-full hover:bg-accent hover:border-primary/30 transition-colors group shadow-sm"
      title={tooltip}
    >
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          className="w-6 h-6 rounded flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <ExternalLink className="w-5 h-5 text-primary flex-shrink-0" />
      )}
      <span className="truncate max-w-[250px]">{displayTitle}</span>
    </a>
  );
}

export function LinksPage() {
  const user = useAuthStore(s => s.user);

  // Fetch all spaces the user has access to
  const { data: spaces, isLoading: loadingSpaces } = useQuery({
    queryKey: ['spaces', user?.id || 'public'],
    queryFn: () => spacesApi.list(),
  });

  // Fetch items of type LINK from each space
  const spaceIds = useMemo(() => (spaces || []).map((s: SpaceWithRole) => s.id), [spaces]);

  const { data: linksBySpace, isLoading: loadingLinks } = useQuery({
    queryKey: ['all-links', spaceIds],
    queryFn: async () => {
      const results = new Map<string, LinkItem[]>();
      await Promise.all(
        spaceIds.map(async (spaceId: string) => {
          try {
            const resp = await itemsApi.list(spaceId, { type: 'LINK', pageSize: 200 });
            const items = (resp.data || []).filter((i: any) => i.url);
            if (items.length > 0) {
              results.set(spaceId, items.map((i: any) => ({
                id: i.id,
                title: i.title,
                url: i.url,
                description: i.description,
                spaceId,
              })));
            }
          } catch { /* skip inaccessible spaces */ }
        })
      );
      return results;
    },
    enabled: spaceIds.length > 0,
  });

  const isLoading = loadingSpaces || loadingLinks;

  // Group spaces by community
  const grouped = useMemo(() => {
    if (!spaces || !linksBySpace) return [];

    const communityMap = new Map<string, { name: string; avatarUrl: string | null; isPublic: boolean; spaces: { space: SpaceWithRole; links: LinkItem[] }[] }>();
    const noCommunity: { space: SpaceWithRole; links: LinkItem[] }[] = [];

    for (const space of spaces as SpaceWithRole[]) {
      const links = linksBySpace.get(space.id);
      if (!links || links.length === 0) continue;

      if (space.communityId && space.community) {
        if (!communityMap.has(space.communityId)) {
          communityMap.set(space.communityId, {
            name: space.community.name,
            avatarUrl: (space.community as any).avatarUrl || null,
            isPublic: (space.community as any).isPublic || false,
            spaces: [],
          });
        }
        communityMap.get(space.communityId)!.spaces.push({ space, links });
      } else {
        noCommunity.push({ space, links });
      }
    }

    const result: { communityId: string | null; communityName: string; avatarUrl: string | null; isPublic: boolean; spaces: { space: SpaceWithRole; links: LinkItem[] }[] }[] = [];

    for (const [communityId, data] of communityMap) {
      result.push({ communityId, communityName: data.name, avatarUrl: data.avatarUrl, isPublic: data.isPublic, spaces: data.spaces });
    }

    if (noCommunity.length > 0) {
      result.push({ communityId: null, communityName: 'Espaces independants', avatarUrl: null, isPublic: false, spaces: noCommunity });
    }

    return result;
  }, [spaces, linksBySpace]);

  const totalLinks = useMemo(() => {
    if (!linksBySpace) return 0;
    let count = 0;
    for (const links of linksBySpace.values()) count += links.length;
    return count;
  }, [linksBySpace]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Liens</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalLinks} lien{totalLinks !== 1 ? 's' : ''} dans {grouped.reduce((n, g) => n + g.spaces.length, 0)} espace{grouped.reduce((n, g) => n + g.spaces.length, 0) !== 1 ? 's' : ''}
          </p>
        </div>

        {totalLinks === 0 ? (
          <div className="text-center py-16">
            <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucun lien</p>
            <p className="text-sm text-muted-foreground">Les items de type LINK apparaitront ici, groupes par communaute et espace.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map(group => (
              <div key={group.communityId || 'independent'}>
                {/* Community header */}
                <div className="flex items-center gap-2 mb-3">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-muted-foreground" />
                  )}
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{group.communityName}</h2>
                  {group.isPublic && <Globe className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>

                {/* Spaces within community */}
                <div className="space-y-4">
                  {group.spaces.map(({ space, links }) => (
                    <div key={space.id}>
                      {/* Space header */}
                      <div className="flex items-center gap-2 mb-2">
                        {space.avatarUrl ? (
                          <img src={space.avatarUrl} alt="" className="w-4 h-4 rounded object-cover" />
                        ) : (
                          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium text-muted-foreground">{space.name}</span>
                      </div>

                      {/* Links as tags with metadata */}
                      <div className="flex flex-wrap gap-2">
                        {links.map(link => (
                          <LinkTag key={link.id} link={link} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
