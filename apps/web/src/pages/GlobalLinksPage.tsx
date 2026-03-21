import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Search, FolderOpen } from 'lucide-react';
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
    return links.filter(l =>
      l.title?.toLowerCase().includes(q) ||
      l.url?.toLowerCase().includes(q) ||
      (l as any).spaceName?.toLowerCase().includes(q) ||
      (l as any).space?.name?.toLowerCase().includes(q)
    );
  }, [links, search]);

  // Group by space
  const grouped = useMemo(() => {
    const map = new Map<string, { spaceName: string; spaceId: string; items: any[] }>();
    for (const link of filtered) {
      const spaceId = (link as any).spaceId || (link as any).space?.id || 'unknown';
      const spaceName = (link as any).spaceName || (link as any).space?.name || 'Sans espace';
      if (!map.has(spaceId)) {
        map.set(spaceId, { spaceName, spaceId, items: [] });
      }
      map.get(spaceId)!.items.push(link);
    }
    return Array.from(map.values()).sort((a, b) => a.spaceName.localeCompare(b.spaceName));
  }, [filtered]);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ExternalLink className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold">Liens</h1>
            <span className="text-sm text-muted-foreground">({filtered.length})</span>
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucun lien</p>
            <p className="text-sm text-muted-foreground">
              {search ? 'Aucun lien ne correspond a la recherche.' : 'Aucun item de type LINK dans vos espaces.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(group => (
              <div key={group.spaceId}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {group.spaceName}
                  </h2>
                  <span className="text-xs text-muted-foreground">({group.items.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.items.map(link => (
                    <LinkCard key={link.id} item={link} />
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
