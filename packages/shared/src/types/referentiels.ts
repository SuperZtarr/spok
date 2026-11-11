// =============================================================================
// REFERENTIELS TYPES - Types pour la configuration des référentiels par espace
// Statut : StatusConfig (category = son sens, 2026-11-08). Type d'élément : TypeLabelConfig (surcharge de communauté
// sur le registre des types).
// =============================================================================

/** Sens d'un statut (constants/statusCategory.ts) : seul repère des règles « terminé », « en cours »… */
export type StatusCategory = 'none' | 'open' | 'active' | 'review' | 'late' | 'done' | 'cancelled';

/**
 * Configuration d'un statut personnalisable
 */
export interface StatusConfig {
  id: string;           // ex: "todo"
  label: string;        // ex: "À faire"
  color: string;        // ex: "bg-gray-100 text-gray-800"
  borderColor: string;  // ex: "border-gray-300 bg-gray-50"
  order: number;
  visible: boolean;
  /**
   * Quand true, les items avec ce statut sont masqués des vues actives
   * si leur startDate est à plus de 30 jours dans le futur.
   * Ils redeviennent visibles normalement quand la date se rapproche.
   */
  deferredByDate?: boolean;
  /**
   * Statut réservé à certains types (ex. issues d'une question : ['QUESTION']). Absent = valable pour tous les
   * types. Un statut réservé n'est proposé que pour ses types (statusesForType) ; les statuts réservés par défaut
   * (RESERVED_STATUS_IDS) ne se suppriment pas et gardent leur réservation (withDefaultStatuses).
   */
  types?: string[];
  /**
   * Sens du statut (terminé, en cours…). Absent (statut personnalisé avant 2026-11-08) : celui du statut par défaut de
   * même id, sinon « à faire » — lire via statusCategory(), jamais directement.
   */
  category?: StatusCategory;
}

/**
 * Configuration d'un label de type
 */
export interface TypeLabelConfig {
  label: string;        // ex: "Notes"
  labelShort: string;   // ex: "Note"
  color: string;        // ex: "border-blue-400"
  bgHover: string;      // ex: "bg-blue-50"
  visible: boolean;
  order: number;
}

/**
 * Configuration complète des référentiels d'un espace
 */
export interface SpaceReferentiels {
  statuses: StatusConfig[];
  typeLabels: Record<string, TypeLabelConfig>;
  // Plus de bugsViewTag : vue Bugs retirée le 2026-11-11 (filtre Tags et vue Tags à la place)
}

/**
 * Réponse API pour les référentiels
 */
export interface ReferentielsResponse {
  referentiels: SpaceReferentiels;
  isDefault: boolean;   // true si les valeurs par défaut sont utilisées
}
