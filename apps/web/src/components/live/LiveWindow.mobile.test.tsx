/* Tests de LiveWindow sur écran étroit (< 768px) : plein écran, bascule « Voir l'espace » / « Retour au direct »,
 * retour au premier plan à chaque nouvel affichage. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('../../lib/api', () => ({ liveSessionsApi: {}, searchApi: {}, getValidAccessToken: vi.fn(), LIVE_API_URL: '/api' }))

import { LiveWindow } from './LiveWindow'

const entry = (id: string) => ({ id, kind: 'DISPLAY', createdAt: '2026-10-10T10:00:00Z', user: { id: 'u', name: 'Anim' }, itemId: 'c', itemTitle: 'T' })
const state = (entryId: string): any => ({
  session: { id: 'ls', spaceId: 'sp', status: 'LIVE' }, spaceName: 'S', roles: [], myRole: 'PARTICIPANT',
  entries: [], agenda: [], presence: [],
  current: { entry: entry(entryId), item: { id: 'c', title: `Élément ${entryId}`, type: 'NOTE' }, children: [] },
})

function setNarrow(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: narrow && q.includes('max-width'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as any
}

const renderWindow = (s: any) => {
  const qc = new QueryClient()
  const props = { live: {} as any, onOpenItem: vi.fn(), onGoToSession: vi.fn(), onLeave: vi.fn() }
  const utils = render(<QueryClientProvider client={qc}><LiveWindow state={s} {...props} /></QueryClientProvider>)
  return { ...utils, rerenderWith: (n: any) => utils.rerender(<QueryClientProvider client={qc}><LiveWindow state={n} {...props} /></QueryClientProvider>) }
}

describe('LiveWindow — mobile', () => {
  beforeEach(() => { localStorage.clear(); setNarrow(true) })

  it('plein écran sur écran étroit', () => {
    const { getByTestId } = renderWindow(state('e1'))
    expect(getByTestId('live-window').style.inset).toBe('0px')
  })

  it("« Voir l'espace » réduit en barre, « Retour au direct » revient au plein écran", () => {
    const { getByTestId, getByText, queryByText } = renderWindow(state('e1'))
    fireEvent.click(getByText("Voir l'espace"))
    expect(getByTestId('live-window').style.inset).not.toBe('0px')
    expect(queryByText('Retour au direct')).toBeTruthy()
    fireEvent.click(getByText('Retour au direct'))
    expect(getByTestId('live-window').style.inset).toBe('0px')
  })

  it('un nouvel affichage ramène la fenêtre au premier plan', () => {
    const { getByTestId, getByText, rerenderWith } = renderWindow(state('e1'))
    fireEvent.click(getByText("Voir l'espace"))
    rerenderWith(state('e2'))
    expect(getByTestId('live-window').style.inset).toBe('0px')
  })

  it('écran large : fenêtre flottante, pas de bouton « Voir l’espace »', () => {
    setNarrow(false)
    const { getByTestId, queryByText } = renderWindow(state('e1'))
    expect(getByTestId('live-window').style.inset).toBe('')
    expect(queryByText("Voir l'espace")).toBeNull()
  })
})
