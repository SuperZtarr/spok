import {
  FileText,
  CheckSquare,
  FolderKanban,
  Calendar,
  CalendarRange,
  Link2,
  Settings,
  File,
  Image,
} from 'lucide-react';
import type { ItemType } from '@spok/shared';

// =============================================================================
// TYPE ICONS - Icônes associées à chaque type d'item
// =============================================================================
export const TYPE_ICONS: Record<ItemType, typeof FileText> = {
  NOTE: FileText,
  PROJECT: FolderKanban,
  TASK: CheckSquare,
  MEETING: Calendar,
  PERIOD: CalendarRange,
  LINK: Link2,
  CONFIG: Settings,
  DOCUMENT: File,
  IMAGE: Image,
};

// =============================================================================
// TYPE LABELS - Libellés des types d'items
// =============================================================================
export const TYPE_LABELS: Record<ItemType, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Configuration',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
};

// Version courte pour les espaces restreints
export const TYPE_LABELS_SHORT: Record<ItemType, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Doc',
  IMAGE: 'Image',
};

// =============================================================================
// STATUS LABELS - Libellés des statuts
// =============================================================================
export const STATUS_LABELS: Record<string, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Terminé',
  cancelled: 'Annulé',
};

// =============================================================================
// STATUS COLORS - Couleurs des badges de statut
// =============================================================================
export const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-gray-100 text-gray-800',
  in_progress: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-500 border-dashed',
};

// Couleurs alternatives pour les bordures (SequenceView)
export const STATUS_BORDER_COLORS: Record<string, string> = {
  todo: 'border-gray-300 bg-gray-50',
  in_progress: 'border-blue-300 bg-blue-50',
  done: 'border-green-300 bg-green-50',
  cancelled: 'border-red-300 bg-red-50',
  none: 'border-gray-200 bg-white',
};

// =============================================================================
// STATUS OPTIONS - Options pour les selects/dropdowns
// =============================================================================
export const STATUS_OPTIONS = [
  { value: 'todo', label: 'À faire' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'done', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
] as const;

// =============================================================================
// KANBAN COLUMNS - Configuration des colonnes Kanban (par statut)
// =============================================================================
export const KANBAN_COLUMNS: { id: string; label: string; color: string; bgHover: string }[] = [
  { id: 'undefined', label: 'Non défini', color: 'border-slate-400', bgHover: 'bg-slate-100' },
  { id: 'todo', label: 'À faire', color: 'border-gray-300', bgHover: 'bg-gray-100' },
  { id: 'in_progress', label: 'En cours', color: 'border-blue-400', bgHover: 'bg-blue-100' },
  { id: 'done', label: 'Terminé', color: 'border-green-400', bgHover: 'bg-green-100' },
  { id: 'cancelled', label: 'Annulé', color: 'border-red-400', bgHover: 'bg-red-100' },
];

// =============================================================================
// TYPE COLUMNS - Configuration des colonnes Types (par type d'item)
// =============================================================================
export const TYPE_COLUMNS: { id: ItemType; label: string; color: string; bgHover: string }[] = [
  { id: 'NOTE', label: 'Notes', color: 'border-blue-400', bgHover: 'bg-blue-50' },
  { id: 'PROJECT', label: 'Projets', color: 'border-purple-400', bgHover: 'bg-purple-50' },
  { id: 'TASK', label: 'Tâches', color: 'border-green-400', bgHover: 'bg-green-50' },
  { id: 'MEETING', label: 'Réunions', color: 'border-orange-400', bgHover: 'bg-orange-50' },
  { id: 'PERIOD', label: 'Périodes', color: 'border-teal-400', bgHover: 'bg-teal-50' },
  { id: 'LINK', label: 'Liens', color: 'border-cyan-400', bgHover: 'bg-cyan-50' },
  { id: 'CONFIG', label: 'Config', color: 'border-gray-400', bgHover: 'bg-gray-50' },
  { id: 'DOCUMENT', label: 'Documents', color: 'border-amber-400', bgHover: 'bg-amber-50' },
  { id: 'IMAGE', label: 'Images', color: 'border-pink-400', bgHover: 'bg-pink-50' },
];

// =============================================================================
// LOCAL STORAGE KEYS - Clés pour le stockage local
// =============================================================================
export const STORAGE_KEYS = {
  PARENT_SORT_MODE: 'spok-parent-sort-mode',
} as const;
