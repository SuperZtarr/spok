import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import type { Item } from '@spok/shared';

const API_URL = import.meta.env.VITE_API_URL || '';

interface UrlMeta {
  title: string | null;
  description: string | null;
  favicon: string | null;
}

function LinkTag({ item, onEdit }: { item: Item; onEdit?: (id: string) => void }) {
  const { data: meta } = useQuery<UrlMeta>({
    queryKey: ['url-meta', item.url],
    queryFn: async () => {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/url-meta?url=${encodeURIComponent(item.url!)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return { title: null, description: null, favicon: null };
      return res.json();
    },
    enabled: !!item.url,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });

  const displayTitle = item.title || meta?.title || item.url;
  const tooltip = [meta?.description || item.description, item.url].filter(Boolean).join('\n');
  const faviconUrl = meta?.favicon;

  return (
    <a
      href={item.url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-card border border-border rounded-full hover:bg-accent hover:border-primary/30 transition-colors group shadow-sm"
      title={tooltip}
      onDoubleClick={(e) => { e.preventDefault(); onEdit?.(item.id); }}
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

interface LinksViewProps {
  items: Item[] | undefined;
  onEdit?: (id: string) => void;
}

export function LinksView({ items, onEdit }: LinksViewProps) {
  const links = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'LINK' && item.url);
  }, [items]);

  if (links.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <ExternalLink className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucun lien</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item de type LINK.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex flex-wrap gap-2">
        {links.map(link => (
          <LinkTag key={link.id} item={link} onEdit={onEdit} />
        ))}
      </div>
    </div>
  );
}
