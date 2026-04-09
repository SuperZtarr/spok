import { Pencil, CheckSquare, Plus, UserPlus, Merge, ArrowDownToLine, Copy, FolderInput, FolderPlus, Trash2 } from 'lucide-react';
import type { ItemActionGroup, ItemAction } from '../components/ui/ItemActionMenu';

export interface ItemMenuCallbacks {
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
}

export interface ItemMenuOptions {
  statusAction?: { label: string; statusId: string } | null;
  extraCreate?: ItemAction[];
  extraOrganise?: ItemAction[];
  extraSections?: Array<{ label: string; actions: ItemAction[] }>;
}

export function buildItemMenuGroups(
  itemId: string,
  callbacks: ItemMenuCallbacks,
  options: ItemMenuOptions = {},
): ItemActionGroup[] {
  const {
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
  } = callbacks;
  const { statusAction, extraCreate = [], extraOrganise = [], extraSections = [] } = options;

  const createActions: ItemAction[] = [
    ...(onEdit ? [{ id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(itemId) }] : []),
    ...(onUpdateStatus && statusAction ? [{ id: 'status', label: statusAction.label, icon: CheckSquare, onClick: () => onUpdateStatus(itemId, statusAction.statusId) }] : []),
    ...(onAddChild ? [{ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(itemId) }] : []),
    ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(itemId) }] : []),
    ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(itemId) }] : []),
    ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(itemId) }] : []),
    ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer vers...', icon: Copy, onClick: () => onDuplicateToSpace(itemId) }] : []),
    ...extraCreate,
  ];

  const organiseActions: ItemAction[] = [
    ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(itemId) }] : []),
    ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(itemId) }] : []),
    ...extraOrganise,
  ];

  return [
    ...(createActions.length > 0 ? [{ label: 'Créer', actions: createActions }] : []),
    ...(organiseActions.length > 0 ? [{ label: 'Organiser', actions: organiseActions }] : []),
    ...extraSections.filter((s) => s.actions.length > 0),
    ...(onDelete ? [{ actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(itemId), variant: 'danger' as const }] }] : []),
  ];
}
