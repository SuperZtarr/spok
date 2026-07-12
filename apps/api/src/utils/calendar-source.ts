/*
 * Ingestion des calendriers externes de la page Ma journée.
 * parseIcs : texte ICS → CalendarEvent[] dans la fenêtre [from, to[ (récurrences RRULE dépliées).
 * IcsFeedSource : implémentation CalendarSource par URL ICS, avec cache mémoire 15 min sur le
 * texte brut (clé = feedId). C'est LA frontière à réutiliser si on branche Microsoft Graph un jour.
 * Règle : ne jamais loguer l'URL d'un feed (secret utilisateur).
 */
import ical from 'node-ical'

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO
  end: string | null
  allDay: boolean
  location?: string
}

export interface CalendarSource {
  fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]>
}

const DEFAULT_DURATION_MS = 60 * 60 * 1000

/** node-ical peut renvoyer summary/location comme string ou objet { params, val }. */
function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'val' in value) return String((value as { val: unknown }).val)
  return undefined
}

export function parseIcs(icsText: string, from: Date, to: Date): CalendarEvent[] {
  let parsed: ical.CalendarResponse
  try {
    parsed = ical.sync.parseICS(icsText)
  } catch {
    return []
  }
  const events: CalendarEvent[] = []
  for (const key of Object.keys(parsed)) {
    const ev = parsed[key]
    if (ev.type !== 'VEVENT') continue
    const vevent = ev as ical.VEvent
    const durationMs = vevent.end && vevent.start
      ? vevent.end.getTime() - vevent.start.getTime()
      : DEFAULT_DURATION_MS
    const allDay = (vevent.datetype as string | undefined) === 'date'

    if (vevent.rrule) {
      // Récurrence : instances dont le DÉBUT tombe dans la fenêtre
      const exdates = new Set(
        Object.values(vevent.exdate ?? {}).map((d) => (d as Date).getTime())
      )
      for (const occ of vevent.rrule.between(from, to, true)) {
        if (occ >= to || exdates.has(occ.getTime())) continue
        events.push({
          id: `${vevent.uid}:${occ.toISOString()}`,
          title: asText(vevent.summary) ?? '(sans titre)',
          start: occ.toISOString(),
          end: new Date(occ.getTime() + durationMs).toISOString(),
          allDay,
          location: asText(vevent.location) || undefined,
        })
      }
      continue
    }

    if (!vevent.start) continue
    const start = vevent.start
    const end = vevent.end ?? new Date(start.getTime() + DEFAULT_DURATION_MS)
    // Chevauchement avec la fenêtre [from, to[
    if (end <= from || start >= to) continue
    events.push({
      id: vevent.uid ?? key,
      title: asText(vevent.summary) ?? '(sans titre)',
      start: start.toISOString(),
      end: end.toISOString(),
      allDay,
      location: asText(vevent.location) || undefined,
    })
  }
  return events.sort((a, b) => a.start.localeCompare(b.start))
}

const FETCH_TIMEOUT_MS = 10_000
const CACHE_TTL_MS = 15 * 60 * 1000
const MAX_ICS_BYTES = 2 * 1024 * 1024

const icsCache = new Map<string, { at: number; text: string }>()

/** Vide le cache — réservé aux tests. */
export function _clearIcsCache() {
  icsCache.clear()
}

export class IcsFeedSource implements CalendarSource {
  constructor(private feedId: string, private url: string) {}

  async fetchEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
    const cached = icsCache.get(this.feedId)
    let text: string
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      text = cached.text
    } else {
      const res = await fetch(this.url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`Réponse ${res.status} du calendrier`)
      text = await res.text()
      if (text.length > MAX_ICS_BYTES) throw new Error('Calendrier trop volumineux')
      icsCache.set(this.feedId, { at: Date.now(), text })
    }
    return parseIcs(text, from, to)
  }
}
