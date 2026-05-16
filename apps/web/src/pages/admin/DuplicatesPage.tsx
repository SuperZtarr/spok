// apps/web/src/pages/admin/DuplicatesPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw, Copy, ExternalLink, ChevronRight, AlertCircle } from 'lucide-react';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { getTypeIcon } from '../../constants/ui';

type Reason = 'title' | 'url' | 'filename';

const REASON_CONFIG: Record<Reason, { label: string; color: string; bg: string }> = {
  title:    { label: 'Titre',   color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  url:      { label: 'URL',     color: 'text-blue-700 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/30' },
  filename: { label: 'Fichier', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/30' },
};

type FilterTab = 'all' | Reason;

type DuplicateItem = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  status: string | null;
  spaceId: string;
  spaceName: string;
  communityName: string | null;
  ancestors: Array<{ id: string; title: string }>;
};

// Breadcrumb: Communauté > Espace > Grand-parent > Parent
function Breadcrumb({ item }: { item: DuplicateItem }) {
  const parts: string[] = [];
  if (item.communityName) parts.push(item.communityName);
  parts.push(item.spaceName);
  for (const a of item.ancestors) parts.push(a.title);

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-0.5">
          {i > 0 && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40 flex-shrink-0" />}
          <span className={`text-[10px] truncate max-w-[80px] ${i === parts.length - 1 ? 'text-muted-foreground' : 'text-muted-foreground/60'}`} title={part}>
            {part}
          </span>
        </span>
      ))}
    </div>
  );
}

export function DuplicatesPage() {
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'duplicates'],
    queryFn: () => adminApi.duplicates.list(),
  });

  const groups = data?.groups ?? [];
  const filtered = filter === 'all' ? groups : groups.filter((g) => g.reason === filter);
  const countByReason = (r: Reason) => groups.filter((g) => g.reason === r).length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',      label: 'Tous',    count: groups.length },
    { key: 'title',    label: 'Titre',   count: countByReason('title') },
    { key: 'url',      label: 'URL',     count: countByReason('url') },
    { key: 'filename', label: 'Fichier', count: countByReason('filename') },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Copy className="w-6 h-6 text-orange-500" />
            Doublons
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Items avec titre, URL ou nom de fichier identique sur tous les espaces
          </p>
        </div>
        <Button variant="bordered" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
              filter === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-mono ${
                filter === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Analyse en cours…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Aucun doublon détecté</p>
          <p className="text-sm mt-1">
            {filter === 'all'
              ? 'Tous les items sont uniques.'
              : `Aucun doublon par ${REASON_CONFIG[filter as Reason].label.toLowerCase()}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((group, idx) => {
            const cfg = REASON_CONFIG[group.reason];
            return (
              <div key={`${group.reason}-${group.key}`} className="border border-border rounded-lg overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  <span className="text-sm font-medium truncate flex-1" title={group.key}>
                    {group.key || <span className="italic text-muted-foreground">(vide)</span>}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {group.items.length} items
                  </span>
                </div>

                {/* Cards row */}
                <div className="flex gap-3 p-4 overflow-x-auto">
                  {group.items.map((item) => {
                    const Icon = getTypeIcon(item.type, item.url ?? undefined);
                    return (
                      <div
                        key={item.id}
                        className="flex-shrink-0 w-60 bg-card border border-border rounded-lg p-3 flex flex-col gap-2 hover:border-primary/50 transition-colors"
                      >
                        {/* Type + title */}
                        <div className="flex items-start gap-2">
                          <Icon className="w-4 h-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                          <span className="text-sm font-medium leading-tight line-clamp-2 flex-1">
                            {item.title}
                          </span>
                        </div>

                        {/* Status */}
                        {item.status && (
                          <span className="text-xs text-muted-foreground/80 truncate">{item.status}</span>
                        )}

                        {/* Breadcrumb: Communauté > Espace > ancêtres */}
                        <div className="mt-auto pt-2 border-t border-border/50">
                          <Breadcrumb item={item} />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1">
                          <Link
                            to={`/spaces/${item.spaceId}?item=${item.id}`}
                            className="flex-1 text-xs text-center px-2 py-1 rounded border border-border hover:bg-accent transition-colors"
                          >
                            Ouvrir
                          </Link>
                          <Link
                            to={`/spaces/${item.spaceId}?item=${item.id}`}
                            target="_blank"
                            className="p-1 rounded border border-border hover:bg-accent transition-colors"
                            title="Ouvrir dans un nouvel onglet"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
