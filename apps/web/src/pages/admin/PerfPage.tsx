/* Admin performance (/admin/perf) : métriques DB et temps de réponse. */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Trash2, RefreshCw, AlertTriangle, Weight } from 'lucide-react';
import { adminPerfApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';

function ms(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`;
  return `${value}ms`;
}

function kb(value: number) {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} Mo`;
  return `${value} Ko`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  return `il y a ${h}h`;
}

export function PerfPage() {
  const queryClient = useQueryClient();
  const [filterSlow, setFilterSlow] = useState(false);
  const [filterHeavy, setFilterHeavy] = useState(false);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin', 'perf', filterSlow, filterHeavy],
    queryFn: () => adminPerfApi.get({ slow: filterSlow || undefined, heavy: filterHeavy || undefined }),
    refetchInterval: 10_000,
  });

  const clearMutation = useMutation({
    mutationFn: adminPerfApi.clear,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'perf'] }),
  });

  const stats = data?.stats;
  const topSlow = data?.topSlow ?? [];
  const entries = data?.entries ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Performances API</h1>
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground">{timeAgo(new Date(dataUpdatedAt).toISOString())}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'perf'] })}>
            <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
          </Button>
          <Button variant="bordered" size="sm" onClick={() => clearMutation.mutate()} disabled={clearMutation.isPending}>
            <Trash2 className="w-4 h-4 mr-1" /> Vider
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Requêtes enregistrées', value: stats.totalRequests, color: 'text-foreground' },
            { label: 'Temps moyen', value: ms(stats.avgMs), color: stats.avgMs > 500 ? 'text-orange-500' : 'text-green-600' },
            { label: 'Requêtes lentes (> 1s)', value: stats.slowCount, color: stats.slowCount > 0 ? 'text-orange-500' : 'text-green-600' },
            { label: 'Réponses lourdes (> 500Ko)', value: stats.heavyCount, color: stats.heavyCount > 0 ? 'text-orange-500' : 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Top slow endpoints */}
      {topSlow.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Endpoints les plus lents (moyenne)</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Endpoint</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Appels</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Moy. durée</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Moy. taille</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Lents</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Lourds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topSlow.map((row) => (
                  <tr key={row.endpoint} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{row.endpoint}</td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{row.count}</td>
                    <td className={`px-4 py-2 text-right font-medium ${row.avgMs > 1000 ? 'text-orange-500' : ''}`}>{ms(row.avgMs)}</td>
                    <td className={`px-4 py-2 text-right ${row.avgKb > 500 ? 'text-orange-500' : 'text-muted-foreground'}`}>{kb(row.avgKb)}</td>
                    <td className="px-4 py-2 text-right">{row.slowCount > 0 ? <span className="text-orange-500 font-medium">{row.slowCount}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-4 py-2 text-right">{row.heavyCount > 0 ? <span className="text-orange-500 font-medium">{row.heavyCount}</span> : <span className="text-muted-foreground">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filtres log */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Journal des requêtes</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSlow(v => !v)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors ${filterSlow ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-input text-muted-foreground hover:bg-accent'}`}
            >
              <AlertTriangle className="w-3 h-3" /> Lentes seulement
            </button>
            <button
              onClick={() => setFilterHeavy(v => !v)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-colors ${filterHeavy ? 'bg-orange-100 border-orange-300 text-orange-700' : 'border-input text-muted-foreground hover:bg-accent'}`}
            >
              <Weight className="w-3 h-3" /> Lourdes seulement
            </button>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">{entries.length} entrée{entries.length > 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Chargement…</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">Aucune requête enregistrée</div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Heure</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Méthode</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">URL</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Statut</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Durée</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Taille</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e, i) => (
                  <tr key={i} className={`transition-colors ${e.slow || e.heavy ? 'bg-orange-50/50 dark:bg-orange-950/10' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-1.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(e.timestamp)}</td>
                    <td className="px-4 py-1.5">
                      <span className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        e.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                        e.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                        e.method === 'PATCH' || e.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400' :
                        'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                      }`}>{e.method}</span>
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs max-w-[300px] truncate" title={e.url}>{e.url}</td>
                    <td className="px-4 py-1.5 text-right">
                      <span className={`font-mono text-xs ${e.status >= 400 ? 'text-red-500' : 'text-muted-foreground'}`}>{e.status}</span>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <span className={`text-xs font-medium ${e.slow ? 'text-orange-500' : 'text-muted-foreground'}`}>{ms(e.ms)}</span>
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <span className={`text-xs ${e.heavy ? 'text-orange-500 font-medium' : 'text-muted-foreground'}`}>{kb(e.kb)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
