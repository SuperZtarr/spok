import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, isConflictError } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation, SpaceReferentiels, Tag } from '@spok/shared';
import { ConflictDialog } from './ConflictDialog';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus, ExternalLink, ChevronRight, Home, Tag as TagIcon } from 'lucide-react';
import { TagSelector } from './ui/TagSelector';
import { TagBadge } from './ui/TagBadge';
import { TYPE_LABELS, TYPE_ICONS, STORAGE_KEYS } from '../constants/ui';
import { useAuthStore } from '../stores/auth';
import { RichTextEditor } from './ui/RichTextEditor';
import { ImageUploadZone } from './ui/ImageUploadZone';
import { FileUploadZone } from './ui/FileUploadZone';
import { DateTimeField } from './ui/DateTimeField';
import { diffMs, addHours, addDays, addMonths, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { formatDate, formatDateTime } from '../lib/utils';

const MEETING_DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '45 min', ms: 45 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '1h30', ms: 90 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
];

const DAY = 24 * 60 * 60 * 1000;
const PERIOD_DURATIONS = [
  { label: '1 jour', ms: DAY },
  { label: '2 jours', ms: 2 * DAY },
  { label: '3 jours', ms: 3 * DAY },
  { label: '5 jours', ms: 5 * DAY },
  { label: '1 sem.', ms: 7 * DAY },
  { label: '2 sem.', ms: 14 * DAY },
  { label: '1 mois', ms: 30 * DAY },
  { label: '3 mois', ms: 90 * DAY },
];

const TASK_DURATIONS = [
  { label: '15 min', ms: 15 * 60 * 1000 },
  { label: '30 min', ms: 30 * 60 * 1000 },
  { label: '45 min', ms: 45 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
  { label: '1h30', ms: 90 * 60 * 1000 },
  { label: '2h', ms: 2 * 60 * 60 * 1000 },
  { label: '3h', ms: 3 * 60 * 60 * 1000 },
  { label: '4h', ms: 4 * 60 * 60 * 1000 },
  { label: '1 jour', ms: DAY },
  { label: '2 jours', ms: 2 * DAY },
  { label: '1 sem.', ms: 7 * DAY },
  { label: '2 sem.', ms: 14 * DAY },
];

const PROJECT_DURATIONS = [
  { label: '1 mois', ms: 30 * DAY },
  { label: '3 mois', ms: 90 * DAY },
  { label: '6 mois', ms: 180 * DAY },
  { label: '1 an', ms: 365 * DAY },
  { label: '2 ans', ms: 730 * DAY },
];

type ParentSortMode = 'tree' | 'alpha';

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  itemId: string | null;
  allItems: Item[];
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  spaceName?: string;
  onNavigate?: (itemId: string) => void;
}

export function ItemEditModal({
  isOpen,
  onClose,
  spaceId,
  itemId,
  allItems,
  referentiels,
  canEdit = true,
  spaceName,
  onNavigate,
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

  // Tags state
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [originalTagIds, setOriginalTagIds] = useState<string[]>([]);

  // Contributions state
  const [newContribution, setNewContribution] = useState('');
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingContributionContent, setEditingContributionContent] = useState('');

  // Conflict state
  const [conflictData, setConflictData] = useState<{
    conflicts: Array<{ field: string; label: string; serverValue: unknown; clientValue: unknown }>;
  } | null>(null);

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
      const tagIds = item.tags?.map((t: Tag) => t.id) || [];
      setSelectedTagIds(tagIds);
      setOriginalTagIds(tagIds);
    }
  }, [item]);

  const updateMutation = useMutation({
    mutationFn: (data: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string; dueDate?: string | null; startDate?: string | null; endDate?: string | null; updatedAt?: string }) =>
      itemsApi.update(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setConflictData(null);
      onClose();
    },
    onError: (error) => {
      if (isConflictError(error)) {
        setConflictData({ conflicts: error.details.conflicts });
      }
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

  // Image upload mutation
  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => itemsApi.uploadImage(spaceId, itemId!, file),
    onSuccess: (updatedItem) => {
      setUrl(updatedItem.url || '');
      // Only invalidate the list (for thumbnails etc.), NOT the individual item query
      // Invalidating ['item', ...] would trigger the useEffect that resets all form fields
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  // Document upload mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => itemsApi.uploadDocument(spaceId, itemId!, file),
    onSuccess: (updatedItem) => {
      setUrl(updatedItem.url || '');
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
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

  // --- Auto-fill title from file/URL ---
  /** Extract a clean name from a filename (remove extension) */
  const fileNameToTitle = useCallback((filename: string): string => {
    const name = filename.replace(/\.[^.]+$/, ''); // remove extension
    return name.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
  }, []);

  /** Extract a readable title from a URL (domain or last path segment) */
  const urlToTitle = useCallback((rawUrl: string): string => {
    try {
      const u = new URL(rawUrl);
      const path = u.pathname.replace(/\/$/, '');
      if (path && path !== '/') {
        const last = path.split('/').pop() || '';
        const decoded = decodeURIComponent(last).replace(/\.[^.]+$/, '');
        if (decoded) return decoded.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
      }
      return u.hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }, []);

  const autoFillTitle = useCallback((name: string) => {
    if (!title || title.trim() === '') {
      setTitle(name);
    }
  }, [title]);

  // --- Date linking logic ---
  const handleStartDateChange = useCallback((newStart: string) => {
    const hadDuration = startDate && endDate;
    const duration = hadDuration ? diffMs(startDate, endDate) : 0;

    setStartDate(newStart);

    if (!newStart) {
      // Clear start → clear end too
      setEndDate('');
      return;
    }

    if (hadDuration && duration > 0) {
      // Maintain the same duration
      const newEnd = new Date(fromDatetimeLocal(newStart).getTime() + duration);
      setEndDate(toDatetimeLocal(newEnd));
    } else {
      // Set default end if empty or before new start
      const needsDefault = !endDate || (endDate && fromDatetimeLocal(endDate) <= fromDatetimeLocal(newStart));
      if (needsDefault) {
        const start = fromDatetimeLocal(newStart);
        if (type === 'MEETING' || type === 'TASK') {
          setEndDate(toDatetimeLocal(addHours(start, 1)));
        } else if (type === 'PROJECT') {
          setEndDate(toDatetimeLocal(addMonths(start, 1)));
        } else if (type === 'PERIOD') {
          setEndDate(toDatetimeLocal(addDays(start, 1)));
        }
      }
    }
  }, [startDate, endDate, type]);

  const handleEndDateChange = useCallback((newEnd: string) => {
    if (newEnd && startDate) {
      const s = fromDatetimeLocal(startDate);
      const e = fromDatetimeLocal(newEnd);
      if (e < s) {
        // End before start → move start to match
        setStartDate(newEnd);
      }
    }
    setEndDate(newEnd);
  }, [startDate]);

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

  const isContributionEmpty = (html: string) => !html || html === '<p></p>';

  const handleAddContribution = () => {
    if (!isContributionEmpty(newContribution)) {
      createContributionMutation.mutate(newContribution);
    }
  };

  const handleEditContribution = (contribution: ContributionWithAuthor) => {
    setEditingContributionId(contribution.id);
    setEditingContributionContent(contribution.content);
  };

  const handleSaveContribution = () => {
    if (editingContributionId && !isContributionEmpty(editingContributionContent)) {
      updateContributionMutation.mutate({
        id: editingContributionId,
        content: editingContributionContent,
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

    const updates: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string; dueDate?: string | null; startDate?: string | null; endDate?: string | null; tagIds?: string[]; updatedAt?: string } = {};

    // Include updatedAt for optimistic locking
    updates.updatedAt = item.updatedAt;

    if (type !== item.type) {
      updates.type = type;
    }

    if (title !== item.title) {
      updates.title = title;
    }

    const newDescription = (description && description !== '<p></p>') ? description : null;
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

    // Handle tag changes
    const sortedCurrent = [...selectedTagIds].sort();
    const sortedOriginal = [...originalTagIds].sort();
    if (sortedCurrent.length !== sortedOriginal.length || sortedCurrent.some((id, i) => id !== sortedOriginal[i])) {
      updates.tagIds = selectedTagIds;
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

  // Build breadcrumb path by walking up parentId chain
  const breadcrumb = useMemo(() => {
    if (!item || !allItems.length) return [];
    const path: { id: string; title: string }[] = [];
    let currentId = item.parentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const parent = allItems.find((i) => i.id === currentId);
      if (!parent) break;
      path.unshift({ id: parent.id, title: parent.title });
      currentId = parent.parentId;
    }
    return path;
  }, [item, allItems]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="font-semibold text-lg flex-shrink-0">
            {canEdit ? "Modifier" : "Détail"}
          </span>
          {item && (breadcrumb.length > 0 || spaceName) && (
            <nav className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap min-w-0">
              {spaceName && (
                <>
                  <Home className="w-3 h-3 flex-shrink-0" />
                  <span className="font-medium">{spaceName}</span>
                </>
              )}
              {breadcrumb.map((crumb) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  {onNavigate ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(crumb.id)}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {crumb.title}
                    </button>
                  ) : (
                    <span>{crumb.title}</span>
                  )}
                </span>
              ))}
              {item && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  <span className="font-semibold text-foreground">{item.title}</span>
                </span>
              )}
            </nav>
          )}
          {item?.createdBy && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto flex-shrink-0">
              <User className="w-3 h-3" />
              <span>{item.createdBy.name}</span>
              <span>•</span>
              <span>
                {new Date(item.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>
      }
      size="large"
    >
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : item ? (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="space-y-4 overflow-y-auto flex-1 pr-1">

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" title="Nom principal de l'élément">Titre</label>
              {canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'élément"
                  required
                />
              ) : (
                <p className="text-lg font-medium">{title}</p>
              )}
            </div>
            <div className="space-y-2 sm:min-w-[200px]">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" title="Élément parent dans l'arborescence">Parent</label>
                {canEdit && (
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
                )}
              </div>
              {canEdit ? (
                <Select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  options={parentOptions}
                />
              ) : (
                <p className="text-sm">
                  {parentId
                    ? parentOptions.find((o) => o.value === parentId)?.label || 'Parent inconnu'
                    : <span className="text-muted-foreground">Aucun parent</span>}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" title="Description détaillée, supporte le texte riche">Description</label>
            <RichTextEditor
              key={itemId}
              content={description}
              onChange={setDescription}
              editable={canEdit}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" title="État d'avancement de l'élément">Statut</label>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  (referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).map((s) => {
                    const isSelected = (s.id === 'undefined' && !status) || s.id === status;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const newStatus = s.id === 'undefined' ? '' : s.id;
                          setStatus(newStatus);
                          // Auto-set endDate when marking as done or cancelled
                          if ((newStatus === 'done' || newStatus === 'cancelled') && !endDate) {
                            setEndDate(toDatetimeLocal(new Date()));
                          }
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all ${
                          isSelected
                            ? `${s.borderColor} font-semibold shadow-sm`
                            : `${s.borderColor} opacity-60 hover:opacity-100`
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })
                ) : (
                  (() => {
                    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
                    const selected = statuses.find((s) =>
                      (s.id === 'undefined' && !status) || s.id === status
                    );
                    return selected ? (
                      <span className={`px-3 py-1.5 text-sm rounded-md border-2 ${selected.borderColor} font-semibold`}>
                        {selected.label}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Non défini</span>
                    );
                  })()
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" title="Catégorie de l'élément (note, tâche, projet...)">Type</label>
              <div className="flex flex-wrap gap-2">
                {canEdit ? (
                  (() => {
                    const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                    return Object.entries(typeLabels)
                      .filter(([, config]) => config.visible)
                      .sort(([, a], [, b]) => a.order - b.order)
                      .map(([key, config]) => {
                        const Icon = TYPE_ICONS[key];
                        const isSelected = type === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setType(key as ItemType)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${
                              isSelected
                                ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current`
                                : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            {Icon && <Icon className="w-3.5 h-3.5" />}
                            {config.labelShort}
                          </button>
                        );
                      });
                  })()
                ) : (
                  (() => {
                    const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                    const config = typeLabels[type];
                    const Icon = TYPE_ICONS[type];
                    return (
                      <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 ${config?.color || 'border-border'} ${config?.bgHover || ''} font-semibold`}>
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {config?.labelShort || TYPE_LABELS[type] || type}
                      </span>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {type === 'IMAGE' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" title="Image associée à cet élément">Image</label>
              {canEdit ? (
                <>
                  <ImageUploadZone
                    currentUrl={url || null}
                    onUpload={(file) => {
                      autoFillTitle(fileNameToTitle(file.name));
                      uploadImageMutation.mutate(file);
                    }}
                    onRemove={() => setUrl('')}
                    isUploading={uploadImageMutation.isPending}
                  />
                  {uploadImageMutation.isError && (
                    <p className="text-sm text-destructive">
                      {(uploadImageMutation.error as Error)?.message || "Erreur lors de l'upload"}
                    </p>
                  )}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground transition-colors">
                      URL externe (optionnel)
                    </summary>
                    <div className="mt-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </details>
                </>
              ) : url ? (
                <img
                  src={url}
                  alt="Image"
                  className="w-full max-h-80 object-contain rounded-lg border border-border bg-muted"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Aucune image</p>
              )}
            </div>
          ) : url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Image</label>
              <img src={url} alt="Image" className="w-full max-h-40 object-contain rounded-lg border border-border bg-muted" />
            </div>
          ) : null}

          {type === 'DOCUMENT' ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" title="Fichier associé à cet élément">Fichier</label>
              {canEdit ? (
                <>
                  <FileUploadZone
                    currentUrl={url || null}
                    onUpload={(file) => {
                      autoFillTitle(fileNameToTitle(file.name));
                      uploadDocumentMutation.mutate(file);
                    }}
                    onRemove={() => setUrl('')}
                    isUploading={uploadDocumentMutation.isPending}
                  />
                  {uploadDocumentMutation.isError && (
                    <p className="text-sm text-destructive">
                      {(uploadDocumentMutation.error as Error)?.message || "Erreur lors de l'upload"}
                    </p>
                  )}
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground transition-colors">
                      URL externe (optionnel)
                    </summary>
                    <div className="mt-2">
                      <Input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://..."
                      />
                    </div>
                  </details>
                </>
              ) : url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all"
                >
                  <ExternalLink className="w-4 h-4 flex-shrink-0" />
                  Télécharger le fichier
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun fichier</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium" title="Adresse web associée à cet élément">URL</label>
            {type === 'LINK' && canEdit ? (
              <Input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  const extracted = urlToTitle(e.target.value);
                  if (extracted) autoFillTitle(extracted);
                }}
                placeholder="https://..."
              />
            ) : null}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all"
              >
                <ExternalLink className="w-4 h-4 flex-shrink-0" />
                {url}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground italic">Aucune URL</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2 relative">
              <label className="text-sm font-medium">Début</label>
              {canEdit ? (
                <DateTimeField
                  value={startDate}
                  onChange={handleStartDateChange}
                  showTime={type === 'MEETING' || type === 'TASK'}
                />
              ) : (
                <p className="text-sm">
                  {startDate
                    ? (type === 'MEETING' || type === 'TASK' ? formatDateTime(startDate) : formatDate(startDate))
                    : <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <label className="text-sm font-medium">Fin</label>
              {canEdit ? (
                <div className="space-y-2">
                  {(type === 'MEETING' || type === 'PERIOD' || type === 'PROJECT' || type === 'TASK') && startDate && (
                    <div className="flex flex-wrap gap-1.5">
                      {(type === 'MEETING' ? MEETING_DURATIONS : type === 'TASK' ? TASK_DURATIONS : type === 'PROJECT' ? PROJECT_DURATIONS : PERIOD_DURATIONS).map((d) => {
                        const isSelected = startDate && endDate && Math.abs(diffMs(startDate, endDate) - d.ms) < 60000;
                        return (
                          <button
                            key={d.ms}
                            type="button"
                            onClick={() => {
                              const end = new Date(fromDatetimeLocal(startDate).getTime() + d.ms);
                              setEndDate(toDatetimeLocal(end));
                            }}
                            className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/10 font-semibold text-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <DateTimeField
                    value={endDate}
                    onChange={handleEndDateChange}
                    showTime={type === 'MEETING' || type === 'TASK'}
                    showPresets={type !== 'MEETING' && type !== 'PROJECT' && type !== 'TASK'}
                    minDate={startDate}
                  />
                </div>
              ) : (
                <p className="text-sm">
                  {endDate
                    ? (type === 'MEETING' || type === 'TASK' ? formatDateTime(endDate) : formatDate(endDate))
                    : <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>
            <div className="space-y-2 relative">
              <label className="text-sm font-medium">Échéance</label>
              {canEdit ? (
                <DateTimeField
                  value={dueDate}
                  onChange={setDueDate}
                  showTime={false}
                />
              ) : (
                <p className="text-sm">
                  {dueDate
                    ? formatDate(dueDate)
                    : <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>
          </div>

          {/* Tags section */}
          <div className="space-y-2 pt-4 border-t border-border">
            <label className="text-sm font-medium flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              Tags
            </label>
            {canEdit ? (
              <TagSelector
                spaceId={spaceId}
                value={selectedTagIds}
                onChange={setSelectedTagIds}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {item?.tags && item.tags.length > 0 ? (
                  item.tags.map((tag: Tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun tag</span>
                )}
              </div>
            )}
          </div>

          {/* Dependencies/Relations section */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Dépendances
              </label>
              {canEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddRelation(!showAddRelation)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Ajouter
                </Button>
              )}
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
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRelation(relation.id)}
                        className="p-1 hover:bg-background rounded transition-colors text-destructive"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
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

            {/* Existing contributions */}
            {item.contributions && item.contributions.length > 0 && (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {item.contributions.map((contribution) => (
                  <div
                    key={contribution.id}
                    className="p-3 bg-card border border-border rounded-lg space-y-2"
                  >
                    {editingContributionId === contribution.id ? (
                      <div className="space-y-2">
                        <RichTextEditor
                          key={`edit-${contribution.id}`}
                          content={editingContributionContent}
                          onChange={setEditingContributionContent}
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
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                          dangerouslySetInnerHTML={{ __html: contribution.content }}
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground/80 mt-2">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span className="font-medium text-foreground/70">{contribution.author.name}</span>
                            <span>·</span>
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
                          {canEdit && (contribution.authorId === user?.id) && (
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

            {/* New contribution input */}
            {canEdit && (
              <div className="space-y-2">
                <RichTextEditor
                  key={`new-contrib-${item.contributions?.length ?? 0}`}
                  content={newContribution}
                  onChange={setNewContribution}
                  placeholder="Ajouter une contribution..."
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddContribution}
                  disabled={isContributionEmpty(newContribution) || createContributionMutation.isPending}
                >
                  {createContributionMutation.isPending ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            )}
          </div>

          </div>

          <div className="flex gap-2 pt-4 border-t border-border mt-4 flex-shrink-0">
            {canEdit && (
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {canEdit ? 'Annuler' : 'Fermer'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="py-8 text-center text-muted-foreground">
          Élément introuvable
        </div>
      )}
      {/* Conflict resolution dialog */}
      {conflictData && (
        <ConflictDialog
          isOpen={!!conflictData}
          onClose={() => setConflictData(null)}
          conflicts={conflictData.conflicts}
          onResolve={(resolvedFields) => {
            // Force overwrite with resolved fields (no updatedAt = skip check)
            setConflictData(null);
            updateMutation.mutate(resolvedFields as any);
          }}
          onKeepServer={() => {
            // Discard local changes, reload from server
            setConflictData(null);
            queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
            queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
