/*
 * Helpers purs d'échéance pour le Gantt (TimelineView) : clic droit sur une ligne = poser/déplacer
 * l'échéance au jour sous le curseur, glisser le losange = la déplacer.
 * - dayAtLaneX : jour (minuit local) correspondant à une position x en px depuis le bord gauche de la
 *   zone chronologique de la ligne. Arithmétique calendaire (setDate), sûre aux changements d'heure.
 * - dueDateForDay : ISO de l'échéance pour ce jour — conserve l'heure locale de l'échéance existante,
 *   sinon midi local (évite qu'un décalage de fuseau fasse basculer l'échéance sur la veille).
 */

/** Jour sous la position x (px depuis le bord gauche de la zone chronologique). */
export function dayAtLaneX(x: number, dayWidth: number, visibleStartDate: Date): Date {
  const offset = Math.floor(x / dayWidth);
  const d = new Date(visibleStartDate.getFullYear(), visibleStartDate.getMonth(), visibleStartDate.getDate());
  d.setDate(d.getDate() + offset);
  return d;
}

/** ISO de l'échéance posée sur `day`, en gardant l'heure de `existingDueDate` (sinon 12:00 local). */
export function dueDateForDay(day: Date, existingDueDate: string | null | undefined): string {
  const prev = existingDueDate ? new Date(existingDueDate) : null;
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), prev ? prev.getHours() : 12, prev ? prev.getMinutes() : 0);
  return d.toISOString();
}
