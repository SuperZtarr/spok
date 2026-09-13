/*
 * Duplication d'un item (et enfants) vers un autre espace, en N itérations optionnelles
 * décalées cumulativement d'une unité de temps (jour/semaine/mois/an) — pratique pour créer
 * une série récurrente. iterations=1 (défaut) = comportement classique, pas de décalage.
 */
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Copy, Loader2, Search } from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import { groupSpacesByCommunity } from '../lib/spaceGrouping';
import { Button } from './ui/Button';
import { DevModalBadge } from './ui/DevModalBadge';

interface DuplicateToSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpaceId: string;
  itemIds?: string[];  // Si fourni, utilise ces IDs au lieu du selection store
}

export function DuplicateToSpaceModal({ isOpen, onClose, currentSpaceId, itemIds }: DuplicateToSpaceModalProps) {
  const queryClient = useQueryClient();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentSpaceId);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [iterations, setIterations] = useState(1);
  const [offsetUnit, setOffsetUnit] = useState<'day' | 'week' | 'month' | 'year'>('week');

  // Réinitialise les contrôles d'itération à chaque fermeture (évite de garder N=12
  // pour la prochaine ouverture sur un autre item).
  useEffect(() => {
    if (!isOpen) {
      setIterations(1);
      setOffsetUnit('week');
    }
  }, [isOpen]);

  const effectiveIds = itemIds || [];

  const { data: spaces, isLoading: spacesLoading } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
    enabled: isOpen,
  });

  const bulkDuplicateMutation = useMutation({
    mutationFn: () =>
      itemsApi.bulkDuplicate(currentSpaceId, {
        itemIds: effectiveIds,
        targetSpaceId: selectedSpaceId,
        includeChildren,
        iterations,
        offsetUnit: iterations > 1 ? offsetUnit : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', currentSpaceId] });
      if (selectedSpaceId !== currentSpaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', selectedSpaceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['space', currentSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', selectedSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs', selectedSpaceId] });
      onClose();
    },
  });

  // All spaces are available for duplication (including current)
  const availableSpaces = spaces || [];

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) return availableSpaces;
    const query = searchQuery.toLowerCase();
    return availableSpaces.filter((s) =>
      s.name.toLowerCase().includes(query) ||
      (s.community?.name && s.community.name.toLowerCase().includes(query))
    );
  }, [availableSpaces, searchQuery]);

  const spaceGroups = useMemo(() => groupSpacesByCommunity(filteredSpaces), [filteredSpaces]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          title="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <Copy className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-semibold">
            Dupliquer vers un espace
          </h2>
          <DevModalBadge name="DuplicateToSpaceModal" />
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {effectiveIds.length} élément{effectiveIds.length > 1 ? 's' : ''} sélectionné{effectiveIds.length > 1 ? 's' : ''}
        </p>

        {spacesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : availableSpaces.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucun espace disponible
          </p>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un espace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>

            {filteredSpaces.length === 0 ? (
              <p className="text-muted-foreground text-center py-6 text-sm">
                Aucun espace trouvé
              </p>
            ) : (
            <div className="max-h-60 overflow-y-auto mb-4">
              {spaceGroups.map((group) => (
                <div key={group.communityId || '_personal'}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 py-1.5 sticky top-0 bg-card">
                    {group.label}
                  </div>
                  <div className="space-y-1.5">
                    {group.spaces.map((space) => (
                      <label
                        key={space.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedSpaceId === space.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-accent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="targetSpace"
                          value={space.id}
                          checked={selectedSpaceId === space.id}
                          onChange={(e) => setSelectedSpaceId(e.target.value)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            {space.name}
                            {space.id === currentSpaceId && (
                              <span className="ml-2 text-xs text-muted-foreground">(actuel)</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {space.type === 'PERSONAL' ? 'Personnel' : 'Groupe'} • {space.role}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            )}

            <label className="flex items-center gap-2 mb-4 text-sm">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(e) => setIncludeChildren(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Inclure les éléments enfants</span>
            </label>

            <div className="space-y-2 mb-6">
              <label className="flex items-center gap-2 text-sm">
                <span>Nombre d'itérations</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={iterations}
                  onChange={(e) => setIterations(Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1)))}
                  className="w-16 px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              {iterations > 1 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Décalage entre chaque copie (dates conservées, décalées cumulativement)</p>
                  <div className="flex gap-1.5">
                    {([
                      { value: 'day', label: '1 jour' },
                      { value: 'week', label: '1 semaine' },
                      { value: 'month', label: '1 mois' },
                      { value: 'year', label: '1 an' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setOffsetUnit(opt.value)}
                        className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                          offsetUnit === opt.value ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="bordered" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => bulkDuplicateMutation.mutate()}
            disabled={!selectedSpaceId || bulkDuplicateMutation.isPending}
          >
            {bulkDuplicateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Duplication...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                {iterations > 1 ? `Dupliquer ×${iterations}` : 'Dupliquer'}
              </>
            )}
          </Button>
        </div>

        {bulkDuplicateMutation.isError && (
          <p className="mt-4 text-sm text-destructive text-center">
            Erreur lors de la duplication. Veuillez réessayer.
          </p>
        )}
      </div>
    </div>
  );
}
