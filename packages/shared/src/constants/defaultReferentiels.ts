import type { StatusConfig, TypeLabelConfig, SpaceReferentiels } from '../types/referentiels.js';

// =============================================================================
// DEFAULT STATUS CONFIGS - Configuration par défaut des statuts
// =============================================================================

export const DEFAULT_STATUSES: StatusConfig[] = [
  {
    id: 'undefined',
    label: 'Non défini',
    color: 'bg-slate-100 text-slate-600',
    borderColor: 'border-slate-400 bg-slate-100',
    order: 0,
    visible: true,
  },
  {
    id: 'todo',
    label: 'À faire',
    color: 'bg-yellow-100 text-yellow-800',
    borderColor: 'border-yellow-300 bg-yellow-50',
    order: 1,
    visible: true,
  },
  {
    id: 'in_progress',
    label: 'En cours',
    color: 'bg-orange-100 text-orange-800',
    borderColor: 'border-orange-300 bg-orange-50',
    order: 2,
    visible: true,
  },
  {
    id: 'late',
    label: 'En retard',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300 bg-red-50',
    order: 3,
    visible: true,
  },
  {
    id: 'to_validate',
    label: 'À valider',
    color: 'bg-purple-100 text-purple-800',
    borderColor: 'border-purple-300 bg-purple-50',
    order: 4,
    visible: true,
  },
  {
    id: 'done',
    label: 'Terminé',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300 bg-green-50',
    order: 5,
    visible: true,
  },
  {
    id: 'cancelled',
    label: 'Annulé',
    color: 'bg-gray-100 text-gray-800',
    borderColor: 'border-gray-300 bg-gray-50',
    order: 6,
    visible: true,
  },
];

// =============================================================================
// DEFAULT TYPE LABELS - Configuration par défaut des labels de types
// =============================================================================

export const DEFAULT_TYPE_LABELS: Record<string, TypeLabelConfig> = {
  NOTE: {
    label: 'Notes',
    labelShort: 'Note',
    color: 'border-blue-400',
    bgHover: 'bg-blue-50',
    visible: true,
    order: 0,
  },
  PROJECT: {
    label: 'Projets',
    labelShort: 'Projet',
    color: 'border-purple-400',
    bgHover: 'bg-purple-50',
    visible: true,
    order: 1,
  },
  TASK: {
    label: 'Tâches',
    labelShort: 'Tâche',
    color: 'border-green-400',
    bgHover: 'bg-green-50',
    visible: true,
    order: 2,
  },
  MEETING: {
    label: 'Réunions',
    labelShort: 'Réunion',
    color: 'border-orange-400',
    bgHover: 'bg-orange-50',
    visible: true,
    order: 3,
  },
  PERIOD: {
    label: 'Périodes',
    labelShort: 'Période',
    color: 'border-teal-400',
    bgHover: 'bg-teal-50',
    visible: true,
    order: 4,
  },
  LINK: {
    label: 'Liens',
    labelShort: 'Lien',
    color: 'border-cyan-400',
    bgHover: 'bg-cyan-50',
    visible: true,
    order: 5,
  },
  CONFIG: {
    label: 'Configuration',
    labelShort: 'Config',
    color: 'border-gray-400',
    bgHover: 'bg-gray-50',
    visible: true,
    order: 6,
  },
  DOCUMENT: {
    label: 'Documents',
    labelShort: 'Doc',
    color: 'border-amber-400',
    bgHover: 'bg-amber-50',
    visible: true,
    order: 7,
  },
  IMAGE: {
    label: 'Images',
    labelShort: 'Image',
    color: 'border-pink-400',
    bgHover: 'bg-pink-50',
    visible: true,
    order: 8,
  },
  BUG: {
    label: 'Anomalies',
    labelShort: 'Bug',
    color: 'border-red-400',
    bgHover: 'bg-red-50',
    visible: true,
    order: 9,
  },
};

// =============================================================================
// DEFAULT REFERENTIELS - Configuration complète par défaut
// =============================================================================

export const DEFAULT_REFERENTIELS: SpaceReferentiels = {
  statuses: DEFAULT_STATUSES,
  typeLabels: DEFAULT_TYPE_LABELS,
};

// =============================================================================
// STATUS HELPERS - Conversion StatusConfig[] → Record<string, string>
// =============================================================================

export function buildStatusColorMap(
  statuses: StatusConfig[] = DEFAULT_STATUSES,
): Record<string, string> {
  const map: Record<string, string> = {};
  statuses.forEach((s) => {
    map[s.id] = s.color;
  });
  if (!map['none'] && map['undefined']) {
    map['none'] = map['undefined'];
  }
  return map;
}

export function buildStatusLabelMap(
  statuses: StatusConfig[] = DEFAULT_STATUSES,
): Record<string, string> {
  const map: Record<string, string> = {};
  statuses.forEach((s) => {
    map[s.id] = s.label;
  });
  return map;
}

// =============================================================================
// COLOR PALETTES - Palettes de couleurs disponibles
// =============================================================================

export const BADGE_COLOR_OPTIONS = [
  { id: 'gray', label: 'Gris', color: 'bg-gray-100 text-gray-800', borderColor: 'border-gray-300 bg-gray-50' },
  { id: 'slate', label: 'Ardoise', color: 'bg-slate-100 text-slate-800', borderColor: 'border-slate-300 bg-slate-50' },
  { id: 'blue', label: 'Bleu', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-300 bg-blue-50' },
  { id: 'green', label: 'Vert', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50' },
  { id: 'red', label: 'Rouge', color: 'bg-red-100 text-red-800', borderColor: 'border-red-300 bg-red-50' },
  { id: 'yellow', label: 'Jaune', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50' },
  { id: 'purple', label: 'Violet', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-300 bg-purple-50' },
  { id: 'orange', label: 'Orange', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50' },
  { id: 'pink', label: 'Rose', color: 'bg-pink-100 text-pink-800', borderColor: 'border-pink-300 bg-pink-50' },
  { id: 'cyan', label: 'Cyan', color: 'bg-cyan-100 text-cyan-800', borderColor: 'border-cyan-300 bg-cyan-50' },
  { id: 'amber', label: 'Ambre', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-300 bg-amber-50' },
  { id: 'indigo', label: 'Indigo', color: 'bg-indigo-100 text-indigo-800', borderColor: 'border-indigo-300 bg-indigo-50' },
];

export const BORDER_COLOR_OPTIONS = [
  { id: 'gray', label: 'Gris', color: 'border-gray-400', bgHover: 'bg-gray-50' },
  { id: 'slate', label: 'Ardoise', color: 'border-slate-400', bgHover: 'bg-slate-50' },
  { id: 'blue', label: 'Bleu', color: 'border-blue-400', bgHover: 'bg-blue-50' },
  { id: 'green', label: 'Vert', color: 'border-green-400', bgHover: 'bg-green-50' },
  { id: 'red', label: 'Rouge', color: 'border-red-400', bgHover: 'bg-red-50' },
  { id: 'yellow', label: 'Jaune', color: 'border-yellow-400', bgHover: 'bg-yellow-50' },
  { id: 'purple', label: 'Violet', color: 'border-purple-400', bgHover: 'bg-purple-50' },
  { id: 'orange', label: 'Orange', color: 'border-orange-400', bgHover: 'bg-orange-50' },
  { id: 'pink', label: 'Rose', color: 'border-pink-400', bgHover: 'bg-pink-50' },
  { id: 'cyan', label: 'Cyan', color: 'border-cyan-400', bgHover: 'bg-cyan-50' },
  { id: 'amber', label: 'Ambre', color: 'border-amber-400', bgHover: 'bg-amber-50' },
  { id: 'indigo', label: 'Indigo', color: 'border-indigo-400', bgHover: 'bg-indigo-50' },
];
