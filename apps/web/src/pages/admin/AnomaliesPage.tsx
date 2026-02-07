import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ChevronDown, ChevronRight, ExternalLink, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';

type Severity = 'error' | 'warning' | 'info';

const severityConfig: Record<Severity, { icon: typeof AlertCircle; color: string; bg: string; badge: string }> = {
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
  },
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  },
};

function CategoryDetail({ categoryKey }: { categoryKey: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'anomalies', categoryKey, page],
    queryFn: () => adminApi.anomalies.detail(categoryKey, { page, pageSize: 50 }),
  });

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Aucun élément trouvé.
      </div>
    );
  }

  const isSpaceCategory = categoryKey.startsWith('spaces-');

  return (
    <div className="border-t border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Titre</th>
              {!isSpaceCategory && (
                <th className="px-4 py-2 text-left font-medium">Espace</th>
              )}
              <th className="px-4 py-2 text-left font-medium">Détail</th>
              <th className="px-4 py-2 text-right font-medium w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30">
                <td className="px-4 py-2 max-w-[300px] truncate" title={item.title}>
                  {item.title}
                </td>
                {!isSpaceCategory && (
                  <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                    {item.spaceName || '-'}
                  </td>
                )}
                <td className="px-4 py-2 text-muted-foreground max-w-[300px] truncate" title={item.detail}>
                  {item.detail || '-'}
                </td>
                <td className="px-4 py-2 text-right">
                  {isSpaceCategory && item.id ? (
                    <Link
                      to={`/admin/spaces`}
                      className="text-primary hover:text-primary/80"
                      title="Voir dans l'admin"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </Link>
                  ) : item.spaceId ? (
                    <Link
                      to={`/spaces/${item.spaceId}`}
                      className="text-primary hover:text-primary/80"
                      title="Voir l'espace"
                    >
                      <ExternalLink className="w-4 h-4 inline" />
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
          <span className="text-sm text-muted-foreground">
            Page {data.pagination.page} / {data.pagination.totalPages} ({data.pagination.total} éléments)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnomaliesPage() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'anomalies'],
    queryFn: () => adminApi.anomalies.summary(),
  });

  const toggleCategory = (key: string) => {
    setExpandedCategory(prev => prev === key ? null : key);
  };

  // Group categories
  const groups = data
    ? data.categories.reduce<Record<string, typeof data.categories>>((acc, cat) => {
        if (!acc[cat.group]) acc[cat.group] = [];
        acc[cat.group].push(cat);
        return acc;
      }, {})
    : {};

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Anomalies</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.totalAnomalies} anomalies détectées
              {data.checkedAt && ` — Dernière vérification : ${new Date(data.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          Analyse en cours...
        </div>
      )}

      {/* Groups */}
      {Object.entries(groups).map(([groupName, categories]) => {
        const groupTotal = categories.reduce((s, c) => s + c.count, 0);
        const typesWithIssues = categories.filter(c => c.count > 0).length;

        return (
          <div key={groupName} className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {groupName}
              <span className="ml-2 text-xs font-normal">
                ({typesWithIssues} type{typesWithIssues > 1 ? 's' : ''} — {groupTotal} anomalies)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
              {categories.map((cat) => {
                const config = severityConfig[cat.severity];
                const Icon = config.icon;
                const isExpanded = expandedCategory === cat.key;
                const hasItems = cat.count > 0;

                return (
                  <div key={cat.key}>
                    <button
                      onClick={() => hasItems && toggleCategory(cat.key)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        hasItems ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-default'
                      } ${isExpanded ? 'bg-muted/30' : ''}`}
                      disabled={!hasItems}
                    >
                      <div className="flex items-center gap-3">
                        {hasItems ? (
                          isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <Icon className={`w-4 h-4 ${hasItems ? config.color : 'text-green-500'}`} />
                        <span className={`text-sm ${hasItems ? '' : 'text-muted-foreground'}`}>
                          {cat.label}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                          hasItems ? config.badge : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>

                    {isExpanded && hasItems && (
                      <CategoryDetail categoryKey={cat.key} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
