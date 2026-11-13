/**
 * ItemEditModal — Modale d'édition complète d'un item.
 * Affiche et permet de modifier tous les champs : titre, type, description, statut, priorité,
 * assignation, tags, dates (début/fin/échéance), contenus, relations, contributions (thread).
 * Toggle "Jours pleins / Heures" contrôle l'affichage des sélecteurs H:MM via allDay state. Type daté à l'heure près et
 * durée proposée à la fin : registre des types (timed, defaultDuration), jamais de test de type en dur. Choix du statut
 * (pickStatus) : règles de dates partagées avec Kanban / menu ⋯ (lib/statusChange.ts) — fin pré-remplie si le statut
 * ferme l'élément, début pré-rempli, « Non défini » efface les deux.
 * Les dates sont lues/écrites en heure locale via toDatetimeLocal() — ne jamais utiliser toISOString() pour afficher.
 * Fiche réduite ou complète, dans tous les modes d'interface : réduite = Titre + Description (hauteur adaptée au
 * contenu, 240px min / 40vh max, pour que les contributions restent visibles juste dessous) + blocs media +
 * Réactions/Contributions ; le bouton « Plus de champs / Moins de champs » (expanded → showAll), toujours affiché,
 * révèle Type/Statut/Priorité/Dates/Assigné/Dépendances/Parent/Enfants en layout 3 colonnes. Tags (tagsSection)
 * toujours visibles (2026-11-11) : fiche réduite au-dessus de la Description, fiche complète en colonne droite. Une fois réduite,
 * une ligne de résumé cliquable (buildForumSummary) sous le titre liste les champs avancés renseignés.
 * Défaut à l'ouverture : réduite en Forum et Loisirs, complète en Projet / Tous (décision Thomas 2026-10-22), non mémorisé.
 * Fiche réduite (2026-10-29) : rangée des types « avec contenu » (CONTENT_TYPES : Non défini, Note, Lien, Document, Image,
 * Schéma, Article) au-dessus de la Description. Les types de pilotage, dates, priorité et statut restent dans la fiche
 * complète ; un élément d'un tel type voit son type, non modifiable ici.
 * Zone « Contenus » (contenus multiples, lot 2, 2026-11-08) : ItemContentsSection sous la Description (mediaSection),
 * quel que soit le type, masquée sur un Article — images, fichiers, liens, schémas, plusieurs par sorte, écrits tout
 * de suite (hooks/useItemContents), hors « Enregistrer ». Le formulaire n'envoie ni url ni content.xml (plus de champ
 * url depuis le lot 4 : un média est toujours un contenu).
 * Mode Composer d'un article (décision Thomas 2026-11-06) : troisième choix du sélecteur, si article.canEditArticle.
 * Grisé si la fiche n'est pas enregistrée en ARTICLE (hint openArticleUnsaved, aussi affiché en phrase visible dans le
 * formulaire, et seul pour un élément en création) ou a des modifications non enregistrées. Sans droit, un
 * ?mode=composition retombe sur Afficher.
 * Modes (sélecteur Afficher / Modifier dans l'en-tête, « Fiche » sans droit d'édition) : readMode → ItemReadView
 * (fiche en document, même contenu que « Copier la fiche », pied réduit à Fermer) ; sinon le formulaire ci-dessous.
 * Mode initial : prop initialMode (menu Afficher / Ouvrir, ?mode=lecture), défaut lecture si !canEdit (itemOpenMode.ts).
 * Afficher est bloqué tant qu'il y a des modifications non enregistrées (la lecture montre la version enregistrée).
 * Plus de bouton admin « Voir comme visiteur » (retiré 2026-10-23, décision Thomas) : un visiteur ouvre la fiche en
 * lecture, c'est donc « Afficher » qui montre ce qu'il voit — ne pas réintroduire un formulaire grisé.
 * Pied de page : Imprimer / Export PDF (itemExport.ts) et « Copier la fiche » (itemClipboard.ts, HTML + Markdown,
 * image/schéma intégrés ; infobulle HelpHint lue dans item-modal.help.ts → hints.copySheet) et « Copier la vignette »
 * (itemThumbnail.ts, image PNG de la carte ; aussi dans le mode Afficher — hints.copyThumbnail).
 * Save explicite (2026-10-28) : « Enregistrer et quitter » (orange vif, submit — Entrée dans un champ) ferme après succès,
 * « Enregistrer » (orange clair, Ctrl+S) garde la fiche ouverte (closeAfterSaveRef lu par updateMutation.onSuccess), avec verrou
 * optimiste (updatedAt). « Fermer » avec des modifications : confirmation useUnsavedGuard à trois choix (Rester / Quitter sans
 * enregistrer / Enregistrer et quitter = doSubmit(true), proposé seulement si canEditTags ; hints.unsavedLeave / unsavedSaveAndLeave).
 * Focus à l'ouverture : titre seulement si l'item n'a pas encore de titre (création
 * via « Nouveau ») ; item existant → focus sur la modale (useDialogFocus), une frappe ne modifie rien.
 * Accusé de lecture à l'assignation sous « Assigné à » (assignmentReceipt de l'API) : « Vu par X le … » ou
 * « Pas encore vu », seulement pour l'assigné enregistré. Écritures directes hors Enregistrer (contenus : envoi, lien,
 * schéma auto-sauvé…) : toujours suivies d'une relecture de la fiche (useItemContents), sinon faux 409.
 * Fraîcheur : la fiche ['item', spaceId, itemId] est TOUJOURS relue à l'ouverture (staleTime 0) et
 * chaque version plus récente (updatedAt) est fusionnée champ par champ dans le formulaire
 * (mergeFormWithServer) — les vues modifient l'item sans invalider cette clé.
 * Sous-modales keyées par itemId (remontage = reset de leur state d'un item à l'autre) : chaque clé
 * doit rester préfixée et unique parmi les enfants de <Modal> (deux `key={itemId}` frères = warning
 * React « two children with the same key » à chaque rendu, bug corrigé le 2026-09-27).
 * Assigné : menu des membres + saisie libre (assignedToName, personne sans compte, sans droit ni notification ; exclusif avec
 * assignedToId, garanti par l'API).
 * Relations : cible choisie par ItemSearchPicker (cet espace, communauté, tous mes espaces — droits appliqués par l'API).
 * Zones data-devzone item-* : vocabulaire de DevZoneInspector et du mode Aide (textes : help/shellZones.ts).
 * Aide par section (2026-11-12) : chaque section porte son « ? » (ElementHelp, élément de item-modal.help.ts de même
 * clé) ; le « ? » de l'en-tête est compact (résumé, tutoriel, mode Aide, sans liste). Section ajoutée = son « ? ».
 * Copie de séance live (lockedAt) : lecture seule sauf tags (canEditTags) et contributions ; bandeau d'origine ;
 * l'enregistrement n'envoie alors que tagIds (l'API refuse tout autre champ, cf. utils/itemLock.ts).
 * Pied : boutons « Ajouter à la préparation » / « Présenter en séance » si la séance live active le permet (liveItemActions) ;
 * le premier est grisé (« Déjà dans la préparation de … ») quand l'élément y est, d'après le cache de la séance (useLiveSession).
 * Contributions affichées via sanitizeHtml (règle user-html-sanitized) ; liens des contenus : ItemContentsSection (safeHref).
 * Zone de contribution (ouverte, réponse en cours, texte, vote) remise à zéro à chaque changement d'item (effet sur itemId).
 * Vote de chaque contribution (2026-11-12, règle contribution-vote-kept) : le vote qui ouvre le champ (onReacted de la barre
 * de l'élément ou de la contribution répondue) est gardé dans contributionVote, affiché « Votre vote : … » au-dessus du
 * champ, envoyé à la création (reactionType) puis affiché après l'auteur (ContributionVoteBadge). Jamais modifié ensuite.
 * Historique (2026-11-12, règle item-history-members) : ItemHistorySection sous les contributions, fiche réduite ou
 * complète, pour toute personne connectée (pas le visiteur anonyme) ; hints.historyToggle / historyEmpty.
 * Brouillon (2026-11-12, règle item-draft-local, lib/itemDraft.ts) : saisie non enregistrée (champs si canEditTags,
 * contribution en cours) copiée dans le navigateur 1 s après la dernière frappe ; à l'ouverture, ItemDraftBanner propose
 * Reprendre / Ignorer si elle diffère de l'enregistré. Effacé après enregistrement réussi, contribution envoyée,
 * « Quitter sans enregistrer » (bouton Fermer) ou Ignorer ; croix / Échap / clic à côté le GARDENT (rien n'y est confirmé).
 * Panneau compact (2026-11-13, réorganisation, lot 4) : dates résumées sur une ligne (datesOpen, dépliées au clic, repliées à
 * chaque élément) ; aides des champs du panneau en rappel au survol du libellé (itemFields) au lieu de texte sous le champ ;
 * fiche complète sur grand écran : colonne principale et panneau défilent séparément.
 * Deux colonnes (2026-11-13, réorganisation, lot 3) : colonne principale commune (sélecteur de type « contenu » en fiche
 * réduite, Tags, Description, Contenus, Contributions, Historique en fiche réduite) ; fiche complète = + panneau Pilotage
 * (data-devzone item-pilotage) : Type, Statut, Priorité, Dates, Assigné, Parent, Références, Dépendances, Enfants,
 * Historique. L'identifiant n'est plus affiché : « Copier l'identifiant » dans le menu Actions.
 * En-tête commun (2026-11-13, réorganisation, lot 2) : chemin + auteur·date / icône du type + titre (champ en Modifier, titre
 * en Afficher et Composer — ItemReadView hideTitle) / modes, Plus de champs (HelpHint moreFields / lessFields), un seul « ? »
 * (HelpButton compact : aide et tutoriel). Plus de « ? » de section pour les modes et Plus de champs.
 * Pied commun (2026-11-13, réorganisation de la fiche, lot 1) : Modifier, Afficher et Composer ont le même pied — à gauche
 * Enregistrer et quitter / Enregistrer (Modifier seulement), Fermer, boutons de séance ; à droite statut de copie, « ? » et menu
 * « Actions » (ItemActionMenu + itemSheetActions.ts : partage, organisation, structure, Supprimer). Plus d'icônes à côté du
 * titre en mode Afficher.
 * Références externes (2026-11-12, règle item-external-refs) : externalRefsText, une ligne « Appli : Réf | … » (ExternalRefsField),
 * comprise dans hasChanges, la fusion serveur et le brouillon ; envoyée découpée (splitExternalRefs) par doSubmit si elle a changé.
 * Visiteur anonyme (lecture seule, spec « Sécurité & Accès ») : réactions en compteurs seuls (ReactionBar readOnly),
 * pas d'enregistrement « vu » (markViewed) à l'ouverture.
 * Type ARTICLE : en mode « Afficher », les blocs sont lus dans la fiche (ArticleReadBlocks) et Imprimer sort l'article
 * complet (printArticle) ; la lecture en pleine page (ArticlePage) s'ouvre depuis la vue Articles ou le menu ⋮.
 * Brouillon vide (2026-10-28) : un élément tout juste créé par l'utilisateur (isFreshDraft) et vide à l'ouverture,
 * refermé sans enregistrement (closeWithoutSaving) alors qu'il est toujours vide (isItemEmpty), est supprimé —
 * lib/emptyNewItem.ts, règle empty-new-item-discarded. Ne jamais brancher une fermeture après enregistrement dessus.
 * Type QUESTION (2026-11-08) : bloc QuestionPanel (réponses, votes, issue) au-dessus de la zone Contenus et en mode Afficher ;
 * Statut (2026-11-11) = QuestionStatusField, ses 4 statuts réservés appliqués tout de suite (issue), hors « Enregistrer ».
 * Statuts proposés aux autres types : statusesForType (sans les issues réservées) ; un statut devenu non permis par un
 * changement de type est remis à « Non défini ».
 * Types à composants (groupe « Compositions » : Article, Question — isComposedType, 2026-11-11) : choisir un de ces types
 * enregistre aussitôt le type seul, fiche ouverte, pour afficher ses composants (règle composed-type-autosave).
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RELATION_TYPE_LIST, getRelationMeta, type OfficialRelationType } from '../constants/relationTypes';
import { assignmentReceiptLabel } from '../lib/assignmentReceipt';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, spacesApi, bookmarksApi, activityApi, isConflictError } from '../lib/api';
import type { Item, ItemType, ContributionWithAuthor, ItemRelation, SpaceReferentiels, Tag, TypeLabelConfig } from '@spok/shared';
import { ConflictDialog } from './ConflictDialog';
import { ItemSearchPicker } from './ItemSearchPicker';
import { buildLiveItemActions } from '../lib/liveItemActions';
import { useLiveSession } from '../hooks/useLiveSession';
import { useActiveLiveSessionStore } from '../stores/activeLiveSession';
import { ConfirmModal } from './ConfirmModal';
import { DEFAULT_REFERENTIELS, getItemTypeDef, isComposedType, statusAllowedForType, statusesForType } from '@spok/shared';
import { statusChangeFields } from '../lib/statusChange';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { PenLine, ArrowDownAZ, GitBranch, MessageSquarePlus, Trash2, Pencil, User, X, Link2, ArrowRight, Plus, ChevronRight, ChevronDown, ChevronUp, Home, Tag as TagIcon, Building2, Eye, EyeOff, BookOpen } from 'lucide-react';
import { ItemReadView } from './ItemReadView';
import { ArticleReadBlocks } from './article/ArticleReadBlocks';
import { QuestionPanel } from './question/QuestionPanel';
import { QuestionStatusField } from './question/QuestionStatusField';
import { ArticleEditor } from './article/ArticleEditor';
import { printArticle } from './article/printArticle';
import { useArticle } from '../hooks/useArticle';
import { sanitizeHtml } from '../lib/sanitizeHtml';
import { resolveItemMode, type ItemOpenMode } from '../lib/itemOpenMode';
import { Link } from 'react-router-dom';
import { TagSelector } from './ui/TagSelector';
import { ReactionBar } from './ReactionBar';
import { ContributionVoteBadge } from './ContributionVoteBadge';
import { ItemHistorySection } from './ItemHistorySection';
import { ItemDraftBanner } from './ItemDraftBanner';
import { ItemActionMenu } from './ui/ItemActionMenu';
import { buildSheetActionGroups } from './itemSheetActions';
import { ExternalRefsInput, ExternalRefsList } from './ExternalRefsField';
import { formatExternalRefs, splitExternalRefs } from '@spok/shared';
import { saveItemDraft, loadItemDraft, clearItemDraft, purgeExpiredItemDrafts, draftHasChanges, type ItemDraft, type ItemDraftFields } from '../lib/itemDraft';
import { HelpButton } from '../help/HelpButton';
import { PAGE_HELP } from '../help/pageHelp';
import { HelpHint } from '../help/HelpHint';
import { FieldHelp } from '../help/FieldHelp';
import { ElementHelp } from '../help/ElementHelp';
import { usePageTourPulse } from '../hooks/useOnboarding';
import { TagBadge } from './ui/TagBadge';
import { RuleHint } from './ui/RuleHint';
import { TYPE_LABELS, TYPE_ICONS, STORAGE_KEYS, PRIORITIES, TYPE_GROUPS, CONTENT_TYPES } from '../constants/ui';
import { useAuthStore } from '../stores/auth';
import { useUnsavedGuard, UnsavedChangesGuard } from './ui/UnsavedChangesGuard';
import { useCtrlS } from '../hooks/useCtrlS';
import { RichTextEditor } from './ui/RichTextEditor';
import { ItemContentsSection } from './contents/ItemContentsSection';
import { DateTimeField } from './ui/DateTimeField';
import { TimeRangePicker } from './ui/TimeRangePicker';
import { diffMs, addHours, addDays, addMonths, toDatetimeLocal, fromDatetimeLocal } from '../lib/dateUtils';
import { computeCascadeDependents, computeCascadeDescendants, type CascadeDependent } from '../lib/cascadeShift';
import { CascadeShiftConfirmModal } from './CascadeShiftConfirmModal';
import { RelationEditDialog } from './relations/RelationEditDialog';
import type { RelationEnd } from './relations/RelationSentenceRow';
import { formatDate, formatDateTime } from '../lib/utils';
import { MEETING_DURATIONS, DUE_DATE_DURATIONS } from './item-edit-constants';
import { getDescendantIds, mergeFormWithServer, tagKey, buildForumSummary } from './item-edit-helpers';
import { printItem, exportItemPDF } from '../lib/itemExport';
import { buildItemSheet, copyItemSheet } from '../lib/itemClipboard';
import { buildItemThumbnail, copyItemThumbnail } from '../lib/itemThumbnail';
import { MoveToSpaceModal } from './MoveToSpaceModal';
import { DuplicateToSpaceModal } from './DuplicateToSpaceModal';
import { SaveAsTemplateModal } from './SaveAsTemplateModal';
import { InsertTemplateModal } from './InsertTemplateModal';
import { hasHeadings, markItemUnread } from '../lib/itemMenuGroups';
import { useInterfaceModeStore } from '../stores/interfaceMode';
import { isFreshDraft, isItemEmpty } from '../lib/emptyNewItem';

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

/** Champs du formulaire tirés d'un élément enregistré (dates en datetime-local, heure locale) — base du formulaire et
 *  du brouillon (lib/itemDraft.ts) */
function itemFormFields(it: Item): ItemDraftFields {
  return {
    title: it.title,
    description: it.description || '',
    parentId: it.parentId || '',
    status: it.status || '',
    priority: it.priority ?? null,
    assignedToId: it.assignedToId || '',
    assignedToName: it.assignedToName || '',
    type: it.type as string,
    dueDate: it.dueDate ? toDatetimeLocal(new Date(it.dueDate)) : '',
    startDate: it.startDate ? toDatetimeLocal(new Date(it.startDate)) : '',
    endDate: it.endDate ? toDatetimeLocal(new Date(it.endDate)) : '',
    tagIds: it.tags?.map((t: Tag) => t.id) || [],
    externalRefs: formatExternalRefs(it.externalRefs),
  };
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
  const { pulseHelp: itemPulse, startTour: startItemTour } = usePageTourPulse('item-modal', PAGE_HELP['item-modal'].tour);
  const { mode: interfaceMode } = useInterfaceModeStore();
  // Fiche réduite (titre + description + médias + contributions) ou complète, dans tous les modes, via le bouton
  // « Plus de champs / Moins de champs ». Défaut à l'ouverture : réduite en Forum et Loisirs, complète en Projet / Tous.
  // Non mémorisé : chaque fiche ouverte (ou changement de mode) repart du défaut.
  const collapsedByDefault = interfaceMode === 'forum' || interfaceMode === 'loisirs';
  const [expanded, setExpanded] = useState(!collapsedByDefault);
  const [sheetCopied, setSheetCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  // Dates du panneau Pilotage : résumé sur une ligne, dépliées au clic (réorganisation, lot 4) ; repliées à chaque élément
  const [datesOpen, setDatesOpen] = useState(false);
  useEffect(() => { setDatesOpen(false); }, [itemId]);
  const [thumbnailState, setThumbnailState] = useState<'idle' | 'busy' | 'copied' | 'downloaded' | 'error'>('idle');
  // Mode Afficher (ItemReadView), Modifier / Fiche ou Composer : fixé à chaque ouverture, conservé en naviguant d'item en item
  const [displayMode, setDisplayMode] = useState<ItemOpenMode>('edit');
  useEffect(() => {
    if (isOpen) setDisplayMode(itemId ? resolveItemMode(initialMode, canEditProp) : 'edit');
  }, [isOpen, initialMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [status, setStatus] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [assignedToName, setAssignedToName] = useState(''); // saisie libre : personne sans compte SPOK
  // Références externes, en ligne « Appli1 : Réf1 | appli2 : réf2 » (règle item-external-refs), découpées à l'enregistrement
  const [externalRefsText, setExternalRefsText] = useState('');
  const [type, setType] = useState<ItemType>('UNDEFINED');
  // Statut non permis pour le nouveau type (issue d'une question sur un autre type, ou l'inverse) : remis à « Non
  // défini » — une question enregistrée sans statut repart « Ouverte » (API, utils/question.ts)
  // Type à composants (Question…) : enregistré tout de suite, l'API fixe le statut — la relecture le reporte ici
  useEffect(() => {
    if (!statusAllowedForType(status, type) && !isComposedType(type)) setStatus('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Choix d'un statut : mêmes règles de dates que Kanban / menu ⋯ (lib/statusChange.ts) — « Non défini » efface
  // début et fin, un statut qui ferme remplit la fin vide, tout statut remplit le début vide
  const pickStatus = (picked: string) => {
    const toIso = (local: string) => (local ? fromDatetimeLocal(local).toISOString() : null);
    const toLocal = (iso: string | null) => (iso ? toDatetimeLocal(new Date(iso)) : '');
    const fields = statusChangeFields(picked, { startDate: toIso(startDate), endDate: toIso(endDate) }, referentiels?.statuses);
    setStatus(fields.status ?? '');
    if (fields.startDate !== undefined) setStartDate(toLocal(fields.startDate));
    if (fields.endDate !== undefined) setEndDate(toLocal(fields.endDate));
  };
  const [allDay, setAllDay] = useState(true);
  const [priority, setPriority] = useState<number | null>(null);
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
  // Vote qui a ouvert le champ de contribution (réaction sur l'élément ou sur la contribution répondue), envoyé avec
  // la contribution et figé sur elle (règle contribution-vote-kept)
  const [contributionVote, setContributionVote] = useState<string | null>(null);
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
  const [newRelationTargetTitle, setNewRelationTargetTitle] = useState('');
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
  // Préparation de la séance active (cache partagé, sans flux) : bouton grisé si l'élément y est déjà
  const { state: liveState } = useLiveSession(liveInfo ? liveSpaceId ?? undefined : undefined);
  const liveActions = (id: string) =>
    buildLiveItemActions(id, liveInfo, liveSpaceId, !!liveState?.agenda.some((a) => a.sourceItemId === id));
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
  // Élément vide tout juste créé (« Nouveau »…) : supprimé s'il est refermé sans contenu (lib/emptyNewItem.ts)
  const draftItemIdRef = useRef<string | null>(null);
  // Enregistrement en cours : fermer la fiche après succès (« Enregistrer et quitter ») ou non (« Enregistrer », Ctrl+S)
  const closeAfterSaveRef = useRef(true);
  // Brouillon gardé dans le navigateur (règle item-draft-local) : brouillon retrouvé en attente de décision,
  // écriture différée en cours, élément déjà vérifié à cette ouverture
  const [pendingDraft, setPendingDraft] = useState<ItemDraft | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const draftCheckedRef = useRef<string | null>(null);
  const clearDraft = useCallback(() => {
    clearTimeout(draftTimerRef.current);
    if (user && itemId) clearItemDraft(user.id, itemId);
  }, [user, itemId]);

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
    setContributionVote(null);
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
    // Premier chargement de CET item : brouillon vide tout juste créé par moi → supprimable à la fermeture
    if (loadedItemRef.current?.id !== item.id) {
      draftItemIdRef.current = isFreshDraft(item, user?.id, Date.now()) && isItemEmpty(item as any, allItems.filter(i => i.parentId === item.id).length)
        ? item.id : null;
    }
    initializedItemIdRef.current = initKey;

    const toForm = (it: NonNullable<typeof item>) => {
      const { tagIds, ...fields } = itemFormFields(it as Item);
      return { ...fields, tags: tagKey(tagIds) };
    };
    const base = loadedItemRef.current?.id === item.id ? toForm(loadedItemRef.current) : null;
    loadedItemRef.current = item;
    const next = toForm(item);
    const merged = mergeFormWithServer(
      { title, description, parentId, status, priority, assignedToId, assignedToName, type: type as string, dueDate, startDate, endDate, externalRefs: externalRefsText, tags: tagKey(selectedTagIds) },
      base,
      next,
    );

    setTitle(merged.title);
    setDescription(merged.description);
    setParentId(merged.parentId);
    setStatus(merged.status);
    setPriority(merged.priority);
    setAssignedToId(merged.assignedToId);
    setAssignedToName(merged.assignedToName);
    if (!base || merged.type !== type) {
      setType(merged.type as ItemType);
      setAllDay(!getItemTypeDef(merged.type)?.timed);
    }
    setDueDate(merged.dueDate);
    setStartDate(merged.startDate);
    setEndDate(merged.endDate);
    setExternalRefsText(merged.externalRefs ?? '');
    const serverTagIds = item.tags?.map((t: Tag) => t.id) || [];
    if (merged.tags === next.tags) setSelectedTagIds(serverTagIds);
    setOriginalTagIds(serverTagIds);
  }, [item]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateMutation = useMutation({
    mutationFn: (data: { type?: ItemType; title?: string; description?: string | null; url?: string | null; parentId?: string | null; status?: string | null; assignedToId?: string | null; assignedToName?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; updatedAt?: string }) =>
      itemsApi.update(spaceId, itemId!, data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['items', spaceId] }),
        queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] }),
      ]);
      setConflictData(null);
      clearDraft();
      // « Enregistrer et quitter » ferme ; « Enregistrer » (et Ctrl+S) laisse la fiche ouverte, resynchronisée par la relecture
      if (closeAfterSaveRef.current) onClose();
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

  // Écritures directes hors « Enregistrer » (contenus) : useItemContents relit la fiche après chacune — sans quoi
  // « Enregistrer » renverrait l'ancien updatedAt → 409 « conflit » contre sa propre modification (bug 2026-09-28).
  // La relecture est fusionnée champ par champ (mergeFormWithServer) : la saisie en cours est conservée.

  const createContributionMutation = useMutation({
    mutationFn: (data: { content: string; parentId?: string; reactionType?: string }) =>
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
      setContributionVote(null);
      clearDraft();
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
        // Durée proposée selon le type : registre des types (defaultDuration)
        const duration = getItemTypeDef(type)?.defaultDuration;
        if (duration === 'hour') setEndDate(toDatetimeLocal(addHours(start, 1)));
        else if (duration === 'month') setEndDate(toDatetimeLocal(addMonths(start, 1)));
        else if (duration === 'day') setEndDate(toDatetimeLocal(addDays(start, 1)));
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
      createContributionMutation.mutate({ content: newContribution, parentId: replyToContributionId || undefined, reactionType: contributionVote ?? undefined });
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
    if ((parentId || null) !== item.parentId) return true;
    if (status !== (item.status || '')) return true;
    if (priority !== (item.priority ?? null)) return true;
    if ((assignedToId || null) !== (item.assignedToId || null)) return true;
    if ((assignedToName.trim() || null) !== (item.assignedToName || null)) return true;
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
    // Références externes : comparées découpées et normalisées (espaces, doublons ne comptent pas)
    if (formatExternalRefs(splitExternalRefs(externalRefsText)) !== formatExternalRefs(item.externalRefs)) return true;
    return false;
  }, [item, type, title, description, parentId, status, priority, assignedToId, assignedToName, dueDate, startDate, endDate, selectedTagIds, originalTagIds, externalRefsText]);

  // Confirmation de fermeture : « Enregistrer et quitter » seulement si l'utilisateur peut enregistrer (mêmes droits
  // que les boutons du pied) ; doSubmit(true) ferme après succès, garde la fiche ouverte sur conflit.
  const unsavedHints = PAGE_HELP['item-modal'].hints;
  const { guard: guardClose, ConfirmDialog } = useUnsavedGuard(hasChanges, {
    onSaveAndLeave: item && canEditTags ? () => doSubmit(true) : undefined,
    hints: { leave: unsavedHints?.unsavedLeave, saveAndLeave: unsavedHints?.unsavedSaveAndLeave },
  });

  // Brouillon : à l'ouverture de la fiche, proposer une saisie retrouvée qui diffère de l'enregistré
  useEffect(() => {
    if (!isOpen) { draftCheckedRef.current = null; setPendingDraft(null); return; }
    if (!item || !user || draftCheckedRef.current === item.id) return;
    draftCheckedRef.current = item.id;
    purgeExpiredItemDrafts();
    const draft = loadItemDraft(user.id, item.id);
    if (!draft || !draftHasChanges(draft, itemFormFields(item as Item))) {
      if (draft) clearItemDraft(user.id, item.id);
      setPendingDraft(null);
      return;
    }
    const usable = (draft.fields && canEditTags) || (draft.contribution && canInteract);
    setPendingDraft(usable ? draft : null);
  }, [isOpen, item?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Brouillon : saisie non enregistrée copiée dans le navigateur une seconde après la dernière frappe. Une nouvelle
  // saisie alors qu'un brouillon attend une décision le remplace (le bandeau disparaît).
  const contributionDirty = showContributionField && !isContributionEmpty(newContribution);
  useEffect(() => {
    if (!item || !user) return;
    const fieldsDirty = hasChanges && canEditTags;
    if (!fieldsDirty && !contributionDirty) return;
    if (pendingDraft) setPendingDraft(null);
    const timer = setTimeout(() => saveItemDraft(user.id, item.id, {
      savedAt: Date.now(),
      baseUpdatedAt: loadedItemRef.current?.updatedAt ?? null,
      fields: fieldsDirty ? { title, description, parentId, status, priority, assignedToId, assignedToName, type, dueDate, startDate, endDate, tagIds: selectedTagIds, externalRefs: externalRefsText } : undefined,
      contribution: contributionDirty ? { text: newContribution, vote: contributionVote, replyTo: replyToContributionId } : undefined,
    }), 1000);
    draftTimerRef.current = timer;
    return () => clearTimeout(timer);
  }, [item?.id, user?.id, hasChanges, canEditTags, contributionDirty, title, description, parentId, status, priority, assignedToId, assignedToName, type, dueDate, startDate, endDate, selectedTagIds, externalRefsText, newContribution, contributionVote, replyToContributionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // « Reprendre » : la saisie retrouvée remplace le formulaire (à enregistrer ensuite comme d'habitude)
  const resumeDraft = () => {
    const draft = pendingDraft;
    if (!draft) return;
    if (draft.fields && canEditTags) {
      const f = draft.fields;
      setTitle(f.title); setDescription(f.description); setParentId(f.parentId); setStatus(f.status); setPriority(f.priority);
      setAssignedToId(f.assignedToId); setAssignedToName(f.assignedToName);
      setType(f.type as ItemType); setAllDay(!getItemTypeDef(f.type)?.timed);
      setDueDate(f.dueDate); setStartDate(f.startDate); setEndDate(f.endDate); setSelectedTagIds(f.tagIds);
      if (f.externalRefs !== undefined) setExternalRefsText(f.externalRefs);
      setExpanded(true);
    }
    if (draft.contribution && canInteract) {
      const c = draft.contribution;
      const replyExists = !!c.replyTo && !!item?.contributions?.some((x: { id: string }) => x.id === c.replyTo);
      setReplyToContributionId(replyExists ? c.replyTo : null);
      setContributionVote(c.vote);
      setNewContribution(c.text);
      setShowContributionField(true);
    }
    setPendingDraft(null);
  };
  const discardDraft = () => { clearDraft(); setPendingDraft(null); };

  // Fermeture SANS enregistrement (croix, Échap, clic à côté, Fermer / Quitter sans enregistrer) : un brouillon resté
  // vide côté serveur est supprimé — la création l'avait écrit en base avant d'ouvrir la fiche. Les fermetures après
  // enregistrement appellent onClose directement et ne passent pas ici.
  const closeWithoutSaving = useCallback(() => {
    if (item && draftItemIdRef.current === item.id && isItemEmpty(item as any, allItems.filter(i => i.parentId === item.id).length)) {
      const draftSpaceId = item.spaceId ?? spaceId;
      draftItemIdRef.current = null;
      itemsApi.delete(draftSpaceId, item.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['items', draftSpaceId] });
          queryClient.invalidateQueries({ queryKey: ['space', draftSpaceId] });
        })
        .catch(() => { /* suppression impossible : l'élément vide reste, rien d'autre à faire */ });
    }
    onClose();
  }, [item, allItems, spaceId, queryClient, onClose]);

  const doSubmit = (closeAfter = true) => {
    if (!item) return;
    closeAfterSaveRef.current = closeAfter;
    const closeIfAsked = () => { if (closeAfter) onClose(); };

    const updates: { type?: ItemType; title?: string; description?: string | null; content?: Record<string, unknown>; url?: string | null; parentId?: string | null; status?: string | null; priority?: number | null; assignedToId?: string | null; assignedToName?: string | null; dueDate?: string | null; startDate?: string | null; endDate?: string | null; tagIds?: string[]; externalRefs?: string[]; updatedAt?: string } = {};

    // Include updatedAt for optimistic locking
    updates.updatedAt = item.updatedAt;

    // Copie de séance : seuls les tags sont modifiables
    if (isLockedCopy) {
      const tagsChanged = [...selectedTagIds].sort().join() !== [...originalTagIds].sort().join();
      if (tagsChanged) {
        const tagUpdate = { updatedAt: item.updatedAt, tagIds: selectedTagIds };
        updateMutation.mutate(tagUpdate);
      } else {
        closeIfAsked();
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

    // Les médias ne partent pas d'ici : les contenus s'écrivent tout de suite (ItemContentsSection).

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
    const newAssignedToName = assignedToName.trim() || null;
    if (newAssignedToName !== (item.assignedToName || null)) {
      updates.assignedToName = newAssignedToName;
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

    // Références externes (règle item-external-refs) : liste complète envoyée si elle a changé
    const nextRefs = splitExternalRefs(externalRefsText);
    if (formatExternalRefs(nextRefs) !== formatExternalRefs(item.externalRefs)) {
      updates.externalRefs = nextRefs;
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
      closeIfAsked();
    }
  };

  // Type à composants choisi (groupe « Compositions » : Article, Question — isComposedType) : le type est enregistré
  // tout de suite, fiche ouverte, pour afficher ses composants (bloc Question, Composer). Seul le type part : les autres
  // saisies restent en attente d'« Enregistrer » (fusion champ par champ à la relecture). Règle composed-type-autosave.
  useEffect(() => {
    if (!item || !canEdit || isLockedCopy || updateMutation.isPending) return;
    if (type === item.type || !isComposedType(type)) return;
    closeAfterSaveRef.current = false;
    updateMutation.mutate({ type, updatedAt: item.updatedAt });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, item?.type]);

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

  // Envoi du formulaire (bouton « Enregistrer et quitter », Entrée dans un champ) : enregistre puis ferme
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSubmit(true);
  };

  // Ctrl+S = « Enregistrer » : la fiche reste ouverte (2026-10-28)
  useCtrlS(hasChanges && !updateMutation.isPending, () => doSubmit(false));

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

  // Article enregistré : ses blocs et le droit de les composer. Composer sans ce droit retombe sur Afficher.
  const savedArticle = item?.type === 'ARTICLE';
  const articleState = useArticle(savedArticle ? (item?.spaceId ?? spaceId) : undefined, savedArticle ? (itemId ?? undefined) : undefined);
  const canCompose = !!articleState.article?.canEditArticle;
  const composing = displayMode === 'compose' && canCompose;
  const readMode = displayMode === 'read' || (displayMode === 'compose' && !canCompose);
  const formMode = !readMode && !composing;
  const articlePrintRef = useRef<HTMLDivElement>(null);

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
  const itemHints = PAGE_HELP['item-modal'].hints;
  // Aides des champs du panneau : rappel au survol du libellé (lot 4), plus de texte sous chaque champ
  const itemFields = PAGE_HELP['item-modal'].fields;
  // « Copier la vignette » : image PNG de l'item (lib/itemThumbnail.ts) ; message visible si téléchargée ou en échec
  const copyThumbnail = async () => {
    setThumbnailState('busy');
    let next: 'copied' | 'downloaded' | 'error';
    try {
      next = await copyItemThumbnail(buildItemThumbnail(buildSheet(), type, item?.contents));
    } catch {
      next = 'error';
    }
    setThumbnailState(next);
    setTimeout(() => setThumbnailState('idle'), next === 'copied' ? 2000 : 6000);
  };
  const printSheet = () => {
    if (!item) return;
    if (item.type === 'ARTICLE' && articlePrintRef.current) {
      printArticle(articlePrintRef.current, item.title, { description: item.description });
      return;
    }
    printItem({ item: item as any, children: allItems.filter(i => i.parentId === item.id), spaceName });
  };

  // Menu « Actions » du pied (itemSheetActions.ts), le même dans Modifier, Afficher et Composer : mêmes conditions
  // que les anciennes icônes (réorganisation et suppression si canEdit, épingle si connecté)
  const sheetActionGroups = item && itemId ? buildSheetActionGroups({
    print: printSheet,
    exportPdf: () => exportItemPDF({ item: item as any, children: allItems.filter(i => i.parentId === item.id), spaceName }),
    copySheet,
    copyThumbnail,
    copyId: () => { void navigator.clipboard?.writeText(item.id).then(() => { setIdCopied(true); setTimeout(() => setIdCopied(false), 2000); }).catch(() => {}); },
    toggleBookmark: user ? toggleBookmark : undefined,
    markUnread: () => { void markItemUnread(itemId); onClose(); },
    duplicate: () => setShowDuplicateModal(true),
    move: () => setShowMoveModal(true),
    convertToSpace: onConvertToSpace ? () => { onConvertToSpace(itemId); onClose(); } : undefined,
    absorbChildren: onAbsorbChildren && allItems.some(i => i.parentId === itemId) ? () => { onAbsorbChildren(itemId); onClose(); } : undefined,
    splitDescription: onSplitDescription && hasHeadings(item.description) ? () => { onSplitDescription(itemId); onClose(); } : undefined,
    merge: onMerge ? () => { onMerge(itemId); onClose(); } : undefined,
    saveAsTemplate: () => setShowSaveAsTemplateModal(true),
    insertTemplate: () => setShowInsertTemplateModal(true),
    delete: onDelete ? () => { onDelete(itemId); onClose(); } : undefined,
  }, {
    canEdit,
    isBookmarked,
    thumbnailBusy: thumbnailState === 'busy',
    hints: {
      print: itemHints?.print, exportPdf: itemHints?.actionExportPdf, copyId: itemHints?.actionCopyId, copySheet: itemHints?.copySheet, copyThumbnail: itemHints?.copyThumbnail,
      bookmark: itemHints?.actionBookmark, markUnread: itemHints?.actionMarkUnread, duplicate: itemHints?.actionDuplicate,
      move: itemHints?.actionMove, convertToSpace: itemHints?.actionConvert, absorbChildren: itemHints?.actionAbsorb,
      splitDescription: itemHints?.actionSplit, merge: itemHints?.actionMerge, saveAsTemplate: itemHints?.actionSaveTemplate,
      insertTemplate: itemHints?.actionInsertTemplate, delete: itemHints?.actionDelete,
    },
  }) : [];
  // Retour d'une copie (fiche, vignette), affiché dans le pied : le menu s'est refermé
  const copyStatus = sheetCopied ? itemHints?.copySheetDone
    : idCopied ? itemHints?.copyIdDone
    : thumbnailState === 'copied' ? itemHints?.copyThumbnailDone
    : thumbnailState === 'downloaded' ? itemHints?.copyThumbnailDownloaded
    : thumbnailState === 'error' ? itemHints?.copyThumbnailError
    : undefined;
  const footerActions = (
    <div className="ml-auto flex items-center gap-2">
      {copyStatus && (
        <span role="status" className={`text-xs ${thumbnailState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{copyStatus}</span>
      )}
      <ElementHelp page="item-modal" element="actions" />
      {sheetActionGroups.length > 0 && (
        <ItemActionMenu groups={sheetActionGroups} tourId="item-actions-menu" triggerLabel="Actions de l'élément" triggerText="Actions"
          triggerClassName="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input text-sm hover:bg-accent transition-colors" />
      )}
    </div>
  );

  // Blocs sous la Description : phrase d'un Article non enregistré, bloc Question, puis zone Contenus (tout type sauf
  // Article). Fiche complète : rendus dans la colonne centrale. Fiche réduite (colonne centrale supprimée) :
  // rendus sous la Description dans la colonne principale.
  const mediaSection = (
    <>
      {/* Pas encore enregistré en Article (création, ou type changé sans enregistrer) : phrase visible, Composer grisé
          ne montre pas son infobulle */}
      {type === 'ARTICLE' && (!itemId || item?.type !== 'ARTICLE') && (
        <p className="text-xs text-muted-foreground">{itemHints?.openArticleUnsaved}</p>
      )}
      {/* Question : options, votes, issue (QuestionPanel) — seulement une fois enregistrée comme Question */}
      {type === 'QUESTION' && (itemId && item?.type === 'QUESTION'
        ? <QuestionPanel spaceId={item.spaceId ?? spaceId} itemId={itemId} />
        : <FieldHelp page="question" field="unsaved" />)}
      {/* Contenus : images, fichiers, liens, schémas, quel que soit le type — masqués sur un Article (ses blocs) */}
      {type !== 'ARTICLE' && (
        <ItemContentsSection spaceId={item?.spaceId ?? spaceId} itemId={itemId ?? undefined} contents={item?.contents}
          canEdit={canEdit} onTitleHint={autoFillTitle} />
      )}
    </>
  );

  // Tags — toujours visibles (décision Thomas 2026-11-11 : une anomalie est une Tâche taguée « bug », une
  // configuration une Note taguée « config ») : fiche réduite sous la ligne de type, fiche complète en colonne droite.
  const tagsSection = (
    <div className="space-y-3" data-tour="item-tags" data-devzone="item-tags">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <TagIcon className="w-4 h-4" />
        Tags
        <ElementHelp page="item-modal" element="tags" />
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
  );

  return (<>
    <Modal
      isOpen={isOpen}
      onClose={closeWithoutSaving}
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
          {/* En-tête commun (réorganisation, lot 2, 2026-11-13) — même structure dans Modifier, Afficher et Composer :
              1. chemin + auteur · date ; 2. icône du type + titre pleine largeur ; 3. modes, Plus de champs, un seul « ? » */}
          <div className="flex items-start gap-3 mb-2 px-1">
            {(communityName || spaceName || breadcrumb.length > 0) ? (
              <nav className="flex flex-1 min-w-0 items-center gap-1.5 text-sm text-muted-foreground flex-wrap" data-tour="item-breadcrumb" data-devzone="item-chemin">
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
            ) : <div className="flex-1" />}
            {item?.createdBy && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 pt-0.5">
                <User className="w-3 h-3" />
                <span>{item.createdBy.name}</span>
                <span>•</span>
                <span>{new Date(item.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </div>
            )}
          </div>

          <div className="mb-3" data-devzone="item-entete">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${typeConfig?.bgHover || 'bg-muted'}`}>
                {TypeIcon && <TypeIcon className={`w-5 h-5 sm:w-6 sm:h-6 ${typeConfig?.color || 'text-muted-foreground'}`} />}
              </div>
              <div className="flex-1 min-w-0" data-tour="item-title">
                {formMode && canEdit ? (
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titre de l'élément"
                    className="text-lg sm:text-xl font-bold px-2 py-1 h-auto bg-muted/30 hover:bg-muted/60 focus:bg-background transition-colors"
                    autoFocus={!item?.title}
                  />
                ) : (
                  <h1 className="text-lg sm:text-2xl font-bold leading-tight break-words">{item.title || title}</h1>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-3">
            {!isNewItem && (
              <div className="flex items-center rounded-md bg-muted p-0.5 flex-shrink-0" role="group" aria-label="Mode d'affichage" data-tour="item-mode-switch">
                <HelpHint text={itemHints?.[!readMode && hasChanges ? 'readModeUnsaved' : 'readMode']}>
                  <button
                    type="button"
                    aria-pressed={readMode}
                    disabled={!readMode && hasChanges}
                    onClick={() => setDisplayMode('read')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${readMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Afficher</span>
                  </button>
                </HelpHint>
                <HelpHint text={itemHints?.[canEdit ? 'editMode' : 'sheetMode']}>
                  <button
                    type="button"
                    aria-pressed={formMode}
                    onClick={() => setDisplayMode('edit')}
                    className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors ${formMode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{canEdit ? 'Modifier' : 'Fiche'}</span>
                  </button>
                </HelpHint>
                {(canCompose || (type === 'ARTICLE' && !savedArticle && canEdit)) && (
                  <HelpHint text={itemHints?.[!savedArticle ? 'openArticleUnsaved' : hasChanges ? 'composeModeUnsaved' : 'composeMode']}>
                    <button
                      type="button"
                      aria-pressed={composing}
                      disabled={!savedArticle || hasChanges}
                      onClick={() => setDisplayMode('compose')}
                      data-tour="item-mode-compose"
                      className={`flex items-center gap-1 px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${composing ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      <PenLine className="w-3 h-3" />
                      <span>Composer</span>
                    </button>
                  </HelpHint>
                )}
              </div>
            )}
              {formMode && (
                <HelpHint text={itemHints?.[expanded ? 'lessFields' : 'moreFields']}>
                  <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    data-tour="item-more-fields"
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
                  >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    <span>{expanded ? 'Moins de champs' : 'Plus de champs'}</span>
                  </button>
                </HelpHint>
              )}
              <div className="ml-auto">
                <HelpButton help={PAGE_HELP['item-modal']} onStartTour={startItemTour} pulse={itemPulse} variant="page" buttonTitle="Aide" compact />
              </div>
            </div>
          </div>

          {/* Mode Afficher : la fiche en document (même contenu que « Copier la fiche »), pied réduit à Fermer */}
          {readMode && (
            <>
              <div className="flex-1 overflow-y-auto pr-1">
                <ItemReadView
                  sheet={buildSheet()}
                  hideTitle
                  tags={item?.tags}
                  onOpenChild={onNavigate}
                  articleContent={item?.type === 'ARTICLE' && itemId ? (
                    <div ref={articlePrintRef}>
                      <ArticleReadBlocks spaceId={item.spaceId ?? spaceId} articleId={itemId} />
                    </div>
                  ) : item?.type === 'QUESTION' && itemId ? (
                    <QuestionPanel spaceId={item.spaceId ?? spaceId} itemId={itemId} />
                  ) : undefined}
                  contents={item?.type === 'ARTICLE' ? [] : (item?.contents ?? [])}
                  reactions={(
                    <ReactionBar spaceId={spaceId} itemId={item.id} summary={(item as any).reactionSummary || []} readOnly={!user} />
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border mt-4 flex-shrink-0" data-tour="item-actions" data-devzone="item-pied">
                <Button type="button" variant="bordered" onClick={onClose}>Fermer</Button>
                {footerActions}
              </div>
            </>
          )}

          {/* Mode Composer d'un article : titre et chapeau en rappel, puis ses blocs. Pied réduit à Fermer. */}
          {composing && item && articleState.article && (
            <>
              <div className="flex-1 overflow-y-auto pr-1" data-devzone="item-composer">
                {item.description && (
                  <div className="prose dark:prose-invert max-w-none mt-2 mb-4 text-muted-foreground" dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }} />
                )}
                <ArticleEditor spaceId={item.spaceId ?? spaceId} articleId={item.id} article={articleState.article} state={articleState} />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border mt-4 flex-shrink-0" data-tour="item-actions" data-devzone="item-pied">
                <Button type="button" variant="bordered" onClick={onClose}>Fermer</Button>
                {footerActions}
              </div>
            </>
          )}

          {formMode && (<>
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
                data-devzone="item-resume"
                className="self-start -mt-1 mb-2 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-left"
                title="Afficher tous les champs"
              >
                {parts.join(' · ')}
              </button>
            );
          })()}

          {/* Contenu défilant ; fiche complète sur grand écran : la colonne principale et le panneau défilent chacun
              de leur côté (lot 4), le panneau reste en place quand on lit une longue description */}
          <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${showAll ? 'lg:overflow-hidden lg:flex lg:flex-col' : ''}`}>

            {/* Brouillon retrouvé (règle item-draft-local) : Reprendre / Ignorer */}
            {pendingDraft && (
              <ItemDraftBanner savedAt={pendingDraft.savedAt}
                changedSince={!!pendingDraft.baseUpdatedAt && !!item?.updatedAt && pendingDraft.baseUpdatedAt !== item.updatedAt}
                onResume={resumeDraft} onDiscard={discardDraft}
                texts={{ explain: itemHints?.draftExplain, changedSince: itemHints?.draftChangedSince, resume: itemHints?.draftResume, discard: itemHints?.draftDiscard }} />
            )}

            {/* Deux colonnes (réorganisation, lot 3, 2026-11-13) : colonne principale identique en fiche réduite et complète ;
                la fiche complète ajoute seulement le panneau Pilotage à droite (« Plus de champs » l'ouvre / le ferme) */}
            <div className={`grid grid-cols-1 gap-6 ${showAll ? 'lg:grid-cols-[minmax(0,1fr),400px] lg:grid-rows-[minmax(0,1fr)] lg:flex-1 lg:min-h-0' : ''}`}>

          {/* === COLONNE PRINCIPALE : tags, description, contenus, contributions === */}
          <div className={`space-y-6 min-w-0 ${showAll ? 'lg:overflow-y-auto lg:pr-2' : ''}`}>


              {/* Fiche réduite (Forum, Loisirs) : types « avec contenu » (CONTENT_TYPES) — choisir Image / Document / Lien…
                  fait apparaître son bloc (mediaSection) sous la Description. Types de pilotage : fiche complète. */}
              {!showAll && canEdit && (CONTENT_TYPES as string[]).includes(type) && (() => {
                const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                const offered = CONTENT_TYPES.filter((t) => typeLabels[t]?.visible !== false);
                const isContentType = (CONTENT_TYPES as string[]).includes(type);
                return (
                  <div className="flex items-center gap-1.5">
                  <HelpHint text={itemHints?.contentTypes}>
                    <div className="flex flex-wrap items-center gap-1.5" data-tour="item-content-types" data-devzone="item-type">
                      {isContentType ? offered.map((key) => {
                        const config = typeLabels[key];
                        const Icon = TYPE_ICONS[key];
                        const isSelected = type === key;
                        return (
                          <button key={key} type="button" onClick={() => setType(key)}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border-2 transition-all ${config?.color ?? 'border-border'} ${isSelected ? `${config?.bgHover ?? ''} font-semibold ring-1 ring-current text-gray-900` : 'opacity-60 hover:opacity-100'}`}>
                            {Icon && <Icon className="w-3 h-3 flex-shrink-0" />}
                            {config?.labelShort ?? TYPE_LABELS[key]}
                          </button>
                        );
                      }) : null}
                    </div>
                  </HelpHint>
                  <ElementHelp page="item-modal" element="contentTypes" />
                  </div>
                );
              })()}

              {/* Tags, dans les deux fiches, avant la Description */}
              {tagsSection}

              {/* Description — visible pour tous les types, y compris Lien/Doc/Image/Diagramme (demande 2026-07-15) */}
              <div className="space-y-2" data-tour="item-description" data-devzone="item-description">
                <label className="text-sm font-medium flex items-center gap-1.5">Description <ElementHelp page="item-modal" element="description" /></label>
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

              {/* Contenus (et bloc Question / phrase Article) sous la Description, dans les deux fiches */}
              {mediaSection}

              {/* Reactions + Contributions */}
              <div className="space-y-3" data-tour="item-reactions" data-devzone="item-contributions">
                {/* Reaction bar on item */}
                {item && (
                  <div className="flex items-start gap-1.5">
                    <div className="flex-1 min-w-0">
                      <ReactionBar
                        spaceId={spaceId}
                        itemId={item.id}
                        summary={(item as any).reactionSummary || []}
                        onReacted={(type) => { if (canInteract) { setContributionVote(type); setShowContributionField(true); } }}
                        label="Réagissez ou Contribuez à l'article"
                        readOnly={!user}
                      />
                    </div>
                    <ElementHelp page="item-modal" element="reactions" />
                  </div>
                )}

                {/* New contribution field (shown after reaction or manual click) */}
                {canInteract && showContributionField && !replyToContributionId && (
                  <div className="space-y-2">
                    <ContributionVoteBadge type={contributionVote} pending hint={itemHints?.contributionVotePending} />
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
                                {contribution.reactionType && (<>
                                  <span>·</span>
                                  <ContributionVoteBadge type={contribution.reactionType} hint={itemHints?.contributionVote} />
                                </>)}
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
                                  onReacted={(type) => { if (canInteract) { setReplyToContributionId(contribution.id); setContributionVote(type); setShowContributionField(true); setNewContribution(''); }}}
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
                              <ContributionVoteBadge type={contributionVote} pending hint={itemHints?.contributionVotePending} />
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
                        <ElementHelp page="item-modal" element="contributions" />
                      </h2>
                      <div className="divide-y divide-border/50">
                        {rootContribs.map(c => renderContribution(c, 0))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Historique (règle item-history-members) — fiche réduite : en bas de la colonne ; complète : en bas du panneau */}
              {!showAll && item && user && (
                <ItemHistorySection spaceId={item.spaceId ?? spaceId} itemId={item.id} version={item.updatedAt}
                  hints={{ toggle: itemHints?.historyToggle, empty: itemHints?.historyEmpty }} />
              )}

          </div>{/* fin colonne principale */}

          {/* === PANNEAU PILOTAGE (fiche complète) : type, statut, priorité, dates, assigné, parent, références,
              dépendances, enfants, historique === */}
          {showAll && <div className="space-y-6 min-w-0 lg:border-l lg:border-border lg:pl-6 lg:pr-2 lg:overflow-y-auto" data-tour="item-details" data-devzone="item-pilotage">

              {/* Type */}
              {showAll && <div className="space-y-2" data-tour="item-type-selector" data-devzone="item-type">
                <label className="text-sm font-medium flex items-center gap-1.5">Type <ElementHelp page="item-modal" element="type" /></label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={type}
                        onChange={(e) => { setType(e.target.value as ItemType); if (getItemTypeDef(e.target.value)?.timed) setAllDay(false); }}
                        options={(Object.entries(referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels))
                          .filter(([, c]) => c.visible)
                          .sort(([, a], [, b]) => a.order - b.order)
                          .map(([key, c]) => ({ value: key, label: c.labelShort }))}
                      />
                    </div>
                    {/* Desktop: buttons, groupés par TYPE_GROUPS (Défaut/Activités/Compositions) */}
                    <div className="hidden sm:flex flex-col gap-1.5">
                      {(() => {
                        const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
                        const renderButton = (key: string, config: TypeLabelConfig) => {
                          const Icon = TYPE_ICONS[key];
                          const isSelected = type === key;
                          return (
                            <button key={key} type="button" onClick={() => { setType(key as ItemType); if (getItemTypeDef(key)?.timed) setAllDay(false); }}
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
              {/* Question : ses 4 statuts réservés, appliqués tout de suite comme une issue (QuestionStatusField) */}
              {showAll && type === 'QUESTION' && itemId && item?.type === 'QUESTION' && (
                <QuestionStatusField spaceId={item.spaceId ?? spaceId} itemId={itemId} statuses={referentiels?.statuses} />
              )}
              {showAll && type !== 'QUESTION' &&<div className="space-y-2" data-tour="item-status" data-devzone="item-statut">
                <label className="text-sm font-medium flex items-center gap-1.5">Statut <ElementHelp page="item-modal" element="statut" /></label>
                {canEdit ? (
                  <>
                    {/* Mobile: select */}
                    <div className="sm:hidden">
                      <Select
                        value={status || 'undefined'}
                        onChange={(e) => pickStatus(e.target.value)}
                        options={statusesForType(referentiels?.statuses || DEFAULT_REFERENTIELS.statuses, type).map((s) => ({ value: s.id, label: s.label }))}
                      />
                    </div>
                    {/* Desktop: buttons */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      {statusesForType(referentiels?.statuses || DEFAULT_REFERENTIELS.statuses, type).map((s) => {
                        const isSelected = (s.id === 'undefined' && !status) || s.id === status;
                        return (
                          <button key={s.id} type="button"
                            onClick={() => pickStatus(s.id)}
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
                <HelpHint text={itemFields?.priority}><label className="text-sm font-medium">Priorité</label></HelpHint>
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
              {showAll && <div data-tour="item-dates" data-devzone="item-dates" className="space-y-3">
                {/* Toggle Jours pleins / Heures (dates dépliées seulement) ; le « ? » des dates reste visible sans droit d'édition */}
                {canEdit && datesOpen ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium flex items-center gap-1.5">Dates <ElementHelp page="item-modal" element="dates" /></span>
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
                ) : (
                  <span className="text-sm font-medium flex items-center gap-1.5">Dates <ElementHelp page="item-modal" element="dates" /></span>
                )}
                {datesOpen && (<>
                {/* Champs de dates + sélecteur heures à droite */}
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0 space-y-4">
                  <div className="space-y-2">
                    <HelpHint text={itemFields?.startEnd}><label className="text-sm font-medium">Début</label></HelpHint>
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
                    <HelpHint text={itemFields?.dueDate}><label className="text-sm font-medium">Échéance</label></HelpHint>
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
                <button type="button" onClick={() => setDatesOpen(false)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                  Replier les dates
                </button>
                </>)}
                {!datesOpen && (() => {
                  const fmt = (d: string) => (allDay ? formatDate(d) : formatDateTime(d));
                  const parts = [
                    startDate && `Début ${fmt(startDate)}`,
                    endDate && `Fin ${fmt(endDate)}`,
                    dueDate && `Échéance ${formatDate(dueDate)}`,
                  ].filter(Boolean);
                  return (
                    <HelpHint text={itemHints?.datesSummary}>
                      <button type="button" onClick={() => setDatesOpen(true)} data-tour="item-dates-summary"
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-md border border-border hover:bg-accent transition-colors">
                        <span className={`flex-1 min-w-0 ${parts.length ? '' : 'text-muted-foreground'}`}>
                          {parts.length ? parts.join(' · ') : (canEdit ? 'Aucune date — cliquer pour en ajouter' : 'Aucune date')}
                        </span>
                        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    </HelpHint>
                  );
                })()}
              </div>}

              {/* Assigné à */}
              {showAll && spaceMembers && spaceMembers.length > 0 && (
                <div className="space-y-2">
                  <HelpHint text={itemFields?.assignee}><label className="text-sm font-medium">Assigné à</label></HelpHint>
                  {canEdit ? (
                    <div className="flex items-center gap-2">
                      {/* Menu + saisie libre : un nom identique à celui d'un membre l'assigne, tout autre nom reste un simple nom */}
                      <Input
                        list="item-assignee-members"
                        value={assignedToId ? (spaceMembers.find((m) => m.userId === assignedToId)?.name || item?.assignedTo?.name || '') : assignedToName}
                        onChange={(e) => {
                          const text = e.target.value;
                          const member = spaceMembers.find((m) => m.name.toLowerCase() === text.trim().toLowerCase());
                          setAssignedToId(member?.userId ?? '');
                          setAssignedToName(member ? '' : text);
                        }}
                        placeholder="Non assigné — choisir ou saisir un nom"
                      />
                      <datalist id="item-assignee-members">
                        {spaceMembers.map((m) => <option key={m.userId} value={m.name} />)}
                      </datalist>
                      {user && assignedToId !== user.id && (
                        <button type="button" onClick={() => { setAssignedToId(user.id); setAssignedToName(''); }}
                          className="shrink-0 px-2 py-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                          title="M'assigner">
                          <User className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm">
                      {assignedToId ? (spaceMembers.find((m) => m.userId === assignedToId)?.name || 'Membre inconnu') : assignedToName || <span className="text-muted-foreground">Non assigné</span>}
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

              {/* Parent (masqué sans droit d'édition) */}
              {showAll && canEdit && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <HelpHint text={itemFields?.parent}><label className="text-sm font-medium">Parent</label></HelpHint>
                    <button type="button" onClick={toggleParentSortMode}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      title={parentSortMode === 'tree' ? 'Tri par arborescence' : 'Tri alphabétique'}>
                      {parentSortMode === 'tree' ? <><GitBranch className="w-3 h-3" /><span>Arborescence</span></> : <><ArrowDownAZ className="w-3 h-3" /><span>A-Z</span></>}
                    </button>
                </div>
                  <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
              </div>
              )}

              {/* Références externes (règle item-external-refs) : fiche complète, saisie sur une ligne */}
              {showAll && (canEdit || (item?.externalRefs?.length ?? 0) > 0) && (
                <div className="space-y-2" data-tour="item-external-refs" data-devzone="item-references">
                  <label className="text-sm font-medium flex items-center gap-1.5"><HelpHint text={itemFields?.externalRefs}><span>Références externes</span></HelpHint> <ElementHelp page="item-modal" element="references" /></label>
                  {canEdit
                    ? <ExternalRefsInput value={externalRefsText} onChange={setExternalRefsText} placeholder="Appli1 : Réf1 | appli2 : réf2" />
                    : <ExternalRefsList refs={item?.externalRefs} className="text-sm" />}
                </div>
              )}

              {/* Dépendances */}
              {showAll && <div className="space-y-3" data-tour="item-relations" data-devzone="item-relations">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    Dépendances
                    <ElementHelp page="item-modal" element="relations" />
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
                        {newRelationTargetId ? (
                          <div className="flex items-center gap-2 px-2 py-1 rounded border border-border bg-background text-sm">
                            <span className="flex-1 min-w-0 truncate">{newRelationTargetTitle}</span>
                            <button type="button" className="text-xs text-primary hover:underline flex-shrink-0" onClick={() => setNewRelationTargetId('')}>Changer</button>
                          </div>
                        ) : (
                          <ItemSearchPicker
                            spaceId={spaceId}
                            excludeIds={new Set(itemId ? [itemId] : [])}
                            browseItems={allItems.map((i) => ({ id: i.id, title: i.title, spaceId }))}
                            actionLabel="Choisir"
                            onPick={(hit) => { setNewRelationTargetId(hit.id); setNewRelationTargetTitle(hit.title || 'Sans titre'); }}
                          />
                        )}
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

              {/* Children items */}
              {showAll && item && (() => {
                const children = allItems.filter(i => i.parentId === item.id);
                if (children.length === 0) return null;
                return (
                  <div className="space-y-2" data-tour="item-children" data-devzone="item-enfants">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Éléments enfants ({children.length})
                      <ElementHelp page="item-modal" element="enfants" />
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

              {/* Historique, en dernier dans le panneau Pilotage */}
              {item && user && (
                <ItemHistorySection spaceId={item.spaceId ?? spaceId} itemId={item.id} version={item.updatedAt}
                  hints={{ toggle: itemHints?.historyToggle, empty: itemHints?.historyEmpty }} />
              )}

          </div>}{/* fin panneau Pilotage */}


            </div>
          </div>

          {/* Pied commun (lot « pied », 2026-11-13) : enregistrer / fermer à gauche, menu « Actions » à droite */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border mt-4 flex-shrink-0" data-tour="item-actions" data-devzone="item-pied">
            {canEditTags && (<>
              <HelpHint text={itemHints?.saveAndClose}>
                <Button type="submit" disabled={!hasChanges || updateMutation.isPending}
                  className={`bg-orange-500 text-white hover:bg-orange-600 ${!hasChanges ? 'opacity-40' : ''}`}>
                  {updateMutation.isPending && closeAfterSaveRef.current ? 'Enregistrement...' : 'Enregistrer et quitter'}
                </Button>
              </HelpHint>
              <HelpHint text={itemHints?.save}>
                <Button type="button" disabled={!hasChanges || updateMutation.isPending} onClick={() => doSubmit(false)}
                  className={`bg-orange-200 text-orange-900 hover:bg-orange-300 ${!hasChanges ? 'opacity-40' : ''}`}>
                  {updateMutation.isPending && !closeAfterSaveRef.current ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </HelpHint>
            </>)}
            <Button type="button" variant="bordered" onClick={() => guardClose(() => { clearDraft(); closeWithoutSaving(); })}>
              Fermer
            </Button>
            {itemId && liveActions(itemId).map((a) => (
              <Button key={a.id} type="button" variant="bordered" onClick={a.onClick} disabled={a.disabled}>
                <a.icon className="w-4 h-4 mr-1" />{a.label}
              </Button>
            ))}
            {footerActions}
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
