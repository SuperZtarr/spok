/*
 * Construction des groupes d'actions du menu contextuel des items (ItemActionMenu) : Ajouter,
 * Ouvrir, Modifier, Organiser, Danger. Point unique — cf. skill spok-menu avant modification.
 * « Marquer comme non lu » (groupe Ouvrir) : markItemUnread, sans callback à câbler ; présent pour tout utilisateur
 * connecté (même sans droit d'édition), absent pour un visiteur anonyme (lu via useAuthStore.getState()).
 * Vocabulaire unique (décision Thomas 2026-11-26) : libellés et icônes lus dans le registre constants/itemActions.ts
 * (itemAction), le même que le menu « Actions » de la fiche et le sélecteur Lire | Modifier | Composer.
 * Groupe Ouvrir : « Lire » — Article / Process (option item) : leur page (lecture de l'article avec retour à la vue
 * d'origine, canevas en consultation) via appNavigate, ce menu étant construit hors des hooks ; autre élément :
 * onOpen(id, 'read') ; « Modifier » (onOpen(id, 'edit'), à défaut onEdit) seulement si canEdit ; « Composer » sur un
 * Article / Process si canEdit (leur page en composition). Les vues passent toujours { item } pour que Lire et
 * Composer trouvent le type.
 * Section « Séance » (Ajouter à la préparation / Présenter en séance) : ajoutée d'office si une séance live active
 * le permet (liveItemActions, lu via useActiveLiveSessionStore.getState()), indépendamment de canEdit.
 * Sous-menu « Statut » : seulement les statuts permis pour le type de l'item (statusesForType, @spok/shared) — une
 * question ne propose que ses 4 issues, les autres types jamais celles-ci (statuts réservés, 2026-11-08).
 * Ligne « Statut » (2026-11-20) : « Passer à <statut suivant> » (nextStatusForType, @spok/shared — jamais recalculé ici),
 * même onUpdateStatus que le sous-menu ; la flèche de la ligne ouvre le sous-menu (splitSubmenu). Statut final (aucun
 * suivant) → « Modifier le statut », sous-menu seul. Les vues passent { item, currentStatusId } pour que le bouton sache où aller.
 * « Absorber » / « Éclater » (2026-11-26) : ouvrent la modale de choix partie par partie (ItemPartsPickModal), rien n'est
 * fait sans confirmation ; hasHeadings dérive de hasDescriptionHeadings (@spok/shared).
 */
import { hasDescriptionHeadings, nextStatusForType, statusesForType, type StatusConfig } from '@spok/shared';
import { ArrowRight, CheckSquare, Circle } from 'lucide-react';
import { articleReturnState, type ItemOpenMode } from './itemOpenMode';
import { workspaceOf } from './composeTargets';
import { itemAction } from '../constants/itemActions';
import { appNavigate } from './appNavigate';
import type { ItemActionGroup, ItemAction } from '../components/ui/ItemActionMenu';
import { activityApi } from './api';
import { queryClient } from './queryClient';
import { buildLiveItemActions } from './liveItemActions';
import { useActiveLiveSessionStore } from '../stores/activeLiveSession';
import { useAuthStore } from '../stores/auth';

/**
 * « Marquer comme non lu » : pose la marque serveur puis rafraîchit le feed d'activité (page Activité,
 * panneau Non lus, badge du bandeau) et les listes d'items (clignotement dans les vues).
 * Personnel → disponible même sans droit d'édition. Utilisé par les menus et par ItemEditModal.
 */
export async function markItemUnread(itemId: string): Promise<void> {
  await activityApi.markUnread(itemId);
  queryClient.invalidateQueries({ queryKey: ['activity'] });
  queryClient.invalidateQueries({ queryKey: ['items'] });
}

/** Rappel fonctionnel du bouton « Passer à … » (affiché en bas du menu au survol) */
export const NEXT_STATUS_HINT = "Passe l'élément au statut suivant de son parcours (mêmes règles de dates que la fiche). La flèche à droite ouvre la liste pour choisir un autre statut.";

/** Condition d'affichage de « Éclater » : même détection des titres que l'API (descriptionSections, @spok/shared). */
export const hasHeadings = hasDescriptionHeadings;

/**
 * L'item a-t-il des enfants ? (`childCount` fourni par la liste API, ou `children` des vues en arbre).
 * Condition d'affichage de « Absorber les enfants » — sans enfant, l'API répond 400 « No children to absorb ».
 */
export const hasChildItems = (item?: object | null) => {
  // `childCount` est renvoyé par l'API liste mais absent du type partagé Item → lecture défensive
  const it = item as { childCount?: number; children?: unknown[] } | null | undefined;
  return !!it && ((it.childCount ?? 0) > 0 || (it.children?.length ?? 0) > 0);
};

export interface ItemMenuCallbacks {
  /** Ouvre la fiche de l'élément dans le mode demandé (Lire = 'read', Modifier = 'edit') */
  onOpen?: (id: string, mode?: ItemOpenMode) => void;
  onOpenInNewTab?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string, spaceId?: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
}

export interface ItemMenuOptions {
  statusOptions?: Array<{ id: string; label: string }> | null;
  currentStatusId?: string;
  // Actions supplémentaires dans le groupe "enfants" (ex: portail MindMap)
  extraChildren?: ItemAction[];
  // Actions supplémentaires dans le groupe "organiser" (ex: réorganiser MindMap)
  extraOrganise?: ItemAction[];
  // Sections supplémentaires (ex: Exporter dans ListView/Kanban)
  extraSections?: Array<{ label?: string; actions: ItemAction[] }>;
  // spaceId de l'item courant (pour addChild multi-espace)
  itemSpaceId?: string;
  // Élément du menu : son type et son espace (Lire / Composer d'un Article ou d'un Process)
  item?: { type?: string; spaceId?: string | null };
  // Permissions : false = masquer toutes les actions d'écriture (delete, move, merge...)
  canEdit?: boolean;
}

export function buildItemMenuGroups(
  itemId: string,
  callbacks: ItemMenuCallbacks,
  options: ItemMenuOptions = {},
): ItemActionGroup[] {
  const {
    onOpen,
    onOpenInNewTab,
    onEdit,
    onDelete,
    onUpdateStatus,
    onAddChild,
    onMoveToSpace,
    onDuplicateToSpace,
    onConvertToSpace,
    onSelfAssign,
    onMerge,
    onAbsorbChildren,
    onSplitDescription,
  } = callbacks;
  const { currentStatusId, extraChildren = [], extraOrganise = [], extraSections = [], itemSpaceId, canEdit = true, item } = options;
  const statusOptions = options.statusOptions ? statusesForType(options.statusOptions as StatusConfig[], item?.type ?? null) : options.statusOptions;
  const nextStatus = options.statusOptions ? nextStatusForType(options.statusOptions as StatusConfig[], item?.type ?? null, currentStatusId) : null;

  // Groupe 1 — Ouvrir (toujours visible ; « non lu » réservé aux connectés : un anonyme ne modifie rien)
  const isLoggedIn = !!useAuthStore.getState().user;
  const openFiche = onOpen ? () => onOpen(itemId, 'edit') : onEdit ? () => onEdit(itemId) : null;
  // Article / Process : Lire et Composer mènent à leur page (composeTargets)
  const workspace = item?.spaceId ? workspaceOf(item.type) : undefined;
  const goTo = (url: string) => () => appNavigate(url, { state: articleReturnState(window.location) });
  // Vue sans onOpen : onEdit ouvre la fiche, en lecture pour qui ne peut pas modifier → c'est alors « Lire »
  // Lire / Composer s'ouvrent dans la fiche (2026-11-26, la vue et sa barre restent derrière) ; à défaut d'onOpen, la
  // page de l'article ou le canevas du process
  const read = onOpen ? () => onOpen(itemId, 'read')
    : workspace ? goTo(workspace.readUrl(item!.spaceId!, itemId))
    : !canEdit && onEdit ? () => onEdit(itemId) : null;
  const compose = workspace ? (onOpen ? () => onOpen(itemId, 'compose') : goTo(workspace.composeUrl(item!.spaceId!, itemId))) : null;
  const group1: ItemAction[] = [
    ...(read ? [itemAction('read', read)] : []),
    ...(canEdit && openFiche ? [itemAction('edit', openFiche)] : []),
    ...(canEdit && compose ? [itemAction('compose', compose)] : []),
    ...(onOpenInNewTab ? [itemAction('openNewTab', () => onOpenInNewTab(itemId), { id: 'open-new-tab' })] : []),
    ...(isLoggedIn ? [itemAction('markUnread', () => { void markItemUnread(itemId); }, { id: 'mark-unread' })] : []),
  ];

  // Groupe 2 — Structure (écriture) : Absorber, Éclater, Fusionner (la fiche s'ouvre par « Modifier »)
  const group2: ItemAction[] = canEdit ? [
    ...(onAbsorbChildren ? [itemAction('absorbChildren', () => onAbsorbChildren(itemId), { id: 'absorb' })] : []),
    ...(onSplitDescription ? [itemAction('splitDescription', () => onSplitDescription(itemId), { id: 'split' })] : []),
    ...(onMerge ? [itemAction('merge', () => onMerge(itemId))] : []),
  ] : [];

  // Groupe 3 — (séparateur) M'assigner, Modifier le statut, Déplacer
  const group3: ItemAction[] = canEdit ? [
    ...(onSelfAssign ? [itemAction('selfAssign', () => onSelfAssign(itemId), { id: 'self-assign' })] : []),
    ...(onUpdateStatus && statusOptions && statusOptions.length > 0 ? [{
      id: 'status',
      // Bouton « Passer à <suivant> » (même onUpdateStatus que le sous-menu) ; statut final → sous-menu seul
      ...(nextStatus
        ? { label: `Passer à ${nextStatus.label}`, icon: ArrowRight, onClick: () => onUpdateStatus(itemId, nextStatus.id), splitSubmenu: true, hint: NEXT_STATUS_HINT }
        : { label: 'Modifier le statut', icon: CheckSquare, onClick: () => {} }),
      submenu: statusOptions.map(s => ({
        id: `status-${s.id}`,
        label: s.label,
        icon: Circle,
        checked: s.id === currentStatusId,
        onClick: () => onUpdateStatus(itemId, s.id),
      })),
    }] : []),
    ...(onMoveToSpace ? [itemAction('move', () => onMoveToSpace(itemId))] : []),
    ...extraOrganise,
  ] : [];

  // Groupe 4 — Ajouter : Ajouter un enfant, Dupliquer
  const group4: ItemAction[] = canEdit ? [
    ...(onAddChild ? [itemAction('addChild', () => onAddChild(itemId, itemSpaceId), { id: 'add-child' })] : []),
    ...(onDuplicateToSpace ? [itemAction('duplicate', () => onDuplicateToSpace(itemId))] : []),
    ...extraChildren,
  ] : [];

  // Groupe 5 — Autres : Convertir en espace, Supprimer
  const group5: ItemAction[] = canEdit ? [
    ...(onConvertToSpace ? [itemAction('convertToSpace', () => onConvertToSpace(itemId), { id: 'convert' })] : []),
    ...(onDelete ? [itemAction('delete', () => onDelete(itemId), { variant: 'danger' })] : []),
  ] : [];

  return [
    ...(group4.length > 0 ? [{ actions: group4 }] : []),
    ...(group1.length > 0 ? [{ actions: group1 }] : []),
    ...(group2.length > 0 ? [{ actions: group2 }] : []),
    ...(group3.length > 0 ? [{ actions: group3 }] : []),
    ...(group5.length > 0 ? [{ actions: group5 }] : []),
    ...extraSections.filter((s) => s.actions.length > 0),
    ...liveSection(itemId),
  ];
}

/** Section « Séance » : lue au moment de construire le menu (séance active de l'onglet). */
function liveSection(itemId: string) {
  const { info, spaceId } = useActiveLiveSessionStore.getState();
  const actions = buildLiveItemActions(itemId, info, spaceId);
  return actions.length > 0 ? [{ label: 'Séance', actions }] : [];
}
