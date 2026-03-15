import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, spacesApi, isConflictError } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation, SpaceReferentiels, Tag } from '@spok/shared';
import { ConflictDialog } from './ConflictDialog';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus, ExternalLink, ChevronRight, Home, Tag as TagIcon, Printer, FileDown, Building2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TagSelector } from './ui/TagSelector';
import { ReactionBar } from './ReactionBar';
import { driver } from 'driver.js';
import { ITEM_MODAL_TOUR } from '../hooks/viewTours';
import { TagBadge } from './ui/TagBadge';
import { TYPE_LABELS, TYPE_ICONS, STORAGE_KEYS, PRIORITIES } from '../constants/ui';
import { useAuthStore } from '../stores/auth';
import { RichTextEditor } from './ui/RichTextEditor';
import { DrawioEditor } from './ui/DrawioEditor';
import { ImageUploadZone } from './ui/ImageUploadZone';
import { FileUploadZone } from './ui/FileUploadZone';
import { DateTimeField } from './ui/DateTimeField';
import { diffMs, addHours, addDays, addMonths, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { formatDate, formatDateTime } from '../lib/utils';
import { MEETING_DURATIONS, PERIOD_DURATIONS, TASK_DURATIONS, PROJECT_DURATIONS, DUE_DATE_DURATIONS } from './item-edit-constants';
import { fileNameToTitle, urlToTitle, getDescendantIds } from './item-edit-helpers';
import { printItem, exportItemPDF } from '../lib/itemExport';

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
  communityName?: string;
  onNavigate?: (itemId: string) => void;
  onDelete?: (id: string) => void;
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
  communityName,
  onNavigate,
  onDelete,
}: ItemEditModalProps) {
  const queryClient = useQueryClient();
  const tourShownRef = useRef(false);

  // Show modal tour on first open
  useEffect(() => {
    if (!isOpen || tourShownRef.current) return;
    const key = 'spok-item-modal-tour-done';
    if (localStorage.getItem(key)) return;
    tourShownRef.current = true;
    const timer = setTimeout(() => {
      const validSteps = ITEM_MODAL_TOUR.filter(s => !s.element || document.querySelector(s.element));
      if (validSteps.length === 0) return;
      const d = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        nextBtnText: 'Suivant',
        prevBtnText: 'Précédent',
        doneBtnText: 'Terminer',
        progressText: '{{current}} / {{total}}',
        steps: validSteps,
        onDestroyed: () => localStorage.setItem(key, 'true'),
      });
      d.drive();
    }, 500);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [imageExpanded, setImageExpanded] = useState(false);
  const [parentId, setParentId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [type, setType] = useState<ItemType>('NOTE');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [priority, setPriority] = useState<number | null>(null);
  const [diagramXml, setDiagramXml] = useState('');
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

  // Confirm delete state
  const [pendingDeleteRelationId, setPendingDeleteRelationId] = useState<string | null>(null);
  const [pendingDeleteContributionId, setPendingDeleteContributionId] = useState<string | null>(null);

  // Relations state
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [newRelationType, setNewRelationType] = useState<'depends' | 'blocks' | 'relates'>('depends');
  const [newRelationTargetId, setNewRelationTargetId] = useState('');
  const [newRelationLabel, setNewRelationLabel] = useState('');
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  const [editRelationType, setEditRelationType] = useState('');
  const [editRelationLabel, setEditRelationLabel] = useState('');

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

  const { data: spaceMembers } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
    enabled: isOpen,
  });

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setDescription(item.description || '');
      setUrl(item.url || '');
      setParentId(item.parentId || '');
      setStatus(item.status || '');
      setPriority(item.priority ?? null);
      setAssignedToId(item.assignedToId || '');
      setType(item.type);
      setDiagramXml((item.content as Record<string, unknown>)?.xml as string || '');
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
    mutationFn: (data: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string | null; assignedToId?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; updatedAt?: string }) =>
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
    mutationFn: (data: { toItemId: string; type: string; label?: string }) =>
      itemsApi.createRelation(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setShowAddRelation(false);
      setNewRelationTargetId('');
      setNewRelationLabel('');
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: (relationId: string) =>
      itemsApi.deleteRelation(spaceId, itemId!, relationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: ({ relationId, data }: { relationId: string; data: { type?: string; label?: string | null } }) =>
      itemsApi.updateRelation(spaceId, itemId!, relationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setEditingRelationId(null);
      setEditRelationType('');
      setEditRelationLabel('');
    },
  });

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
        label: newRelationLabel.trim() || undefined,
      });
      setNewRelationLabel('');
    }
  };

  const handleDeleteRelation = (relationId: string) => {
    setPendingDeleteRelationId(relationId);
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
    setPendingDeleteContributionId(contributionId);
  };

  const doSubmit = () => {
    if (!item) return;

    const updates: { type?: ItemType; title?: string; description?: string | null; content?: Record<string, unknown>; url?: string | null; parentId?: string | null; status?: string | null; priority?: number | null; assignedToId?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; tagIds?: string[]; updatedAt?: string } = {};

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

    // Handle diagram content
    if (type === 'DIAGRAM') {
      const currentXml = (item.content as Record<string, unknown>)?.xml as string || '';
      if (diagramXml !== currentXml) {
        updates.content = { xml: diagramXml };
      }
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
      updates.status = status || null;
    }

    if (priority !== (item.priority ?? null)) {
      updates.priority = priority;
    }

    const newAssignedToId = assignedToId || null;
    if (newAssignedToId !== (item.assignedToId || null)) {
      updates.assignedToId = newAssignedToId;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit();
  };

  // Build parent options excluding current item and its descendants
  const parentOptions = useMemo(() => {
    const descendants = itemId ? getDescendantIds(itemId, allItems) : new Set<string>();

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

  const TypeIcon = TYPE_ICONS[type];
  const typeConfig = (referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels)[type];
  const contributionCount = item?.contributions?.length || 0;


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="fullscreen"
    >
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : item ? (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          {/* Breadcrumb */}
          {(communityName || spaceName || breadcrumb.length > 0) && (
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3 px-1 flex-wrap" data-tour="item-breadcrumb">
              {communityName && (
                <>
                  <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{communityName}</span>
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
                </>
              )}
              {spaceName && (
                <Link to={`/spaces/${spaceId}/content`} onClick={onClose} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                  <Home className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{spaceName}</span>
                </Link>
              )}
              {breadcrumb.map((crumb) => (
                <span key={crumb.id} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
                  {onNavigate ? (
                    <button type="button" onClick={() => onNavigate(crumb.id)} className="hover:text-primary hover:underline transition-colors">
                      {crumb.title}
                    </button>
                  ) : (
                    <span>{crumb.title}</span>
                  )}
                </span>
              ))}
            </nav>
          )}

          {/* Header with type icon + title */}
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConfig?.bgHover || 'bg-muted'}`}>
              {TypeIcon && <TypeIcon className={`w-6 h-6 ${typeConfig?.color || 'text-muted-foreground'}`} />}
            </div>
            <div className="flex-1 min-w-0" data-tour="item-title">
              {canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'élément"
                  className="text-xl font-bold px-2 py-1 h-auto bg-muted/30 hover:bg-muted/60 focus:bg-background transition-colors"
                  autoFocus={!title}
                />
              ) : (
                <h1 className="text-xl font-bold truncate">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item?.createdBy && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{item.createdBy.name}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  const validSteps = ITEM_MODAL_TOUR.filter(s => !s.element || document.querySelector(s.element));
                  if (validSteps.length === 0) return;
                  const d = driver({
                    showProgress: true,
                    showButtons: ['next', 'previous', 'close'],
                    nextBtnText: 'Suivant',
                    prevBtnText: 'Précédent',
                    doneBtnText: 'Terminer',
                    progressText: '{{current}} / {{total}}',
                    steps: validSteps,
                  });
                  d.drive();
                }}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="Aide sur cette page"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pr-1">

            {/* Type selector — full width */}
            <div className="flex flex-wrap gap-2 mb-4">
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
                          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${
                            isSelected
                              ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current`
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                          {config.labelShort}
                        </button>
                      );
                    });
                })()
              ) : (
                <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 ${typeConfig?.color || 'border-border'} ${typeConfig?.bgHover || ''} font-semibold`}>
                  {TypeIcon && <TypeIcon className="w-3.5 h-3.5" />}
                  {typeConfig?.labelShort || TYPE_LABELS[type] || type}
                </span>
              )}
            </div>

            {/* Three-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,1fr,320px] gap-6">

          {/* === LEFT COLUMN: description + contributions === */}
          <div className="space-y-6 min-w-0">

              {/* Description */}
              <div className="space-y-2" data-tour="item-description">
                <label className="text-sm font-medium">Description</label>
                <RichTextEditor
                  key={itemId}
                  content={description}
                  onChange={setDescription}
                  editable={canEdit}
                  spaceId={spaceId}
                  mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))}
                />
              </div>

              {/* Reactions on item */}
              {item && (
                <div className="space-y-1" data-tour="item-reactions">
                  <h2 className="text-sm font-medium text-muted-foreground">Réactions</h2>
                  <ReactionBar
                    spaceId={spaceId}
                    itemId={item.id}
                    summary={(item as any).reactionSummary || []}
                  />
                </div>
              )}

              {/* Contributions */}
              <div className="space-y-3" data-tour="item-contributions">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5" />
                  Contributions ({contributionCount})
                </h2>

                {item.contributions && item.contributions.length > 0 && (
                  <div className="space-y-3">
                    {item.contributions.map((contribution) => (
                      <div key={contribution.id} className="p-4 bg-card border border-border rounded-lg space-y-2">
                        {editingContributionId === contribution.id ? (
                          <div className="space-y-2">
                            <RichTextEditor key={`edit-${contribution.id}`} content={editingContributionContent} onChange={setEditingContributionContent} spaceId={spaceId}
                              mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))} />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={handleSaveContribution} disabled={updateContributionMutation.isPending}>Enregistrer</Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => { setEditingContributionId(null); setEditingContributionContent(''); }}><X className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: contribution.content }} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground/80 mt-2">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="font-medium text-foreground/70">{contribution.author.name}</span>
                                <span>·</span>
                                <span>{new Date(contribution.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              {canEdit && (contribution.authorId === user?.id) && (
                                <div className="flex items-center gap-1">
                                  <button type="button" onClick={() => handleEditContribution(contribution)} className="p-1 hover:bg-muted rounded transition-colors" title="Modifier"><Pencil className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => handleDeleteContribution(contribution.id)} className="p-1 hover:bg-muted rounded transition-colors text-destructive" title="Supprimer" disabled={deleteContributionMutation.isPending}><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                            {/* Reactions on contribution */}
                            <ReactionBar
                              spaceId={spaceId}
                              itemId={item.id}
                              contributionId={contribution.id}
                              summary={(contribution as any).reactionSummary || []}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canEdit && (
                  <div className="space-y-2">
                    <RichTextEditor key={`new-contrib-${contributionCount}`} content={newContribution} onChange={setNewContribution} placeholder="Ajouter une contribution..." spaceId={spaceId}
                      mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))} />
                    <Button type="button" size="sm" onClick={handleAddContribution} disabled={isContributionEmpty(newContribution) || createContributionMutation.isPending}>
                      {createContributionMutation.isPending ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  </div>
                )}
              </div>

          </div>{/* end left column */}

          {/* === CENTER COLUMN === */}
          <div className="space-y-6 min-w-0">

              {/* Statut */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Statut</label>
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
                      const selected = statuses.find((s) => (s.id === 'undefined' && !status) || s.id === status);
                      return selected ? (
                        <span className={`px-3 py-1.5 text-sm rounded-md border-2 ${selected.borderColor} font-semibold`}>{selected.label}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Non défini</span>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Début</label>
                  {canEdit ? (
                    <DateTimeField value={startDate} onChange={handleStartDateChange} showTime={type === 'MEETING' || type === 'TASK'} />
                  ) : (
                    <p className="text-sm">{startDate ? (type === 'MEETING' || type === 'TASK' ? formatDateTime(startDate) : formatDate(startDate)) : <span className="text-muted-foreground">—</span>}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fin</label>
                  {canEdit ? (
                    <div className="space-y-2">
                      {(type === 'MEETING' || type === 'PERIOD' || type === 'PROJECT' || type === 'TASK') && startDate && (
                        <div className="flex flex-wrap gap-1.5">
                          {(type === 'MEETING' ? MEETING_DURATIONS : type === 'TASK' ? TASK_DURATIONS : type === 'PROJECT' ? PROJECT_DURATIONS : PERIOD_DURATIONS).map((d) => {
                            const isSelected = startDate && endDate && Math.abs(diffMs(startDate, endDate) - d.ms) < 60000;
                            return (
                              <button key={d.ms} type="button"
                                onClick={() => setEndDate(toDatetimeLocal(new Date(fromDatetimeLocal(startDate).getTime() + d.ms)))}
                                className={`px-2.5 py-1 text-xs rounded-md border transition-all ${isSelected ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <DateTimeField value={endDate} onChange={handleEndDateChange} showTime={type === 'MEETING' || type === 'TASK'} showPresets={type !== 'MEETING' && type !== 'PROJECT' && type !== 'TASK' && type !== 'PERIOD'} minDate={startDate} />
                    </div>
                  ) : (
                    <p className="text-sm">{endDate ? (type === 'MEETING' || type === 'TASK' ? formatDateTime(endDate) : formatDate(endDate)) : <span className="text-muted-foreground">—</span>}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Échéance</label>
                  {canEdit ? (
                    <div className="space-y-2">
                      {startDate && type !== 'PERIOD' && (
                        <div className="flex flex-wrap gap-1.5">
                          {DUE_DATE_DURATIONS.map((d) => {
                            const targetDate = new Date(fromDatetimeLocal(startDate).getTime() + d.ms);
                            const isSelected = dueDate && Math.abs(fromDatetimeLocal(dueDate).getTime() - targetDate.getTime()) < 60000;
                            return (
                              <button key={d.ms} type="button" onClick={() => setDueDate(toDatetimeLocal(targetDate))}
                                className={`px-2.5 py-1 text-xs rounded-md border transition-all ${isSelected ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                {d.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <DateTimeField value={dueDate} onChange={setDueDate} showTime={false} minDate={startDate} />
                    </div>
                  ) : (
                    <p className="text-sm">{dueDate ? formatDate(dueDate) : <span className="text-muted-foreground">—</span>}</p>
                  )}
                </div>
              </div>

              {/* URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                {type === 'LINK' && canEdit ? (
                  <Input type="url" value={url}
                    onChange={(e) => { setUrl(e.target.value); const extracted = urlToTitle(e.target.value); if (extracted) autoFillTitle(extracted); }}
                    placeholder="https://..." />
                ) : null}
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all">
                    <ExternalLink className="w-4 h-4 flex-shrink-0" /> {url}
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Aucune URL</p>
                )}
              </div>

              {/* Diagramme */}
              {type === 'DIAGRAM' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Diagramme</label>
                  <DrawioEditor
                    xml={diagramXml}
                    onChange={setDiagramXml}
                    onSaveAndClose={async (savedXml, pngBlob) => {
                      if (!itemId) return;
                      await itemsApi.update(spaceId, itemId, { content: { xml: savedXml } });
                      setDiagramXml(savedXml);
                      const file = new File([pngBlob], 'diagram.png', { type: 'image/png' });
                      await uploadImageMutation.mutateAsync(file);
                      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
                    }}
                    previewUrl={url || undefined}
                    editable={canEdit}
                  />
                </div>
              )}

              {/* Image */}
              {type === 'IMAGE' ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Image</label>
                  {canEdit ? (
                    <>
                      <ImageUploadZone currentUrl={url || null}
                        onUpload={(file) => { autoFillTitle(fileNameToTitle(file.name)); uploadImageMutation.mutate(file); }}
                        onRemove={() => setUrl('')} isUploading={uploadImageMutation.isPending} />
                      {uploadImageMutation.isError && <p className="text-sm text-destructive">{(uploadImageMutation.error as Error)?.message || "Erreur lors de l'upload"}</p>}
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground transition-colors">URL externe (optionnel)</summary>
                        <div className="mt-2"><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
                      </details>
                    </>
                  ) : url ? (
                    <>
                      <img src={url} alt="Image" className="w-16 h-16 object-cover rounded border border-border bg-muted cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setImageExpanded(true)} title="Cliquer pour agrandir" />
                      {imageExpanded && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 cursor-pointer" onClick={() => setImageExpanded(false)}>
                          <img src={url} alt="Image" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune image</p>
                  )}
                </div>
              ) : url && type !== 'DIAGRAM' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Image</label>
                  <img src={url} alt="Image" className="w-16 h-16 object-cover rounded border border-border bg-muted cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setImageExpanded(true)} title="Cliquer pour agrandir" />
                  {imageExpanded && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 cursor-pointer" onClick={() => setImageExpanded(false)}>
                      <img src={url} alt="Image" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Document */}
              {type === 'DOCUMENT' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fichier</label>
                  {canEdit ? (
                    <>
                      <FileUploadZone currentUrl={url || null}
                        onUpload={(file) => { autoFillTitle(fileNameToTitle(file.name)); uploadDocumentMutation.mutate(file); }}
                        onRemove={() => setUrl('')} isUploading={uploadDocumentMutation.isPending} />
                      {uploadDocumentMutation.isError && <p className="text-sm text-destructive">{(uploadDocumentMutation.error as Error)?.message || "Erreur lors de l'upload"}</p>}
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground transition-colors">URL externe (optionnel)</summary>
                        <div className="mt-2"><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
                      </details>
                    </>
                  ) : url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all">
                      <ExternalLink className="w-4 h-4 flex-shrink-0" /> Télécharger le fichier
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun fichier</p>
                  )}
                </div>
              )}

          </div>{/* end center column */}

          {/* === RIGHT COLUMN === */}
          <div className="space-y-6" data-tour="item-details">

              {/* Parent */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Parent</label>
                  {canEdit && (
                    <button type="button" onClick={toggleParentSortMode}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}>
                      {parentSortMode === 'tree' ? <><GitBranch className="w-3 h-3" /><span>Arborescence</span></> : <><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></>}
                    </button>
                  )}
                </div>
                {canEdit ? (
                  <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
                ) : (
                  <p className="text-sm">
                    {parentId ? parentOptions.find((o) => o.value === parentId)?.label || 'Parent inconnu' : <span className="text-muted-foreground">Aucun parent</span>}
                  </p>
                )}
              </div>

              {/* Priorité */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                <div className="flex flex-wrap gap-2">
                  {canEdit ? (
                    <>
                      <button type="button" onClick={() => setPriority(null)}
                        className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all ${priority === null ? 'border-gray-400 bg-gray-100 font-semibold shadow-sm' : 'border-gray-200 opacity-60 hover:opacity-100'}`}>
                        Aucune
                      </button>
                      {PRIORITIES.map((p) => (
                        <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                          className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all ${p.color} ${priority === p.value ? `${p.bgColor} font-semibold shadow-sm` : 'opacity-60 hover:opacity-100'}`}>
                          {p.label}
                        </button>
                      ))}
                    </>
                  ) : (
                    (() => {
                      const config = PRIORITIES.find(p => p.value === priority);
                      return config ? (
                        <span className={`px-3 py-1.5 text-sm rounded-md border-2 ${config.color} ${config.bgColor} font-semibold`}>{config.label}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Non définie</span>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* Assigné à */}
              {spaceMembers && spaceMembers.length > 1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigné à</label>
                  {canEdit ? (
                    <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}
                      options={[{ value: '', label: 'Non assigné' }, ...spaceMembers.map((m) => ({ value: m.userId, label: m.name || m.email }))]} />
                  ) : (
                    <p className="text-sm">
                      {assignedToId ? (spaceMembers.find((m) => m.userId === assignedToId)?.name || 'Membre inconnu') : <span className="text-muted-foreground">Non assigné</span>}
                    </p>
                  )}
                </div>
              )}

              {/* Dépendances */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Dépendances
                  </h2>
                  {canEdit && (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowAddRelation(!showAddRelation)}>
                      <Plus className="w-4 h-4 mr-1" /> Ajouter
                    </Button>
                  )}
                </div>

                {showAddRelation && (
                  <div className="p-3 bg-muted rounded-lg space-y-3">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Type</label>
                        <Select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value as 'depends' | 'blocks' | 'relates')}
                          options={[{ value: 'depends', label: 'Dépend de...' }, { value: 'blocks', label: 'Bloque...' }, { value: 'relates', label: 'Lié à...' }]} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Élément</label>
                        <Select value={newRelationTargetId} onChange={(e) => setNewRelationTargetId(e.target.value)}
                          options={[{ value: '', label: 'Sélectionner...' }, ...allItems.filter((i) => i.id !== itemId).map((i) => ({ value: i.id, label: i.title }))]} />
                      </div>
                    </div>
                    <Input value={newRelationLabel} onChange={(e) => setNewRelationLabel(e.target.value)} placeholder="Commentaire (optionnel)" className="text-sm" />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleAddRelation} disabled={!newRelationTargetId || createRelationMutation.isPending}>
                        {createRelationMutation.isPending ? 'Ajout...' : 'Ajouter'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setShowAddRelation(false); setNewRelationTargetId(''); setNewRelationLabel(''); }}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                {((item.relationsFrom && item.relationsFrom.length > 0) || (item.relationsTo && item.relationsTo.length > 0)) ? (
                  <div className="space-y-2">
                    {item.relationsFrom?.map((relation: ItemRelation & { toItem?: { id: string; title: string; type: string } }) => (
                      <div key={relation.id} className="p-3 bg-card border border-border rounded-lg text-sm space-y-1">
                        {editingRelationId === relation.id ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Select value={editRelationType} onChange={(e) => setEditRelationType(e.target.value)} className="text-xs h-7"
                                options={[{ value: 'depends', label: 'Dépend de' }, { value: 'blocks', label: 'Bloque' }, { value: 'relates', label: 'Lié à' }]} />
                              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span className="truncate">{relation.toItem?.title || 'Élément inconnu'}</span>
                            </div>
                            <Input value={editRelationLabel} onChange={(e) => setEditRelationLabel(e.target.value)} placeholder="Commentaire (optionnel)" className="text-xs h-7" />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={() => updateRelationMutation.mutate({ relationId: relation.id, data: { type: editRelationType, label: editRelationLabel.trim() || null } })} disabled={updateRelationMutation.isPending}>
                                {updateRelationMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => setEditingRelationId(null)}>Annuler</Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${relation.type === 'depends' ? 'bg-orange-100 text-orange-700' : relation.type === 'blocks' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {relation.type === 'depends' ? 'Dépend de' : relation.type === 'blocks' ? 'Bloque' : 'Lié à'}
                                </span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{relation.toItem?.title || 'Élément inconnu'}</span>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <button type="button" onClick={() => { setEditingRelationId(relation.id); setEditRelationType(relation.type); setEditRelationLabel(relation.label || ''); }}
                                    className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground" title="Modifier"><Pencil className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => handleDeleteRelation(relation.id)}
                                    className="p-1 hover:bg-muted rounded transition-colors text-destructive" title="Supprimer"><Trash2 className="w-3 h-3" /></button>
                                </div>
                              )}
                            </div>
                            {relation.label && <p className="text-xs text-muted-foreground italic pl-1">{relation.label}</p>}
                          </>
                        )}
                      </div>
                    ))}
                    {item.relationsTo?.map((relation: ItemRelation & { fromItem?: { id: string; title: string; type: string } }) => (
                      <div key={relation.id} className="p-3 bg-card border border-border rounded-lg text-sm space-y-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{relation.fromItem?.title || 'Élément inconnu'}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${relation.type === 'depends' ? 'bg-blue-100 text-blue-700' : relation.type === 'blocks' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {relation.type === 'depends' ? 'dépend de ceci' : relation.type === 'blocks' ? 'est bloqué par ceci' : 'lié à ceci'}
                          </span>
                        </div>
                        {relation.label && <p className="text-xs text-muted-foreground italic pl-1">{relation.label}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune dépendance</p>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags
                </h2>
                {canEdit ? (
                  <TagSelector spaceId={spaceId} value={selectedTagIds} onChange={setSelectedTagIds} />
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {item?.tags && item.tags.length > 0 ? (
                      item.tags.map((tag: Tag) => <TagBadge key={tag.id} tag={tag} />)
                    ) : (
                      <span className="text-sm text-muted-foreground">Aucun tag</span>
                    )}
                  </div>
                )}
              </div>

          </div>{/* end right column */}

            </div>
          </div>

          {/* Children items */}
          {item && (() => {
            const children = allItems.filter(i => i.parentId === item.id);
            if (children.length === 0) return null;
            return (
              <div className="border-t border-border mt-4 pt-4" data-tour="item-children">
                <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <GitBranch className="w-4 h-4" />
                  Éléments enfants ({children.length})
                </h2>
                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {children.map(child => {
                    const ChildIcon = TYPE_ICONS[child.type];
                    const childTypeConfig = (referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels)[child.type];
                    const grandChildCount = allItems.filter(i => i.parentId === child.id).length;
                    return (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => onNavigate?.(child.id)}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-left group"
                      >
                        {ChildIcon && <ChildIcon className={`w-4 h-4 flex-shrink-0 ${childTypeConfig?.color || 'text-muted-foreground'}`} />}
                        <span className="truncate flex-1">{child.title}</span>
                        {grandChildCount > 0 && (
                          <span className="text-[10px] text-muted-foreground/70 flex-shrink-0">
                            {grandChildCount} enfant{grandChildCount > 1 ? 's' : ''}
                          </span>
                        )}
                        {child.status && (
                          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted flex-shrink-0">
                            {(referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).find((s: any) => s.id === child.status)?.label || child.status}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Footer — always visible */}
          <div className="flex gap-2 pt-4 border-t border-border mt-4 flex-shrink-0" data-tour="item-actions">
            {canEdit && (
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              {canEdit ? 'Annuler' : 'Fermer'}
            </Button>
            {item && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Imprimer"
                  onClick={() => {
                    const children = allItems.filter(i => i.parentId === item.id);
                    printItem({ item: item as any, children, spaceName });
                  }}
                >
                  <Printer className="w-4 h-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Export PDF"
                  onClick={() => {
                    const children = allItems.filter(i => i.parentId === item.id);
                    exportItemPDF({ item: item as any, children, spaceName });
                  }}
                >
                  <FileDown className="w-4 h-4" />
                </Button>
              </>
            )}
            {canEdit && onDelete && itemId && (
              <Button type="button" variant="destructive" className="ml-auto" onClick={() => { onDelete(itemId); onClose(); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
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
      {/* Confirm delete relation */}
      <ConfirmModal
        isOpen={!!pendingDeleteRelationId}
        onClose={() => setPendingDeleteRelationId(null)}
        onConfirm={() => {
          if (pendingDeleteRelationId) {
            deleteRelationMutation.mutate(pendingDeleteRelationId);
            setPendingDeleteRelationId(null);
          }
        }}
        title="Supprimer la dépendance"
        message="Voulez-vous supprimer cette dépendance ?"
        confirmLabel="Supprimer"
        isPending={deleteRelationMutation.isPending}
      />
      {/* Confirm delete contribution */}
      <ConfirmModal
        isOpen={!!pendingDeleteContributionId}
        onClose={() => setPendingDeleteContributionId(null)}
        onConfirm={() => {
          if (pendingDeleteContributionId) {
            deleteContributionMutation.mutate(pendingDeleteContributionId);
            setPendingDeleteContributionId(null);
          }
        }}
        title="Supprimer la contribution"
        message="Voulez-vous supprimer cette contribution ?"
        confirmLabel="Supprimer"
        isPending={deleteContributionMutation.isPending}
      />
    </Modal>
  );
}
