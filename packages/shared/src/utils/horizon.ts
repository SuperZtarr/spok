/*
 * Horizon temporel effectif d'un item (spec 2026-07-19-horizons-revue-design) :
 * - avec dueDate → dérivé automatiquement de la date, jamais stocké (recalcul à chaque lecture)
 * - sans dueDate → manualHorizon tel quel (null = bac à trier)
 * isOverdueForReview : grâce par horizon depuis horizonSetAt avant remontée en revue —
 * uniquement pour les items SANS dueDate (ceux avec échéance sont toujours "à jour" par
 * recalcul). LATER ne remonte jamais : c'est un horizon de repos, pas d'attente.
 * Fuseau fixé sur Europe/Paris (via Intl.DateTimeFormat) plutôt que le fuseau local du
 * process : ce module tourne à la fois côté API (Railway, probablement UTC) et côté
 * navigateur (Thomas, Europe/Paris) — SPOK est un outil mono-utilisateur, pas besoin de
 * gérer plusieurs fuseaux utilisateurs, juste d'être cohérent entre les deux environnements.
 */
export type HorizonBucket = 'NOW' | 'TODAY' | 'WEEK' | 'MONTH' | 'LATER'

export const HORIZON_LABELS: Record<HorizonBucket, string> = {
  NOW: 'Maintenant',
  TODAY: "Aujourd'hui",
  WEEK: 'Cette semaine',
  MONTH: 'Ce mois',
  LATER: 'Plus tard',
}

/** Ordre d'affichage du plus urgent au plus lointain. */
export const HORIZON_ORDER: HorizonBucket[] = ['NOW', 'TODAY', 'WEEK', 'MONTH', 'LATER']

const HORIZON_TIMEZONE = 'Europe/Paris'

/** Composants année/mois/jour d'une date dans le fuseau Europe/Paris — indépendant du fuseau du process. */
function parisDateParts(d: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HORIZON_TIMEZONE,
    year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: Number(get('year')),
    month: Number(get('month')) - 1, // 0-indexé, cohérent avec Date.getMonth()
    day: Number(get('day')),
    weekday: WEEKDAYS.indexOf(get('weekday')),
  }
}

/** Minuit Europe/Paris du jour calendaire de `d`, exprimé en instant UTC absolu comparable à d'autres Date. */
function parisMidnight(d: Date): Date {
  const { year, month, day } = parisDateParts(d)
  // new Date(Date.UTC(...)) construit un instant absolu — la comparaison avec `due` (elle-même
  // un instant absolu) reste correcte quel que soit le fuseau du process qui exécute ce code.
  // Approximation acceptée : ne gère pas le décalage exact UTC+1/+2 (heure d'été), suffisant
  // pour classer un jour calendaire, l'erreur possible est de quelques heures au pire aux
  // frontières DST, sans impact sur le classement horizon (granularité jour/semaine/mois).
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
}

interface HorizonInput {
  dueDate?: string | Date | null
  manualHorizon?: HorizonBucket | null
}

export function effectiveHorizon(item: HorizonInput, now: Date = new Date()): HorizonBucket | null {
  if (item.dueDate) {
    const due = new Date(item.dueDate)
    const startOfToday = parisMidnight(now)
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1)
    if (due <= endOfToday) return 'NOW'

    const { weekday } = parisDateParts(now)
    // Semaine lundi→dimanche : (7-weekday) % 7 = jours restants jusqu'à dimanche inclus,
    // 0 quand `now` est déjà dimanche (dernier jour de la semaine courante — le lendemain
    // appartient à la semaine suivante). Puis fin de journée (+1 jour -1ms) sur ce jour-là.
    const daysToWeekEnd = (7 - weekday) % 7
    const endOfWeek = new Date(startOfToday.getTime() + (daysToWeekEnd + 1) * 24 * 60 * 60 * 1000 - 1)
    if (due <= endOfWeek) return 'WEEK'

    const { year, month } = parisDateParts(now)
    // Premier jour du mois suivant, minuit Paris, moins 1ms = fin du mois courant en Paris.
    const startOfNextMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0))
    const endOfMonth = new Date(startOfNextMonth.getTime() - 1)
    if (due <= endOfMonth) return 'MONTH'

    return 'LATER'
  }
  return item.manualHorizon ?? null
}

const GRACE_DAYS: Partial<Record<HorizonBucket, number>> = {
  NOW: 1,
  TODAY: 1,
  WEEK: 10,
  MONTH: 35,
  // LATER volontairement absent : jamais de grâce, jamais de remontée automatique
}

interface OverdueInput extends HorizonInput {
  horizonSetAt?: string | Date | null
}

export function isOverdueForReview(item: OverdueInput, now: Date = new Date()): boolean {
  if (item.dueDate) return false
  if (!item.manualHorizon || !item.horizonSetAt) return false
  const graceDays = GRACE_DAYS[item.manualHorizon]
  if (graceDays === undefined) return false // LATER
  const deadline = new Date(item.horizonSetAt)
  deadline.setDate(deadline.getDate() + graceDays)
  return now > deadline
}
