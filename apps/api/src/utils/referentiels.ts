/*
 * Référentiels d'une communauté : les libellés de types sont stockés tels quels (Community.referentiels) au moment
 * de la personnalisation. Un type ajouté depuis (ARTICLE, 2026-10-23) y serait absent → invisible et non créable.
 * withDefaultTypeLabels complète les types manquants avec DEFAULT_TYPE_LABELS, sans jamais toucher un type présent.
 * À appliquer à toute LECTURE de référentiels personnalisés (routes referentiels.ts, community-referentiels.ts).
 */
import { DEFAULT_TYPE_LABELS, type SpaceReferentiels } from '@spok/shared';

export function withDefaultTypeLabels(r: SpaceReferentiels): SpaceReferentiels {
  return { ...r, typeLabels: { ...DEFAULT_TYPE_LABELS, ...r.typeLabels } };
}
