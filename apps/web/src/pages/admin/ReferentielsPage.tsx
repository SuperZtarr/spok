import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';

export function ReferentielsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'referentiels'],
    queryFn: () => adminApi.referentiels.summary(),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Referentiels</h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {data.defaults.statuses.length} statuts, {Object.keys(data.defaults.typeLabels).length} types d'items
              {' '}— {data.customizedCount} espace{data.customizedCount > 1 ? 's' : ''} personnalise{data.customizedCount > 1 ? 's' : ''}
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
          Chargement...
        </div>
      )}

      {data && (
        <>
          {/* Section 1: Statuts par défaut */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Statuts par defaut
              <span className="ml-2 text-xs font-normal">
                ({data.defaults.statuses.length} statuts)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium w-16">Ordre</th>
                    <th className="px-4 py-2 text-left font-medium">ID</th>
                    <th className="px-4 py-2 text-left font-medium">Label</th>
                    <th className="px-4 py-2 text-left font-medium">Couleur</th>
                    <th className="px-4 py-2 text-center font-medium w-20">Visible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.defaults.statuses.map((status) => (
                    <tr key={status.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">{status.order}</td>
                      <td className="px-4 py-2 font-mono text-xs">{status.id}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <code className="text-xs text-muted-foreground">{status.color}</code>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {status.visible ? (
                          <span className="text-green-500">Oui</span>
                        ) : (
                          <span className="text-muted-foreground">Non</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Types d'items par défaut */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Types d'items par defaut
              <span className="ml-2 text-xs font-normal">
                ({Object.keys(data.defaults.typeLabels).length} types)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium w-16">Ordre</th>
                    <th className="px-4 py-2 text-left font-medium">Cle</th>
                    <th className="px-4 py-2 text-left font-medium">Label</th>
                    <th className="px-4 py-2 text-left font-medium">Label court</th>
                    <th className="px-4 py-2 text-left font-medium">Couleur</th>
                    <th className="px-4 py-2 text-center font-medium w-20">Visible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(data.defaults.typeLabels)
                    .sort(([, a], [, b]) => a.order - b.order)
                    .map(([key, typeLabel]) => (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground">{typeLabel.order}</td>
                        <td className="px-4 py-2 font-mono text-xs">{key}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded border-2 ${typeLabel.color}`} />
                            {typeLabel.label}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{typeLabel.labelShort}</td>
                        <td className="px-4 py-2">
                          <code className="text-xs text-muted-foreground">{typeLabel.color}</code>
                        </td>
                        <td className="px-4 py-2 text-center">
                          {typeLabel.visible ? (
                            <span className="text-green-500">Oui</span>
                          ) : (
                            <span className="text-muted-foreground">Non</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Espaces personnalisés */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Espaces personnalises
              <span className="ml-2 text-xs font-normal">
                ({data.customizedCount} espace{data.customizedCount > 1 ? 's' : ''} sur {data.totalSpaces} ont personnalise leurs referentiels)
              </span>
            </h2>

            <div className="border border-border rounded-lg overflow-hidden">
              {data.customizedSpaces.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Tous les espaces utilisent les referentiels par defaut
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Nom de l'espace</th>
                      <th className="px-4 py-2 text-left font-medium">Type</th>
                      <th className="px-4 py-2 text-center font-medium">Statuts custom</th>
                      <th className="px-4 py-2 text-center font-medium">Types custom</th>
                      <th className="px-4 py-2 text-right font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.customizedSpaces.map((space) => (
                      <tr key={space.id} className="hover:bg-muted/30">
                        <td className="px-4 py-2 font-medium">{space.name}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            space.type === 'GROUP'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {space.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">{space.customStatusCount}</td>
                        <td className="px-4 py-2 text-center">{space.customTypeCount}</td>
                        <td className="px-4 py-2 text-right">
                          <Link
                            to={`/spaces/${space.id}`}
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
        </>
      )}
    </div>
  );
}
