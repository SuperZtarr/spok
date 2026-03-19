import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

export function ReferentielsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'referentiels'],
    queryFn: () => adminApi.referentiels.summary(),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Referentiels</h1>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.defaults.statuses.length} statuts · {Object.keys(data.defaults.typeLabels).length} types d'items
                 · {data.customizedCount} espace{data.customizedCount > 1 ? 's' : ''} personnalise{data.customizedCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Chargement...</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Section 1: Statuts par defaut */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Statuts par defaut
              <span className="ml-2 font-normal">({data.defaults.statuses.length})</span>
            </h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Ordre</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Couleur</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Visible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.defaults.statuses.map((status) => (
                    <tr key={status.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 text-muted-foreground tabular-nums">{status.order}</td>
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{status.id}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{status.color}</code>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {status.visible ? (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Oui</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Non</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Types d'items par defaut */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Types d'items par defaut
              <span className="ml-2 font-normal">({Object.keys(data.defaults.typeLabels).length})</span>
            </h2>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-16">Ordre</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Cle</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Label</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Court</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Couleur</th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">Visible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(data.defaults.typeLabels)
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([key, typeLabel]) => (
                      <tr key={key} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground tabular-nums">{typeLabel.order}</td>
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{key}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded border-2 ${typeLabel.color}`} />
                            {typeLabel.label}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{typeLabel.labelShort}</td>
                        <td className="px-4 py-2">
                          <code className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{typeLabel.color}</code>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {typeLabel.visible ? (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Oui</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Non</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Espaces personnalises */}
          <div>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Espaces personnalises
              <span className="ml-2 font-normal">
                ({data.customizedCount} sur {data.totalSpaces})
              </span>
            </h2>
            <div className="border border-border rounded-lg overflow-hidden">
              {data.customizedSpaces.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Tous les espaces utilisent les referentiels par defaut
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Espace</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Statuts</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Types</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.customizedSpaces.map((space) => (
                      <tr key={space.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2 font-medium">{space.name}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            space.type === 'GROUP'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}>
                            {space.type === 'GROUP' ? 'Groupe' : 'Perso'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center tabular-nums">{space.customStatusCount}</td>
                        <td className="px-4 py-2 text-center tabular-nums">{space.customTypeCount}</td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            to={`/spaces/${space.id}/content`}
                            className="text-primary hover:text-primary/80"
                            title="Voir l'espace"
                          >
                            <ExternalLink className="w-4 h-4 inline" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
