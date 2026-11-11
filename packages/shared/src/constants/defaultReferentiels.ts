/* Référentiels par défaut : statuts (couleurs, ordre) et labels de types — base des personnalisations.
   DEFAULT_TYPE_LABELS est dérivé du registre des types (typeRegistry.ts) : ne rien y écrire à la main.
   Chaque statut porte sa catégorie (category : sens terminé / en cours / en retard…, constants/statusCategory.ts).
   labelShort en toutes lettres (« Réunion », « Période »… — décision Thomas 2026-10-29, plus d'abréviations) ;
   une communauté aux référentiels personnalisés garde ses propres libellés. (DEFAULT_BUGS_VIEW_TAG retiré avec la vue
   Bugs le 2026-11-11.)
   Statuts réservés à un type (StatusConfig.types) : les 4 issues d'une question (QUESTION_STATUS) ne sont proposées
   que pour une Question, qui n'utilise qu'elles — statusesForType / statusAllowedForType sont la source unique de ce tri (API, MCP, web) ;
   withDefaultStatuses les rajoute à un référentiel personnalisé qui ne les a pas et rétablit leur réservation. */
import type { StatusConfig, TypeLabelConfig, SpaceReferentiels } from '../types/referentiels.js';
import { ITEM_TYPE_REGISTRY } from './typeRegistry.js';

// =============================================================================
// DEFAULT STATUS CONFIGS - Configuration par défaut des statuts
// =============================================================================

export const DEFAULT_STATUSES: StatusConfig[] = [
  {
    id: 'undefined',
    label: 'Non défini',
    color: 'bg-indigo-100 text-indigo-700',
    borderColor: 'border-indigo-300 bg-indigo-50',
    order: 0,
    visible: true,
    category: 'none',
  },
  {
    id: 'todo',
    label: 'À faire',
    color: 'bg-yellow-100 text-yellow-800',
    borderColor: 'border-yellow-300 bg-yellow-50',
    order: 1,
    visible: true,
    category: 'open',
  },
  {
    id: 'scheduled',
    label: 'Planifié',
    color: 'bg-blue-100 text-blue-800',
    borderColor: 'border-blue-300 bg-blue-50',
    order: 2,
    visible: true,
    category: 'open',
    deferredByDate: true,
  },
  {
    id: 'in_progress',
    label: 'En cours',
    color: 'bg-orange-100 text-orange-800',
    borderColor: 'border-orange-300 bg-orange-50',
    order: 3,
    visible: true,
    category: 'active',
  },
  {
    id: 'late',
    label: 'En retard',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300 bg-red-50',
    order: 4,
    visible: true,
    category: 'late',
  },
  {
    id: 'to_validate',
    label: 'À valider',
    color: 'bg-purple-100 text-purple-800',
    borderColor: 'border-purple-300 bg-purple-50',
    order: 5,
    visible: true,
    category: 'review',
  },
  {
    id: 'done',
    label: 'Terminé',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300 bg-green-50',
    order: 6,
    visible: true,
    category: 'done',
  },
  {
    id: 'cancelled',
    label: 'Annulé',
    color: 'bg-pink-100 text-pink-800',
    borderColor: 'border-pink-300 bg-pink-50',
    order: 7,
    visible: true,
    category: 'cancelled',
  },
  // Issues d'une question (type QUESTION, 2026-11-08) — réservées à ce type
  {
    id: 'question_open',
    label: 'Ouverte',
    color: 'bg-sky-100 text-sky-800',
    borderColor: 'border-sky-300 bg-sky-50',
    order: 8,
    visible: true,
    category: 'open',
    types: ['QUESTION'],
  },
  {
    id: 'question_decided',
    label: 'Tranchée',
    color: 'bg-emerald-100 text-emerald-800',
    borderColor: 'border-emerald-300 bg-emerald-50',
    order: 9,
    visible: true,
    category: 'done',
    types: ['QUESTION'],
  },
  {
    id: 'question_postponed',
    label: 'Reportée',
    color: 'bg-amber-100 text-amber-800',
    borderColor: 'border-amber-300 bg-amber-50',
    order: 10,
    visible: true,
    category: 'open',
    types: ['QUESTION'],
  },
  {
    id: 'question_no_conclusion',
    label: 'Sans conclusion',
    color: 'bg-slate-100 text-slate-700',
    borderColor: 'border-slate-300 bg-slate-50',
    order: 11,
    visible: true,
    category: 'cancelled',
    types: ['QUESTION'],
  },
];

/** Identifiants des issues d'une question (statuts réservés au type QUESTION). */
export const QUESTION_STATUS = {
  OPEN: 'question_open',
  DECIDED: 'question_decided',
  POSTPONED: 'question_postponed',
  NO_CONCLUSION: 'question_no_conclusion',
} as const;

/** Statuts réservés livrés par défaut : non supprimables, réservation non modifiable. */
export const RESERVED_STATUS_IDS: string[] = DEFAULT_STATUSES.filter((s) => s.types?.length).map((s) => s.id);

/**
 * Un statut est-il permis pour ce type ? Un type qui a des statuts réservés (QUESTION) n'utilise QUE ceux-là ;
 * les autres types utilisent les statuts sans réservation. Vide / 'undefined' / 'none' = toujours permis
 * (sauf pour une question, que l'API remet à « Ouverte »).
 */
export function statusAllowedForType(
  statusId: string | null | undefined,
  type: string | null | undefined,
  statuses: StatusConfig[] = DEFAULT_STATUSES,
): boolean {
  if (!statusId || statusId === 'undefined' || statusId === 'none') return true;
  const all = withDefaultStatuses(statuses);
  const cfg = all.find((s) => s.id === statusId);
  const typeHasReserved = !!type && all.some((s) => s.types?.includes(type));
  if (typeHasReserved) return !!cfg?.types?.includes(type!);
  // Statut inconnu de cette liste (statut propre à une communauté) : permis s'il n'est pas réservé
  return !cfg?.types?.length;
}

/**
 * Statuts proposés au choix pour un élément de ce type : ses statuts réservés s'il en a (une question ne
 * propose que ses 4 issues), sinon les statuts sans réservation. Sans type (choix groupé, filtre global) :
 * les statuts sans réservation.
 */
export function statusesForType<T extends StatusConfig>(statuses: T[], type: string | null | undefined): T[] {
  const reserved = type ? statuses.filter((s) => s.types?.includes(type)) : [];
  if (reserved.length > 0) return reserved;
  return statuses.filter((s) => !s.types?.length);
}

/**
 * Statuts à montrer pour un ensemble d'éléments (colonnes du Kanban, filtres, regroupements) : les statuts sans
 * réservation + les statuts réservés dont un type est présent (les issues d'une question n'apparaissent que si
 * l'espace contient une question).
 */
export function statusesForItems<T extends StatusConfig>(statuses: T[], items: Iterable<{ type?: string | null }>): T[] {
  const present = new Set<string>();
  for (const it of items) if (it.type) present.add(it.type);
  return statuses.filter((s) => !s.types?.length || s.types.some((t) => present.has(t)));
}

/**
 * Statuts réservés absents d'un référentiel personnalisé (enregistré avant leur création) : ajoutés ; présents :
 * leur réservation et leur catégorie sont rétablies (libellé, couleur, ordre, visibilité personnalisés conservés).
 */
export function withDefaultStatuses(statuses: StatusConfig[]): StatusConfig[] {
  const out = statuses.map((s) => {
    const def = DEFAULT_STATUSES.find((d) => d.id === s.id && d.types?.length);
    return def ? { ...s, types: def.types, category: def.category } : s;
  });
  for (const def of DEFAULT_STATUSES) {
    if (def.types?.length && !out.some((s) => s.id === def.id)) out.push({ ...def });
  }
  return out;
}

// =============================================================================
// DEFAULT TYPE LABELS - Configuration par défaut des labels de types
// =============================================================================

// Dérivé du registre des types (typeRegistry.ts) : libellé pluriel, libellé court, teinte, ordre (Non défini en tête)
export const DEFAULT_TYPE_LABELS: Record<string, TypeLabelConfig> = Object.fromEntries(
  ITEM_TYPE_REGISTRY.map((t, i): [string, TypeLabelConfig] => [
    t.id,
    {
      label: t.plural,
      labelShort: t.label,
      color: `border-${t.hue}-400`,
      bgHover: `bg-${t.hue}-50`,
      visible: true,
      order: i - 1,
    },
  ]),
);

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
  // Alias '' and 'none' → 'undefined' so items with empty/null status show as "Non défini"
  if (map['undefined']) {
    map[''] = map['undefined'];
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
  // Alias '' → 'undefined' so items with empty status show label "Non défini"
  if (map['undefined']) {
    map[''] = map['undefined'];
  }
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
