/*
 * Liens globaux (/links) : items LINK des espaces lisibles, groupés Communauté › Espace › sous-espace.
 * Périmètre : sélecteur Communauté / Espace (un espace inclut ses sous-espaces), filtré côté API (GET /user/tasks,
 * communityId / spaceId, toujours intersecté avec les espaces lisibles). Chargement par pages de PAGE_SIZE avec
 * « Charger plus » et total affiché — jamais de coupe silencieuse. La recherche texte (titre, URL, espace) porte sur
 * les liens chargés : un avertissement le dit tant qu'il en reste à charger.
 */
import { useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { ExternalLink, Search, FolderOpen, Building2, ChevronRight } from 'lucide-react';
import type { SpaceWithRole } from '@spok/shared';
import { userTasksApi, spacesApi } from '../lib/api';
import { PageHelpButton } from '../help/PageHelpButton';

const PAGE_SIZE = 200;

/** Options du sélecteur de périmètre : communautés (optgroup) et leurs espaces indentés par profondeur. */
function buildScopeOptions(spaces: SpaceWithRole[]) {
  const byParent = new Map<string | null, SpaceWithRole[]>();
  for (const s of spaces) {
    const key = s.parentId && spaces.some(p => p.id === s.parentId) ? s.parentId : null;
    byParent.set(key, [...(byParent.get(key) || []), s]);
  }
  const groups = new Map<string, { label: string; communityId: string | null; options: { value: string; label: string }[] }>();
  const visit = (s: SpaceWithRole, depth: number) => {
    const gKey = s.type === 'PERSONAL' ? 'personal' : s.communityId || 'none';
    if (!groups.has(gKey)) {
      groups.set(gKey, {
        label: s.type === 'PERSONAL' ? 'Espaces personnels' : s.community?.name || 'Sans communauté',
        communityId: s.type === 'PERSONAL' ? null : s.communityId ?? null,
        options: [],
      });
    }
    groups.get(gKey)!.options.push({ value: `s:${s.id}`, label: `${'  '.repeat(depth)}${s.name}` });
    for (const c of (byParent.get(s.id) || []).sort((a, b) => a.name.localeCompare(b.name))) visit(c, depth + 1);
  };
  for (const s of (byParent.get(null) || []).sort((a, b) => a.name.localeCompare(b.name))) visit(s, 0);
  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
}

/** Id de l'espace et de tous ses sous-espaces (le filtre par espace inclut les sous-espaces). */
function withDescendants(spaces: SpaceWithRole[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const s of spaces) if (s.parentId === ids[i] && !ids.includes(s.id)) ids.push(s.id);
  }
  return ids;
}

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
    <a data-tour="global-links-link"
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
  // Périmètre : '' = tout, 'c:<communityId>' = une communauté, 's:<spaceId>' = un espace et ses sous-espaces
  const [scope, setScope] = useState('');

  const { data: allSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
  });
  const scopeGroups = useMemo(() => buildScopeOptions(allSpaces || []), [allSpaces]);

  const scopeFilter = useMemo(() => {
    if (scope.startsWith('c:')) return { communityId: scope.slice(2) };
    if (scope.startsWith('s:')) return { spaceId: withDescendants(allSpaces || [], scope.slice(2)).join(',') };
    return {};
  }, [scope, allSpaces]);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['global-links', scopeFilter],
    queryFn: ({ pageParam }) => userTasksApi.list({ type: 'LINK', ...scopeFilter, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });

  const links = useMemo(() => data?.pages.flatMap(p => p.data) || [], [data]);
  const grandTotal = data?.pages[0]?.total ?? 0;

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
  const remaining = Math.max(0, grandTotal - links.length);
  // Compteur : liens affichés, et sur combien quand tout n'est pas chargé ou qu'une recherche filtre
  const countLabel = search.trim() || remaining > 0 ? `${totalLinks} sur ${grandTotal}` : `${grandTotal}`;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <ExternalLink className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Liens</h1>
            <span className="text-sm text-muted-foreground">({countLabel})</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="Périmètre : communauté ou espace"
            data-tour="global-links-scope"
            className="max-w-[16rem] px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Tous mes espaces</option>
            {scopeGroups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.communityId && <option value={`c:${g.communityId}`}>Toute la communauté</option>}
                {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
          <div className="relative w-64" data-tour="global-links-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un lien..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
            <PageHelpButton pageKey="global-links" />
          </div>
        </div>

        {search.trim() && remaining > 0 && (
          <p className="mb-4 text-xs text-amber-700 dark:text-amber-400">
            La recherche porte sur les {links.length} liens chargés ; {remaining} restent à charger (bas de page).
          </p>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Chargement...</div>
        ) : totalLinks === 0 ? (
          <div className="text-center py-16">
            <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucun lien</p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Aucun lien ne correspond à la recherche.' : scope ? 'Aucun lien dans ce périmètre.' : 'Aucun item de type LINK dans vos espaces.'}
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-8">
            {communities.map(community => (
              <div key={community.communityId} data-tour="global-links-community" className="rounded-lg border border-border bg-card/50 shadow-sm overflow-hidden">
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
          </>
        )}

        {hasNextPage && (
          <div className="flex justify-center mt-8">
            <button
              type="button"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="px-4 py-2 text-sm font-medium border border-border rounded-md bg-card hover:bg-accent disabled:opacity-50"
            >
              {isFetchingNextPage ? 'Chargement…' : `Charger plus (${remaining} restant${remaining > 1 ? 's' : ''})`}
            </button>
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
