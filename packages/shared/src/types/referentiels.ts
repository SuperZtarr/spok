// =============================================================================
// REFERENTIELS TYPES - Types pour la configuration des référentiels par espace
// =============================================================================

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
}

/**
 * Réponse API pour les référentiels
 */
export interface ReferentielsResponse {
  referentiels: SpaceReferentiels;
  isDefault: boolean;   // true si les valeurs par défaut sont utilisées
}
