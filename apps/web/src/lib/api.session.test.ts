/* TNR fetchApi : un 401 ne déclenche l'expiration forcée (auth:logout) que s'il existe une session (bug 2026-10-21). */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { activityApi } from './api'

vi.mock('../stores/theme', () => ({
  useThemeStore: { getState: () => ({ initTheme: vi.fn() }) },
}))

const json401 = () =>
  new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })

describe('fetchApi — 401 et session', () => {
  let logoutEvents: number
  const onLogout = () => { logoutEvents++ }

  beforeEach(() => {
    localStorage.clear()
    logoutEvents = 0
    window.addEventListener('auth:logout', onLogout)
  })
  afterEach(() => {
    window.removeEventListener('auth:logout', onLogout)
    vi.unstubAllGlobals()
  })

  it('visiteur anonyme : simple erreur 401, pas de déconnexion forcée ni de refresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json401())
    vi.stubGlobal('fetch', fetchMock)

    await expect(activityApi.feed()).rejects.toMatchObject({ statusCode: 401 })
    expect(logoutEvents).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(1) // aucun appel à /auth/refresh
  })

  it('session dont le refresh échoue : expiration forcée (auth:logout)', async () => {
    localStorage.setItem('accessToken', 'not-a-jwt')
    localStorage.setItem('auth-storage', JSON.stringify({ state: { refreshToken: 'rt' } }))
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(json401()))
    vi.stubGlobal('fetch', fetchMock)

    await expect(activityApi.feed()).rejects.toMatchObject({ statusCode: 401, code: 'SESSION_EXPIRED' })
    expect(logoutEvents).toBe(1)
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/auth/refresh'))).toBe(true)
  })
})
