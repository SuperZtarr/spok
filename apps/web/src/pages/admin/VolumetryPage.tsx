/* Admin volumétrie (/admin/volumetry, 2026-11-18, élément SPOK cmwlvqf5u000qgxbey2330zg4) : taille réelle, lignes et
   croissance (7 / 30 jours) de chaque table, taille de la base, niveau face aux seuils du registre @spok/shared
   volumetry.ts (tables dépassées en tête). Lecture seule : le lien « Purger » mène à la page qui purge à la main ; SPOK
   n'efface jamais rien de lui-même. Les admins sont notifiés par la surveillance de l'API (utils/volumetryWatch.ts).
   Aide utilisateur : fiche pages/help/admin-volumetry.help.ts — « ? » (PageHelpButton), rappels fonctionnels (pageHint). */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Database, RefreshCw } from 'lucide-react';
import { VOLUMETRY_LEVEL_LABELS, type VolumetryLevel } from '@spok/shared';
import { adminVolumetryApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { PageHelpButton } from '../../help/PageHelpButton';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

const LEVEL_CLASS: Record<VolumetryLevel, string> = {
  exceeded: 'bg-red-500/15 text-red-600',
  warning: 'bg-orange-500/15 text-orange-600',
  ok: 'bg-green-500/15 text-green-700',
  unwatched: 'bg-muted text-muted-foreground',
};

const num = (n: number | null) => (n == null ? '—' : n.toLocaleString('fr-FR'));
const mb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} Go` : `${n.toLocaleString('fr-FR')} Mo`);

function LevelBadge({ level }: { level: VolumetryLevel }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_CLASS[level]}`}>{VOLUMETRY_LEVEL_LABELS[level]}</span>;
}

export function VolumetryPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'volumetry'],
    queryFn: adminVolumetryApi.get,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold">Volumétrie</h1>
          <PageHelpButton pageKey="admin-volumetry" />
          {data && (
            <span className="text-xs text-muted-foreground">mesurée le {new Date(data.measuredAt).toLocaleString('fr-FR')}</span>
          )}
        </div>
        <HelpHint text={pageHint('admin-volumetry', 'refresh')}>
          <Button
            variant="bordered"
            size="sm"
            disabled={isFetching}
            onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'volumetry'] })}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? 'animate-spin' : ''}`} /> Mesurer
          </Button>
        </HelpHint>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Mesure en cours…</p>}

      {data && (
        <>
          <div className="rounded-lg border border-border bg-card p-4 max-w-sm" data-tour="admin-volumetry-database" data-help-zone="admin-volumetry:base">
            <p className="text-xs text-muted-foreground mb-1">Base entière</p>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold">{mb(data.database.sizeMB)}</p>
              <LevelBadge level={data.database.level} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">seuil : {mb(data.database.maxMB)}</p>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto" data-tour="admin-volumetry-tables" data-help-zone="admin-volumetry:tables">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Table</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Lignes</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Taille</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">+ 7 j</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">+ 30 j</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Seuil</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">État</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.tables.map((t) => (
                  <tr key={t.table} className="border-t border-border">
                    <td className="px-4 py-2">
                      <span className="font-medium">{t.label}</span>
                      {t.label !== t.table && <span className="ml-2 text-xs text-muted-foreground font-mono">{t.table}</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{num(t.rows)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{mb(t.sizeMB)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{num(t.last7d)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{num(t.last30d)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {t.maxRows != null ? `${num(t.maxRows)} l. / ${t.maxMB} Mo` : '—'}
                    </td>
                    <td className="px-4 py-2"><LevelBadge level={t.level} /></td>
                    <td className="px-4 py-2 text-right">
                      {t.purgeRoute && (
                        <HelpHint text={pageHint('admin-volumetry', 'purge')}>
                          <Link to={t.purgeRoute} className="text-primary hover:underline text-xs">Purger</Link>
                        </HelpHint>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
