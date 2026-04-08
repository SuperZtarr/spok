import type { StatusConfig } from '../types/referentiels.js';

const DEFERRED_DAYS_THRESHOLD = 30;

/**
 * Retourne true si l'item est "en sommeil" : il a un statut deferredByDate
 * ET sa startDate est à plus de DEFERRED_DAYS_THRESHOLD jours dans le futur.
 * Dans ce cas il est masqué des vues actives jusqu'à ce que la date se rapproche.
 */
export function isItemDeferred(
  item: { status?: string | null; startDate?: string | null },
  statuses: StatusConfig[]
): boolean {
  if (!item.status || !item.startDate) return false;

  const statusConfig = statuses.find((s) => s.id === item.status);
  if (!statusConfig?.deferredByDate) return false;

  const startDate = new Date(item.startDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + DEFERRED_DAYS_THRESHOLD);

  return startDate > threshold;
}

/**
 * Retourne le nombre de jours avant la startDate d'un item planifié.
 * Retourne null si pas de startDate.
 */
export function daysUntilStart(item: { startDate?: string | null }): number | null {
  if (!item.startDate) return null;
  const diff = new Date(item.startDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
