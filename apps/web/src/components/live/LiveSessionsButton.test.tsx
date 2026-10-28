/* Tests de LiveSessionsButton (en-tête) : masqué sans séance démarrée (préparée = masqué), badge du nombre de séances en direct,
 * « Rejoindre » rejoint puis active la séance. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

const api = vi.hoisted(() => ({ ongoing: vi.fn(), join: vi.fn(async () => ({})) }))
vi.mock('../../lib/api', () => ({ liveSessionsApi: api }))

import { LiveSessionsButton } from './LiveSessionsButton'
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession'

const s = (id: string, status: 'LIVE' | 'PREPARED', isMember = true) =>
  ({ id, spaceId: `sp-${id}`, spaceName: `Séance ${id}`, parentSpaceName: 'Comité', status, isMember, myRole: 'PARTICIPANT' })

const renderButton = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><LiveSessionsButton /></MemoryRouter>
  </QueryClientProvider>,
)

describe('LiveSessionsButton', () => {
  beforeEach(() => { localStorage.clear(); api.ongoing.mockReset(); api.join.mockClear(); useActiveLiveSessionStore.getState().clear() })

  it('rien sans séance en cours', async () => {
    api.ongoing.mockResolvedValue([])
    const { container } = renderButton()
    await waitFor(() => expect(api.ongoing).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="live-sessions-button"]')).toBeNull()
  })

  it('rien si les séances sont seulement préparées (bouton réservé aux séances démarrées)', async () => {
    api.ongoing.mockResolvedValue([s('b', 'PREPARED')])
    const { container } = renderButton()
    await waitFor(() => expect(api.ongoing).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50)) // laisser la requête se résoudre et le rendu se faire
    expect(container.querySelector('[data-testid="live-sessions-button"]')).toBeNull()
  })

  it('badge = nombre de séances en direct, en orange (couleur des séances)', async () => {
    api.ongoing.mockResolvedValue([s('a', 'LIVE'), s('c', 'LIVE'), s('b', 'PREPARED')])
    const { findByTestId } = renderButton()
    const btn = await findByTestId('live-sessions-button')
    expect(btn.textContent).toContain('2')
    expect(btn.className).toContain('text-orange-500')
  })

  it("« Rejoindre » rejoint puis fait de la séance la séance active", async () => {
    api.ongoing.mockResolvedValue([s('a', 'LIVE', false)])
    const { findByTestId, findByText } = renderButton()
    fireEvent.click(await findByTestId('live-sessions-button'))
    fireEvent.click(await findByText('Rejoindre'))
    await waitFor(() => expect(useActiveLiveSessionStore.getState().spaceId).toBe('sp-a'))
    expect(api.join).toHaveBeenCalledWith('a')
  })
})
