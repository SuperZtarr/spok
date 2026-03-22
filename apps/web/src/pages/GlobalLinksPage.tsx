import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search, FolderOpen, Building2, ChevronRight } from 'lucide-react';
import { userTasksApi } from '../lib/api';

const API_URL = import.meta.env.VITE_API_URL || '';

function useFavicon(url: string | null) {
  return useQuery({
    queryKey: ['url-meta', url],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/url-meta?url=${encodeURIComponent(url!)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { title: null, description: null, favicon: null };
      return res.json() as Promise<{ title: string | null; description: string | null; favicon: string | null }>;
    },
    enabled: !!url,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

function LinkCard({ item }: { item: any }) {
  const { data: meta } = useFavicon(item.url);
  const displayTitle = item.title || meta?.title || item.url;
  const tooltip = [meta?.description || item.description, item.url].filter(Boolean).join('\n');

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-full hover:bg-accent hover:border-primary/30 transition-colors shadow-sm"
      title={tooltip}
    >
      {meta?.favicon ? (
        <img
          src={meta.favicon}
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

interface SpaceNode {
  spaceId: string;
  spaceName: string;
  items: any[];
  children: SpaceNode[];
}

interface CommunityGroup {
  communityId: string;
  communityName: string;
  spaces: SpaceNode[];
}

export function GlobalLinksPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['global-links'],
    queryFn: () => userTasksApi.list({ type: 'LINK', pageSize: 500 }),
  });

  const links = data?.data || [];

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return links;
    const q = search.toLowerCase();
    return links.filter((l: any) =>
      l.title?.toLowerCase().includes(q) ||
      l.url?.toLowerCase().includes(q) ||
      l.spaceName?.toLowerCase().includes(q) ||
      l.communityName?.toLowerCase().includes(q)
    );
  }, [links, search]);

  // Build hierarchy: community -> space -> sub-space
  const communities = useMemo(() => {
    // Collect all spaces and their links
    const spaceMap = new Map<string, { spaceId: string; spaceName: string; parentId: string | null; communityId: string | null; communityName: string | null; items: any[] }>();

    for (const link of filtered) {
      const spaceId = (link as any).spaceId || 'unknown';
      const spaceName = (link as any).spaceName || (link as any).space?.name || 'Sans espace';
      const parentId = (link as any).spaceParentId || null;
      const communityId = (link as any).communityId || null;
      const communityName = (link as any).communityName || null;

      if (!spaceMap.has(spaceId)) {
        spaceMap.set(spaceId, { spaceId, spaceName, parentId, communityId, communityName, items: [] });
      }
      spaceMap.get(spaceId)!.items.push(link);
    }

    // Build tree per community
    const communityMap = new Map<string, CommunityGroup>();

    for (const space of spaceMap.values()) {
      const cId = space.communityId || 'none';
      const cName = space.communityName || 'Sans communaut\u00e9';

      if (!communityMap.has(cId)) {
        communityMap.set(cId, { communityId: cId, communityName: cName, spaces: [] });
      }
    }

    // Build space trees within each community
    for (const space of spaceMap.values()) {
      const cId = space.communityId || 'none';
      const community = communityMap.get(cId)!;

      // Check if parent is in our spaceMap (has links)
      const parentInMap = space.parentId && spaceMap.has(space.parentId);

      if (!parentInMap) {
        // Root level space (or parent has no links)
        community.spaces.push({
          spaceId: space.spaceId,
          spaceName: space.spaceName,
          items: space.items,
          children: [],
        });
      }
    }

    // Attach children to parents
    for (const space of spaceMap.values()) {
      if (space.parentId && spaceMap.has(space.parentId)) {
        const cId = space.communityId || 'none';
        const community = communityMap.get(cId)!;
        const parentNode = community.spaces.find(s => s.spaceId === space.parentId);
        if (parentNode) {
          parentNode.children.push({
            spaceId: space.spaceId,
            spaceName: space.spaceName,
            items: space.items,
            children: [],
          });
        } else {
          // Parent exists in map but not at root — add as root
          community.spaces.push({
            spaceId: space.spaceId,
            spaceName: space.spaceName,
            items: space.items,
            children: [],
          });
        }
      }
    }

    return Array.from(communityMap.values())
      .filter(c => c.spaces.length > 0)
      .sort((a, b) => a.communityName.localeCompare(b.communityName));
  }, [filtered]);

  const totalLinks = filtered.length;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ExternalLink className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Liens</h1>
            <span className="text-sm text-muted-foreground">({totalLinks})</span>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lien..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement...</div>
        ) : totalLinks === 0 ? (
          <div className="text-center py-16">
            <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucun lien</p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Aucun lien ne correspond a la recherche.' : 'Aucun item de type LINK dans vos espaces.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {communities.map(community => (
              <div key={community.communityId} className="rounded-lg border border-border bg-card/50 shadow-sm overflow-hidden">
                {/* Community header */}
                <div className="flex items-center gap-2 px-5 py-3 bg-muted/50 border-b border-border">
                  <Building2 className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">{community.communityName}</h2>
                  <span className="text-xs text-muted-foreground ml-1">
                    ({community.spaces.reduce((sum, s) => sum + s.items.length + s.children.reduce((cs, c) => cs + c.items.length, 0), 0)})
                  </span>
                </div>

                <div className="space-y-4 p-5">
                  {community.spaces.map(space => (
                    <SpaceLinks key={space.spaceId} space={space} depth={0} />
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

function SpaceLinks({ space, depth }: { space: SpaceNode; depth: number }) {
  return (
    <div className={`rounded-md border border-border/60 bg-background ${depth > 0 ? 'ml-4' : ''}`}>
      {/* Space header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border/60 rounded-t-md">
        {depth > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <FolderOpen className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {space.spaceName}
        </h3>
        <span className="text-xs text-muted-foreground">({space.items.length})</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Links */}
        {space.items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {space.items.map(link => (
              <LinkCard key={link.id} item={link} />
            ))}
          </div>
        )}

        {/* Sub-spaces */}
        {space.children.map(child => (
          <SpaceLinks key={child.spaceId} space={child} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}
