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
  Bug,
} from 'lucide-react';
import type { ItemType, TypeLabelConfig } from '@spok/shared';
import { DEFAULT_TYPE_LABELS } from '@spok/shared';

// =============================================================================
// TYPE ICONS - Icônes associées à chaque type d'item
// =============================================================================
export const TYPE_ICONS: Record<string, typeof FileText> = {
  NOTE: FileText,
  PROJECT: FolderKanban,
  TASK: CheckSquare,
  MEETING: Calendar,
  PERIOD: CalendarRange,
  LINK: Link2,
  CONFIG: Settings,
  DOCUMENT: File,
  IMAGE: Image,
  BUG: Bug,
  // Legacy fallback
  APPOINTMENT: Calendar,
};

// =============================================================================
// TYPE LABELS - Libellés des types d'items
// =============================================================================
export const TYPE_LABELS: Record<string, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Configuration',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
  BUG: 'Anomalie',
  // Legacy fallback
  APPOINTMENT: 'Rendez-vous',
};

// Version courte pour les espaces restreints
export const TYPE_LABELS_SHORT: Record<string, string> = {
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Doc',
  IMAGE: 'Image',
  BUG: 'Bug',
  // Legacy fallback
  APPOINTMENT: 'RDV',
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
  todo: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  none: 'bg-gray-100 text-gray-500 border-dashed',
};

// Couleurs alternatives pour les bordures (SequenceView)
export const STATUS_BORDER_COLORS: Record<string, string> = {
  todo: 'border-blue-300 bg-blue-50',
  in_progress: 'border-yellow-300 bg-yellow-50',
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
  { id: 'todo', label: 'À faire', color: 'border-blue-300', bgHover: 'bg-blue-100' },
  { id: 'in_progress', label: 'En cours', color: 'border-yellow-400', bgHover: 'bg-yellow-100' },
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
  { id: 'BUG', label: 'Anomalies', color: 'border-red-400', bgHover: 'bg-red-50' },
];

// =============================================================================
// TYPE COLOR HELPER - Couleur de bordure/fond par type d'item
// =============================================================================
export function getTypeColor(type: string, typeLabels?: Record<string, TypeLabelConfig>) {
  const config = typeLabels?.[type] || DEFAULT_TYPE_LABELS[type];
  return {
    color: config?.color || 'border-gray-400',
    bgHover: config?.bgHover || 'bg-gray-50',
  };
}

// Mapping border → text pour les couleurs de type (classes complètes pour Tailwind JIT)
const BORDER_TO_TEXT: Record<string, string> = {
  'border-blue-400': 'text-blue-500',
  'border-purple-400': 'text-purple-500',
  'border-green-400': 'text-green-500',
  'border-orange-400': 'text-orange-500',
  'border-teal-400': 'text-teal-500',
  'border-cyan-400': 'text-cyan-500',
  'border-gray-400': 'text-gray-500',
  'border-amber-400': 'text-amber-500',
  'border-pink-400': 'text-pink-500',
  'border-red-400': 'text-red-500',
  'border-yellow-400': 'text-yellow-500',
  'border-indigo-400': 'text-indigo-500',
  'border-slate-400': 'text-slate-500',
};

// Retourne la couleur de texte correspondant au type
export function getTypeTextColor(type: string, typeLabels?: Record<string, TypeLabelConfig>) {
  const { color } = getTypeColor(type, typeLabels);
  return BORDER_TO_TEXT[color] || 'text-gray-500';
}

// =============================================================================
// LOCAL STORAGE KEYS - Clés pour le stockage local
// =============================================================================
export const STORAGE_KEYS = {
  PARENT_SORT_MODE: 'spok-parent-sort-mode',
} as const;
