/* Utilitaires du Gantt : calculs de dates/positions de barres, plages visibles, snapping, chemin
 * critique (ordonnancement = isOrderingRelation : blocks et implements, comme le PERT). */
import type { StatusConfig } from '@spok/shared';
import type { Item, ItemRelation } from '@spok/shared';
import { isOrderingRelation } from '../../constants/relationTypes';

/**
 * Fin de référence d'un déplacement du corps de barre (TimelineView, drag 'move') : la fin
 * AFFICHÉE, pour que la barre se déplace telle qu'on la voit (décision Thomas 2026-09-28).
 * - endDate enregistrée → elle-même
 * - début (ou échéance servant de début) sans fin → la barre est dessinée jusqu'à aujourd'hui :
 *   fin = maintenant, jamais avant le début. Sans ça, fin = début + delta et la barre se réduisait
 *   à un jour près de son début, souvent hors de la période affichée (« elle disparaît »).
 * - aucune date → undefined (inchangé : barre fantôme d'un jour).
 */
export function moveInitialEnd(
  item: { startDate?: string | Date | null; endDate?: string | Date | null; dueDate?: string | Date | null },
  now: Date = new Date(),
): Date | undefined {
  if (item.endDate) return new Date(item.endDate);
  const start = item.startDate || item.dueDate;
  if (!start) return undefined;
  const startDate = new Date(start);
  return startDate > now ? startDate : now;
}

/**
 * CPM — retourne l'ensemble des IDs d'items sur le chemin critique.
 * Retourne un Set vide si le graphe contient un cycle.
 *
 * Relations (isOrderingRelation, source unique relationTypes — même règle que le PERT) :
 *   - blocks / implements (from=A, to=B) : A est prédécesseur de B
 *   - drives, relates, types hors liste : n'ordonnent pas
 *
 * Seuls les items ayant au moins une relation d'ordre participent (item isolé : jamais critique).
 * Items sans dates mais reliés : durée = 0 (jalons).
 * Fin de chaîne : date au plus tard = fin du projet (EF maximal) — CPM standard (2026-09-28) : une
 * chaîne courte qui finit avant la fin du projet a de la marge et n'est pas critique.
 */
export function computeCriticalPath(items: Item[], relations: ItemRelation[]): Set<string> {
  // 1. Construire le graphe de précédence
  // predecessors[id] = liste des IDs qui doivent finir avant id
  // successors[id]   = liste des IDs qui commencent après id
  const predecessors = new Map<string, string[]>();
  const successors   = new Map<string, string[]>();
  const itemSet      = new Set(items.map(i => i.id));

  for (const item of items) {
    predecessors.set(item.id, []);
    successors.set(item.id, []);
  }

  for (const rel of relations) {
    const from = rel.fromItemId;
    const to   = rel.toItemId;
    if (!itemSet.has(from) || !itemSet.has(to)) continue;

    if (isOrderingRelation(rel.type)) {
      // from doit finir avant to
      predecessors.get(to)!.push(from);
      successors.get(from)!.push(to);
    }
  }

  // 2. Identifier les items inclus dans le calcul
  const hasDeps = (id: string) =>
    (predecessors.get(id)?.length ?? 0) > 0 || (successors.get(id)?.length ?? 0) > 0;

  // Seuls les items reliés par une relation d'ordre participent (un item isolé n'a pas de chemin)
  const durationsMs = new Map<string, number>();
  for (const item of items) {
    if (!hasDeps(item.id)) continue;
    const hasDate = item.startDate && item.endDate;
    durationsMs.set(item.id, hasDate
      ? new Date(item.endDate!).getTime() - new Date(item.startDate!).getTime()
      : 0); // sans dates : jalon
  }

  const included = Array.from(durationsMs.keys());
  if (included.length === 0) return new Set();

  // 3. Tri topologique (Kahn) — détecte les cycles
  const inDegree = new Map<string, number>();
  for (const id of included) {
    const preds = predecessors.get(id)!.filter(p => durationsMs.has(p));
    inDegree.set(id, preds.length);
  }

  const queue: string[] = [];
  for (const id of included) {
    if (inDegree.get(id) === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    topoOrder.push(cur);
    for (const succ of (successors.get(cur) ?? []).filter(s => durationsMs.has(s))) {
      const deg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, deg);
      if (deg === 0) queue.push(succ);
    }
  }

  if (topoOrder.length !== included.length) return new Set(); // cycle détecté

  // 4. Forward pass — ES / EF en ms epoch
  const ES = new Map<string, number>();
  const EF = new Map<string, number>();

  for (const id of topoOrder) {
    const item = items.find(i => i.id === id)!;
    const preds = predecessors.get(id)!.filter(p => durationsMs.has(p));
    let es: number;
    if (preds.length === 0) {
      es = item.startDate ? new Date(item.startDate).getTime() : 0;
    } else {
      es = Math.max(...preds.map(p => EF.get(p) ?? 0));
    }
    ES.set(id, es);
    EF.set(id, es + durationsMs.get(id)!);
  }

  // 5. Backward pass — LS / LF en ms epoch. Fin de chaîne : LF = fin du projet (EF maximal), pas son
  // propre EF — sinon toute fin de chaîne aurait une marge nulle et ressortirait critique.
  const LS = new Map<string, number>();
  const LF = new Map<string, number>();
  const projectEnd = Math.max(...Array.from(EF.values()));

  for (const id of [...topoOrder].reverse()) {
    const succs = (successors.get(id) ?? []).filter(s => durationsMs.has(s));
    const lf = succs.length === 0
      ? projectEnd
      : Math.min(...succs.map(s => LS.get(s) ?? Infinity));
    LF.set(id, lf);
    LS.set(id, lf - durationsMs.get(id)!);
  }

  // 6. Slack ≤ 60s → critique
  const SLACK_THRESHOLD_MS = 60 * 1000;
  const critical = new Set<string>();
  for (const id of included) {
    const slack = (LS.get(id) ?? 0) - (ES.get(id) ?? 0);
    if (slack <= SLACK_THRESHOLD_MS) critical.add(id);
  }

  return critical;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function differenceInDays(date1: Date, date2: Date): number {
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  return Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDateFull(date: Date): string {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getMonthName(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'short' });
}

// Get status color from referentiels
export function getStatusColor(status: string | null | undefined, statuses: StatusConfig[]): string {
  if (!status) {
    const undefinedStatus = statuses.find(s => s.id === 'undefined');
    return undefinedStatus?.color || 'bg-slate-100 text-slate-600';
  }
  const statusConfig = statuses.find(s => s.id === status);
  if (!statusConfig) return 'bg-gray-100 text-gray-800';
  return statusConfig.color;
}
