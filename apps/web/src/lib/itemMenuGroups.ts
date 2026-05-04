import { Pencil, CheckSquare, Plus, UserPlus, Merge, ArrowDownToLine, Copy, FolderInput, FolderPlus, Trash2, Scissors, ExternalLink, Eye, Circle } from 'lucide-react';
import type { ItemActionGroup, ItemAction } from '../components/ui/ItemActionMenu';

export const hasHeadings = (desc?: string | null) => !!desc && /<h[2-3][^>]*>/i.test(desc);

export interface ItemMenuCallbacks {
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onAddChild?: (id: string) => void;
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
  const { statusOptions, currentStatusId, extraChildren = [], extraOrganise = [], extraSections = [], canEdit = true } = options;

  // Groupe 1 — Ouvrir (toujours visible)
  const group1: ItemAction[] = [
    ...(onOpen ? [{ id: 'open', label: 'Ouvrir', icon: Eye, onClick: () => onOpen(itemId) }] : []),
    ...(onOpenInNewTab ? [{ id: 'open-new-tab', label: 'Ouvrir dans un nouvel onglet', icon: ExternalLink, onClick: () => onOpenInNewTab(itemId) }] : []),
  ];

  // Groupe 2 — Modifier (write) : Modifier, Absorber, Éclater, Fusionner
  const group2: ItemAction[] = canEdit ? [
    ...(onEdit ? [{ id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(itemId) }] : []),
    ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(itemId) }] : []),
    ...(onSplitDescription ? [{ id: 'split', label: 'Éclater en sous-items', icon: Scissors, onClick: () => onSplitDescription(itemId) }] : []),
    ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(itemId) }] : []),
  ] : [];

  // Groupe 3 — (séparateur) M'assigner, Modifier le statut, Déplacer
  const group3: ItemAction[] = canEdit ? [
    ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(itemId) }] : []),
    ...(onUpdateStatus && statusOptions && statusOptions.length > 0 ? [{
      id: 'status',
      label: 'Modifier le statut',
      icon: CheckSquare,
      onClick: () => {},
      submenu: statusOptions.map(s => ({
        id: `status-${s.id}`,
        label: s.label,
        icon: Circle,
        checked: s.id === currentStatusId,
        onClick: () => onUpdateStatus(itemId, s.id),
      })),
    }] : []),
    ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(itemId) }] : []),
    ...extraOrganise,
  ] : [];

  // Groupe 4 — Ajouter : Ajouter un enfant, Dupliquer
  const group4: ItemAction[] = canEdit ? [
    ...(onAddChild ? [{ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(itemId) }] : []),
    ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer vers...', icon: Copy, onClick: () => onDuplicateToSpace(itemId) }] : []),
    ...extraChildren,
  ] : [];

  // Groupe 5 — Autres : Convertir en espace, Supprimer
  const group5: ItemAction[] = canEdit ? [
    ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(itemId) }] : []),
    ...(onDelete ? [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(itemId), variant: 'danger' as const }] : []),
  ] : [];

  return [
    ...(group1.length > 0 ? [{ actions: group1 }] : []),
    ...(group2.length > 0 ? [{ actions: group2 }] : []),
    ...(group3.length > 0 ? [{ actions: group3 }] : []),
    ...(group4.length > 0 ? [{ actions: group4 }] : []),
    ...(group5.length > 0 ? [{ actions: group5 }] : []),
    ...extraSections.filter((s) => s.actions.length > 0),
  ];
}
