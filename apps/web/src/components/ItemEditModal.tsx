import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, spacesApi, bookmarksApi, activityApi, isConflictError } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation, SpaceReferentiels, Tag } from '@spok/shared';
import { ConflictDialog } from './ConflictDialog';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus, ExternalLink, ChevronRight, Home, Tag as TagIcon, Printer, FileDown, Building2, HelpCircle, Play, Bookmark, Eye, FolderInput, Copy, Merge, Scissors, ArrowDownToLine, FolderPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TagSelector } from './ui/TagSelector';
import { ReactionBar } from './ReactionBar';
import { ITEM_MODAL_TOUR } from '../hooks/viewTours';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { TagBadge } from './ui/TagBadge';
import { TYPE_LABELS, TYPE_ICONS, STORAGE_KEYS, PRIORITIES } from '../constants/ui';
import { useAuthStore } from '../stores/auth';
import { useUnsavedGuard, UnsavedChangesGuard } from './ui/UnsavedChangesGuard';
import { useAdminMode } from './DevDbStatus';
import { useCtrlS } from '../hooks/useCtrlS';
import { RichTextEditor } from './ui/RichTextEditor';
import { DrawioEditor } from './ui/DrawioEditor';
import { ImageUploadZone } from './ui/ImageUploadZone';
import { FileUploadZone } from './ui/FileUploadZone';
import { DateTimeField } from './ui/DateTimeField';
import { TimeRangePicker } from './ui/TimeRangePicker';
import { diffMs, addHours, addDays, addMonths, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { formatDate, formatDateTime } from '../lib/utils';
import { MEETING_DURATIONS, PERIOD_DURATIONS, TASK_DURATIONS, PROJECT_DURATIONS, DUE_DATE_DURATIONS } from './item-edit-constants';
import { fileNameToTitle, urlToTitle, getDescendantIds } from './item-edit-helpers';
import { printItem, exportItemPDF } from '../lib/itemExport';
import { MoveToSpaceModal } from './MoveToSpaceModal';
import { DuplicateToSpaceModal } from './DuplicateToSpaceModal';
import { hasHeadings } from '../lib/itemMenuGroups';

function ItemHelpButton({ pulse, onStartTour }: { pulse?: boolean; onStartTour: () => void }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const btn = btnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const w = 320;
      let left = rect.right - w;
      if (left < 8) left = 8;
      setPos({ top: rect.bottom + 6, left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleKey); };
  }, [open]);

  const launchTour = () => {
    setOpen(false);
    setTimeout(onStartTour, 200);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors${pulse ? ' animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
        title="Aide"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && createPortal(
        <div ref={popRef} className="fixed z-[200] w-[320px] rounded-lg border border-border bg-card shadow-lg" style={{ top: pos.top, left: pos.left }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h3 className="text-sm font-semibold">Fiche élément</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <p className="px-4 pb-2 text-xs text-muted-foreground leading-relaxed">
            Cette fiche regroupe toutes les informations d'un élément : description, contributions, relations, tags, dates et priorité.
          </p>
          <ul className="px-4 pb-3 space-y-1">
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Utilisez @mentions et #références dans la description</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Ajoutez des réactions pour donner votre avis</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Les contributions permettent de discuter sur l'élément</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Créez des relations pour lier les éléments entre eux</li>
            <li className="flex items-start gap-2 text-xs text-foreground/80"><span className="text-primary mt-0.5">&#8226;</span>Les enfants sont listés en bas de la fiche</li>
          </ul>
          <div className="px-4 pb-3">
            <button
              type="button"
              onClick={launchTour}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Lancer le tutoriel interactif
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

type ParentSortMode = 'tree' | 'alpha';

interface ItemEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  itemId: string | null;
  allItems: Item[];
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  spaceRole?: string;
  spaceName?: string;
  communityName?: string;
  onNavigate?: (itemId: string) => void;
  onDelete?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
}

export function ItemEditModal({
  isOpen,
  onClose,
  spaceId,
  itemId,
  allItems,
  referentiels,
  canEdit: canEditProp = true,
  spaceRole,
  spaceName,
  communityName,
  onNavigate,
  onDelete,
  onConvertToSpace,
  onMerge,
  onAbsorbChildren,
  onSplitDescription,
}: ItemEditModalProps) {
  const queryClient = useQueryClient();
  const { pulseHelp: itemPulse, startTour: startItemTour } = usePageTourPulse('item-modal', ITEM_MODAL_TOUR);
  const adminMode = useAdminMode();
  const [visitorPreview, setVisitorPreview] = useState(false);

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
  const [showContributionField, setShowContributionField] = useState(false);
  const [replyToContributionId, setReplyToContributionId] = useState<string | null>(null);
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null);
  const [editingContributionContent, setEditingContributionContent] = useState('');

  // Conflict state
  const [conflictData, setConflictData] = useState<{
    conflicts: Array<{ field: string; label: string; serverValue: unknown; clientValue: unknown }>;
  } | null>(null);

  // Confirm delete state
  const [pendingDeleteRelationId, setPendingDeleteRelationId] = useState<string | null>(null);
  const [pendingDeleteContributionId, setPendingDeleteContributionId] = useState<string | null>(null);

  // Internal move/duplicate modals
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

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

  // canEdit: space OWNER, or item author, or item assignee (new items are always editable)
  const isNewItem = !itemId;
  const isSpaceOwner = spaceRole === 'OWNER';
  const isItemAuthor = !!user && !!item && (item as any).createdById === user.id;
  const isItemAssignee = !!user && !!item && item.assignedToId === user.id;
  const canEdit = canEditProp && !visitorPreview && (isNewItem || isSpaceOwner || isItemAuthor || isItemAssignee);
  // canInteract: any authenticated member can react and contribute (even if they can't edit the item)
  const canInteract = canEditProp && !visitorPreview;

  const { data: spaceMembers } = useQuery({
    queryKey: ['space-members', spaceId],
    queryFn: () => spacesApi.getMembers(spaceId),
    enabled: isOpen,
  });

  // Bookmarks
  const { data: bookmarkIds = [] } = useQuery({
    queryKey: ['bookmark-ids'],
    queryFn: () => bookmarksApi.listIds(),
    enabled: isOpen && !!user,
  });
  const isBookmarked = itemId ? bookmarkIds.includes(itemId) : false;
  const toggleBookmark = useCallback(async () => {
    if (!itemId) return;
    if (isBookmarked) {
      await bookmarksApi.remove(itemId);
    } else {
      await bookmarksApi.add(itemId);
    }
    queryClient.invalidateQueries({ queryKey: ['bookmark-ids'] });
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
  }, [itemId, isBookmarked, queryClient]);

  // Tracks which itemId has already been loaded into the form.
  // Prevents re-initialising the form when the same item is refetched
  // (e.g. after a comment is added) while still re-initialising when a
  // different item is opened.
  const initializedItemIdRef = useRef<string | null>(null);

  // Capture viewedAt from the list snapshot BEFORE marking as viewed
  const viewedAtRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isOpen && itemId) {
      const fromList = allItems.find(i => i.id === itemId);
      viewedAtRef.current = (fromList as any)?.viewedAt ?? null;
      activityApi.markViewed(itemId).catch(() => {});
    }
  }, [isOpen, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the tracker whenever the requested item changes
  useEffect(() => {
    initializedItemIdRef.current = null;
  }, [itemId]);

  // Populate the form once the correct item data has arrived
  useEffect(() => {
    if (!item) return;
    if (initializedItemIdRef.current === item.id) return; // already initialised for this item
    initializedItemIdRef.current = item.id;

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
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: (data: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string | null; assignedToId?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; updatedAt?: string }) =>
      itemsApi.update(spaceId, itemId!, data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items', spaceId] }),
        queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] }),
      ]);
      setConflictData(null);
      onClose();
    },
    onError: (error) => {
      if (isConflictError(error)) {
        setConflictData({ conflicts: error.details.conflicts });
      }
    },
  });

  const autoSaveDiagramMutation = useMutation({
    mutationFn: (xml: string) =>
      itemsApi.update(spaceId, itemId!, { content: { xml } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const autoSaveDiagramTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (type !== 'DIAGRAM' || !itemId) return;
    const savedXml = (item?.content as Record<string, unknown>)?.xml as string || '';
    if (diagramXml === savedXml) return;
    if (autoSaveDiagramTimerRef.current) clearTimeout(autoSaveDiagramTimerRef.current);
    autoSaveDiagramTimerRef.current = setTimeout(() => {
      autoSaveDiagramMutation.mutate(diagramXml);
    }, 2000);
    return () => {
      if (autoSaveDiagramTimerRef.current) clearTimeout(autoSaveDiagramTimerRef.current);
    };
  }, [diagramXml]); // eslint-disable-line react-hooks/exhaustive-deps

  const createContributionMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string }) =>
      itemsApi.createContribution(spaceId, itemId!, data),
    onSuccess: (newContrib) => {
      // Injecter immédiatement la nouvelle contribution dans le cache
      queryClient.setQueryData(['item', spaceId, itemId], (old: any) => {
        if (!old) return old;
        const contrib = { ...newContrib, reactions: (newContrib as any).reactions ?? [] };
        return {
          ...old,
          contributions: [contrib, ...(old.contributions || [])],
          _count: { ...old._count, contributions: (old._count?.contributions ?? 0) + 1 },
        };
      });
      // Synchroniser en arrière-plan
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      setNewContribution('');
      setShowContributionField(false);
      setReplyToContributionId(null);
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

  const handleTimeRangeChange = useCallback((st: string, et: string) => {
    const datePart = startDate ? startDate.slice(0, 10) : toDatetimeLocal(new Date()).slice(0, 10);
    setStartDate(`${datePart}T${st}`);
    setEndDate(`${datePart}T${et}`);
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
      createContributionMutation.mutate({ content: newContribution, parentId: replyToContributionId || undefined });
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

  // Track whether any field has changed from the original item
  const hasChanges = useMemo(() => {
    if (!item) return title.trim().length > 0; // creation mode
    if (type !== item.type) return true;
    if (title !== item.title) return true;
    const normalizeDesc = (d: string | null | undefined) => {
      if (!d) return null;
      const trimmed = d.trim();
      if (!trimmed || trimmed === '<p></p>' || trimmed === '<p><br></p>' || trimmed === '<p><br/></p>' || trimmed === '<p> </p>') return null;
      return trimmed;
    };
    if (normalizeDesc(description) !== normalizeDesc(item.description)) return true;
    if (type === 'DIAGRAM') {
      const currentXml = (item.content as Record<string, unknown>)?.xml as string || '';
      if (diagramXml !== currentXml) return true;
    }
    if ((url || null) !== (item.url || null)) return true;
    if ((parentId || null) !== item.parentId) return true;
    if (status !== (item.status || '')) return true;
    if (priority !== (item.priority ?? null)) return true;
    if ((assignedToId || null) !== (item.assignedToId || null)) return true;
    // Compare dates using the same format as initialization (ISO slice 0-16)
    const formatDateForCompare = (d: string | null | undefined) => d ? new Date(d).toISOString().slice(0, 16) : null;
    if ((dueDate || null) !== formatDateForCompare(item.dueDate)) return true;
    if ((startDate || null) !== formatDateForCompare(item.startDate)) return true;
    if ((endDate || null) !== formatDateForCompare(item.endDate)) return true;
    const sortedCurrent = [...selectedTagIds].sort();
    const sortedOriginal = [...originalTagIds].sort();
    if (sortedCurrent.length !== sortedOriginal.length || sortedCurrent.some((id, i) => id !== sortedOriginal[i])) return true;
    return false;
  }, [item, type, title, description, diagramXml, url, parentId, status, priority, assignedToId, dueDate, startDate, endDate, selectedTagIds, originalTagIds]);

  const { guard: guardClose, ConfirmDialog } = useUnsavedGuard(hasChanges);

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

  useCtrlS(hasChanges && !updateMutation.isPending, doSubmit);

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


  return (<>
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
                <Link to={`/spaces/${spaceId}`} onClick={onClose} className="flex items-center gap-1.5 hover:text-primary transition-colors">
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
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConfig?.bgHover || 'bg-muted'}`}>
              {TypeIcon && <TypeIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${typeConfig?.color || 'text-muted-foreground'}`} />}
            </div>
            <div className="flex-1 min-w-0" data-tour="item-title">
              {canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'élément"
                  className="text-lg sm:text-xl font-bold px-2 py-1 h-auto bg-muted/30 hover:bg-muted/60 focus:bg-background transition-colors"
                  autoFocus
                />
              ) : (
                <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
              )}
            </div>
            {adminMode && canEditProp && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setVisitorPreview(!visitorPreview); }}
                className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md flex-shrink-0 transition-colors ${
                  visitorPreview
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title="Voir comme un visiteur"
              >
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">{visitorPreview ? 'Vue visiteur' : 'Voir comme visiteur'}</span>
              </button>
            )}
            <div className="flex items-center gap-2 flex-shrink-0">
              {item?.createdBy && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{item.createdBy.name}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              <ItemHelpButton pulse={itemPulse} onStartTour={startItemTour} />
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pr-1">

            {/* Three-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,0.85fr,380px] gap-6">

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
                  minHeight={240}
                  mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))}
                />
              </div>

              {/* Reactions + Contributions */}
              <div className="space-y-3" data-tour="item-reactions">
                {/* Reaction bar on item */}
                {item && (
                  <ReactionBar
                    spaceId={spaceId}
                    itemId={item.id}
                    summary={(item as any).reactionSummary || []}
                    onReacted={() => canInteract && setShowContributionField(true)}
                    label="Réagissez ou Contribuez à l'article"
                  />
                )}

                {/* New contribution field (shown after reaction or manual click) */}
                {canInteract && showContributionField && !replyToContributionId && (
                  <div className="space-y-2">
                    <RichTextEditor key={`new-contrib-${contributionCount}`} content={newContribution} onChange={setNewContribution} placeholder="Ajouter un commentaire..." spaceId={spaceId} autoFocus
                      mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleAddContribution} disabled={isContributionEmpty(newContribution) || createContributionMutation.isPending}>
                        {createContributionMutation.isPending ? 'Ajout...' : 'Ajouter'}
                      </Button>
                      <Button type="button" size="sm" variant="bordered" onClick={() => { setShowContributionField(false); setNewContribution(''); }}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}

                {/* Threaded contributions */}
                {item.contributions && item.contributions.length > 0 && (() => {
                  // Build tree from flat list
                  const allContribs = item.contributions as (ContributionWithAuthor & { parentId?: string | null })[];
                  const rootContribs = allContribs.filter(c => !c.parentId);
                  const childrenMap = new Map<string, typeof allContribs>();
                  allContribs.filter(c => c.parentId).forEach(c => {
                    const arr = childrenMap.get(c.parentId!) || [];
                    arr.push(c);
                    childrenMap.set(c.parentId!, arr);
                  });

                  const renderContribution = (contribution: typeof allContribs[number], depth: number) => {
                    const children = childrenMap.get(contribution.id) || [];
                    const isReplying = replyToContributionId === contribution.id;
                    const vAt = viewedAtRef.current;
                    const isNewContrib = vAt === null
                      || (vAt && new Date(contribution.createdAt) > new Date(vAt));
                    return (
                      <div key={contribution.id} className={`${depth > 0 ? 'ml-6 border-l-2 border-border pl-3' : ''} ${isNewContrib ? 'bg-blue-50/60 dark:bg-blue-950/20 rounded-md px-2 -mx-2' : ''}`}>
                        <div className="py-2">
                          {editingContributionId === contribution.id ? (
                            <div className="space-y-2">
                              <RichTextEditor key={`edit-${contribution.id}`} content={editingContributionContent} onChange={setEditingContributionContent} spaceId={spaceId}
                                mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))} />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={handleSaveContribution} disabled={updateContributionMutation.isPending}>Enregistrer</Button>
                                <Button type="button" size="sm" variant="bordered" onClick={() => { setEditingContributionId(null); setEditingContributionContent(''); }}><X className="w-4 h-4" /></Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Content first */}
                              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>p]:my-0.5" dangerouslySetInnerHTML={{ __html: contribution.content }} />
                              {/* Author + date + reactions + actions — compact line below */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                <span className="font-medium">{contribution.author.name}</span>
                                <span>·</span>
                                <span>{new Date(contribution.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                {isNewContrib && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Nouveau</span>
                                )}
                                <ReactionBar
                                  spaceId={spaceId}
                                  itemId={item.id}
                                  contributionId={contribution.id}
                                  summary={(contribution as any).reactionSummary || []}
                                  label="Réagissez ou Contribuez au commentaire"
                                  onReacted={() => { if (canInteract) { setReplyToContributionId(contribution.id); setShowContributionField(true); setNewContribution(''); }}}
                                />
                                {canInteract && (contribution.authorId === user?.id) && (
                                  <>
                                    <button type="button" onClick={() => handleEditContribution(contribution)} className="p-0.5 hover:bg-muted rounded transition-colors" title="Modifier"><Pencil className="w-3 h-3" /></button>
                                    <button type="button" onClick={() => handleDeleteContribution(contribution.id)} className="p-0.5 hover:bg-muted rounded transition-colors text-destructive" title="Supprimer" disabled={deleteContributionMutation.isPending}><Trash2 className="w-3 h-3" /></button>
                                  </>
                                )}
                              </div>
                            </>
                          )}

                          {/* Reply field inline */}
                          {canInteract && isReplying && showContributionField && (
                            <div className="mt-2 space-y-2">
                              <RichTextEditor key={`reply-${contribution.id}-${contributionCount}`} content={newContribution} onChange={setNewContribution} placeholder="Répondre..." spaceId={spaceId} autoFocus
                                mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))} />
                              <div className="flex gap-2">
                                <Button type="button" size="sm" onClick={handleAddContribution} disabled={isContributionEmpty(newContribution) || createContributionMutation.isPending}>
                                  {createContributionMutation.isPending ? 'Ajout...' : 'Répondre'}
                                </Button>
                                <Button type="button" size="sm" variant="bordered" onClick={() => { setReplyToContributionId(null); setShowContributionField(false); setNewContribution(''); }}>
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Render children recursively */}
                        {children.map(child => renderContribution(child, depth + 1))}
                      </div>
                    );
                  };

                  return (
                    <div className="space-y-1">
                      <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MessageSquarePlus className="w-4 h-4" />
                        Contributions ({contributionCount})
                      </h2>
                      <div className="divide-y divide-border/50">
                        {rootContribs.map(c => renderContribution(c, 0))}
                      </div>
                    </div>
                  );
                })()}
              </div>

          </div>{/* end left column */}

          {/* === CENTER COLUMN === */}
          <div className="space-y-6 min-w-0">

              {/* Type */}
              <div className="space-y-2" data-tour="item-type-selector">
                <label className="text-sm font-medium">Type</label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={type}
                        onChange={(e) => setType(e.target.value as ItemType)}
                        options={(Object.entries(referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels))
                          .filter(([, c]) => c.visible)
                          .sort(([, a], [, b]) => a.order - b.order)
                          .map(([key, c]) => ({ value: key, label: c.labelShort }))}
                      />
                    </div>
                    {/* Desktop: buttons */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      {(() => {
                        const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                        return Object.entries(typeLabels)
                          .filter(([, config]) => config.visible)
                          .sort(([, a], [, b]) => a.order - b.order)
                          .map(([key, config]) => {
                            const Icon = TYPE_ICONS[key];
                            const isSelected = type === key;
                            return (
                              <button key={key} type="button" onClick={() => setType(key as ItemType)}
                                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${isSelected ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current text-gray-900` : 'opacity-60 hover:opacity-100'}`}>
                                {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                                {config.labelShort}
                              </button>
                            );
                          });
                      })()}
                    </div>
                  </>
                ) : (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 ${typeConfig?.color || 'border-border'} ${typeConfig?.bgHover || ''} font-semibold`}>
                    {TypeIcon && <TypeIcon className="w-3.5 h-3.5" />}
                    {typeConfig?.labelShort || TYPE_LABELS[type] || type}
                  </span>
                )}
              </div>

              {/* Statut */}
              <div className="space-y-2" data-tour="item-status">
                <label className="text-sm font-medium">Statut</label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={status || 'undefined'}
                        onChange={(e) => {
                          const newStatus = e.target.value === 'undefined' ? '' : e.target.value;
                          setStatus(newStatus);
                          if (newStatus === '') { setStartDate(''); setEndDate(''); }
                          else {
                            let currentEndDate = endDate;
                            if ((newStatus === 'done' || newStatus === 'cancelled') && !currentEndDate) { currentEndDate = toDatetimeLocal(new Date()); setEndDate(currentEndDate); }
                            if (!startDate) { const now = new Date(); setStartDate(currentEndDate && fromDatetimeLocal(currentEndDate) < now ? currentEndDate : toDatetimeLocal(now)); }
                          }
                        }}
                        options={(referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).map((s) => ({ value: s.id, label: s.label }))}
                      />
                    </div>
                    {/* Desktop: buttons */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      {(referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).map((s) => {
                        const isSelected = (s.id === 'undefined' && !status) || s.id === status;
                        return (
                          <button key={s.id} type="button"
                            onClick={() => {
                              const newStatus = s.id === 'undefined' ? '' : s.id;
                              setStatus(newStatus);
                              if (newStatus === '') { setStartDate(''); setEndDate(''); }
                              else {
                                let currentEndDate = endDate;
                                if ((newStatus === 'done' || newStatus === 'cancelled') && !currentEndDate) { currentEndDate = toDatetimeLocal(new Date()); setEndDate(currentEndDate); }
                                if (!startDate) { const now = new Date(); setStartDate(currentEndDate && fromDatetimeLocal(currentEndDate) < now ? currentEndDate : toDatetimeLocal(now)); }
                              }
                            }}
                            className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${isSelected ? `${s.borderColor} font-semibold shadow-sm` : `${s.borderColor} opacity-60 hover:opacity-100`}`}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  (() => {
                    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
                    const selected = statuses.find((s) => (s.id === 'undefined' && !status) || s.id === status);
                    return selected ? (
                      <span className={`px-3 py-1.5 text-sm rounded-md border-2 ${selected.borderColor} font-semibold`}>{selected.label}</span>
                    ) : <span className="text-sm text-muted-foreground">Non défini</span>;
                  })()
                )}
              </div>

              {/* Priorité */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={priority === null ? '' : String(priority)}
                        onChange={(e) => setPriority(e.target.value === '' ? null : Number(e.target.value))}
                        options={[
                          { value: '', label: 'Aucune' },
                          ...PRIORITIES.map((p) => ({ value: String(p.value), label: `${p.icon} ${p.label}` })),
                        ]}
                      />
                    </div>
                    {/* Desktop: buttons */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      <button type="button" onClick={() => setPriority(null)}
                        className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${priority === null ? 'border-gray-400 bg-gray-100 font-semibold shadow-sm' : 'border-gray-200 opacity-60 hover:opacity-100'}`}>
                        Aucune
                      </button>
                      {PRIORITIES.map((p) => (
                        <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                          className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${p.color} ${priority === p.value ? `${p.bgColor} font-semibold shadow-sm` : 'opacity-60 hover:opacity-100'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  (() => {
                    const config = PRIORITIES.find(p => p.value === priority);
                    return config ? (
                      <span className={`px-3 py-1.5 text-sm rounded-md border-2 ${config.color} ${config.bgColor} font-semibold`}>{config.label}</span>
                    ) : <span className="text-sm text-muted-foreground">Non définie</span>;
                  })()
                )}
              </div>

              {/* Dates */}
              <div data-tour="item-dates">
                {type === 'MEETING' && canEdit ? (
                  /* MEETING : picker vertical + champs côte à côte */
                  <div className="flex gap-3 items-start">
                    {/* Plage horaire */}
                    <div className="w-48 flex-shrink-0">
                      <TimeRangePicker
                        startTime={startDate ? startDate.slice(11, 16) : null}
                        endTime={endDate ? endDate.slice(11, 16) : null}
                        onChange={handleTimeRangeChange}
                      />
                    </div>
                    {/* Champs de date */}
                    <div className="flex-1 min-w-0 space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Début</label>
                        <DateTimeField value={startDate} onChange={handleStartDateChange} showTime />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Fin</label>
                        <div className="space-y-2">
                          {startDate && (
                            <div className="flex flex-wrap gap-1.5">
                              {MEETING_DURATIONS.map((d) => {
                                const isSelected = startDate && endDate && Math.abs(diffMs(startDate, endDate) - d.ms) < 60000;
                                return (
                                  <button key={d.ms} type="button"
                                    onClick={() => setEndDate(toDatetimeLocal(new Date(fromDatetimeLocal(startDate).getTime() + d.ms)))}
                                    className={`px-2 py-0.5 text-xs rounded-md border transition-all ${isSelected ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <DateTimeField value={endDate} onChange={handleEndDateChange} showTime minDate={startDate} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Échéance</label>
                        <div className="space-y-2">
                          {startDate && (
                            <div className="flex flex-wrap gap-1.5">
                              {DUE_DATE_DURATIONS.map((d) => {
                                const targetDate = new Date(fromDatetimeLocal(startDate).getTime() + d.ms);
                                const isSelected = dueDate && Math.abs(fromDatetimeLocal(dueDate).getTime() - targetDate.getTime()) < 60000;
                                return (
                                  <button key={d.ms} type="button" onClick={() => setDueDate(toDatetimeLocal(targetDate))}
                                    className={`px-2 py-0.5 text-xs rounded-md border transition-all ${isSelected ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50'}`}>
                                    {d.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <DateTimeField value={dueDate} onChange={setDueDate} showTime={false} minDate={startDate} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Autres types : layout standard */
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Début</label>
                      {canEdit ? (
                        <DateTimeField value={startDate} onChange={handleStartDateChange} showTime={type === 'TASK'} />
                      ) : (
                        <p className="text-sm">{startDate ? (type === 'MEETING' || type === 'TASK' ? formatDateTime(startDate) : formatDate(startDate)) : <span className="text-muted-foreground">—</span>}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Fin</label>
                      {canEdit ? (
                        <div className="space-y-2">
                          {(type === 'PERIOD' || type === 'PROJECT' || type === 'TASK') && startDate && (
                            <div className="hidden sm:flex flex-wrap gap-1.5">
                              {(type === 'TASK' ? TASK_DURATIONS : type === 'PROJECT' ? PROJECT_DURATIONS : PERIOD_DURATIONS).map((d) => {
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
                          <DateTimeField value={endDate} onChange={handleEndDateChange} showTime={type === 'TASK'} showPresets={type !== 'PROJECT' && type !== 'TASK' && type !== 'PERIOD'} minDate={startDate} />
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
                            <div className="hidden sm:flex flex-wrap gap-1.5">
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
                )}
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

              {/* ID de l'item */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">ID :</span>
                <span className="text-xs text-muted-foreground font-mono select-all">{item.id}</span>
              </div>

              {/* Parent (hidden in viewer mode — breadcrumb is enough) */}
              {canEdit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Parent</label>
                    <button type="button" onClick={toggleParentSortMode}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}>
                      {parentSortMode === 'tree' ? <><GitBranch className="w-3 h-3" /><span>Arborescence</span></> : <><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></>}
                    </button>
                </div>
                  <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
              </div>
              )}

              {/* Assigné à */}
              {spaceMembers && spaceMembers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigné à</label>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}
                        options={[{ value: '', label: 'Non assigné' }, ...spaceMembers.map((m) => ({ value: m.userId, label: m.name || m.email }))]} />
                      {user && assignedToId !== user.id && (
                        <button type="button" onClick={() => setAssignedToId(user.id)}
                          className="shrink-0 px-2 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                          title="M'assigner">
                          <User className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">
                      {assignedToId ? (spaceMembers.find((m) => m.userId === assignedToId)?.name || 'Membre inconnu') : <span className="text-muted-foreground">Non assigné</span>}
                    </p>
                  )}
                </div>
              )}

              {/* Dépendances */}
              <div className="space-y-3" data-tour="item-relations">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Dépendances
                  </h2>
                  {canEdit && (
                    <Button type="button" variant="bordered" size="sm" onClick={() => setShowAddRelation(!showAddRelation)}>
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
                    <textarea
                      value={newRelationLabel}
                      onChange={(e) => setNewRelationLabel(e.target.value)}
                      placeholder="Justification de la relation (optionnel)"
                      rows={2}
                      className="w-full text-sm px-3 py-1.5 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleAddRelation} disabled={!newRelationTargetId || createRelationMutation.isPending}>
                        {createRelationMutation.isPending ? 'Ajout...' : 'Ajouter'}
                      </Button>
                      <Button type="button" size="sm" variant="bordered" onClick={() => { setShowAddRelation(false); setNewRelationTargetId(''); setNewRelationLabel(''); }}>
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
                            <textarea
                              value={editRelationLabel}
                              onChange={(e) => setEditRelationLabel(e.target.value)}
                              placeholder="Justification de la relation (optionnel)"
                              rows={2}
                              className="w-full text-xs px-2 py-1 rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            <div className="flex gap-2">
                              <Button type="button" size="sm" onClick={() => updateRelationMutation.mutate({ relationId: relation.id, data: { type: editRelationType, label: editRelationLabel.trim() || null } })} disabled={updateRelationMutation.isPending}>
                                {updateRelationMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                              </Button>
                              <Button type="button" size="sm" variant="bordered" onClick={() => setEditingRelationId(null)}>Annuler</Button>
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
                            {relation.label && <p className="text-xs text-muted-foreground italic pl-1 line-clamp-2" title={relation.label}>{relation.label}</p>}
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
              <div className="space-y-3" data-tour="item-tags">
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

              {/* Children items */}
              {item && (() => {
                const children = allItems.filter(i => i.parentId === item.id);
                if (children.length === 0) return null;
                return (
                  <div className="space-y-2" data-tour="item-children">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Éléments enfants ({children.length})
                    </h2>
                    <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
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

          </div>{/* end right column */}

            </div>
          </div>

          {/* Footer — always visible */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border mt-4 flex-shrink-0" data-tour="item-actions">
            {canEdit && (
              <Button type="submit" disabled={!hasChanges || updateMutation.isPending} className={!hasChanges ? 'opacity-40' : ''}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            )}
            <Button type="button" variant="bordered" onClick={() => guardClose(onClose)}>
              {canEdit ? 'Fermer' : 'Fermer'}
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
                {user && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    title={isBookmarked ? 'Retirer des épingles' : 'Épingler'}
                    onClick={toggleBookmark}
                  >
                    <Bookmark className={`w-4 h-4 ${isBookmarked ? 'text-blue-500 fill-blue-500' : ''}`} />
                  </Button>
                )}
              </>
            )}
            {/* Contextual actions */}
            {item && canEdit && itemId && (
              <div className="flex items-center gap-1 sm:ml-auto">
                {onAbsorbChildren && (
                  <Button type="button" variant="ghost" size="sm" title="Absorber les enfants"
                    onClick={() => { onAbsorbChildren(itemId); onClose(); }}>
                    <ArrowDownToLine className="w-4 h-4" />
                  </Button>
                )}
                {onSplitDescription && hasHeadings(item.description) && (
                  <Button type="button" variant="ghost" size="sm" title="Éclater en sous-items"
                    onClick={() => { onSplitDescription(itemId); onClose(); }}>
                    <Scissors className="w-4 h-4" />
                  </Button>
                )}
                {onMerge && (
                  <Button type="button" variant="ghost" size="sm" title="Fusionner avec..."
                    onClick={() => { onMerge(itemId); onClose(); }}>
                    <Merge className="w-4 h-4" />
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" title="Dupliquer vers un espace"
                  onClick={() => setShowDuplicateModal(true)}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" title="Déplacer vers un espace"
                  onClick={() => setShowMoveModal(true)}>
                  <FolderInput className="w-4 h-4" />
                </Button>
                {onConvertToSpace && (
                  <Button type="button" variant="ghost" size="sm" title="Convertir en espace"
                    onClick={() => { onConvertToSpace(itemId); onClose(); }}>
                    <FolderPlus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            {canEdit && onDelete && itemId && (
              <Button type="button" variant="destructive" onClick={() => { onDelete(itemId); onClose(); }}>
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
      {/* Move / Duplicate modals */}
      {itemId && (
        <MoveToSpaceModal
          isOpen={showMoveModal}
          onClose={() => setShowMoveModal(false)}
          currentSpaceId={spaceId}
          itemIds={[itemId]}
        />
      )}
      {itemId && (
        <DuplicateToSpaceModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          currentSpaceId={spaceId}
          itemIds={[itemId]}
        />
      )}
    </Modal>
    <UnsavedChangesGuard hasChanges={hasChanges} onConfirmLeave={onClose} />
    {ConfirmDialog}
    </>
  );
}
