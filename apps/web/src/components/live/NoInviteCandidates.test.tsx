/* Tests de NoInviteCandidates : explique la liste d'invitation vide et renvoie vers les membres de la communauté. */
import { describe, it, expect, vi } from 'vitest'
import { render, findByText } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { NoInviteCandidates } from './NoInviteCandidates'

vi.mock('../../lib/api', () => ({
  spacesApi: { get: vi.fn().mockResolvedValue({ id: 's1', community: { id: 'c1', name: 'Thomas JDR' } }) },
}))

describe('NoInviteCandidates', () => {
  it('nomme la communauté et propose de gérer ses membres', async () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter><NoInviteCandidates spaceId="s1" /></MemoryRouter>
      </QueryClientProvider>,
    )
    await findByText(container, /« Thomas JDR »/)
    const link = await findByText(container, 'Gérer les membres de la communauté')
    expect(link.getAttribute('href')).toBe('/communities/c1/settings')
  })
})
