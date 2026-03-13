import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TYPE_ICONS, TYPE_LABELS, getPriorityConfig } from '../constants/ui';
import type { Item } from '@spok/shared';
import { itemsApi } from '../lib/api';

type KeepChoice = 'source' | 'target';
type DescriptionChoice = 'source' | 'target' | 'concat';

interface MergeField {
  key: string;
  label: string;
  sourceValue: string;
  targetValue: string;
}

interface MergeItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceItem: Item | null;
  allItems: Item[];
  spaceId: string;
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  cancelled: 'Annulé',
};

function formatDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
}

function displayValue(val: string | null | undefined): string {
  return val || '—';
}

export function MergeItemModal({ isOpen, onClose, sourceItem, allItems, spaceId }: MergeItemModalProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'pick' | 'compare'>('pick');
  const [search, setSearch] = useState('');
  const [targetItem, setTargetItem] = useState<Item | null>(null);
  const [keep, setKeep] = useState<Record<string, KeepChoice>>({});
  const [descriptionChoice, setDescriptionChoice] = useState<DescriptionChoice>('concat');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('pick');
      setSearch('');
      setTargetItem(null);
      setKeep({});
      setDescriptionChoice('concat');
    }
  }, [isOpen]);

  // Filter items for picker (exclude source and its descendants)
  const pickableItems = useMemo(() => {
    if (!sourceItem) return [];
    const excludeIds = new Set<string>();
    excludeIds.add(sourceItem.id);
    // Exclude descendants
    function addDescendants(parentId: string) {
      for (const item of allItems) {
        if (item.parentId === parentId && !excludeIds.has(item.id)) {
          excludeIds.add(item.id);
          addDescendants(item.id);
        }
      }
    }
    addDescendants(sourceItem.id);

    return allItems.filter(i => !excludeIds.has(i.id));
  }, [sourceItem, allItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return pickableItems;
    const lower = search.toLowerCase();
    return pickableItems.filter(i => i.title.toLowerCase().includes(lower));
  }, [pickableItems, search]);

  // Build comparison fields
  const fields: MergeField[] = useMemo(() => {
    if (!sourceItem || !targetItem) return [];
    return [
      { key: 'title', label: 'Titre', sourceValue: sourceItem.title, targetValue: targetItem.title },
      { key: 'type', label: 'Type', sourceValue: TYPE_LABELS[sourceItem.type] || sourceItem.type, targetValue: TYPE_LABELS[targetItem.type] || targetItem.type },
      { key: 'status', label: 'Statut', sourceValue: STATUS_LABELS[sourceItem.status || ''] || displayValue(sourceItem.status), targetValue: STATUS_LABELS[targetItem.status || ''] || displayValue(targetItem.status) },
      { key: 'priority', label: 'Priorité', sourceValue: getPriorityConfig(sourceItem.priority)?.label || '—', targetValue: getPriorityConfig(targetItem.priority)?.label || '—' },
      { key: 'assignedToId', label: 'Assigné à', sourceValue: sourceItem.assignedToId || '—', targetValue: targetItem.assignedToId || '—' },
      { key: 'startDate', label: 'Date début', sourceValue: formatDate(sourceItem.startDate), targetValue: formatDate(targetItem.startDate) },
      { key: 'endDate', label: 'Date fin', sourceValue: formatDate(sourceItem.endDate), targetValue: formatDate(targetItem.endDate) },
      { key: 'dueDate', label: 'Échéance', sourceValue: formatDate(sourceItem.dueDate), targetValue: formatDate(targetItem.dueDate) },
      { key: 'url', label: 'URL', sourceValue: displayValue(sourceItem.url), targetValue: displayValue(targetItem.url) },
    ];
  }, [sourceItem, targetItem]);

  // Initialize keep choices when entering compare step
  useEffect(() => {
    if (step === 'compare' && sourceItem && targetItem) {
      const initial: Record<string, KeepChoice> = {};
      // Default: keep target for each field (merge INTO target)
      for (const f of fields) {
        initial[f.key] = 'target';
      }
      setKeep(initial);
      setDescriptionChoice('concat');
    }
  }, [step, sourceItem?.id, targetItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mergeMutation = useMutation({
    mutationFn: (data: Parameters<typeof itemsApi.merge>[2]) =>
      itemsApi.merge(spaceId, sourceItem!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      onClose();
    },
  });

  const handleSelectTarget = (item: Item) => {
    setTargetItem(item);
    setStep('compare');
  };

  const handleConfirm = () => {
    if (!sourceItem || !targetItem) return;
    mergeMutation.mutate({
      targetItemId: targetItem.id,
      keep: {
        title: keep.title || 'target',
        type: keep.type || 'target',
        status: keep.status || 'target',
        priority: keep.priority || 'target',
        assignedToId: keep.assignedToId || 'target',
        startDate: keep.startDate || 'target',
        endDate: keep.endDate || 'target',
        dueDate: keep.dueDate || 'target',
        url: keep.url || 'target',
        description: descriptionChoice,
      },
    });
  };

  if (!sourceItem) return null;

  const SourceIcon = TYPE_ICONS[sourceItem.type] || TYPE_ICONS.NOTE;
  const TargetIcon = targetItem ? (TYPE_ICONS[targetItem.type] || TYPE_ICONS.NOTE) : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Fusionner avec..." size={step === 'compare' ? 'large' : 'default'}>
      {step === 'pick' && (
        <div className="space-y-3">
          {/* Source item display */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <SourceIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Source :</span>
            <span className="font-semibold truncate">{sourceItem.title}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowRight className="w-4 h-4" />
            <span>Choisir l'élément cible (la source sera supprimée après fusion)</span>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un élément..."
              className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          {/* Item list */}
          <div className="max-h-[400px] overflow-y-auto border rounded-md divide-y">
            {filteredItems.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Aucun élément trouvé</div>
            ) : (
              filteredItems.slice(0, 50).map((item) => {
                const Icon = TYPE_ICONS[item.type] || TYPE_ICONS.NOTE;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTarget(item)}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{item.title}</span>
                    <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
                      {TYPE_LABELS[item.type] || item.type}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {step === 'compare' && targetItem && (
        <div className="space-y-4">
          {/* Header: source → target */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
              <SourceIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs text-red-600 dark:text-red-400 font-medium">Source (supprimée)</div>
                <div className="text-sm font-semibold truncate">{sourceItem.title}</div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
              {TargetIcon && <TargetIcon className="w-4 h-4 text-green-500 flex-shrink-0" />}
              <div className="min-w-0">
                <div className="text-xs text-green-600 dark:text-green-400 font-medium">Cible (conservée)</div>
                <div className="text-sm font-semibold truncate">{targetItem.title}</div>
              </div>
            </div>
          </div>

          {/* Field comparison table */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="px-3 py-2 text-left font-medium w-[120px]">Champ</th>
                  <th className="px-3 py-2 text-left font-medium">Source (A)</th>
                  <th className="px-3 py-2 text-center font-medium w-[80px]">Garder</th>
                  <th className="px-3 py-2 text-left font-medium">Cible (B)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map((field) => {
                  const isDifferent = field.sourceValue !== field.targetValue;
                  return (
                    <tr key={field.key} className={isDifferent ? 'bg-yellow-50/50 dark:bg-yellow-950/20' : ''}>
                      <td className="px-3 py-2 font-medium text-muted-foreground">{field.label}</td>
                      <td className={`px-3 py-2 ${keep[field.key] === 'source' ? 'font-semibold' : 'text-muted-foreground'}`}>
                        <span className="truncate block max-w-[200px]">{field.sourceValue}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isDifferent ? (
                          <div className="flex justify-center gap-1">
                            <button
                              onClick={() => setKeep(prev => ({ ...prev, [field.key]: 'source' }))}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                keep[field.key] === 'source'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-accent'
                              }`}
                            >
                              A
                            </button>
                            <button
                              onClick={() => setKeep(prev => ({ ...prev, [field.key]: 'target' }))}
                              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                keep[field.key] === 'target'
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-muted text-muted-foreground hover:bg-accent'
                              }`}
                            >
                              B
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">=</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 ${keep[field.key] === 'target' ? 'font-semibold' : 'text-muted-foreground'}`}>
                        <span className="truncate block max-w-[200px]">{field.targetValue}</span>
                      </td>
                    </tr>
                  );
                })}

                {/* Description row with 3 options */}
                <tr className="bg-yellow-50/50 dark:bg-yellow-950/20">
                  <td className="px-3 py-2 font-medium text-muted-foreground">Description</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="text-xs">{sourceItem.description ? `${sourceItem.description.length} car.` : '—'}</span>
                  </td>
                  <td className="px-3 py-2" colSpan={2}>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setDescriptionChoice('source')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          descriptionChoice === 'source'
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        A
                      </button>
                      <button
                        onClick={() => setDescriptionChoice('target')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          descriptionChoice === 'target'
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        B
                      </button>
                      <button
                        onClick={() => setDescriptionChoice('concat')}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          descriptionChoice === 'concat'
                            ? 'bg-blue-500 text-white'
                            : 'bg-muted text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        A+B
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Info about what will be transferred */}
          <div className="text-xs text-muted-foreground space-y-1 px-1">
            <p>Les enfants, contributions, tags et relations de la source seront transférés à la cible.</p>
            <p className="text-red-500">La source sera supprimée après la fusion.</p>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => { setStep('pick'); setTargetItem(null); }}>
              ← Changer de cible
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button onClick={handleConfirm} disabled={mergeMutation.isPending}>
                {mergeMutation.isPending ? 'Fusion...' : 'Fusionner'}
              </Button>
            </div>
          </div>

          {mergeMutation.isError && (
            <div className="text-sm text-red-600 p-2 bg-red-50 rounded-md">
              Erreur : {(mergeMutation.error as Error).message}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
