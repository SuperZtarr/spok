/* Rubrique « Stockage de fichiers » de la page admin Volumétrie (2026-11-26, décision Thomas : corbeille du stockage).
   Raison d'être : voir ce que pèsent les fichiers des éléments (bucket R2), surveiller la corbeille (fichiers que plus rien
   n'utilise, gardés STORAGE_TRASH_GRACE_DAYS jours puis effacés par l'API) et y faire entrer les orphelins anciens.
   - Volume : actifs + corbeille face au seuil (registre @spok/shared).
   - Corbeille : origine, motif (libellés du registre STORAGE_TRASH_REASONS), dates ; « Effacer maintenant » = définitif.
   - Orphelins : recherche à la demande seulement (lit tout le bucket) ; « Mettre à la corbeille » coupe l'adresse.
   API : adminVolumetryApi (lib/api.ts) → apps/api/src/routes/admin/volumetry.ts. Aide : pages/help/admin-volumetry.help.ts
   (éléments storage, trash, orphans ; rappels fonctionnels via pageHint). Monté par VolumetryPage. */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Search, Trash2 } from 'lucide-react';
import { storageTrashReasonLabel, VOLUMETRY_LEVEL_LABELS, type VolumetryLevel } from '@spok/shared';
import { adminVolumetryApi } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';

const LEVEL_CLASS: Record<VolumetryLevel, string> = {
  exceeded: 'bg-red-500/15 text-red-600',
  warning: 'bg-orange-500/15 text-orange-600',
  ok: 'bg-green-500/15 text-green-700',
  unwatched: 'bg-muted text-muted-foreground',
};

const mb = (n: number) => (n >= 1024 ? `${(n / 1024).toFixed(2)} Go` : `${n.toLocaleString('fr-FR')} Mo`);
const bytes = (n: number | null) => {
  if (n == null) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
};
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');

/** Sélection d'une liste : tout cocher / décocher, case par ligne */
function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set());
  return { selected, toggle, setAll, clear: () => setSelected(new Set()) };
}

export function VolumetryStorageSection() {
  const queryClient = useQueryClient();
  const storage = useQuery({ queryKey: ['admin', 'volumetry', 'storage'], queryFn: adminVolumetryApi.storage });
  const trash = useQuery({ queryKey: ['admin', 'volumetry', 'trash'], queryFn: adminVolumetryApi.trash });
  const orphans = useQuery({ queryKey: ['admin', 'volumetry', 'orphans'], queryFn: adminVolumetryApi.orphans, enabled: false });
  const trashSel = useSelection();
  const orphanSel = useSelection();

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'volumetry', 'storage'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'volumetry', 'trash'] });
  };
  const purge = useMutation({
    mutationFn: (ids: string[]) => adminVolumetryApi.purgeTrash(ids),
    onSuccess: () => { trashSel.clear(); refreshAll(); },
  });
  const sweep = useMutation({
    mutationFn: (keys: string[]) => adminVolumetryApi.trashOrphans(keys),
    onSuccess: () => { orphanSel.clear(); refreshAll(); orphans.refetch(); },
  });

  const graceDays = storage.data?.graceDays;
  const trashRows = trash.data ?? [];
  const orphanRows = orphans.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Stockage de fichiers</h2>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 max-w-xl" data-tour="admin-volumetry-storage" data-help-zone="admin-volumetry:storage">
        {storage.isLoading && <p className="text-sm text-muted-foreground">Mesure en cours…</p>}
        {storage.data && (
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Fichiers des éléments</p>
              <p className="text-2xl font-bold">{mb(storage.data.active.sizeMB)}</p>
              <p className="text-xs text-muted-foreground">{storage.data.active.count.toLocaleString('fr-FR')} fichiers</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Corbeille</p>
              <p className="text-2xl font-bold">{mb(storage.data.trash.sizeMB)}</p>
              <p className="text-xs text-muted-foreground">{storage.data.trash.count.toLocaleString('fr-FR')} fichiers, gardés {graceDays} jours</p>
            </div>
            <div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_CLASS[storage.data.level]}`}>
                {VOLUMETRY_LEVEL_LABELS[storage.data.level]}
              </span>
              <p className="text-xs text-muted-foreground mt-1">seuil : {mb(storage.data.maxMB)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Corbeille */}
      <div className="rounded-lg border border-border" data-tour="admin-volumetry-trash" data-help-zone="admin-volumetry:trash">
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/50">
          <div>
            <p className="font-medium text-sm">Corbeille ({trashRows.length})</p>
            <p className="text-xs text-muted-foreground">
              Fichiers que plus rien n'utilise. Leur adresse ne répond plus ; restaurer l'élément depuis l'historique les remet en place.
            </p>
          </div>
          <HelpHint text={pageHint('admin-volumetry', 'purge-trash')}>
            <Button
              variant="destructive" size="sm"
              disabled={trashSel.selected.size === 0 || purge.isPending}
              onClick={() => {
                const ids = [...trashSel.selected];
                if (confirm(`Effacer définitivement ${ids.length} fichier(s) ? Aucune restauration ne pourra plus les rendre.`)) purge.mutate(ids);
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Effacer maintenant
            </Button>
          </HelpHint>
        </div>
        {trashRows.length === 0
          ? <p className="px-4 py-3 text-sm text-muted-foreground">{trash.isLoading ? 'Chargement…' : 'La corbeille est vide.'}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="px-4 py-2 text-left">
                      <input
                        type="checkbox" aria-label="Tout sélectionner"
                        checked={trashSel.selected.size === trashRows.length}
                        onChange={(e) => trashSel.setAll(trashRows.map((r) => r.id), e.target.checked)}
                      />
                    </th>
                    <th className="px-4 py-2 text-left font-medium">Fichier</th>
                    <th className="px-4 py-2 text-right font-medium">Taille</th>
                    <th className="px-4 py-2 text-left font-medium">Origine</th>
                    <th className="px-4 py-2 text-left font-medium">Motif</th>
                    <th className="px-4 py-2 text-left font-medium">Entré le</th>
                    <th className="px-4 py-2 text-left font-medium">Effacé le</th>
                  </tr>
                </thead>
                <tbody>
                  {trashRows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2"><input type="checkbox" checked={trashSel.selected.has(r.id)} onChange={() => trashSel.toggle(r.id)} /></td>
                      <td className="px-4 py-2 break-all">{r.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{bytes(r.size)}</td>
                      <td className="px-4 py-2">
                        {r.itemTitle ?? '—'}
                        {r.spaceName && <span className="text-xs text-muted-foreground"> · {r.spaceName}</span>}
                      </td>
                      <td className="px-4 py-2">{storageTrashReasonLabel(r.reason)}</td>
                      <td className="px-4 py-2">{day(r.trashedAt)}</td>
                      <td className="px-4 py-2">{day(r.purgeAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Orphelins hors corbeille */}
      <div className="rounded-lg border border-border" data-tour="admin-volumetry-orphans" data-help-zone="admin-volumetry:orphans">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-muted/50">
          <div>
            <p className="font-medium text-sm">Orphelins hors corbeille{orphans.data ? ` (${orphanRows.length})` : ''}</p>
            <p className="text-xs text-muted-foreground">
              Fichiers d'éléments encore en ligne que plus rien n'utilise (supprimés avant la corbeille, ou échappés).
            </p>
          </div>
          <div className="flex gap-2">
            <HelpHint text={pageHint('admin-volumetry', 'search-orphans')}>
              <Button variant="bordered" size="sm" disabled={orphans.isFetching} onClick={() => orphans.refetch()}>
                <Search className="w-4 h-4 mr-1" /> {orphans.isFetching ? 'Recherche…' : 'Rechercher'}
              </Button>
            </HelpHint>
            <HelpHint text={pageHint('admin-volumetry', 'trash-orphans')}>
              <Button
                variant="bordered" size="sm"
                disabled={orphanSel.selected.size === 0 || sweep.isPending}
                onClick={() => {
                  const keys = [...orphanSel.selected];
                  if (confirm(`Mettre ${keys.length} fichier(s) à la corbeille ? Leur adresse cessera de répondre ; ils seront effacés dans ${graceDays} jours.`)) sweep.mutate(keys);
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Mettre à la corbeille
              </Button>
            </HelpHint>
          </div>
        </div>
        {!orphans.data
          ? <p className="px-4 py-3 text-sm text-muted-foreground">Lancez la recherche pour lister les orphelins (lecture de tout le stockage).</p>
          : orphanRows.length === 0
            ? <p className="px-4 py-3 text-sm text-muted-foreground">Aucun orphelin : chaque fichier en ligne est utilisé.</p>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-4 py-2 text-left">
                        <input
                          type="checkbox" aria-label="Tout sélectionner"
                          checked={orphanSel.selected.size === orphanRows.length}
                          onChange={(e) => orphanSel.setAll(orphanRows.map((r) => r.key), e.target.checked)}
                        />
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Fichier</th>
                      <th className="px-4 py-2 text-right font-medium">Taille</th>
                      <th className="px-4 py-2 text-left font-medium">Élément d'origine</th>
                      <th className="px-4 py-2 text-left font-medium">Envoyé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orphanRows.map((r) => (
                      <tr key={r.key} className="border-t border-border">
                        <td className="px-4 py-2"><input type="checkbox" checked={orphanSel.selected.has(r.key)} onChange={() => orphanSel.toggle(r.key)} /></td>
                        <td className="px-4 py-2 break-all">{r.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{bytes(r.size)}</td>
                        <td className="px-4 py-2">{r.itemTitle ?? <span className="text-muted-foreground">supprimé</span>}</td>
                        <td className="px-4 py-2">{day(r.lastModified)}</td>
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
