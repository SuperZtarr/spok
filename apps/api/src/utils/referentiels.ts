/*
 * Référentiels d'une communauté : les libellés de types et les statuts sont stockés tels quels (Community.referentiels)
 * au moment de la personnalisation. Un type ajouté depuis (ARTICLE 2026-10-23, QUESTION 2026-11-08) y serait absent →
 * invisible et non créable ; ses statuts réservés (issues d'une question) aussi.
 * withDefaultTypeLabels complète les types manquants avec DEFAULT_TYPE_LABELS, sans jamais toucher un type présent,
 * et les statuts réservés manquants (withDefaultStatuses, réservation rétablie, libellé/couleur personnalisés gardés).
 * À appliquer à toute LECTURE de référentiels personnalisés (routes referentiels.ts, community-referentiels.ts).
 */
import { DEFAULT_TYPE_LABELS, withDefaultStatuses, type SpaceReferentiels } from '@spok/shared';

export function withDefaultTypeLabels(r: SpaceReferentiels): SpaceReferentiels {
  return { ...r, statuses: withDefaultStatuses(r.statuses), typeLabels: { ...DEFAULT_TYPE_LABELS, ...r.typeLabels } };
}
