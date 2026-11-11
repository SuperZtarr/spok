/* Constantes UI partagées : icônes, libellés, emoji, groupes, colonnes et couleurs des types d'élément, priorités.
   Tout ce qui concerne les types est DÉRIVÉ du registre @spok/shared (ITEM_TYPE_REGISTRY, 2026-11-08) : nouveau type =
   une ligne au registre (+ enum Prisma), rien ici sauf une icône lucide pas encore citée dans TYPE_ICON_COMPONENTS.
   Couleur d'un type : getTypeColor (classes), getTypeTextColor, getTypeHex (graphes) — jamais de table locale.
   Couleur d'un statut en hexadécimal (graphes) : getStatusHex, tirée du badge du référentiel. */
import {
  FileText,
  CheckSquare,
  FolderKanban,
  Calendar,
  CalendarRange,
  File,
  Box,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  Presentation,
  Newspaper,
  MessageCircleQuestion,
} from 'lucide-react';
import type { SVGProps } from 'react';
import type { ItemType, ItemTypeDefinition, StatusConfig, TypeHue, TypeLabelConfig } from '@spok/shared';
import { DEFAULT_STATUSES, DEFAULT_TYPE_LABELS, DEFAULT_ITEM_TYPE, ITEM_TYPE_REGISTRY, itemTypesWhere } from '@spok/shared';
import { getOfficeFileIcon } from '../components/ui/FileTypeIcon';

// Generic icon component type (compatible with both Lucide icons and custom SVG components)
export type IconComponent = React.ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

// =============================================================================
// FILE ICONS - Icône par extension de fichier (contenus Fichier : vue Documents, zone Contenus)
// =============================================================================
export function getFileIcon(url: string): IconComponent {
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
// L'icône ne dépend que du type (lot 4 « contenus multiples » : plus de type Document à icône par extension)
export function getTypeIcon(type: string): IconComponent {
  return TYPE_ICONS[type] || FileText;
}

/** Icônes lucide citées par le registre des types (champ `icon`) — un test vérifie que chaque nom est déclaré ici */
export const TYPE_ICON_COMPONENTS: Record<string, IconComponent> = {
  Box, FileText, FolderKanban, CheckSquare, Calendar, CalendarRange, Newspaper, MessageCircleQuestion,
};

// Ancien type APPOINTMENT (données d'avant la Réunion) : repli d'affichage seulement, absent du registre
const LEGACY_APPOINTMENT = 'APPOINTMENT';

export const TYPE_ICONS: Record<string, IconComponent> = {
  ...Object.fromEntries(ITEM_TYPE_REGISTRY.map((t) => [t.id, TYPE_ICON_COMPONENTS[t.icon] ?? FileText])),
  [LEGACY_APPOINTMENT]: Calendar,
};

// =============================================================================
// TYPE LABELS - Libellés des types d'items (registre ; une communauté peut les renommer : getTypeLabel)
// =============================================================================
export const TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(ITEM_TYPE_REGISTRY.map((t) => [t.id, t.label])),
  [LEGACY_APPOINTMENT]: 'Rendez-vous',
};

// Version courte pour les espaces restreints (aujourd'hui identique : libellés en toutes lettres, décision 2026-10-29)
export const TYPE_LABELS_SHORT: Record<string, string> = TYPE_LABELS;

// Icône du type en texte, pour l'onglet du navigateur : document.title n'accepte pas de composant (Layout, 2026-11-04)
export const TYPE_EMOJI = Object.fromEntries(ITEM_TYPE_REGISTRY.map((t) => [t.id, t.emoji])) as Record<ItemType, string>;

// =============================================================================
// TYPE GROUPS - Regroupement visuel des types (sélecteur de type de la modale)
// =============================================================================
/** Types proposés dans la fiche RÉDUITE (Forum, Loisirs) : ceux qui portent un contenu (texte, image, fichier, lien,
 *  schéma, article) et la Question (sondage en Forum, 2026-11-08 : son issue se note dans son propre bloc). Les types de pilotage (Projet, Tâche, Réunion, Période), comme les
 *  dates, la priorité et le statut, restent dans la fiche complète (décision Thomas 2026-10-29). Registre : `content`. */
export const CONTENT_TYPES: ItemType[] = itemTypesWhere((t) => t.content);

const TYPE_GROUP_LABELS: Record<ItemTypeDefinition['group'], string> = {
  default: 'Défaut',
  activities: 'Activités',
  deliverables: 'Compositions', // Article, Question (Process à venir) : types à composants, enregistrés dès leur choix
};

export const TYPE_GROUPS: { id: string; label: string; types: ItemType[] }[] = (
  Object.keys(TYPE_GROUP_LABELS) as ItemTypeDefinition['group'][]
).map((g) => ({ id: g, label: TYPE_GROUP_LABELS[g], types: itemTypesWhere((t) => t.group === g) }));

// =============================================================================
// TYPE HUE PALETTE - Classes complètes et hexadécimal par teinte (Tailwind ne lit pas @spok/shared : les classes
// des teintes du registre et des couleurs choisissables par une communauté doivent être écrites en entier ici)
// =============================================================================
// hex = teinte 500 (traits, nœuds) ; soft = 100 (fond clair) ; ink = 800 (texte sur fond clair) ; badge = pastille de filtre
type HueEntry = { border: string; bg: string; text: string; hex: string; soft: string; ink: string; badge: string };
export const TYPE_HUE_PALETTE: Record<TypeHue, HueEntry> = {
  slate:   { border: 'border-slate-400',   bg: 'bg-slate-50',   text: 'text-slate-500',   hex: '#64748b', soft: '#f1f5f9', ink: '#1e293b', badge: 'bg-slate-100 text-slate-600 border-slate-300' },
  gray:    { border: 'border-gray-400',    bg: 'bg-gray-50',    text: 'text-gray-500',    hex: '#6b7280', soft: '#f3f4f6', ink: '#1f2937', badge: 'bg-gray-100 text-gray-800 border-gray-300' },
  blue:    { border: 'border-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-500',    hex: '#3b82f6', soft: '#dbeafe', ink: '#1e40af', badge: 'bg-blue-100 text-blue-800 border-blue-300' },
  purple:  { border: 'border-purple-400',  bg: 'bg-purple-50',  text: 'text-purple-500',  hex: '#a855f7', soft: '#f3e8ff', ink: '#6b21a8', badge: 'bg-purple-100 text-purple-800 border-purple-300' },
  green:   { border: 'border-green-400',   bg: 'bg-green-50',   text: 'text-green-500',   hex: '#22c55e', soft: '#dcfce7', ink: '#166534', badge: 'bg-green-100 text-green-800 border-green-300' },
  orange:  { border: 'border-orange-400',  bg: 'bg-orange-50',  text: 'text-orange-500',  hex: '#f97316', soft: '#ffedd5', ink: '#9a3412', badge: 'bg-orange-100 text-orange-800 border-orange-300' },
  teal:    { border: 'border-teal-400',    bg: 'bg-teal-50',    text: 'text-teal-500',    hex: '#14b8a6', soft: '#ccfbf1', ink: '#115e59', badge: 'bg-teal-100 text-teal-800 border-teal-300' },
  cyan:    { border: 'border-cyan-400',    bg: 'bg-cyan-50',    text: 'text-cyan-500',    hex: '#06b6d4', soft: '#cffafe', ink: '#155e75', badge: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  amber:   { border: 'border-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-500',   hex: '#f59e0b', soft: '#fef3c7', ink: '#92400e', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  pink:    { border: 'border-pink-400',    bg: 'bg-pink-50',    text: 'text-pink-500',    hex: '#ec4899', soft: '#fce7f3', ink: '#9d174d', badge: 'bg-pink-100 text-pink-800 border-pink-300' },
  red:     { border: 'border-red-400',     bg: 'bg-red-50',     text: 'text-red-500',     hex: '#ef4444', soft: '#fee2e2', ink: '#991b1b', badge: 'bg-red-100 text-red-800 border-red-300' },
  indigo:  { border: 'border-indigo-400',  bg: 'bg-indigo-50',  text: 'text-indigo-500',  hex: '#6366f1', soft: '#e0e7ff', ink: '#3730a3', badge: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  fuchsia: { border: 'border-fuchsia-400', bg: 'bg-fuchsia-50', text: 'text-fuchsia-500', hex: '#d946ef', soft: '#fae8ff', ink: '#86198f', badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300' },
  sky:     { border: 'border-sky-400',     bg: 'bg-sky-50',     text: 'text-sky-500',     hex: '#0ea5e9', soft: '#e0f2fe', ink: '#075985', badge: 'bg-sky-100 text-sky-800 border-sky-300' },
  yellow:  { border: 'border-yellow-400',  bg: 'bg-yellow-50',  text: 'text-yellow-500',  hex: '#eab308', soft: '#fef9c3', ink: '#854d0e', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  emerald: { border: 'border-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-500', hex: '#10b981', soft: '#d1fae5', ink: '#065f46', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
};

const PALETTE_BY_BORDER = new Map(Object.values(TYPE_HUE_PALETTE).map((p) => [p.border, p]));

// =============================================================================
// TYPE COLUMNS - Colonnes de la vue Types (tous les types sauf le type par défaut)
// =============================================================================
export const TYPE_COLUMNS: { id: ItemType; label: string; color: string; bgHover: string }[] = ITEM_TYPE_REGISTRY
  .filter((t) => t.id !== DEFAULT_ITEM_TYPE)
  .map((t) => ({ id: t.id, label: t.plural, color: TYPE_HUE_PALETTE[t.hue].border, bgHover: TYPE_HUE_PALETTE[t.hue].bg }));

// =============================================================================
// TYPE COLOR HELPERS - Couleur d'un type : celle de la communauté (typeLabels) sinon celle du registre.
// Toute vue (y compris les graphes en hexadécimal) passe par ici : jamais de table de couleurs par type ailleurs.
// =============================================================================
export function getTypeColor(type: string, typeLabels?: Record<string, TypeLabelConfig>) {
  const config = typeLabels?.[type] || DEFAULT_TYPE_LABELS[type];
  return {
    color: config?.color || 'border-gray-400',
    bgHover: config?.bgHover || 'bg-gray-50',
  };
}

// Retourne la couleur de texte correspondant au type
export function getTypeTextColor(type: string, typeLabels?: Record<string, TypeLabelConfig>) {
  const { color } = getTypeColor(type, typeLabels);
  return PALETTE_BY_BORDER.get(color)?.text || 'text-gray-500';
}

/** Couleur hexadécimale du type (graphes SVG / canvas) ; gris pour un type inconnu */
export function getTypeHex(type: string, typeLabels?: Record<string, TypeLabelConfig>): string {
  const { color } = getTypeColor(type, typeLabels);
  return PALETTE_BY_BORDER.get(color)?.hex || TYPE_HUE_PALETTE.gray.hex;
}

/** Jeu de couleurs hexadécimales du type pour une pastille sur fond clair (Calendrier) : fond, bordure, texte */
export function getTypeHexSet(type: string, typeLabels?: Record<string, TypeLabelConfig>): { bg: string; border: string; text: string } {
  const { color } = getTypeColor(type, typeLabels);
  const p = PALETTE_BY_BORDER.get(color) || TYPE_HUE_PALETTE.gray;
  return { bg: p.soft, border: p.hex, text: p.ink };
}

/** Options de filtre par type des pages transverses (/tasks, tableau de bord) : tous les types, couleur du registre */
export const TYPE_FILTER_OPTIONS: { id: ItemType; label: string; color: string }[] = ITEM_TYPE_REGISTRY.map((t) => ({
  id: t.id, label: t.label, color: TYPE_HUE_PALETTE[t.hue].badge,
}));

/**
 * Couleur hexadécimale d'un statut (graphes : Flux cumulatif, répartitions) tirée de la couleur de son badge dans le
 * référentiel (`bg-<teinte>-100 …`) — jamais de table de couleurs par statut. Statut inconnu : gris.
 */
export function getStatusHex(statusId: string | null | undefined, statuses: StatusConfig[] = DEFAULT_STATUSES): string {
  const id = !statusId || statusId === 'none' ? 'undefined' : statusId;
  const color = (statuses.find((s) => s.id === id) ?? DEFAULT_STATUSES.find((s) => s.id === id))?.color ?? '';
  const hue = /bg-([a-z]+)-\d+/.exec(color)?.[1] as TypeHue | undefined;
  return (hue && TYPE_HUE_PALETTE[hue]?.hex) || TYPE_HUE_PALETTE.gray.hex;
}

/** Libellé du type (singulier), renommé par la communauté s'il y a lieu */
export function getTypeLabel(type: string, typeLabels?: Record<string, TypeLabelConfig>): string {
  return typeLabels?.[type]?.labelShort || TYPE_LABELS[type] || type;
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
