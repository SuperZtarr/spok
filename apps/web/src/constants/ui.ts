/* Constantes UI partagées : icônes par type d'item (getTypeIcon), couleurs de statut, tailles. */
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
  Workflow,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  Presentation,
  HelpCircle,
} from 'lucide-react';
import type { SVGProps } from 'react';
import type { ItemType, TypeLabelConfig } from '@spok/shared';
import { DEFAULT_TYPE_LABELS } from '@spok/shared';
import { getOfficeFileIcon } from '../components/ui/FileTypeIcon';

// Generic icon component type (compatible with both Lucide icons and custom SVG components)
export type IconComponent = React.ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

// =============================================================================
// DOCUMENT FILE ICONS - Icône par extension de fichier
// =============================================================================
function getDocumentFileIcon(url: string): IconComponent {
  // Try branded Office icons first (Word, Excel, PowerPoint, PDF)
  const officeIcon = getOfficeFileIcon(url);
  if (officeIcon) return officeIcon;

  // Strip query params and hash before extracting extension (handles Confluence URLs, R2 image URLs, etc.)
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase() || '';
  if (['txt', 'md', 'rtf'].includes(ext)) return FileText;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return FileImage;
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return FileVideo;
  if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext)) return FileAudio;
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return FileArchive;
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'sh', 'sql'].includes(ext)) return FileCode;
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return Presentation;
  if (['xls', 'xlsx', 'csv', 'ods', 'tsv'].includes(ext)) return FileSpreadsheet;
  return File;
}

// =============================================================================
// TYPE ICONS - Icônes associées à chaque type d'item
// =============================================================================
export function getTypeIcon(type: string, url?: string | null): IconComponent {
  if (type === 'DOCUMENT' && url) return getDocumentFileIcon(url);
  return TYPE_ICONS[type] || FileText;
}

export const TYPE_ICONS: Record<string, IconComponent> = {
  UNDEFINED: HelpCircle,
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
  DIAGRAM: Workflow,
  // Legacy fallback
  APPOINTMENT: Calendar,
};

// =============================================================================
// TYPE LABELS - Libellés des types d'items
// =============================================================================
export const TYPE_LABELS: Record<string, string> = {
  UNDEFINED: 'Non défini',
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
  DIAGRAM: 'Diagramme',
  // Legacy fallback
  APPOINTMENT: 'Rendez-vous',
};

// Version courte pour les espaces restreints
export const TYPE_LABELS_SHORT: Record<string, string> = {
  UNDEFINED: 'Non défini',
  NOTE: 'Note',
  PROJECT: 'Projet',
  TASK: 'Tâche',
  MEETING: 'Réunion',
  PERIOD: 'Période',
  LINK: 'Lien',
  CONFIG: 'Config',
  DOCUMENT: 'Document',
  IMAGE: 'Image',
  BUG: 'Bug',
  DIAGRAM: 'Diagramme',
  // Legacy fallback
  APPOINTMENT: 'RDV',
};

// =============================================================================
// TYPE GROUPS - Regroupement visuel des types (sélecteur de type de la modale)
// =============================================================================
export const TYPE_GROUPS: { id: string; label: string; types: ItemType[] }[] = [
  { id: 'default', label: 'Défaut', types: ['UNDEFINED', 'NOTE'] },
  { id: 'activities', label: 'Activités', types: ['PROJECT', 'TASK', 'MEETING', 'PERIOD', 'BUG'] },
  { id: 'deliverables', label: 'Livrables', types: ['LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'DIAGRAM'] },
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
  { id: 'DIAGRAM', label: 'Diagrammes', color: 'border-indigo-400', bgHover: 'bg-indigo-50' },
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
// PRIORITY - Niveaux de priorité des items
// =============================================================================
export const PRIORITIES: { value: number; label: string; shortLabel: string; color: string; bgColor: string; textColor: string; icon: string }[] = [
  { value: 4, label: 'Urgente', shortLabel: 'P1', color: 'border-red-500', bgColor: 'bg-red-50', textColor: 'text-red-600', icon: '🔴' },
  { value: 3, label: 'Haute', shortLabel: 'P2', color: 'border-orange-400', bgColor: 'bg-orange-50', textColor: 'text-orange-600', icon: '🟠' },
  { value: 2, label: 'Normale', shortLabel: 'P3', color: 'border-blue-400', bgColor: 'bg-blue-50', textColor: 'text-blue-600', icon: '🔵' },
  { value: 1, label: 'Basse', shortLabel: 'P4', color: 'border-gray-300', bgColor: 'bg-gray-50', textColor: 'text-gray-500', icon: '⚪' },
];

export function getPriorityConfig(priority: number | null | undefined) {
  return PRIORITIES.find(p => p.value === priority) || null;
}

// =============================================================================
// LOCAL STORAGE KEYS - Clés pour le stockage local
// =============================================================================
export const STORAGE_KEYS = {
  PARENT_SORT_MODE: 'spok-parent-sort-mode',
} as const;
