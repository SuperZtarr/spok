/**
 * ItemEditModal — Modale d'édition complète d'un item.
 * Affiche et permet de modifier tous les champs : titre, type, description, statut, priorité,
 * assignation, tags, dates (début/fin/échéance), URL, relations, contributions (thread).
 * Toggle "Jours pleins / Heures" contrôle l'affichage des sélecteurs H:MM via allDay state.
 * Les dates sont lues/écrites en heure locale via toDatetimeLocal() — ne jamais utiliser toISOString() pour afficher.
 * Fiche réduite ou complète, dans tous les modes d'interface : réduite = Titre + Description (hauteur adaptée au
 * contenu, 240px min / 40vh max, pour que les contributions restent visibles juste dessous) + blocs media +
 * Réactions/Contributions ; le bouton « Plus de champs / Moins de champs » (expanded → showAll), toujours affiché,
 * révèle Type/Statut/Priorité/Dates/Assigné/Dépendances/Parent/Tags/Enfants en layout 3 colonnes. Une fois réduite,
 * une ligne de résumé cliquable (buildForumSummary) sous le titre liste les champs avancés renseignés.
 * Défaut à l'ouverture : réduite en Forum et JDR, complète en Projet / Tous (décision Thomas 2026-10-22), non mémorisé.
 * « Ouvrir l'article » : actif seulement si la fiche est enregistrée en ARTICLE (type choisi mais pas enregistré →
 * grisé, hint openArticleUnsaved) ; départ via guardClose (modifications non enregistrées), espace = item.spaceId.
 * Deux modes (sélecteur Afficher / Modifier dans l'en-tête, « Fiche » sans droit d'édition) : readMode → ItemReadView
 * (fiche en document, même contenu que « Copier la fiche », pied réduit à Fermer) ; sinon le formulaire ci-dessous.
 * Mode initial : prop initialMode (menu Afficher / Ouvrir, ?mode=lecture), défaut lecture si !canEdit (itemOpenMode.ts).
 * Afficher est bloqué tant qu'il y a des modifications non enregistrées (la lecture montre la version enregistrée).
 * Plus de bouton admin « Voir comme visiteur » (retiré 2026-10-23, décision Thomas) : un visiteur ouvre la fiche en
 * lecture, c'est donc « Afficher » qui montre ce qu'il voit — ne pas réintroduire un formulaire grisé.
 * Pied de page : Imprimer / Export PDF (itemExport.ts) et « Copier la fiche » (itemClipboard.ts, HTML + Markdown,
 * image/schéma intégrés ; infobulle HelpHint lue dans item-modal.help.ts → hints.copySheet).
 * Save explicite via bouton Enregistrer (orange vif, action principale — 2026-09-28), avec verrou
 * optimiste (updatedAt). Focus à l'ouverture : titre seulement si l'item n'a pas encore de titre (création
 * via « Nouveau ») ; item existant → focus sur la modale (useDialogFocus), une frappe ne modifie rien.
 * Accusé de lecture à l'assignation sous « Assigné à » (assignmentReceipt de l'API) : « Vu par X le … » ou
 * « Pas encore vu », seulement pour l'assigné enregistré. Écritures directes hors Enregistrer (upload image/document, XML de diagramme
 * auto-sauvé ou « Enregistrer et fermer » draw.io) : toujours suivies de refreshItem(), sinon faux 409.
 * Fraîcheur : la fiche ['item', spaceId, itemId] est TOUJOURS relue à l'ouverture (staleTime 0) et
 * chaque version plus récente (updatedAt) est fusionnée champ par champ dans le formulaire
 * (mergeFormWithServer) — les vues modifient l'item sans invalider cette clé.
 * Sous-modales keyées par itemId (remontage = reset de leur state d'un item à l'autre) : chaque clé
 * doit rester préfixée et unique parmi les enfants de <Modal> (deux `key={itemId}` frères = warning
 * React « two children with the same key » à chaque rendu, bug corrigé le 2026-09-27).
 * Copie de séance live (lockedAt) : lecture seule sauf tags (canEditTags) et contributions ; bandeau d'origine ;
 * l'enregistrement n'envoie alors que tagIds (l'API refuse tout autre champ, cf. utils/itemLock.ts).
 * Pied : boutons « Ajouter à la préparation » / « Présenter en séance » si la séance live active le permet (liveItemActions).
 * Contributions affichées via sanitizeHtml, liens vers url via safeHref (règle user-html-sanitized).
 * Zone de contribution (ouverte, réponse en cours, texte) remise à zéro à chaque changement d'item (effet sur itemId).
 * Visiteur anonyme (lecture seule, spec « Sécurité & Accès ») : réactions en compteurs seuls (ReactionBar readOnly),
 * pas d'enregistrement « vu » (markViewed) à l'ouverture.
 * Type ARTICLE : bouton « Ouvrir l'article » (section média) vers sa page de lecture / composition (ArticlePage).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RELATION_TYPE_LIST, getRelationMeta, type OfficialRelationType } from '../constants/relationTypes';
import { assignmentReceiptLabel } from '../lib/assignmentReceipt';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, spacesApi, bookmarksApi, activityApi, isConflictError } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation, SpaceReferentiels, Tag, TypeLabelConfig } from '@spok/shared';
import { ConflictDialog } from './ConflictDialog';
import { buildLiveItemActions } from '../lib/liveItemActions';
import { useActiveLiveSessionStore } from '../stores/activeLiveSession';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus, ExternalLink, ChevronRight, ChevronDown, ChevronUp, Home, Tag as TagIcon, Printer, FileDown, ClipboardCopy, Check,Building2, Bookmark, Eye, FolderInput, Copy, Merge, Scissors, ArrowDownToLine, FolderPlus, LayoutTemplate, ListTree, EyeOff, BookOpen } from 'lucide-react';
import { ItemReadView } from './ItemReadView';
import { sanitizeHtml, safeHref } from '../lib/sanitizeHtml';
import { resolveItemMode, type ItemOpenMode } from '../lib/itemOpenMode';
import { Link, useNavigate } from 'react-router-dom';
import { TagSelector } from './ui/TagSelector';
import { ReactionBar } from './ReactionBar';
import { HelpButton } from '../help/HelpButton';
import { PAGE_HELP } from '../help/pageHelp';
import { HelpHint } from '../help/HelpHint';
import { FieldHelp } from '../help/FieldHelp';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { TagBadge } from './ui/TagBadge';
import { RuleHint } from './ui/RuleHint';
import { TYPE_LABELS, TYPE_ICONS, STORAGE_KEYS, PRIORITIES, TYPE_GROUPS } from '../constants/ui';
import { useAuthStore } from '../stores/auth';
import { useUnsavedGuard, UnsavedChangesGuard } from './ui/UnsavedChangesGuard';
import { useCtrlS } from '../hooks/useCtrlS';
import { RichTextEditor } from './ui/RichTextEditor';
import { DrawioEditor } from './ui/DrawioEditor';
import { ImageUploadZone } from './ui/ImageUploadZone';
import { FileUploadZone } from './ui/FileUploadZone';
import { DateTimeField } from './ui/DateTimeField';
import { TimeRangePicker } from './ui/TimeRangePicker';
import { diffMs, addHours, addDays, addMonths, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { computeCascadeDependents, computeCascadeDescendants, type CascadeDependent } from '../lib/cascadeShift';
import { CascadeShiftConfirmModal } from './CascadeShiftConfirmModal';
import { RelationEditDialog } from './relations/RelationEditDialog';
import type { RelationEnd } from './relations/RelationSentenceRow';
import { formatDate, formatDateTime } from '../lib/utils';
import { MEETING_DURATIONS, DUE_DATE_DURATIONS } from './item-edit-constants';
import { fileNameToTitle, urlToTitle, getDescendantIds, mergeFormWithServer, tagKey, buildForumSummary } from './item-edit-helpers';
import { printItem, exportItemPDF } from '../lib/itemExport';
import { buildItemSheet, copyItemSheet } from '../lib/itemClipboard';
import { MoveToSpaceModal } from './MoveToSpaceModal';
import { DuplicateToSpaceModal } from './DuplicateToSpaceModal';
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
import { InsertTemplateModal } from './InsertTemplateModal';
import { hasHeadings, markItemUnread } from '../lib/itemMenuGroups';
import { useInterfaceModeStore } from '../stores/interfaceMode';

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
  /** Mode demandé à l'ouverture (menu Afficher / Ouvrir, ?mode=lecture) ; absent = défaut selon canEdit (itemOpenMode.ts) */
  initialMode?: ItemOpenMode;
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
  initialMode,
}: ItemEditModalProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pulseHelp: itemPulse, startTour: startItemTour } = usePageTourPulse('item-modal', PAGE_HELP['item-modal'].tour);
  const { mode: interfaceMode } = useInterfaceModeStore();
  // Fiche réduite (titre + description + médias + contributions) ou complète, dans tous les modes, via le bouton
  // « Plus de champs / Moins de champs ». Défaut à l'ouverture : réduite en Forum et JDR, complète en Projet / Tous.
  // Non mémorisé : chaque fiche ouverte (ou changement de mode) repart du défaut.
  const collapsedByDefault = interfaceMode === 'forum' || interfaceMode === 'jdr';
  const [expanded, setExpanded] = useState(!collapsedByDefault);
  const [sheetCopied, setSheetCopied] = useState(false);
  // Mode Afficher (ItemReadView) ou Modifier / Fiche : fixé à chaque ouverture, conservé en naviguant d'item en item
  const [readMode, setReadMode] = useState(false);
  useEffect(() => {
    if (isOpen) setReadMode(!!itemId && resolveItemMode(initialMode, canEditProp) === 'read');
  }, [isOpen, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [allDay, setAllDay] = useState(true);
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
  const [showSaveAsTemplateModal, setShowSaveAsTemplateModal] = useState(false);
  const [showInsertTemplateModal, setShowInsertTemplateModal] = useState(false);

  // Relations state
  const [showAddRelation, setShowAddRelation] = useState(false);
  const [newRelationType, setNewRelationType] = useState<OfficialRelationType>('implements');
  const [newRelationTargetId, setNewRelationTargetId] = useState('');
  const [newRelationLabel, setNewRelationLabel] = useState('');
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null);
  // Relation ouverte dans RelationEditDialog (modale partagée) : extrémités (titre + statut), type et commentaire initiaux
  const [editingRelationMeta, setEditingRelationMeta] = useState<{ source: RelationEnd; target: RelationEnd; type: string; label: string } | null>(null);

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
    // Toujours relire la fiche à l'ouverture : les vues (Gantt, MindMap…) modifient l'item sans
    // invalider cette clé, et le staleTime global (5 min) resservait une fiche périmée.
    // staleTime 0 couvre aussi le cas où la modale reste montée et ne fait que repasser enabled=true.
    refetchOnMount: 'always',
    staleTime: 0,
  });

  // canEdit: space OWNER, or item author, or item assignee (new items are always editable)
  const isNewItem = !itemId;
  const isSpaceOwner = spaceRole === 'OWNER';
  const isItemAuthor = !!user && !!item && (item as any).createdById === user.id;
  const isItemAssignee = !!user && !!item && item.assignedToId === user.id;
  // Copie de séance verrouillée : lecture seule (commentaires et tags restent possibles) — cf. itemLock.ts côté API
  const isLockedCopy = !!item?.lockedAt;
  const canEdit = canEditProp && !isLockedCopy && (isNewItem || isSpaceOwner || isItemAuthor || isItemAssignee);
  const canEditTags = canEditProp && (canEdit || isLockedCopy);
  // Séance live active : actions « Ajouter à la préparation » / « Présenter en séance » du pied
  const liveInfo = useActiveLiveSessionStore((s) => s.info);
  const liveSpaceId = useActiveLiveSessionStore((s) => s.spaceId);
  const liveActions = (id: string) => buildLiveItemActions(id, liveInfo, liveSpaceId);
  // canInteract: any authenticated member can react and contribute (even if they can't edit the item)
  const canInteract = canEditProp;

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
  // Version de l'item qui a rempli le formulaire (base de la fusion champ par champ)
  const loadedItemRef = useRef<Item | null>(null);

  // Capture viewedAt from the list snapshot BEFORE marking as viewed
  const viewedAtRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (isOpen && itemId) {
      const fromList = allItems.find(i => i.id === itemId);
      viewedAtRef.current = (fromList as any)?.viewedAt ?? null;
      // Lecture personnelle : rien à enregistrer pour un visiteur anonyme (l'API répond 401)
      if (user) activityApi.markViewed(itemId).catch(() => {});
    }
  }, [isOpen, itemId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the tracker whenever the requested item changes
  // Zone de contribution remise à zéro aussi : une réponse en cours à une contribution de l'item précédent
  // (replyToContributionId) masquait la zone principale du suivant — la réaction ne faisait plus que compter (2026-10-28).
  useEffect(() => {
    initializedItemIdRef.current = null;
    loadedItemRef.current = null;
    setShowContributionField(false);
    setReplyToContributionId(null);
    setNewContribution('');
  }, [itemId]);

  // Défaut réduit/complet du mode, à chaque fiche ouverte et à chaque changement de mode
  useEffect(() => {
    setExpanded(!collapsedByDefault);
  }, [itemId, collapsedByDefault]);

  // Formulaire ← item : au premier chargement, puis à CHAQUE version plus récente du même item
  // (updatedAt) — refetch à l'ouverture après une modif faite dans une vue, absorption, cascade…
  // Fusion champ par champ (mergeFormWithServer) : un champ déjà modifié par l'utilisateur garde sa
  // saisie. Ancienne clé id+dates : les autres champs restaient figés sur la fiche en cache
  // (description après absorption, statut changé dans une vue…) jusqu'au rechargement de la page.
  useEffect(() => {
    if (!item) return;
    const initKey = `${item.id}::${item.updatedAt ?? ''}`;
    if (initializedItemIdRef.current === initKey) return; // déjà synchronisé sur cette version
    initializedItemIdRef.current = initKey;

    const toForm = (it: NonNullable<typeof item>) => ({
      title: it.title,
      description: it.description || '',
      url: it.url || '',
      parentId: it.parentId || '',
      status: it.status || '',
      priority: it.priority ?? null,
      assignedToId: it.assignedToId || '',
      type: it.type as string,
      diagramXml: (it.content as Record<string, unknown>)?.xml as string || '',
      // datetime-local (YYYY-MM-DDTHH:mm) en heure locale
      dueDate: it.dueDate ? toDatetimeLocal(new Date(it.dueDate)) : '',
      startDate: it.startDate ? toDatetimeLocal(new Date(it.startDate)) : '',
      endDate: it.endDate ? toDatetimeLocal(new Date(it.endDate)) : '',
      tags: tagKey(it.tags?.map((t: Tag) => t.id) || []),
    });
    const base = loadedItemRef.current?.id === item.id ? toForm(loadedItemRef.current) : null;
    loadedItemRef.current = item;
    const next = toForm(item);
    const merged = mergeFormWithServer(
      { title, description, url, parentId, status, priority, assignedToId, type: type as string, diagramXml, dueDate, startDate, endDate, tags: tagKey(selectedTagIds) },
      base,
      next,
    );

    setTitle(merged.title);
    setDescription(merged.description);
    setUrl(merged.url);
    setParentId(merged.parentId);
    setStatus(merged.status);
    setPriority(merged.priority);
    setAssignedToId(merged.assignedToId);
    if (!base || merged.type !== type) {
      setType(merged.type as ItemType);
      setAllDay(merged.type !== 'MEETING');
    }
    setDiagramXml(merged.diagramXml);
    setDueDate(merged.dueDate);
    setStartDate(merged.startDate);
    setEndDate(merged.endDate);
    const serverTagIds = item.tags?.map((t: Tag) => t.id) || [];
    if (merged.tags === next.tags) setSelectedTagIds(serverTagIds);
    setOriginalTagIds(serverTagIds);
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

  const cascadeShiftMutation = useMutation({
    mutationFn: (data: { deltaDays: number; dependentIds: string[] }) =>
      itemsApi.cascadeShift(spaceId, itemId!, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      // Un dépendant peut être dans un autre espace (relation drives cross-space) — invalider
      // sa requête ['item', <son espace>, id] sans connaître cet espace à l'avance.
      for (const dependentId of variables.dependentIds) {
        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'item' && query.queryKey[2] === dependentId });
      }
    },
  });

  const [pendingCascade, setPendingCascade] = useState<{
    updates: Parameters<typeof updateMutation.mutate>[0];
    deltaDays: number;
    dependents: CascadeDependent[];
    descendants: CascadeDependent[];
  } | null>(null);

  // Écritures directes de la modale hors « Enregistrer » (upload image/document, XML de diagramme) :
  // elles font avancer updatedAt côté serveur. Sans relire la fiche, « Enregistrer » renverrait
  // l'ancien updatedAt → 409 « conflit » contre sa propre modification (bug 2026-09-28). La relecture
  // est fusionnée champ par champ (mergeFormWithServer) : la saisie en cours est conservée.
  const refreshItem = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
  }, [queryClient, spaceId, itemId]);

  const autoSaveDiagramMutation = useMutation({
    mutationFn: (xml: string) =>
      itemsApi.update(spaceId, itemId!, { content: { xml } }),
    onSuccess: refreshItem,
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
      refreshItem();
    },
  });

  // Document upload mutation
  const uploadDocumentMutation = useMutation({
    mutationFn: (file: File) => itemsApi.uploadDocument(spaceId, itemId!, file),
    onSuccess: (updatedItem) => {
      setUrl(updatedItem.url || '');
      refreshItem();
    },
  });

  // Relations mutations
  const createRelationMutation = useMutation({
    mutationFn: (data: { toItemId: string; type: string; label?: string }) =>
      itemsApi.createRelation(spaceId, itemId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
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
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: ({ relationId, data }: { relationId: string; data: { type?: string; label?: string | null } }) =>
      itemsApi.updateRelation(spaceId, itemId!, relationId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] });
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      setEditingRelationId(null);
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
    // Dates : le state (startDate/endDate/dueDate) est en heure locale via toDatetimeLocal()
    // ET tronqué à la minute ; item.xxxDate est en ISO UTC et peut porter des secondes/ms.
    // → normaliser LES DEUX côtés au même instant tronqué à la minute (sinon faux positif
    //   permanent : décalage UTC/local, ou secondes non nulles en base).
    const toMinuteISO = (d: string | null | undefined) => {
      if (!d) return null;
      const t = new Date(d);
      return isNaN(t.getTime()) ? null : t.toISOString().slice(0, 16);
    };
    if (toMinuteISO(dueDate) !== toMinuteISO(item.dueDate)) return true;
    if (toMinuteISO(startDate) !== toMinuteISO(item.startDate)) return true;
    if (toMinuteISO(endDate) !== toMinuteISO(item.endDate)) return true;
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

    // Copie de séance : seuls les tags sont modifiables
    if (isLockedCopy) {
      const tagsChanged = [...selectedTagIds].sort().join() !== [...originalTagIds].sort().join();
      if (tagsChanged) {
        const tagUpdate = { updatedAt: item.updatedAt, tagIds: selectedTagIds };
        updateMutation.mutate(tagUpdate);
      } else {
        onClose();
      }
      return;
    }

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

    // Cascade "Entraîne" : référence dueDate > startDate > endDate parmi les champs modifiés
    // (uniquement quand l'ancienne ET la nouvelle valeur existent — un champ qui apparaît/disparaît
    // n'est pas un déplacement dans le temps, pas de delta calculable).
    let cascadeDeltaDays = 0;
    if (updates.dueDate !== undefined && currentDueDate && newDueDate) {
      cascadeDeltaDays = Math.round((new Date(newDueDate).getTime() - new Date(currentDueDate).getTime()) / 86400000);
    } else if (updates.startDate !== undefined && currentStartDate && newStartDate) {
      cascadeDeltaDays = Math.round((new Date(newStartDate).getTime() - new Date(currentStartDate).getTime()) / 86400000);
    } else if (updates.endDate !== undefined && currentEndDate && newEndDate) {
      cascadeDeltaDays = Math.round((new Date(newEndDate).getTime() - new Date(currentEndDate).getTime()) / 86400000);
    }
    const cascadeDependents = cascadeDeltaDays !== 0 ? computeCascadeDependents(itemId!, cascadeDeltaDays, allItems) : [];
    const cascadeDescendants = cascadeDeltaDays !== 0 ? computeCascadeDescendants(itemId!, cascadeDeltaDays, allItems) : [];

    if (Object.keys(updates).length > 0) {
      if (cascadeDependents.length > 0 || cascadeDescendants.length > 0) {
        setPendingCascade({ updates, deltaDays: cascadeDeltaDays, dependents: cascadeDependents, descendants: cascadeDescendants });
      } else {
        updateMutation.mutate(updates);
      }
    } else {
      onClose();
    }
  };

  const confirmCascade = (includeDescendants: boolean) => {
    if (!pendingCascade) return;
    updateMutation.mutate(pendingCascade.updates);
    const ids = [
      ...pendingCascade.dependents.map((d) => d.id),
      ...(includeDescendants ? pendingCascade.descendants.map((d) => d.id) : []),
    ];
    if (ids.length > 0) {
      cascadeShiftMutation.mutate({ deltaDays: pendingCascade.deltaDays, dependentIds: ids });
    }
    setPendingCascade(null);
  };

  const skipCascade = () => {
    if (!pendingCascade) return;
    updateMutation.mutate(pendingCascade.updates);
    setPendingCascade(null);
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
  // Fiche complète (tous les champs, 3 colonnes) ou réduite — cf. expanded
  const showAll = expanded;

  // Fiche de l'item (version enregistrée) : rendue par le mode Afficher et copiée par « Copier la fiche »
  const buildSheet = () => buildItemSheet({
    item: item as any,
    children: item ? allItems.filter(i => i.parentId === item.id) : [],
    spaceName,
    parentTitle: item?.parentId ? allItems.find(i => i.id === item.parentId)?.title : null,
    labels: {
      typeLabel: (t) => (referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels)[t as ItemType]?.labelShort,
      statusLabel: (s) => (referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).find((st) => st.id === s)?.label,
      priorityLabel: (p) => PRIORITIES.find((pr) => pr.value === p)?.label,
      formatDate: (iso) => formatDate(iso),
    },
    relationLabel: (relType, direction) => {
      const meta = getRelationMeta(relType);
      return direction === 'from' ? meta.label : meta.inverseLabel;
    },
  });
  const copySheet = async () => {
    await copyItemSheet(buildSheet());
    setSheetCopied(true);
    setTimeout(() => setSheetCopied(false), 2000);
  };
  const printSheet = () => {
    if (!item) return;
    printItem({ item: item as any, children: allItems.filter(i => i.parentId === item.id), spaceName });
  };
  const itemHints = PAGE_HELP['item-modal'].hints;

  // Blocs media (URL/Diagramme/Image/Fichier) — conditionnés au type, pas au mode.
  // Fiche complète : rendus dans la colonne centrale. Fiche réduite (colonne centrale supprimée) :
  // rendus sous la Description dans la colonne principale.
  const mediaSection = (
    <>
      {/* Article : ses blocs se composent et se lisent sur sa page (pages/ArticlePage.tsx).
          Actif seulement si la fiche est ENREGISTRÉE en Article (sinon l'API répond « introuvable ») ;
          le départ passe par la garde des modifications non enregistrées. */}
      {type === 'ARTICLE' && itemId && (
        <HelpHint text={item?.type === 'ARTICLE' ? itemHints?.openArticle : itemHints?.openArticleUnsaved}>
          <button
            type="button"
            disabled={item?.type !== 'ARTICLE'}
            onClick={() => guardClose(() => { onClose(); navigate(`/spaces/${item?.spaceId ?? spaceId}/articles/${itemId}`); })}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Ouvrir l'article
          </button>
        </HelpHint>
      )}
      {/* URL — seulement pour le type LINK */}
      {type === 'LINK' && <div className="space-y-2">
        <label className="text-sm font-medium">URL</label>
        {canEdit ? (
          <Input type="url" value={url}
            onChange={(e) => { setUrl(e.target.value); const extracted = urlToTitle(e.target.value); if (extracted) autoFillTitle(extracted); }}
            placeholder="https://..." />
        ) : null}
        {url ? (
          <a href={safeHref(url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all">
            <ExternalLink className="w-4 h-4 flex-shrink-0" /> {url}
          </a>
        ) : null}
      </div>}

      {/* Diagramme — seulement pour le type DIAGRAM */}
      {type === 'DIAGRAM' && <div className="space-y-2">
        <label className="text-sm font-medium">Diagramme</label>
        <DrawioEditor
          xml={diagramXml}
          onChange={setDiagramXml}
          onSaveAndClose={async (savedXml, pngBlob) => {
            if (!itemId) return;
            await itemsApi.update(spaceId, itemId, { content: { xml: savedXml } });
            setDiagramXml(savedXml);
            const file = new File([pngBlob], 'diagram.png', { type: 'image/png' });
            // XML déjà écrit : relire la fiche même si l'upload du PNG échoue (ex. R2 absent en local)
            try {
              await uploadImageMutation.mutateAsync(file);
            } finally {
              refreshItem();
            }
          }}
          previewUrl={url || undefined}
          editable={canEdit}
        />
      </div>}

      {/* Image — seulement pour le type IMAGE */}
      {type === 'IMAGE' && <div className="space-y-2">
        <label className="text-sm font-medium">Image</label>
        {canEdit ? (
          <>
            <ImageUploadZone currentUrl={url || null}
              onUpload={(file) => { autoFillTitle(fileNameToTitle(file.name)); uploadImageMutation.mutate(file); }}
              onRemove={() => setUrl('')} isUploading={uploadImageMutation.isPending} />
            {uploadImageMutation.isError && <p className="text-sm text-destructive">{(uploadImageMutation.error as Error)?.message || "Erreur lors de l'upload"}</p>}
          </>
        ) : url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url) ? (
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
      </div>}

      {/* Fichier — seulement pour le type DOCUMENT */}
      {type === 'DOCUMENT' && <div className="space-y-2">
        <label className="text-sm font-medium">Fichier</label>
        {canEdit ? (
          <>
            <FileUploadZone currentUrl={url || null}
              onUpload={(file) => { autoFillTitle(fileNameToTitle(file.name)); uploadDocumentMutation.mutate(file); }}
              onRemove={() => setUrl('')} isUploading={uploadDocumentMutation.isPending} />
            {uploadDocumentMutation.isError && <p className="text-sm text-destructive">{(uploadDocumentMutation.error as Error)?.message || "Erreur lors de l'upload"}</p>}
          </>
        ) : url ? (
          <a href={safeHref(url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 text-sm text-primary bg-primary/5 border border-primary/20 rounded-md hover:bg-primary/10 transition-colors break-all">
            <ExternalLink className="w-4 h-4 flex-shrink-0" /> Télécharger le fichier
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun fichier</p>
        )}
      </div>}
    </>
  );

  return (<>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="fullscreen"
      devName="ItemEditModal"
    >
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : item ? (
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          {isLockedCopy && (
            <div className="mb-3 rounded border border-orange-300 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 text-xs">
              Copie de séance — présentée le {new Date(item!.lockedAt!).toLocaleString('fr-FR')}. Contenu verrouillé ; commentaires et tags possibles.
            </div>
          )}
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
              {readMode ? (
                <span className="text-sm text-muted-foreground">{typeConfig?.labelShort || type}</span>
              ) : canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Titre de l'élément"
                  className="text-lg sm:text-xl font-bold px-2 py-1 h-auto bg-muted/30 hover:bg-muted/60 focus:bg-background transition-colors"
                  autoFocus={!item?.title}
                />
              ) : (
                <h1 className="text-lg sm:text-xl font-bold truncate">{title}</h1>
              )}
            </div>
            {/* Sélecteur Afficher / Modifier (Fiche sans droit d'édition) — item existant seulement */}
            {!isNewItem && (
              <div className="flex items-center rounded-md bg-muted p-0.5 flex-shrink-0" role="group" aria-label="Mode d'affichage" data-tour="item-mode-switch">
                <HelpHint text={itemHints?.[!readMode && hasChanges ? 'readModeUnsaved' : 'readMode']}>
                  <button
                    type="button"
                    aria-pressed={readMode}
                    disabled={!readMode && hasChanges}
                    onClick={() => setReadMode(true)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${readMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span className="hidden sm:inline">Afficher</span>
                  </button>
                </HelpHint>
                <HelpHint text={itemHints?.[canEdit ? 'editMode' : 'sheetMode']}>
                  <button
                    type="button"
                    aria-pressed={!readMode}
                    onClick={() => setReadMode(false)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${!readMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span className="hidden sm:inline">{canEdit ? 'Modifier' : 'Fiche'}</span>
                  </button>
                </HelpHint>
              </div>
            )}
            {!readMode && <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              data-tour="item-more-fields"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
              title={expanded ? 'Masquer les champs avancés' : 'Afficher tous les champs (type, statut, dates, tags…)'}
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span className="hidden sm:inline">{expanded ? 'Moins de champs' : 'Plus de champs'}</span>
            </button>}
            <div className="flex items-center gap-2 flex-shrink-0">
              {item?.createdBy && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  <span>{item.createdBy.name}</span>
                  <span>•</span>
                  <span>{new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
              )}
              <HelpButton help={PAGE_HELP['item-modal']} onStartTour={startItemTour} pulse={itemPulse} variant="page" buttonTitle="Aide" />
            </div>
          </div>

          {/* Mode Afficher : la fiche en document (même contenu que « Copier la fiche »), pied réduit à Fermer */}
          {readMode && (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <ItemReadView
                  sheet={buildSheet()}
                  onOpenChild={onNavigate}
                  toolbar={(
                    <>
                      <HelpHint text={itemHints?.[sheetCopied ? 'copySheetDone' : 'copySheet']}>
                        <Button type="button" variant="ghost" size="sm" aria-label="Copier la fiche" onClick={copySheet}>
                          {sheetCopied ? <Check className="w-4 h-4 text-green-600" /> : <ClipboardCopy className="w-4 h-4" />}
                        </Button>
                      </HelpHint>
                      <HelpHint text={itemHints?.print}>
                        <Button type="button" variant="ghost" size="sm" aria-label="Imprimer" onClick={printSheet}>
                          <Printer className="w-4 h-4" />
                        </Button>
                      </HelpHint>
                    </>
                  )}
                  reactions={(
                    <ReactionBar spaceId={spaceId} itemId={item.id} summary={(item as any).reactionSummary || []} readOnly={!user} />
                  )}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border mt-4 flex-shrink-0">
                <Button type="button" variant="bordered" onClick={onClose}>Fermer</Button>
              </div>
            </>
          )}

          {!readMode && (<>
          {/* Fiche réduite (tous modes) : résumé cliquable des champs avancés renseignés */}
          {!expanded && item && (() => {
            const parts = buildForumSummary(item, {
              typeLabel: (t) => (referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels)[t as ItemType]?.labelShort,
              statusLabel: (s) => (referentiels?.statuses || DEFAULT_REFERENTIELS.statuses).find((st) => st.id === s)?.label,
              priorityLabel: (p) => PRIORITIES.find((pr) => pr.value === p)?.label,
              formatDate: (iso) => formatDate(iso),
            });
            if (parts.length === 0) return null;
            return (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="self-start -mt-1 mb-2 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                title="Afficher tous les champs"
              >
                {parts.join(' · ')}
              </button>
            );
          })()}

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto pr-1">

            {/* Layout : 3 colonnes fiche complète, 1 colonne fiche réduite (colonne centrale supprimée) */}
            <div className={`grid grid-cols-1 gap-6 ${showAll ? 'lg:grid-cols-[1fr,0.85fr,380px]' : ''}`}>

          {/* === LEFT COLUMN: description + contributions === */}
          <div className="space-y-6 min-w-0">

              {/* Description — visible pour tous les types, y compris Lien/Doc/Image/Diagramme (demande 2026-07-15) */}
              <div className="space-y-2" data-tour="item-description">
                <label className="text-sm font-medium">Description</label>
                <RichTextEditor
                  key={itemId}
                  content={description}
                  onChange={setDescription}
                  editable={canEdit}
                  spaceId={spaceId}
                  minHeight={240}
                  defaultMaxHeight={!showAll ? '40vh' : undefined}
                  mentionableItems={allItems.map((i) => ({ id: i.id, title: i.title, type: i.type }))}
                />
              </div>

              {/* Fiche réduite : blocs media sous la Description */}
              {!showAll && mediaSection}

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
                    readOnly={!user}
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
                    // px-2 sur toutes les contributions (texte aligné lu/non lu), jamais de marge
                    // négative : elle débordait du conteneur scrollable (barre horizontale).
                    return (
                      <div key={contribution.id} className={`px-2 ${depth > 0 ? 'ml-6 border-l-2 border-border pl-3' : ''} ${isNewContrib ? 'bg-blue-50/60 dark:bg-blue-950/20 rounded-md' : ''}`}>
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
                              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground [&>p]:my-0.5" dangerouslySetInnerHTML={{ __html: sanitizeHtml(contribution.content) }} />
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
                                  readOnly={!user}
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
                    <div className="space-y-1" data-tour="item-contributions">
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

          {/* === CENTER COLUMN === — fiche réduite : supprimée (mediaSection sous la Description) */}
          {showAll && <div className="space-y-6 min-w-0">

              {/* Type */}
              {showAll && <div className="space-y-2" data-tour="item-type-selector">
                <label className="text-sm font-medium">Type</label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={type}
                        onChange={(e) => { setType(e.target.value as ItemType); if (e.target.value === 'MEETING') setAllDay(false); }}
                        options={(Object.entries(referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels))
                          .filter(([, c]) => c.visible)
                          .sort(([, a], [, b]) => a.order - b.order)
                          .map(([key, c]) => ({ value: key, label: c.labelShort }))}
                      />
                    </div>
                    {/* Desktop: buttons, groupés par TYPE_GROUPS (Défaut/Activités/Livrables) */}
                    <div className="hidden sm:flex flex-col gap-1.5">
                      {(() => {
                        const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                        const renderButton = (key: string, config: TypeLabelConfig) => {
                          const Icon = TYPE_ICONS[key];
                          const isSelected = type === key;
                          return (
                            <button key={key} type="button" onClick={() => { setType(key as ItemType); if (key === 'MEETING') setAllDay(false); }}
                              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 transition-all ${config.color} ${isSelected ? `${config.bgHover} font-semibold shadow-sm ring-2 ring-offset-1 ring-current text-gray-900` : 'opacity-60 hover:opacity-100'}`}>
                              {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                              {config.labelShort}
                              <RuleHint category="type" value={key} />
                            </button>
                          );
                        };
                        const groupedKeys = new Set(TYPE_GROUPS.flatMap((g) => g.types));
                        const groups = TYPE_GROUPS.map((g) => ({
                          ...g,
                          entries: g.types
                            .map((key): [string, TypeLabelConfig] => [key, typeLabels[key]])
                            .filter(([, config]) => config?.visible)
                            .sort(([, a], [, b]) => a.order - b.order),
                        }));
                        const ungrouped = Object.entries(typeLabels)
                          .filter(([key, config]) => config.visible && !groupedKeys.has(key as ItemType))
                          .sort(([, a], [, b]) => a.order - b.order);
                        if (ungrouped.length > 0) {
                          groups.push({ id: 'other', label: 'Autres', types: [], entries: ungrouped });
                        }
                        return groups
                          .filter((g) => g.entries.length > 0)
                          .map((g) => (
                            <div key={g.id} className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{g.label}</span>
                              {g.entries.map(([key, config]) => renderButton(key, config))}
                            </div>
                          ));
                      })()}
                    </div>
                  </>
                ) : (
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border-2 ${typeConfig?.color || 'border-border'} ${typeConfig?.bgHover || ''} font-semibold`}>
                    {TypeIcon && <TypeIcon className="w-3.5 h-3.5" />}
                    {typeConfig?.labelShort || TYPE_LABELS[type] || type}
                  </span>
                )}
              </div>}

              {/* Statut */}
              {showAll && <div className="space-y-2" data-tour="item-status">
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
                            if ((newStatus === 'done' || newStatus === 'cancelled') && !currentEndDate) { const m = new Date(); m.setHours(0,0,0,0); currentEndDate = toDatetimeLocal(m); setEndDate(currentEndDate); }
                            if (!startDate) { const now = new Date(); const m = new Date(now.getFullYear(), now.getMonth(), now.getDate()); setStartDate(currentEndDate && fromDatetimeLocal(currentEndDate) < now ? currentEndDate : toDatetimeLocal(m)); }
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
                            className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${isSelected ? `${s.borderColor} font-semibold shadow-sm ring-2 ring-offset-1 ring-current` : `${s.borderColor} opacity-60 hover:opacity-100`}`}>
                            {s.label}
                            <RuleHint category="status" value={s.id} />
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
              </div>}

              {/* Priorité */}
              {showAll && <div className="space-y-2">
                <label className="text-sm font-medium">Priorité</label>
                {canEdit && <FieldHelp page="item-modal" field="priority" className="text-xs text-muted-foreground" />}
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
                        className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${priority === null ? 'border-gray-400 bg-gray-100 font-semibold shadow-sm ring-2 ring-offset-1 ring-current' : 'border-gray-200 opacity-60 hover:opacity-100'}`}>
                        Aucune
                      </button>
                      {PRIORITIES.map((p) => (
                        <button key={p.value} type="button" onClick={() => setPriority(p.value)}
                          className={`px-3 py-1.5 text-sm rounded-md border-2 transition-all text-gray-900 ${p.color} ${priority === p.value ? `${p.bgColor} font-semibold shadow-sm ring-2 ring-offset-1 ring-current` : 'opacity-60 hover:opacity-100'}`}>
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
              </div>}

              {/* Dates */}
              {showAll && <div data-tour="item-dates" className="space-y-3">
                {/* Toggle Jours pleins / Heures — pleine largeur */}
                {canEdit && (
                  <div className="flex items-center gap-3">
                    <div className="flex rounded-md border border-border overflow-hidden text-xs">
                      <button type="button"
                        onClick={() => setAllDay(true)}
                        className={`px-3 py-1 transition-all ${allDay ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50'}`}>
                        Jours pleins
                      </button>
                      <button type="button"
                        onClick={() => setAllDay(false)}
                        className={`px-3 py-1 transition-all border-l border-border ${!allDay ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:bg-muted/50'}`}>
                        Heures
                      </button>
                    </div>
                  </div>
                )}
                {/* Champs de dates + sélecteur heures à droite */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Début</label>
                    {canEdit && <FieldHelp page="item-modal" field="startEnd" className="text-xs text-muted-foreground" />}
                    {canEdit ? (
                      <DateTimeField value={startDate} onChange={handleStartDateChange} showTime={!allDay} />
                    ) : (
                      <p className="text-sm">{startDate ? (allDay ? formatDate(startDate) : formatDateTime(startDate)) : <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Fin</label>
                    {canEdit ? (
                      <div className="space-y-2">
                        {startDate && (
                          <div className="hidden sm:flex flex-wrap gap-1.5">
                            {MEETING_DURATIONS.map((d) => {
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
                        <DateTimeField value={endDate} onChange={handleEndDateChange} showTime={!allDay} minDate={startDate} />
                      </div>
                    ) : (
                      <p className="text-sm">{endDate ? (allDay ? formatDate(endDate) : formatDateTime(endDate)) : <span className="text-muted-foreground">—</span>}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Échéance</label>
                    {canEdit && <FieldHelp page="item-modal" field="dueDate" className="text-xs text-muted-foreground" />}
                    {canEdit ? (
                      <div className="space-y-2">
                        {startDate && (
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
                  {canEdit && !allDay && (
                    <div className="flex-shrink-0 w-40">
                      <TimeRangePicker
                        startTime={startDate ? startDate.slice(11, 16) : null}
                        endTime={endDate ? endDate.slice(11, 16) : null}
                        onChange={handleTimeRangeChange}
                      />
                    </div>
                  )}
                </div>
              </div>}

              {/* Blocs media (URL/Diagramme/Image/Fichier) — fiche complète uniquement (réduite : rendus sous la Description) */}
              {mediaSection}

          </div>}{/* end center column */}

          {/* === RIGHT COLUMN === */}
          <div className="space-y-6" data-tour="item-details">

              {/* ID de l'item */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">ID :</span>
                <span className="text-xs text-muted-foreground font-mono select-all">{item.id}</span>
              </div>

              {/* Parent (hidden in viewer mode ; sous le toggle « Plus de champs ») */}
              {showAll && canEdit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Parent</label>
                    <button type="button" onClick={toggleParentSortMode}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}>
                      {parentSortMode === 'tree' ? <><GitBranch className="w-3 h-3" /><span>Arborescence</span></> : <><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></>}
                    </button>
                </div>
                  <FieldHelp page="item-modal" field="parent" className="text-xs text-muted-foreground" />
                  <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
              </div>
              )}

              {/* Assigné à */}
              {showAll && spaceMembers && spaceMembers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigné à</label>
                  {canEdit && <FieldHelp page="item-modal" field="assignee" className="text-xs text-muted-foreground" />}
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
                  {/* Accusé de lecture : seulement pour l'assigné enregistré (pas pendant un changement en cours) */}
                  {(() => {
                    if (!item || (item.assignedToId ?? '') !== assignedToId) return null;
                    const name = spaceMembers.find((m) => m.userId === assignedToId)?.name;
                    const receipt = assignmentReceiptLabel(item.assignmentReceipt, name);
                    if (!receipt) return null;
                    return (
                      <p className={`text-xs flex items-center gap-1 ${receipt.seen ? 'text-muted-foreground' : 'text-orange-600 dark:text-orange-400'}`}>
                        {receipt.seen ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {receipt.text}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Dépendances */}
              {showAll && <div className="space-y-3" data-tour="item-relations">
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
                        <Select value={newRelationType} onChange={(e) => setNewRelationType(e.target.value as OfficialRelationType)}
                          options={RELATION_TYPE_LIST.map((m) => ({ value: m.id, label: `${m.label}...` }))} />
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
                    {item.relationsFrom?.map((relation: ItemRelation & { toItem?: { id: string; title: string; type: string; status?: string | null } }) => {
                      const typeLabel = getRelationMeta(relation.type).label;
                      const typeClass = getRelationMeta(relation.type).badgeClass;
                      const openModal = canEdit ? () => { setEditingRelationId(relation.id); setEditingRelationMeta({ source: { title: item.title, status: item.status }, target: { title: relation.toItem?.title || '', status: relation.toItem?.status }, type: relation.type, label: relation.label || '' }); } : undefined;
                      return (
                        <div key={relation.id}
                          className={`px-3 py-2 bg-card border border-border rounded-lg text-sm flex items-center gap-2 ${canEdit ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
                          onClick={openModal}
                        >
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${typeClass}`}>{typeLabel}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{relation.toItem?.title || 'Élément inconnu'}</span>
                        </div>
                      );
                    })}
                    {item.relationsTo?.map((relation: ItemRelation & { fromItem?: { id: string; title: string; type: string; status?: string | null } }) => {
                      const typeLabel = getRelationMeta(relation.type).inverseLabel;
                      const typeClass = getRelationMeta(relation.type).inverseBadgeClass;
                      const openModal = canEdit ? () => { setEditingRelationId(relation.id); setEditingRelationMeta({ source: { title: relation.fromItem?.title || '', status: relation.fromItem?.status }, target: { title: item.title, status: item.status }, type: relation.type, label: relation.label || '' }); } : undefined;
                      return (
                        <div key={relation.id}
                          className={`px-3 py-2 bg-card border border-border rounded-lg text-sm flex items-center gap-2 ${canEdit ? 'cursor-pointer hover:bg-muted transition-colors' : ''}`}
                          onClick={openModal}
                        >
                          <span className="truncate">{relation.fromItem?.title || 'Élément inconnu'}</span>
                          <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${typeClass}`}>{typeLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune dépendance</p>
                )}
              </div>}

              {/* Tags — sous le toggle « Plus de champs » */}
              {showAll && (
              <div className="space-y-3" data-tour="item-tags">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <TagIcon className="w-4 h-4" />
                  Tags
                </h2>
                {canEditTags ? (
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
              )}

              {/* Children items */}
              {showAll && item && (() => {
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
            {canEditTags && (
              <Button type="submit" disabled={!hasChanges || updateMutation.isPending}
                className={`bg-orange-500 text-white hover:bg-orange-600 ${!hasChanges ? 'opacity-40' : ''}`}>
                {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            )}
            <Button type="button" variant="bordered" onClick={() => guardClose(onClose)}>
              {canEdit ? 'Fermer' : 'Fermer'}
            </Button>
            {itemId && liveActions(itemId).map((a) => (
              <Button key={a.id} type="button" variant="bordered" onClick={a.onClick}>
                <a.icon className="w-4 h-4 mr-1" />{a.label}
              </Button>
            ))}
            {item && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Imprimer"
                  onClick={printSheet}
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
                <HelpHint text={itemHints?.[sheetCopied ? 'copySheetDone' : 'copySheet']}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Copier la fiche"
                  onClick={copySheet}
                >
                  {sheetCopied ? <Check className="w-4 h-4 text-green-600" /> : <ClipboardCopy className="w-4 h-4" />}
                </Button>
                </HelpHint>
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
                {onAbsorbChildren && allItems.some(i => i.parentId === itemId) && (
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
                {/* Personnel : la modale se ferme, sinon l'item serait aussitôt re-marqué lu */}
                <Button type="button" variant="ghost" size="sm" title="Marquer comme non lu"
                  onClick={() => { void markItemUnread(itemId); onClose(); }}>
                  <EyeOff className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" title="Enregistrer comme modèle"
                  onClick={() => setShowSaveAsTemplateModal(true)}>
                  <LayoutTemplate className="w-4 h-4" />
                </Button>
                <Button type="button" variant="ghost" size="sm" title="Ajouter une structure"
                  onClick={() => setShowInsertTemplateModal(true)}>
                  <ListTree className="w-4 h-4" />
                </Button>
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
          </>)}
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
      {pendingCascade && createPortal(
        <CascadeShiftConfirmModal
          anchorTitle={item?.title || ''}
          deltaDays={pendingCascade.deltaDays}
          dependents={pendingCascade.dependents}
          descendants={pendingCascade.descendants}
          onConfirm={(includeDescendants) => confirmCascade(includeDescendants)}
          onCancel={skipCascade}
        />,
        document.body
      )}

      {/* Relation edit modal */}
      {/* Relation edit modal — modale partagée (MindMap, PERT, Gantt, Process), au-dessus de la fiche (z-[200]) */}
      {editingRelationId && editingRelationMeta && createPortal(
        <div className="relative z-[200]">
          <RelationEditDialog
            key={editingRelationId}
            source={editingRelationMeta.source}
            target={editingRelationMeta.target}
            statusOptions={referentiels?.statuses}
            type={editingRelationMeta.type}
            label={editingRelationMeta.label}
            onSave={(type, label) => updateRelationMutation.mutate({ relationId: editingRelationId, data: { type, label: label || null } })}
            onDelete={() => { setEditingRelationId(null); handleDeleteRelation(editingRelationId); }}
            onCancel={() => setEditingRelationId(null)}
          />
        </div>,
        document.body
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
      {itemId && (
        <SaveAsTemplateModal
          key={`save-tpl-${itemId}`}
          isOpen={showSaveAsTemplateModal}
          onClose={() => setShowSaveAsTemplateModal(false)}
          itemId={itemId}
          allItems={allItems}
        />
      )}
      {itemId && (
        <InsertTemplateModal
          key={`insert-tpl-${itemId}`}
          isOpen={showInsertTemplateModal}
          onClose={() => setShowInsertTemplateModal(false)}
          spaceId={spaceId}
          allItems={allItems}
          defaultParentId={itemId}
          onCreated={(rootId) => onNavigate?.(rootId)}
        />
      )}
    </Modal>
    <UnsavedChangesGuard hasChanges={hasChanges} onConfirmLeave={onClose} />
    {ConfirmDialog}
    </>
  );
}
