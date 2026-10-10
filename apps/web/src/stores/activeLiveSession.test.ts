/* Tests du store de séance active : persistance du seul spaceId, clear, droit de présenter. */
import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveLiveSessionStore, canPresent } from './activeLiveSession'

describe('useActiveLiveSessionStore', () => {
  beforeEach(() => { localStorage.clear(); useActiveLiveSessionStore.getState().clear() })

  it('setActive persiste spaceId (pas info)', () => {
    useActiveLiveSessionStore.getState().setActive('sp-1')
    useActiveLiveSessionStore.getState().setInfo({ sessionId: 's', status: 'LIVE', myRole: 'HOST', spaceName: 'X' })
    const raw = JSON.parse(localStorage.getItem('spok.activeLiveSession') || '{}')
    expect(raw.state).toEqual({ spaceId: 'sp-1' })
  })

  it('clear vide spaceId et info', () => {
    useActiveLiveSessionStore.getState().setActive('sp-1')
    useActiveLiveSessionStore.getState().setInfo({ sessionId: 's', status: 'LIVE', myRole: 'HOST', spaceName: 'X' })
    useActiveLiveSessionStore.getState().clear()
    expect(useActiveLiveSessionStore.getState().spaceId).toBeNull()
    expect(useActiveLiveSessionStore.getState().info).toBeNull()
  })

  it('canPresent : HOST/PRESENTER oui, PARTICIPANT/absent non', () => {
    expect(canPresent(null)).toBe(false)
    expect(canPresent({ sessionId: 's', status: 'LIVE', myRole: 'PARTICIPANT', spaceName: 'X' })).toBe(false)
    expect(canPresent({ sessionId: 's', status: 'LIVE', myRole: 'PRESENTER', spaceName: 'X' })).toBe(true)
  })
})
