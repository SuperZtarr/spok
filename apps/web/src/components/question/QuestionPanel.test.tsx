/* Tests de QuestionPanel : vote (appel de l'API avec l'option cochée), décompte nominatif, boutons d'issue réservés à
 * qui peut décider, vote figé une fois la question close, pas d'édition des options en séance (variant live). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { QuestionView } from '@spok/shared'

const view = (over: Partial<QuestionView> = {}): QuestionView => ({
  itemId: 'q1', status: 'question_open', open: true, multiple: false,
  options: [
    { id: 'o1', label: 'Oui', position: 0, voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }] },
    { id: 'o2', label: 'Non', position: 1, voters: [] },
  ],
  outcome: { chosenOptionId: null, answerText: null, note: null, decidedBy: null, decidedAt: null },
  voterCount: 2, leadingOptionIds: ['o1'], myOptionIds: [],
  canVote: true, canDecide: false, canEditOptions: false, locked: false,
  ...over,
})

const api = vi.hoisted(() => ({
  get: vi.fn(),
  vote: vi.fn(),
  setOutcome: vi.fn(),
  saveOptions: vi.fn(),
}))
vi.mock('../../lib/api', () => ({
  questionsApi: api,
  referentielsApi: { get: vi.fn(async () => ({ referentiels: undefined, isDefault: true })) },
}))

import { QuestionPanel } from './QuestionPanel'

const renderPanel = (variant: 'sheet' | 'live' = 'sheet') => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <QuestionPanel spaceId="s1" itemId="q1" variant={variant} />
  </QueryClientProvider>,
)

describe('QuestionPanel', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

  it('décompte nominatif et vote pour une option', async () => {
    api.get.mockResolvedValue(view())
    api.vote.mockResolvedValue(view({ myOptionIds: ['o2'] }))
    const { findByText, getByLabelText } = renderPanel()
    expect(await findByText('Ana, Ben')).toBeTruthy()
    fireEvent.click(getByLabelText('Non'))
    await waitFor(() => expect(api.vote).toHaveBeenCalledWith('s1', 'q1', ['o2']))
  })

  it('issue : boutons seulement pour qui peut décider ; un clic tranche avec l’option', async () => {
    api.get.mockResolvedValue(view({ canDecide: true }))
    api.setOutcome.mockResolvedValue(view({ status: 'question_decided', open: false }))
    const { findByText, getByText } = renderPanel('live')
    await findByText('Reportée')
    fireEvent.click(getByText('Non', { selector: 'button' }))
    await waitFor(() => expect(api.setOutcome).toHaveBeenCalledWith('s1', 'q1', { status: 'question_decided', chosenOptionId: 'o2' }))
  })

  it('question close : pas de vote, issue affichée ; pas d’édition des options en séance', async () => {
    api.get.mockResolvedValue(view({
      status: 'question_no_conclusion', open: false, canVote: false, canEditOptions: true,
      outcome: { chosenOptionId: null, answerText: null, note: 'à revoir', decidedBy: { id: 'h', name: 'Hugo' }, decidedAt: null },
    }))
    const { findByText, queryByLabelText, queryByText } = renderPanel('live')
    expect(await findByText(/à revoir/)).toBeTruthy()
    expect(queryByLabelText('Oui')).toBeNull()
    expect(queryByText('Enregistrer les options')).toBeNull()
  })
})
