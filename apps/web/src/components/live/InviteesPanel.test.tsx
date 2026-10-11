/* Tests de InviteesPanel (bandeau, animateur) : liste des invités et « Retirer », ajout via le sélecteur,
 * séance terminée → retrait seulement (pas d'ajout). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  invitees: vi.fn(async () => [{ userId: 'u1', user: { id: 'u1', name: 'Alice' }, invitedAt: '2026-10-11T10:00:00Z' }]),
  inviteCandidates: vi.fn(async () => [
    { userId: 'u1', name: 'Alice', email: 'a@x' },
    { userId: 'u2', name: 'Bruno', email: 'b@x' },
  ]),
  invite: vi.fn(async () => []),
  uninvite: vi.fn(async () => []),
}))
vi.mock('../../lib/api', () => ({ liveSessionsApi: api }))

import { InviteesPanel } from './InviteesPanel'

const renderPanel = (ended = false) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <InviteesPanel sessionId="ls-1" parentSpaceId="parent" ended={ended} />
  </QueryClientProvider>,
)

describe('InviteesPanel', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockClear()) })

  it('liste les invités ; « Retirer » appelle uninvite', async () => {
    const { findByText } = renderPanel()
    fireEvent.click(await findByText('Retirer'))
    await waitFor(() => expect(api.uninvite).toHaveBeenCalledWith('ls-1', 'u1'))
  })

  it('ajout : les déjà invités ne sont pas proposés ; « Inviter » envoie la sélection', async () => {
    const { findByLabelText, queryByLabelText, getByText } = renderPanel()
    fireEvent.click(await findByLabelText('Bruno'))
    expect(queryByLabelText('Alice')).toBeNull()
    fireEvent.click(getByText(/^Inviter/))
    await waitFor(() => expect(api.invite).toHaveBeenCalledWith('ls-1', ['u2']))
  })

  it('tous les candidats déjà invités : le dit, sans prétendre qu\'ils ont accès à l\'espace', async () => {
    api.inviteCandidates.mockResolvedValueOnce([{ userId: 'u1', name: 'Alice', email: 'a@x' }])
    const { findByText, queryByText } = renderPanel()
    await findByText('Tous les membres invitables sont déjà invités.')
    expect(queryByText(/ont déjà accès/)).toBeNull()
  })

  it('séance terminée : pas d\'ajout possible, retrait toujours possible', async () => {
    const { findByText, queryByText } = renderPanel(true)
    await findByText('Retirer')
    expect(queryByText(/^Inviter/)).toBeNull()
    expect(api.inviteCandidates).not.toHaveBeenCalled()
  })
})
