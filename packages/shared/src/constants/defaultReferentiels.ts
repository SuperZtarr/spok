/* Référentiels par défaut : statuts (couleurs, ordre) et labels de types — base des personnalisations.
   DEFAULT_TYPE_LABELS est dérivé du registre des types (typeRegistry.ts) : ne rien y écrire à la main.
   Chaque statut porte sa catégorie (category : sens terminé / en cours / en retard…, constants/statusCategory.ts).
   labelShort en toutes lettres (« Réunion », « Période »… — décision Thomas 2026-10-29, plus d'abréviations) ;
   une communauté aux référentiels personnalisés garde ses propres libellés. (DEFAULT_BUGS_VIEW_TAG retiré avec la vue
   Bugs le 2026-11-11.)
   Statuts réservés à un type (StatusConfig.types) : les 4 issues d'une question (QUESTION_STATUS) ne sont proposées
   que pour une Question, qui n'utilise qu'elles — statusesForType / statusAllowedForType sont la source unique de ce tri (API, MCP, web) ;
   statusFamilies / typeInStatusFamily / statusesForFamily en dérivent les familles de statuts (Kanban par famille, 2026-11-19) ;
   withDefaultStatuses les rajoute à un référentiel personnalisé qui ne les a pas et rétablit leur réservation.
   Réunion (7 statuts, terminée = CR envoyé) et Article (4 statuts) ont aussi leurs statuts réservés (2026-11-19) ;
   statusForType normalise le statut d'un élément selon son type (correspondance par catégorie au changement de type).
   nextStatusForType donne le statut suivant (bouton « Passer à … » du menu contextuel, 2026-11-20).
   Question (2026-11-21) : 5 issues — Arbitrée ajoutée (isQuestionAnswered = Tranchée ou Arbitrée), ordre et couleurs
   du sens des tâches ; un référentiel qui avait gardé les anciennes couleurs suit les nouvelles (withDefaultStatuses) ;
   pas de statut suivant pour une question.
   Type sans statut (noStatus du registre, typeHasStatus) : aucun statut proposé, enregistré vide, absent des familles
   du Kanban — aucun type ne l'utilise depuis que la Période a retrouvé les statuts ordinaires (2026-11-25). */
import type { StatusCategory, StatusConfig, TypeLabelConfig, SpaceReferentiels } from '../types/referentiels.js';
import { ITEM_TYPE_REGISTRY, typeHasStatus } from './typeRegistry.js';
import { statusCategory } from './statusCategory.js';

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
  // Issues d'une question (type QUESTION, 2026-11-08) — réservées à ce type. Ordre et couleurs (décision Thomas
  // 2026-11-21, sens des tâches) : Ouverte jaune (à faire), Reportée bleu (suspendu), Tranchée vert (terminé : réponse
  // du groupe), Arbitrée émeraude (terminé : décision d'une autorité), Sans conclusion rouge (annulé).
  {
    id: 'question_open',
    label: 'Ouverte',
    color: 'bg-yellow-100 text-yellow-800',
    borderColor: 'border-yellow-300 bg-yellow-50',
    order: 8,
    visible: true,
    category: 'open',
    types: ['QUESTION'],
  },
  {
    id: 'question_postponed',
    label: 'Reportée',
    color: 'bg-blue-100 text-blue-800',
    borderColor: 'border-blue-300 bg-blue-50',
    order: 9,
    visible: true,
    category: 'open',
    types: ['QUESTION'],
  },
  {
    id: 'question_decided',
    label: 'Tranchée',
    color: 'bg-green-100 text-green-800',
    borderColor: 'border-green-300 bg-green-50',
    order: 10,
    visible: true,
    category: 'done',
    types: ['QUESTION'],
  },
  {
    id: 'question_arbitrated',
    label: 'Arbitrée',
    color: 'bg-emerald-100 text-emerald-800',
    borderColor: 'border-emerald-300 bg-emerald-50',
    order: 10.5,
    visible: true,
    category: 'done',
    types: ['QUESTION'],
  },
  {
    id: 'question_no_conclusion',
    label: 'Sans conclusion',
    color: 'bg-red-100 text-red-800',
    borderColor: 'border-red-300 bg-red-50',
    order: 11,
    visible: true,
    category: 'cancelled',
    types: ['QUESTION'],
  },
  // Statuts d'une réunion (type MEETING, décision Thomas 2026-11-19) — réservés à ce type ; terminée = CR envoyé
  // Classes Tailwind écrites en toutes lettres et déjà présentes dans apps/web/src (le contenu scanné par Tailwind
  // n'inclut pas ce paquet : une classe absente du web ne serait pas générée)
  { id: 'meeting_to_organize', label: 'À organiser', color: 'bg-yellow-100 text-yellow-800', borderColor: 'border-yellow-300 bg-yellow-50', order: 12, visible: true, category: 'open', types: ['MEETING'] },
  { id: 'meeting_planned', label: 'Planifiée', color: 'bg-blue-100 text-blue-800', borderColor: 'border-blue-300 bg-blue-50', order: 13, visible: true, category: 'open', types: ['MEETING'] },
  { id: 'meeting_agenda_sent', label: 'ODJ envoyé', color: 'bg-cyan-100 text-cyan-800', borderColor: 'border-cyan-300 bg-cyan-50', order: 14, visible: true, category: 'open', types: ['MEETING'] },
  { id: 'meeting_held', label: 'Réalisée', color: 'bg-orange-100 text-orange-800', borderColor: 'border-orange-300 bg-orange-50', order: 15, visible: true, category: 'active', types: ['MEETING'] },
  { id: 'meeting_minutes_sent', label: 'CR envoyé', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 16, visible: true, category: 'done', types: ['MEETING'] },
  { id: 'meeting_postponed', label: 'Reportée', color: 'bg-amber-100 text-amber-800', borderColor: 'border-amber-300 bg-amber-50', order: 17, visible: true, category: 'open', types: ['MEETING'] },
  { id: 'meeting_cancelled', label: 'Annulée', color: 'bg-pink-100 text-pink-800', borderColor: 'border-pink-300 bg-pink-50', order: 18, visible: true, category: 'cancelled', types: ['MEETING'] },
  // Statuts d'un article (type ARTICLE, décision Thomas 2026-11-19) — réservés à ce type
  { id: 'article_draft', label: 'Brouillon', color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-300 bg-gray-50', order: 19, visible: true, category: 'open', types: ['ARTICLE'] },
  { id: 'article_to_validate', label: 'À valider', color: 'bg-purple-100 text-purple-800', borderColor: 'border-purple-300 bg-purple-50', order: 20, visible: true, category: 'review', types: ['ARTICLE'] },
  { id: 'article_published', label: 'Publié', color: 'bg-green-100 text-green-800', borderColor: 'border-green-300 bg-green-50', order: 21, visible: true, category: 'done', types: ['ARTICLE'] },
  { id: 'article_cancelled', label: 'Annulé', color: 'bg-pink-100 text-pink-800', borderColor: 'border-pink-300 bg-pink-50', order: 22, visible: true, category: 'cancelled', types: ['ARTICLE'] },
];

/**
 * Types dont le statut ne se déduit jamais de la catégorie au changement de type : une question repart toujours
 * « Ouverte » (son issue se note, elle ne s'hérite pas).
 */
const NO_CATEGORY_MAPPING_TYPES = ['QUESTION'];

/**
 * Statut normalisé pour un type (création, changement de type, MCP, API — source unique, 2026-11-19) :
 * - statut permis pour ce type : gardé (vide gardé pour un type aux statuts ordinaires) ;
 * - type à statuts réservés (Question, Réunion, Article) : statut de même catégorie parmi les siens (sauf Question),
 *   sinon le premier (À organiser, Brouillon, Ouverte) ;
 * - type ordinaire avec un statut réservé à un autre type : statut ordinaire de même catégorie, sinon null.
 * La catégorie d'un statut inconnu de `statuses` (statut propre à une communauté) n'est pas connue : pas de correspondance.
 */
export function statusForType(
  type: string,
  status: string | null | undefined,
  statuses: StatusConfig[] = DEFAULT_STATUSES,
): string | null | undefined {
  if (!typeHasStatus(type)) return null; // Période : jamais de statut (2026-11-19)
  const all = withDefaultStatuses(statuses);
  const own = statusesForType(all, type).filter((s) => s.id !== 'undefined').sort((a, b) => a.order - b.order);
  const reserved = all.some((s) => s.types?.includes(type));
  const empty = !status || status === 'undefined' || status === 'none';
  if (empty) return reserved ? own[0]?.id ?? status : status;
  if (statusAllowedForType(status, type, all)) return status;
  const category = all.find((s) => s.id === status)?.category;
  const match = category && !NO_CATEGORY_MAPPING_TYPES.includes(type) ? own.find((s) => s.category === category) : undefined;
  if (match) return match.id;
  return reserved ? own[0]?.id ?? null : null;
}

/** Identifiants des issues d'une question (statuts réservés au type QUESTION). */
export const QUESTION_STATUS = {
  OPEN: 'question_open',
  DECIDED: 'question_decided',
  POSTPONED: 'question_postponed',
  NO_CONCLUSION: 'question_no_conclusion',
  ARBITRATED: 'question_arbitrated',
} as const;

/**
 * Question répondue : Tranchée (réponse du groupe : une réponse en tête des votes) ou Arbitrée (décision d'une
 * autorité, quelle que soit la réponse) — décision Thomas 2026-11-21. Les deux portent une réponse retenue.
 */
export function isQuestionAnswered(status: string | null | undefined): boolean {
  return status === QUESTION_STATUS.DECIDED || status === QUESTION_STATUS.ARBITRATED;
}

/** Couleur et ordre des issues avant le 2026-11-21 : un référentiel qui les a gardés suit les nouveaux défauts */
const QUESTION_STATUS_BEFORE_2026_11_21: Record<string, { color: string; order: number }> = {
  question_open: { color: 'bg-sky-100 text-sky-800', order: 8 },
  question_decided: { color: 'bg-emerald-100 text-emerald-800', order: 9 },
  question_postponed: { color: 'bg-amber-100 text-amber-800', order: 10 },
  question_no_conclusion: { color: 'bg-slate-100 text-slate-700', order: 11 },
};

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
  if (!typeHasStatus(type)) return false; // Période : aucun statut
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
  if (!typeHasStatus(type)) return []; // Période : aucun statut proposé
  const reserved = type ? statuses.filter((s) => s.types?.includes(type)) : [];
  if (reserved.length > 0) return reserved;
  return statuses.filter((s) => !s.types?.length);
}

/** Rang d'avancement d'une catégorie (statut suivant) : un statut hors parcours avance vers un rang supérieur */
const PROGRESS_RANK: Record<StatusCategory, number> = { none: 0, open: 1, active: 2, late: 2, review: 3, done: 4, cancelled: 4 };

/**
 * Statut suivant d'un élément (bouton du menu contextuel, décision Thomas 2026-11-20) — source unique de cette règle.
 * Parcours = statuts visibles du type, dans l'ordre du référentiel, jusqu'au premier statut « terminé » inclus, sans
 * En retard ni Annulé (ni ce qui suit le premier « terminé » : Reportée d'une réunion ou d'une question).
 * Statut sur le parcours → le statut d'après ; hors parcours (Non défini, En retard, Reportée…) → le premier statut du
 * parcours plus avancé (rang de catégorie supérieur) ; statut final (terminé, annulé) ou fin de parcours → null.
 * Suit l'ordre et les catégories des statuts personnalisés d'une communauté (aucun champ « suivant » à régler).
 */
export function nextStatusForType<T extends StatusConfig>(
  statuses: T[],
  type: string | null | undefined,
  current: string | null | undefined,
): T | null {
  // Question : pas de « statut suivant » — son issue se conclut dans le bloc Question (réponse à valider ou arbitrer)
  if (type === 'QUESTION') return null;
  const own = statusesForType(statuses, type)
    .filter((s) => s.visible !== false && s.id !== 'undefined')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); // listes réduites ({ id, label }) passées par certaines vues
  const catOf = (s: StatusConfig) => statusCategory(s.id, statuses);
  const firstDone = own.findIndex((s) => catOf(s) === 'done');
  const path = (firstDone >= 0 ? own.slice(0, firstDone + 1) : own)
    .filter((s) => !['late', 'cancelled'].includes(catOf(s)));
  const idx = current ? path.findIndex((s) => s.id === current) : -1;
  if (idx >= 0) return path[idx + 1] ?? null;
  const rank = PROGRESS_RANK[statusCategory(current, statuses)];
  if (rank >= PROGRESS_RANK.done) return null;
  return path.find((s) => PROGRESS_RANK[catOf(s)] > rank) ?? null;
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

/** Famille de statuts : types qui partagent les mêmes statuts (types null = tous les types sans statut réservé) */
export interface StatusFamily {
  key: string;
  types: string[] | null;
}
export const GENERAL_STATUS_FAMILY = 'general';

/**
 * Familles de statuts présentes parmi ces éléments (Kanban par famille, décision Thomas 2026-11-19) : « general »
 * si un élément utilise les statuts ordinaires, puis une famille par type à statuts réservés présent (Question…).
 * Dérivé des réservations (StatusConfig.types) : un type qui recevra ses propres statuts deviendra une famille de plus.
 */
export function statusFamilies(statuses: StatusConfig[], items: Iterable<{ type?: string | null }>): StatusFamily[] {
  const reservedTypes = [...new Set(statuses.flatMap((s) => s.types ?? []))];
  const present = new Set<string>();
  let general = false;
  for (const it of items) {
    if (!typeHasStatus(it.type)) continue; // Période : dans aucune famille (absente du Kanban)
    if (it.type && reservedTypes.includes(it.type)) present.add(it.type);
    else general = true;
  }
  return [
    ...(general ? [{ key: GENERAL_STATUS_FAMILY, types: null }] : []),
    ...reservedTypes.filter((t) => present.has(t)).map((t) => ({ key: t, types: [t] })),
  ];
}

/** Un élément de ce type appartient-il à cette famille ? */
export function typeInStatusFamily(statuses: StatusConfig[], family: StatusFamily, type: string | null | undefined): boolean {
  if (family.types) return !!type && family.types.includes(type);
  if (!typeHasStatus(type)) return false;
  return !type || !statuses.some((s) => s.types?.includes(type));
}

/** Statuts (colonnes) d'une famille */
export function statusesForFamily<T extends StatusConfig>(statuses: T[], family: StatusFamily): T[] {
  return statusesForType(statuses, family.types?.[0] ?? null);
}

/**
 * Statuts réservés absents d'un référentiel personnalisé (enregistré avant leur création) : ajoutés ; présents :
 * leur réservation et leur catégorie sont rétablies (libellé, couleur, ordre, visibilité personnalisés conservés).
 */
export function withDefaultStatuses(statuses: StatusConfig[]): StatusConfig[] {
  const out = statuses.map((s) => {
    const def = DEFAULT_STATUSES.find((d) => d.id === s.id && d.types?.length);
    if (!def) return s;
    // Couleur / ordre jamais personnalisés (encore ceux d'avant le 2026-11-21) : suivent les défauts actuels
    const old = QUESTION_STATUS_BEFORE_2026_11_21[s.id];
    const follow = old && s.color === old.color && s.order === old.order;
    return { ...s, types: def.types, category: def.category, ...(follow ? { color: def.color, borderColor: def.borderColor, order: def.order } : {}) };
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
