/* Tests du hub SSE en mémoire : diffusion par séance, présence dédoublonnée, désabonnement. */
import { describe, it, expect, vi } from 'vitest'
import { LiveHub } from './liveHub.js'

const alice = { id: 'a', name: 'Alice' }
const bob = { id: 'b', name: 'Bob' }

describe('LiveHub', () => {
  it('diffuse uniquement aux abonnés de la séance', () => {
    const hub = new LiveHub()
    const s1 = vi.fn(); const s2 = vi.fn()
    hub.subscribe('S1', alice, s1)
    hub.subscribe('S2', bob, s2)
    hub.broadcast('S1', { type: 'ended', endedAt: 'x' })
    expect(s1).toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
    expect(s2).not.toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
  })

  it('présence dédoublonnée (deux onglets = une personne) et diffusée', () => {
    const hub = new LiveHub()
    const s = vi.fn()
    hub.subscribe('S1', alice, s)
    const off = hub.subscribe('S1', alice, vi.fn())
    hub.subscribe('S1', bob, vi.fn())
    expect(hub.presence('S1').map(u => u.id).sort()).toEqual(['a', 'b'])
    off()
    expect(hub.presence('S1').map(u => u.id).sort()).toEqual(['a', 'b'])
    expect(s).toHaveBeenCalledWith({ type: 'presence', presence: expect.any(Array) })
  })

  it('un abonné qui lève une erreur ne bloque pas les autres et est retiré', () => {
    const hub = new LiveHub()
    const bad = vi.fn((e: any) => { if (e.type === 'ended') throw new Error('socket closed') })
    const good = vi.fn()
    hub.subscribe('S1', alice, bad)
    hub.subscribe('S1', bob, good)
    hub.broadcast('S1', { type: 'ended', endedAt: 'x' })
    expect(good).toHaveBeenCalledWith({ type: 'ended', endedAt: 'x' })
    expect(hub.presence('S1').map(u => u.id)).toEqual(['b'])
  })
})
