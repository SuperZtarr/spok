/* Tests de applyLiveEvent : convergence (deux présentateurs), fin/démarrage de séance, programme, révélation de sous-items. */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/api', () => ({ liveSessionsApi: {}, getValidAccessToken: vi.fn(), LIVE_API_URL: '/api' }))

import { applyLiveEvent } from './useLiveSession'

const user = { id: 'u', name: 'U' }
const newer = { id: 'e2', kind: 'DISPLAY' as const, createdAt: '2026-10-10T10:00:02.000Z', user, itemId: 'c2', itemTitle: 'B' }
const older = { ...newer, id: 'e1', createdAt: '2026-10-10T10:00:01.000Z', itemId: 'c1', itemTitle: 'A' }

describe('applyLiveEvent', () => {
  it('ignore un display plus ancien que le courant', () => {
    const state: any = { session: { currentEntryId: 'e2' }, entries: [newer], current: { entry: newer, item: { id: 'c2' }, children: [] } }
    const next = applyLiveEvent(state, { type: 'display', entry: older, displayed: { item: { id: 'c1' } as any, children: [] } })
    expect(next.current!.entry.id).toBe('e2')
    expect(next.entries.map((e) => e.id)).toEqual(['e1', 'e2'])
  })

  it('applique un display plus récent', () => {
    const state: any = { session: { currentEntryId: 'e1' }, entries: [older], current: { entry: older, item: { id: 'c1' }, children: [] } }
    const next = applyLiveEvent(state, { type: 'display', entry: newer, displayed: { item: { id: 'c2' } as any, children: [] } })
    expect(next.current!.item.id).toBe('c2')
    expect(next.session.currentEntryId).toBe('e2')
  })

  it('ended passe la séance à ENDED', () => {
    const state: any = { session: { status: 'LIVE', endedAt: null }, entries: [], current: null }
    expect(applyLiveEvent(state, { type: 'ended', endedAt: 'x' }).session.status).toBe('ENDED')
  })

  it('started passe la séance à LIVE', () => {
    const state: any = { session: { status: 'PREPARED', liveAt: null }, entries: [], current: null }
    const next = applyLiveEvent(state, { type: 'started', liveAt: 'x' })
    expect(next.session.status).toBe('LIVE')
    expect(next.session.liveAt).toBe('x')
  })

  it('agenda remplace le programme', () => {
    const state: any = { session: {}, entries: [], agenda: [], current: null }
    const agenda: any = [{ id: 'a' }]
    expect(applyLiveEvent(state, { type: 'agenda', agenda }).agenda).toBe(agenda)
  })

  it("reveal ajoute le sous-item à l'élément courant (sans doublon), ignore un autre parent", () => {
    const state: any = { session: {}, entries: [], current: { entry: newer, item: { id: 'c2' }, children: [] } }
    const child: any = { id: 'k1', title: 'Ligne' }
    const next = applyLiveEvent(state, { type: 'reveal', parentItemId: 'c2', child })
    expect(next.current!.children.map((c) => c.id)).toEqual(['k1'])
    expect(applyLiveEvent(next, { type: 'reveal', parentItemId: 'c2', child }).current!.children).toHaveLength(1)
    expect(applyLiveEvent(state, { type: 'reveal', parentItemId: 'other', child }).current!.children).toHaveLength(0)
  })
})
