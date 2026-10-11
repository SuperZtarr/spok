/* Tests de buildLiveItemActions / requestAddToAgenda : actions « Séance » selon séance active, statut et rôle ;
 * question « avec les sous-éléments ? » seulement si l'élément en a. */
import { describe, it, expect, vi } from 'vitest'

const api = vi.hoisted(() => ({ addToAgenda: vi.fn(async () => []), display: vi.fn(), sourceChildren: vi.fn() }))
vi.mock('./api', () => ({ liveSessionsApi: api }))
vi.mock('./queryClient', () => ({ queryClient: { setQueryData: vi.fn() } }))

import { buildLiveItemActions, requestAddToAgenda } from './liveItemActions'
import { useActiveLiveSessionStore } from '../stores/activeLiveSession'

const info = (status: 'PREPARED' | 'LIVE' | 'ENDED', myRole: 'HOST' | 'PRESENTER' | 'PARTICIPANT' = 'HOST') =>
  ({ sessionId: 's', status, myRole, spaceName: 'X' })

describe('buildLiveItemActions', () => {
  it('aucune action sans séance active, pour un participant ou une séance terminée', () => {
    expect(buildLiveItemActions('i', null, 'sp')).toEqual([])
    expect(buildLiveItemActions('i', info('LIVE', 'PARTICIPANT'), 'sp')).toEqual([])
    expect(buildLiveItemActions('i', info('ENDED'), 'sp')).toEqual([])
  })
  it('séance préparée : seulement « Ajouter à la préparation »', () => {
    expect(buildLiveItemActions('i', info('PREPARED', 'PRESENTER'), 'sp').map((a) => a.id)).toEqual(['live-add-agenda'])
  })
  it('séance en direct : ajouter + présenter', () => {
    expect(buildLiveItemActions('i', info('LIVE'), 'sp').map((a) => a.id)).toEqual(['live-add-agenda', 'live-present'])
  })

  it('requestAddToAgenda : sans sous-élément, ajoute directement', async () => {
    api.sourceChildren.mockResolvedValue({ count: 0 })
    await requestAddToAgenda('i', info('PREPARED'), 'sp')
    expect(api.addToAgenda).toHaveBeenCalledWith('s', 'i', undefined, false)
    expect(useActiveLiveSessionStore.getState().pendingAdd).toBeNull()
  })

  it('requestAddToAgenda : avec sous-éléments, pose la question', async () => {
    api.addToAgenda.mockClear()
    api.sourceChildren.mockResolvedValue({ count: 2 })
    await requestAddToAgenda('i', info('PREPARED'), 'sp')
    expect(api.addToAgenda).not.toHaveBeenCalled()
    expect(useActiveLiveSessionStore.getState().pendingAdd).toEqual({ itemId: 'i', count: 2 })
  })
})
