import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus } from 'lucide-react';
import { TYPE_LABELS, STATUS_OPTIONS, STORAGE_KEYS } from '../constants/ui';
import { useAuthStore } from '../stores/auth';

type ParentSortMode = 'tree' | 'alpha';

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
  const [url, setUrl] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState<ItemType>('NOTE');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [parentSortMode, setParentSortMode] = useState<ParentSortMode>(() => {
    return (localStorage.getItem(STORAGE_KEYS.PARENT_SORT_MODE) as ParentSortMode) || 'tree';
  });

  // Contributions state
  const [newContribution, setNewContribution] = useState('');
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingContributionContent, setEditingContributionContent] = useState('');

  // Relations state
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [newRelationType, setNewRelationType] = useState<'depends' | 'blocks'>('depends');
  const [newRelationTargetId, setNewRelationTargetId] = useState('');

  const { user } = useAuthStore();

  const toggleParentSortMode = () => {
    const newMode = parentSortMode === 'tree' ? 'alpha' : 'tree';
    setParentSortMode(newMode);
    localStorage.setItem(STORAGE_KEYS.PARENT_SORT_MODE, newMode);
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
      setUrl(item.url || '');
      setParentId(item.parentId || '');
      setStatus(item.status || '');
      setType(item.type);
      // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
      if (item.dueDate) {
        const date = new Date(item.dueDate);
        const formatted = date.toISOString().slice(0, 16);
        setDueDate(formatted);
      } else {
        setDueDate('');
      }
      if (item.startDate) {
        const date = new Date(item.startDate);
        const formatted = date.toISOString().slice(0, 16);
        setStartDate(formatted);
      } else {
        setStartDate('');
      }
      if (item.endDate) {
        const date = new Date(item.endDate);
        const formatted = date.toISOString().slice(0, 16);
        setEndDate(formatted);
      } else {
        setEndDate('');
      }
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string; dueDate?: string | null; startDate?: string | null; endDate?: string | null }) =>
      itemsApi.update(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      onClose();
    },
  });

  const createContributionMutation = useMutation({
    mutationFn: (content: string) =>
      itemsApi.createContribution(spaceId, itemId!, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setNewContribution('');
    },
  });

  const updateContributionMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      itemsApi.updateContribution(spaceId, itemId!, id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setEditingContributionId(null);
      setEditingContributionContent('');
    },
  });

  const deleteContributionMutation = useMutation({
    mutationFn: (contributionId: string) =>
      itemsApi.deleteContribution(spaceId, itemId!, contributionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    },
  });

  // Relations mutations
  const createRelationMutation = useMutation({
    mutationFn: (data: { toItemId: string; type: string }) =>
      itemsApi.createRelation(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setShowAddRelation(false);
      setNewRelationTargetId('');
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) =>
      itemsApi.deleteRelation(spaceId, itemId!, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    },
  });

  const handleAddRelation = () => {
    if (newRelationTargetId) {
      createRelationMutation.mutate({
        toItemId: newRelationTargetId,
        type: newRelationType,
      });
    }
  };

  const handleDeleteRelation = (relationId: string) => {
    if (confirm('Supprimer cette dépendance ?')) {
      deleteRelationMutation.mutate(relationId);
    }
  };

  const handleAddContribution = () => {
    if (newContribution.trim()) {
      createContributionMutation.mutate(newContribution.trim());
    }
  };

  const handleEditContribution = (contribution: ContributionWithAuthor) => {
    setEditingContributionId(contribution.id);
    setEditingContributionContent(contribution.content);
  };

  const handleSaveContribution = () => {
    if (editingContributionId && editingContributionContent.trim()) {
      updateContributionMutation.mutate({
        id: editingContributionId,
        content: editingContributionContent.trim(),
      });
    }
  };

  const handleDeleteContribution = (contributionId: string) => {
    if (confirm('Supprimer cette contribution ?')) {
      deleteContributionMutation.mutate(contributionId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item) return;

    const updates: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string; dueDate?: string | null; startDate?: string | null; endDate?: string | null } = {};

    if (type !== item.type) {
      updates.type = type;
    }

    if (title !== item.title) {
      updates.title = title;
    }

    const newDescription = description || null;
    if (newDescription !== (item.description || null)) {
      updates.description = newDescription;
    }

    const newUrl = url || null;
    if (newUrl !== (item.url || null)) {
      updates.url = newUrl;
    }

    const newParentId = parentId || null;
    if (newParentId !== item.parentId) {
      updates.parentId = newParentId;
    }

    if (status !== (item.status || '')) {
      updates.status = status || undefined;
    }

    // Handle dueDate changes
    const newDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    const currentDueDate = item.dueDate ? new Date(item.dueDate).toISOString() : null;
    if (newDueDate !== currentDueDate) {
      updates.dueDate = newDueDate;
    }

    // Handle startDate changes
    const newStartDate = startDate ? new Date(startDate).toISOString() : null;
    const currentStartDate = item.startDate ? new Date(item.startDate).toISOString() : null;
    if (newStartDate !== currentStartDate) {
      updates.startDate = newStartDate;
    }

    // Handle endDate changes
    const newEndDate = endDate ? new Date(endDate).toISOString() : null;
    const currentEndDate = item.endDate ? new Date(item.endDate).toISOString() : null;
    if (newEndDate !== currentEndDate) {
      updates.endDate = newEndDate;
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
          const indent = depth > 0 ? '—'.repeat(depth) + ' ' : '';
          result.push({
            value: child.id,
            label: `${indent}${child.title}`,
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
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </div>

          {(type === 'LINK' || type === 'DOCUMENT' || type === 'IMAGE') && (
            <div className="space-y-2">
              <label className="text-sm font-medium">URL</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {(type === 'MEETING' || type === 'PERIOD' || type === 'PROJECT' || type === 'TASK') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de début</label>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de fin</label>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

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

          {/* Dependencies/Relations section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Dépendances
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAddRelation(!showAddRelation)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            {/* Add new relation */}
            {showAddRelation && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Type</label>
                    <Select
                      value={newRelationType}
                      onChange={(e) => setNewRelationType(e.target.value as 'depends' | 'blocks')}
                      options={[
                        { value: 'depends', label: 'Dépend de...' },
                        { value: 'blocks', label: 'Bloque...' },
                      ]}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Élément</label>
                    <Select
                      value={newRelationTargetId}
                      onChange={(e) => setNewRelationTargetId(e.target.value)}
                      options={[
                        { value: '', label: 'Sélectionner...' },
                        ...allItems
                          .filter((i) => i.id !== itemId)
                          .map((i) => ({ value: i.id, label: i.title })),
                      ]}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddRelation}
                    disabled={!newRelationTargetId || createRelationMutation.isPending}
                  >
                    {createRelationMutation.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddRelation(false);
                      setNewRelationTargetId('');
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Existing relations */}
            {((item.relationsFrom && item.relationsFrom.length > 0) ||
              (item.relationsTo && item.relationsTo.length > 0)) ? (
              <div className="space-y-2">
                {/* Relations FROM this item (this item depends on / blocks others) */}
                {item.relationsFrom?.map((relation: ItemRelation & { toItem?: { id: string; title: string; type: string } }) => (
                  <div
                    key={relation.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        relation.type === 'depends' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {relation.type === 'depends' ? 'Dépend de' : 'Bloque'}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span>{relation.toItem?.title || 'Élément inconnu'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRelation(relation.id)}
                      className="p-1 hover:bg-background rounded transition-colors text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Relations TO this item (others depend on / block this item) */}
                {item.relationsTo?.map((relation: ItemRelation & { fromItem?: { id: string; title: string; type: string } }) => (
                  <div
                    key={relation.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span>{relation.fromItem?.title || 'Élément inconnu'}</span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        relation.type === 'depends' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {relation.type === 'depends' ? 'dépend de ceci' : 'est bloqué par ceci'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune dépendance</p>
            )}
          </div>

          {/* Contributions section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4" />
                Contributions ({item.contributions?.length || 0})
              </label>
            </div>

            {/* New contribution input */}
            <div className="space-y-2">
              <textarea
                value={newContribution}
                onChange={(e) => setNewContribution(e.target.value)}
                placeholder="Ajouter une contribution..."
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddContribution}
                disabled={!newContribution.trim() || createContributionMutation.isPending}
              >
                {createContributionMutation.isPending ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>

            {/* Existing contributions */}
            {item.contributions && item.contributions.length > 0 && (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {item.contributions.map((contribution) => (
                  <div
                    key={contribution.id}
                    className="p-3 bg-muted rounded-lg space-y-2"
                  >
                    {editingContributionId === contribution.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingContributionContent}
                          onChange={(e) => setEditingContributionContent(e.target.value)}
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveContribution}
                            disabled={updateContributionMutation.isPending}
                          >
                            Enregistrer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingContributionId(null);
                              setEditingContributionContent('');
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">{contribution.content}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{contribution.author.name}</span>
                            <span>-</span>
                            <span>
                              {new Date(contribution.createdAt).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          {(contribution.authorId === user?.id) && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditContribution(contribution)}
                                className="p-1 hover:bg-background rounded transition-colors"
                                title="Modifier"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteContribution(contribution.id)}
                                className="p-1 hover:bg-background rounded transition-colors text-destructive"
                                title="Supprimer"
                                disabled={deleteContributionMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
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
