// =============================================================================
// Date utilities — zero dependencies, French locale
// =============================================================================

export const MONTH_NAMES_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export const MONTH_NAMES_SHORT_FR = [
  'janv.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

export const DAY_NAMES_SHORT_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// --- Arithmetic ---

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Round to the nearest 15-minute increment (forward) */
export function roundToQuarter(date: Date): Date {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  d.setMinutes(rounded, 0, 0);
  return d;
}

// --- Difference ---

/** Difference in milliseconds between two datetime-local strings */
export function diffMs(a: string, b: string): number {
  if (!a || !b) return 0;
  return new Date(b).getTime() - new Date(a).getTime();
}

// --- Calendar grid ---

/**
 * Returns a 42-day grid (6 weeks) for a given month.
 * Week starts on Monday (ISO).
 */
export function getCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  // Day of week: 0=Sun → we want Mon=0
  let dayOfWeek = firstDay.getDay();
  if (dayOfWeek === 0) dayOfWeek = 7; // Sunday → 7
  const start = addDays(firstDay, -(dayOfWeek - 1)); // back to Monday

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(addDays(start, i));
  }
  return days;
}

// --- Formatting ---

export function formatDateShort(date: Date): string {
  const day = date.getDate();
  const month = MONTH_NAMES_SHORT_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function formatTimeShort(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// --- Conversion datetime-local ↔ Date ---

/** Date → "YYYY-MM-DDTHH:mm" (local time, for <input type="datetime-local">) */
export function toDatetimeLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}

/** "YYYY-MM-DDTHH:mm" → Date (local time) */
export function fromDatetimeLocal(str: string): Date {
  if (!str) return new Date();
  return new Date(str);
}

/** Check if two dates are the same calendar day */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
