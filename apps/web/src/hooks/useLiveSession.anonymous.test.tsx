/* TNR useLiveSession : aucune requête GET /live-sessions/by-space pour un visiteur anonyme (route authentifiée). */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const getBySpace = vi.fn()
vi.mock('../lib/api', () => ({ liveSessionsApi: { getBySpace: (...a: unknown[]) => getBySpace(...a) }, getValidAccessToken: vi.fn(), LIVE_API_URL: '/api' }))
vi.mock('../lib/liveStream', () => ({ openLiveStream: () => () => {} }))
vi.mock('../stores/theme', () => ({ useThemeStore: { getState: () => ({ initTheme: vi.fn() }) } }))

import { useLiveSession } from './useLiveSession'
import { useAuthStore } from '../stores/auth'

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
)

describe('useLiveSession — visiteur anonyme', () => {
  beforeEach(() => {
    getBySpace.mockReset()
    getBySpace.mockResolvedValue(null)
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  })

  it('anonyme : aucun appel, pas de séance', async () => {
    const { result } = renderHook(() => useLiveSession('sp'), { wrapper })
    await new Promise((r) => setTimeout(r, 20))
    expect(getBySpace).not.toHaveBeenCalled()
    expect(result.current.state).toBeUndefined()
  })

  it('connecté : état de la séance demandé', async () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true })
    renderHook(() => useLiveSession('sp'), { wrapper })
    await waitFor(() => expect(getBySpace).toHaveBeenCalledWith('sp'))
  })
})
