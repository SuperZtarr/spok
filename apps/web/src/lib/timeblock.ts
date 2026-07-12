/*
 * Calculs purs du time-blocking de la page Ma journée : arrondi 15 min et recherche
 * du premier créneau libre parmi des intervalles occupés (réunions + blocs placés).
 * Aucune dépendance UI — testé unitairement. Ne pas déplacer côté serveur : les
 * bornes de journée sont une affaire de fuseau client.
 */
export interface BusyInterval { start: Date; end: Date }

const Q = 15 * 60 * 1000;

export function snapTo15(d: Date): Date {
  return new Date(Math.floor(d.getTime() / Q) * Q);
}

/**
 * Premier créneau libre de `durationMin` minutes, à partir de max(now arrondi au quart
 * d'heure supérieur, dayStart), en sautant les intervalles occupés. null si rien ne rentre.
 */
export function findFreeSlot(
  busy: BusyInterval[],
  durationMin: number,
  now: Date,
  dayStart: Date,
  dayEnd: Date,
): Date | null {
  const durMs = durationMin * 60 * 1000;
  let cursor = Math.max(Math.ceil(now.getTime() / Q) * Q, dayStart.getTime());
  const sorted = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const b of sorted) {
    if (b.end.getTime() <= cursor) continue;
    if (b.start.getTime() - cursor >= durMs) return new Date(cursor);
    cursor = Math.max(cursor, Math.ceil(b.end.getTime() / Q) * Q);
  }
  if (dayEnd.getTime() - cursor >= durMs) return new Date(cursor);
  return null;
}
