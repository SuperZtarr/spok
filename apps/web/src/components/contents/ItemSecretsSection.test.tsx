/* Tests de la section « Données sécurisées » (ItemSecretsSection, 2026-11-20) : valeur masquée par défaut, Afficher
 * puis re-masquage à 30 s, Copier puis presse-papiers vidé à 30 s, boutons selon les droits renvoyés par l'API, valeur
 * jamais dans le cache React Query. API simulée (lib/api) ; valeur témoin seulement. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, screen, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ItemSecretSummary } from '@spok/shared'

const WITNESS = 'TEMOIN-NE-PAS-FUIR-42'
const api = vi.hoisted(() => ({ list: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn(), reveal: vi.fn() }))
vi.mock('../../lib/api', () => ({ itemSecretsApi: api }))

import { ItemSecretsSection, SECRET_EXPOSURE_MS } from './ItemSecretsSection'

const at = '2026-11-20T00:00:00Z'
const s = (over: Partial<ItemSecretSummary> = {}): ItemSecretSummary => ({
  id: 's1', itemId: 'i1', label: 'Accès test', hasLogin: false, visibility: 'PRIVATE', position: 0,
  createdById: 'u1', createdByName: 'Moi', canReveal: true, canEdit: true, canDelete: true,
  revealCount: 2, lastRevealedAt: null, createdAt: at, updatedAt: at, ...over,
})

let qc: QueryClient
const renderSection = () => render(
  <QueryClientProvider client={qc}>
    <ItemSecretsSection spaceId="s" itemId="i1" canAdd title="Données sécurisées" />
  </QueryClientProvider>,
)
/** Laisse passer les promesses en attente (requêtes simulées) */
const flush = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })

describe('ItemSecretsSection', () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.clearAllMocks()
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    api.reveal.mockResolvedValue({ login: null, value: WITNESS })
    Object.assign(navigator, { clipboard: { writeText } })
  })
  afterEach(() => { vi.useRealTimers() })

  it('masquée par défaut, affichée puis re-masquée au bout de 30 s', async () => {
    api.list.mockResolvedValue([s()])
    renderSection()
    await screen.findByText('Accès test')
    expect(screen.getByTestId('secret-value').textContent).toBe('••••••••')
    fireEvent.click(screen.getByLabelText('Afficher'))
    await flush()
    expect(screen.getByTestId('secret-value').textContent).toBe(WITNESS)
    expect(screen.getByText(/consultée 2 fois/)).toBeTruthy()
    await act(async () => { vi.advanceTimersByTime(SECRET_EXPOSURE_MS) })
    expect(screen.getByTestId('secret-value').textContent).toBe('••••••••')
  })

  it('Copier : presse-papiers rempli puis vidé au bout de 30 s', async () => {
    api.list.mockResolvedValue([s()])
    renderSection()
    await screen.findByText('Accès test')
    fireEvent.click(screen.getByLabelText('Copier'))
    await flush()
    expect(writeText).toHaveBeenCalledWith(WITNESS)
    expect(screen.getByTestId('secret-value').textContent).toBe('••••••••')
    await act(async () => { vi.advanceTimersByTime(SECRET_EXPOSURE_MS) })
    expect(writeText).toHaveBeenLastCalledWith('')
  })

  it('sans droit de lecture ni d\'écriture : ni Afficher, ni Copier, ni Modifier, ni Retirer', async () => {
    api.list.mockResolvedValue([s({ canReveal: false, canEdit: false, canDelete: false, createdByName: 'Ana' })])
    renderSection()
    await screen.findByText('Accès test')
    for (const label of ['Afficher', 'Copier', 'Modifier', 'Retirer']) expect(screen.queryByLabelText(label)).toBeNull()
    expect(screen.getByText(/ajoutée par Ana/)).toBeTruthy()
  })

  it('la valeur révélée n\'entre pas dans le cache React Query', async () => {
    api.list.mockResolvedValue([s()])
    renderSection()
    await screen.findByText('Accès test')
    fireEvent.click(screen.getByLabelText('Afficher'))
    await flush()
    const cached = JSON.stringify([
      qc.getQueryCache().getAll().map((q) => q.state.data),
      qc.getMutationCache().getAll().map((m) => m.state.data),
    ])
    expect(cached).not.toContain(WITNESS)
  })

  it('aucune donnée et pas d\'ajout en cours : rien n\'est rendu', async () => {
    api.list.mockResolvedValue([])
    const { container } = renderSection()
    await flush()
    expect(container.textContent).toBe('')
  })
})
