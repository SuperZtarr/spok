import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';
import type { Item, ItemType } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch } from 'lucide-react';

const TYPE_LABELS: Record<ItemType, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  APPOINTMENT: 'Rendez-vous',
};

const STATUS_OPTIONS = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
];

type ParentSortMode = 'tree' | 'alpha';
const PARENT_SORT_KEY = 'spok-parent-sort-mode';

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  itemId: string | null;
  allItems: Item[];
}

export function ItemEditModal({
  isOpen,
  onClose,
  spaceId,
  itemId,
  allItems,
}: ItemEditModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [parentSortMode, setParentSortMode] = useState<ParentSortMode>(() => {
    return (localStorage.getItem(PARENT_SORT_KEY) as ParentSortMode) || 'tree';
  });

  const toggleParentSortMode = () => {
    const newMode = parentSortMode === 'tree' ? 'alpha' : 'tree';
    setParentSortMode(newMode);
    localStorage.setItem(PARENT_SORT_KEY, newMode);
  };

  const { data: item, isLoading } = useQuery({
    queryKey: ['item', spaceId, itemId],
    queryFn: () => itemsApi.get(spaceId, itemId!),
    enabled: !!itemId && isOpen,
  });

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setParentId(item.parentId || '');
      setStatus(item.status || '');
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; description?: string | null; parentId?: string | null; status?: string }) =>
      itemsApi.update(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const updates: { title?: string; description?: string | null; parentId?: string | null; status?: string } = {};

    if (title !== item.title) {
      updates.title = title;
    }

    const newDescription = description || null;
    if (newDescription !== (item.description || null)) {
      updates.description = newDescription;
    }

    const newParentId = parentId || null;
    if (newParentId !== item.parentId) {
      updates.parentId = newParentId;
    }

    if (status !== (item.status || '')) {
      updates.status = status || undefined;
    }

    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    } else {
      onClose();
    }
  };

  // Get all descendants of an item to prevent circular references
  const getDescendantIds = (id: string): Set<string> => {
    const descendants = new Set<string>();
    const findDescendants = (currentId: string) => {
      allItems.forEach((item) => {
        if (item.parentId === currentId && !descendants.has(item.id)) {
          descendants.add(item.id);
          findDescendants(item.id);
        }
      });
    };
    findDescendants(id);
    return descendants;
  };

  // Build parent options excluding current item and its descendants
  const parentOptions = useMemo(() => {
    const descendants = itemId ? getDescendantIds(itemId) : new Set<string>();

    const validItems = allItems.filter((i) => {
      if (!itemId) return true;
      if (i.id === itemId) return false;
      return !descendants.has(i.id);
    });

    if (parentSortMode === 'alpha') {
      // Alphabetical sort
      const sorted = [...validItems].sort((a, b) =>
        a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' })
      );
      return [
        { value: '', label: 'Aucun parent (racine)' },
        ...sorted.map((i) => ({
          value: i.id,
          label: i.title,
        })),
      ];
    } else {
      // Tree sort with indentation
      const buildTree = (parentId: string | null, depth: number): { value: string; label: string }[] => {
        const children = validItems
          .filter((i) => (i.parentId || null) === parentId)
          .sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));

        const result: { value: string; label: string }[] = [];
        for (const child of children) {
          const indent = '  '.repeat(depth);
          const prefix = depth > 0 ? '└ ' : '';
          result.push({
            value: child.id,
            label: `${indent}${prefix}${child.title}`,
          });
          result.push(...buildTree(child.id, depth + 1));
        }
        return result;
      };

      return [
        { value: '', label: 'Aucun parent (racine)' },
        ...buildTree(null, 0),
      ];
    }
  }, [allItems, itemId, parentSortMode]);

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier l'élément">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : item ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Titre</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'élément"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajoutez une description..."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Input value={TYPE_LABELS[item.type]} disabled className="bg-muted" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Parent</label>
              <button
                type="button"
                onClick={toggleParentSortMode}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}
              >
                {parentSortMode === 'tree' ? (
                  <>
                    <GitBranch className="w-3 h-3" />
                    <span>Arborescence</span>
                  </>
                ) : (
                  <>
                    <ArrowDownAZ className="w-3 h-3" />
                    <span>A-Z</span>
                  </>
                )}
              </button>
            </div>
            <Select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              options={parentOptions}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: '', label: 'Aucun statut' }, ...STATUS_OPTIONS]}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          Élément introuvable
        </div>
      )}
    </Modal>
  );
}
