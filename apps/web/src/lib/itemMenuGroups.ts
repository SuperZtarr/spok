import { Pencil, CheckSquare, Plus, UserPlus, Merge, ArrowDownToLine, Copy, FolderInput, FolderPlus, Trash2, Scissors } from 'lucide-react';
import type { ItemActionGroup, ItemAction } from '../components/ui/ItemActionMenu';

export const hasHeadings = (desc?: string | null) => !!desc && /<h[2-3][^>]*>/i.test(desc);

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
  onSplitDescription?: (id: string) => void;
}

export interface ItemMenuOptions {
  statusAction?: { label: string; statusId: string } | null;
  // Actions supplémentaires dans le groupe "enfants" (ex: portail MindMap)
  extraChildren?: ItemAction[];
  // Actions supplémentaires dans le groupe "organiser" (ex: réorganiser MindMap)
  extraOrganise?: ItemAction[];
  // Sections supplémentaires (ex: Exporter dans ListView/Kanban)
  extraSections?: Array<{ label?: string; actions: ItemAction[] }>;
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
    onSplitDescription,
  } = callbacks;
  const { statusAction, extraChildren = [], extraOrganise = [], extraSections = [] } = options;

  // Groupe 1 : actions sur l'item lui-même
  const group1: ItemAction[] = [
    ...(onEdit ? [{ id: 'edit', label: 'Modifier', icon: Pencil, onClick: () => onEdit(itemId) }] : []),
    ...(onSelfAssign ? [{ id: 'self-assign', label: "M'assigner", icon: UserPlus, onClick: () => onSelfAssign(itemId) }] : []),
    ...(onUpdateStatus && statusAction ? [{ id: 'status', label: statusAction.label, icon: CheckSquare, onClick: () => onUpdateStatus(itemId, statusAction.statusId) }] : []),
  ];

  // Groupe 2 : enfants
  const group2: ItemAction[] = [
    ...(onAddChild ? [{ id: 'add-child', label: 'Ajouter un enfant', icon: Plus, onClick: () => onAddChild(itemId) }] : []),
    ...(onAbsorbChildren ? [{ id: 'absorb', label: 'Absorber les enfants', icon: ArrowDownToLine, onClick: () => onAbsorbChildren(itemId) }] : []),
    ...extraChildren,
  ];

  // Groupe 3 : organisation / déplacement
  const group3: ItemAction[] = [
    ...(onSplitDescription ? [{ id: 'split', label: 'Éclater en sous-items', icon: Scissors, onClick: () => onSplitDescription(itemId) }] : []),
    ...(onMerge ? [{ id: 'merge', label: 'Fusionner avec...', icon: Merge, onClick: () => onMerge(itemId) }] : []),
    ...(onDuplicateToSpace ? [{ id: 'duplicate', label: 'Dupliquer vers...', icon: Copy, onClick: () => onDuplicateToSpace(itemId) }] : []),
    ...(onMoveToSpace ? [{ id: 'move', label: 'Déplacer vers un espace', icon: FolderInput, onClick: () => onMoveToSpace(itemId) }] : []),
    ...(onConvertToSpace ? [{ id: 'convert', label: 'Convertir en espace', icon: FolderPlus, onClick: () => onConvertToSpace(itemId) }] : []),
    ...extraOrganise,
  ];

  return [
    ...(group1.length > 0 ? [{ actions: group1 }] : []),
    ...(group2.length > 0 ? [{ actions: group2 }] : []),
    ...(group3.length > 0 ? [{ actions: group3 }] : []),
    ...extraSections.filter((s) => s.actions.length > 0),
    ...(onDelete ? [{ actions: [{ id: 'delete', label: 'Supprimer', icon: Trash2, onClick: () => onDelete(itemId), variant: 'danger' as const }] }] : []),
  ];
}
