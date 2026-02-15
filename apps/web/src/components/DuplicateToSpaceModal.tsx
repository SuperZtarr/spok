import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Copy, Loader2, Search } from 'lucide-react';
import { spacesApi, itemsApi } from '../lib/api';
import { Button } from './ui/Button';
import { useSelectionStore } from '../stores/selection';

interface DuplicateToSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSpaceId: string;
  itemIds?: string[];  // Si fourni, utilise ces IDs au lieu du selection store
}

export function DuplicateToSpaceModal({ isOpen, onClose, currentSpaceId, itemIds }: DuplicateToSpaceModalProps) {
  const queryClient = useQueryClient();
  const { selectedIds, clearSelection } = useSelectionStore();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(currentSpaceId);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Utiliser les itemIds en prop si fournis, sinon le selection store
  const effectiveIds = itemIds || Array.from(selectedIds);

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
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', currentSpaceId] });
      if (selectedSpaceId !== currentSpaceId) {
        queryClient.invalidateQueries({ queryKey: ['items', selectedSpaceId] });
      }
      queryClient.invalidateQueries({ queryKey: ['space', currentSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', selectedSpaceId] });
      queryClient.invalidateQueries({ queryKey: ['auditLogs', selectedSpaceId] });
      if (!itemIds) clearSelection();
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
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {filteredSpaces.map((space) => (
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
            )}

            <label className="flex items-center gap-2 mb-6 text-sm">
              <input
                type="checkbox"
                checked={includeChildren}
                onChange={(e) => setIncludeChildren(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Inclure les éléments enfants</span>
            </label>
          </>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
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
                Dupliquer
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
