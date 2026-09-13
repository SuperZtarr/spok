/* Décalage calendaire de dates (jour/semaine/mois/année) — utilisé par bulk-duplicate et par la
 * cascade "Entraîne" (item-cascade-shift). +1 mois sur le 31 janvier donne le dernier jour de
 * février (clampé), jamais un débordement type "31 jan + 30 jours" qui roulerait sur début mars. */
export function shiftDate(date: Date, unit: 'day' | 'week' | 'month' | 'year', amount: number): Date {
  const d = new Date(date);
  if (unit === 'day') { d.setDate(d.getDate() + amount); return d; }
  if (unit === 'week') { d.setDate(d.getDate() + amount * 7); return d; }
  const originalDay = d.getDate();
  const targetMonth = unit === 'month' ? d.getMonth() + amount : d.getMonth();
  const targetYear = unit === 'year' ? d.getFullYear() + amount : d.getFullYear();
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  d.setFullYear(targetYear, targetMonth, Math.min(originalDay, daysInTargetMonth));
  return d;
}

export function shiftItemDates<T extends { dueDate: Date | null; startDate: Date | null; endDate: Date | null }>(
  item: T,
  unit: 'day' | 'week' | 'month' | 'year' | undefined,
  amount: number
): { dueDate: Date | null; startDate: Date | null; endDate: Date | null } {
  if (!unit || amount === 0) {
    return { dueDate: item.dueDate, startDate: item.startDate, endDate: item.endDate };
  }
  return {
    dueDate: item.dueDate ? shiftDate(item.dueDate, unit, amount) : null,
    startDate: item.startDate ? shiftDate(item.startDate, unit, amount) : null,
    endDate: item.endDate ? shiftDate(item.endDate, unit, amount) : null,
  };
}
