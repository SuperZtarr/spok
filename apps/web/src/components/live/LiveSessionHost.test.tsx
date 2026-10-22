/* Tests de LiveSessionHost : fenêtre seulement en LIVE, séance active vidée si l'API refuse (403/404).
   Utilisateur connecté posé dans beforeEach : l'hôte n'est monté que connecté (App.tsx) et useLiveSession
   ne requête pas sans utilisateur. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const getBySpace = vi.fn()
vi.mock('../../lib/api', () => ({ liveSessionsApi: { getBySpace: (...a: unknown[]) => getBySpace(...a) }, searchApi: {}, getValidAccessToken: vi.fn(), LIVE_API_URL: '/api' }))
vi.mock('../../lib/liveStream', () => ({ openLiveStream: () => () => {} }))
vi.mock('../../stores/theme', () => ({ useThemeStore: { getState: () => ({ initTheme: vi.fn() }) } }))

import { LiveSessionHost } from './LiveSessionHost'
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession'
import { useAuthStore } from '../../stores/auth'

const state = (status: string) => ({
  session: { id: 'ls', spaceId: 'sp', parentSpaceId: 'p', hostId: 'h', status, controllerId: null, currentEntryId: null, startedAt: 'x', liveAt: null, endedAt: null },
  spaceName: '2026-10-10', roles: [], myRole: 'PARTICIPANT', entries: [], agenda: [], current: null, presence: [],
})

const renderHost = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><LiveSessionHost /></MemoryRouter>
  </QueryClientProvider>,
)

describe('LiveSessionHost', () => {
  beforeEach(() => {
    localStorage.clear()
    getBySpace.mockReset()
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true })
    useActiveLiveSessionStore.getState().clear()
    useActiveLiveSessionStore.getState().setActive('sp')
  })

  it('affiche la fenêtre quand la séance est LIVE', async () => {
    getBySpace.mockResolvedValue(state('LIVE'))
    const { findByTestId } = renderHost()
    expect(await findByTestId('live-window')).toBeTruthy()
  })

  it("n'affiche rien quand la séance est PREPARED", async () => {
    getBySpace.mockResolvedValue(state('PREPARED'))
    const { queryByTestId } = renderHost()
    await waitFor(() => expect(useActiveLiveSessionStore.getState().info?.status).toBe('PREPARED'))
    expect(queryByTestId('live-window')).toBeNull()
  })

  it("vide la séance active si l'espace n'est plus une séance (null)", async () => {
    getBySpace.mockResolvedValue(null)
    const { queryByTestId } = renderHost()
    await waitFor(() => expect(useActiveLiveSessionStore.getState().spaceId).toBeNull())
    expect(queryByTestId('live-window')).toBeNull()
  })

  it("vide la séance active si l'API refuse", async () => {
    getBySpace.mockRejectedValue(new Error('403'))
    renderHost()
    await waitFor(() => expect(useActiveLiveSessionStore.getState().spaceId).toBeNull())
  })
})
