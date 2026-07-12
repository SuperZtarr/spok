/*
 * TNR du parsing ICS (page Ma journée) : événements simples, récurrences RRULE,
 * journées entières, fenêtrage from/to. Fixtures inline — pas d'appel réseau.
 */
import { describe, it, expect } from 'vitest'
import { parseIcs } from './calendar-source.js'

const SIMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-1
DTSTART:20260715T090000Z
DTEND:20260715T100000Z
SUMMARY:Réunion projet
LOCATION:Teams
END:VEVENT
END:VCALENDAR`

const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-rec
DTSTART:20260701T080000Z
DTEND:20260701T083000Z
RRULE:FREQ=WEEKLY;BYDAY=WE
SUMMARY:Point hebdo
END:VEVENT
END:VCALENDAR`

const ALLDAY_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:ev-day
DTSTART;VALUE=DATE:20260715
DTEND;VALUE=DATE:20260716
SUMMARY:Congé
END:VEVENT
END:VCALENDAR`

describe('parseIcs', () => {
  const from = new Date('2026-07-15T00:00:00Z')
  const to = new Date('2026-07-16T00:00:00Z')

  it('retourne un événement simple dans la fenêtre', () => {
    const events = parseIcs(SIMPLE_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: 'Réunion projet',
      allDay: false,
      location: 'Teams',
    })
    expect(events[0].start).toBe('2026-07-15T09:00:00.000Z')
    expect(events[0].end).toBe('2026-07-15T10:00:00.000Z')
  })

  it('exclut un événement hors fenêtre', () => {
    const events = parseIcs(SIMPLE_ICS, new Date('2026-07-16T00:00:00Z'), new Date('2026-07-17T00:00:00Z'))
    expect(events).toHaveLength(0)
  })

  it('déplie une récurrence hebdomadaire dans la fenêtre (mercredi 15/07/2026)', () => {
    const events = parseIcs(RECURRING_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Point hebdo')
    expect(events[0].start).toBe('2026-07-15T08:00:00.000Z')
    expect(events[0].end).toBe('2026-07-15T08:30:00.000Z')
  })

  it('marque les événements journée entière', () => {
    const events = parseIcs(ALLDAY_ICS, from, to)
    expect(events).toHaveLength(1)
    expect(events[0].allDay).toBe(true)
  })

  it('rejette un ICS invalide sans crasher', () => {
    expect(() => parseIcs('pas du ICS', from, to)).not.toThrow()
    expect(parseIcs('pas du ICS', from, to)).toEqual([])
  })
})
