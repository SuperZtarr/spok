/* Tests de la section Historique de la fiche (ItemHistorySection, règle item-history-members) : repliée sans appel,
 * chargée à l'ouverture, lignes « avant → après », mention MCP, état vide, page suivante. API simulée (lib/api). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({ history: vi.fn() }))
vi.mock('../lib/api', () => ({ itemsApi: api }))
vi.mock('../help/ElementHelp', () => ({ ElementHelp: () => null }))

import { ItemHistorySection, historyLineText } from './ItemHistorySection'

const renderSection = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ItemHistorySection spaceId="s1" itemId="i1" version="v1" hints={{ empty: 'Aucun changement enregistré pour cet élément.' }} />
  </QueryClientProvider>,
)

describe('ItemHistorySection', () => {
  beforeEach(() => api.history.mockReset())

  it('repliée : aucun appel', () => {
    renderSection()
    expect(api.history).not.toHaveBeenCalled()
  })

  it('ouverte : entrées, lignes et mention MCP', async () => {
    api.history.mockResolvedValue({
      entries: [{ id: 'a1', createdAt: '2026-11-12T10:00:00Z', user: { id: 'u', name: 'Ana' }, viaMcp: true,
        lines: [{ label: 'Statut', before: 'À faire', after: 'En cours' }, { label: 'Tag ajouté', after: 'bug' }] }],
      nextCursor: null,
    })
    renderSection()
    fireEvent.click(screen.getByText('Historique'))
    await waitFor(() => expect(screen.getByText('Statut : À faire → En cours')).toBeTruthy())
    expect(screen.getByText('Tag ajouté : bug')).toBeTruthy()
    expect(screen.getByText(/via MCP/)).toBeTruthy()
    expect(api.history).toHaveBeenCalledWith('s1', 'i1', undefined)
    expect(screen.queryByText('Plus')).toBeNull()
  })

  it('état vide', async () => {
    api.history.mockResolvedValue({ entries: [], nextCursor: null })
    renderSection()
    fireEvent.click(screen.getByText('Historique'))
    await waitFor(() => expect(screen.getByText('Aucun changement enregistré pour cet élément.')).toBeTruthy())
  })

  it('« Plus » charge la page suivante avec le curseur', async () => {
    api.history
      .mockResolvedValueOnce({ entries: [{ id: 'a1', createdAt: '2026-11-12T10:00:00Z', user: null, viaMcp: false, lines: [{ label: 'Créé' }] }], nextCursor: 'c1' })
      .mockResolvedValueOnce({ entries: [{ id: 'a0', createdAt: '2026-11-11T10:00:00Z', user: null, viaMcp: false, lines: [{ label: 'Description modifiée' }] }], nextCursor: null })
    renderSection()
    fireEvent.click(screen.getByText('Historique'))
    fireEvent.click(await screen.findByText('Plus'))
    await waitFor(() => expect(screen.getByText('Description modifiée')).toBeTruthy())
    expect(api.history).toHaveBeenLastCalledWith('s1', 'i1', 'c1')
    expect(screen.getAllByTestId('history-entry')).toHaveLength(2)
  })
})

describe('historyLineText', () => {
  it('formes de ligne', () => {
    expect(historyLineText({ label: 'Échéance', before: null, after: '20/11/2026' })).toBe('Échéance : — → 20/11/2026')
    expect(historyLineText({ label: 'Tag retiré', before: 'idée' })).toBe('Tag retiré : idée')
    expect(historyLineText({ label: 'Créé' })).toBe('Créé')
  })
})
