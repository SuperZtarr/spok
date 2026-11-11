/* Tests de QuestionPanel : vote (appel de l'API avec l'option cochée), décompte nominatif, badge « Unanimité », boutons d'issue réservés à
 * qui peut décider, vote figé une fois la question close, pas d'édition des options en séance (variant live),
 * réponses possibles enregistrées au fil de la saisie sans doublon, confirmation avant de retirer une réponse votée. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { QuestionView } from '@spok/shared'

const view = (over: Partial<QuestionView> = {}): QuestionView => ({
  itemId: 'q1', status: 'question_open', open: true, multiple: false,
  options: [
    { id: 'o1', label: 'Oui', position: 0, voters: [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }], refItemId: null, refItem: null },
    { id: 'o2', label: 'Non', position: 1, voters: [], refItemId: null, refItem: null },
  ],
  outcome: { chosenOptionId: null, answerText: null, note: null, decidedBy: null, decidedAt: null },
  voterCount: 2, leadingOptionIds: ['o1'], unanimousOptionIds: ['o1'], myOptionIds: [],
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
  spacesApi: { get: vi.fn(async () => ({ id: 's1', communityId: null })) },
  searchApi: { advanced: vi.fn(async () => ({ items: [] })) },
}))

import { QuestionPanel } from './QuestionPanel'

const renderPanel = (variant: 'sheet' | 'live' = 'sheet') => render(
  <MemoryRouter>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <QuestionPanel spaceId="s1" itemId="q1" variant={variant} />
    </QueryClientProvider>
  </MemoryRouter>,
)

describe('QuestionPanel', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

  it('décompte nominatif et vote pour une option', async () => {
    api.get.mockResolvedValue(view())
    api.vote.mockResolvedValue(view({ myOptionIds: ['o2'] }))
    const { findByText, getByLabelText } = renderPanel()
    expect(await findByText('Ana, Ben')).toBeTruthy()
    expect(await findByText('Unanimité')).toBeTruthy()
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
    expect(queryByLabelText('Réponse 1')).toBeNull()
    expect(queryByText('Choix multiple')).toBeNull()
  })

  it('réponses possibles enregistrées au fil de la saisie (champ quitté, Entrée), sans doublon', async () => {
    api.get.mockResolvedValue(view({ options: [], canEditOptions: true, voterCount: 0, leadingOptionIds: [], unanimousOptionIds: [] }))
    api.saveOptions.mockImplementation(async (_s: string, _i: string, body: { options: Array<{ id?: string; label: string }> }) =>
      view({ options: body.options.map((o, i) => ({ id: o.id ?? `n${i}`, label: o.label, position: i, voters: [], refItemId: null, refItem: null })), canEditOptions: true }))
    const { findByLabelText, getByLabelText } = renderPanel()
    const first = await findByLabelText('Réponse 1')
    fireEvent.change(first, { target: { value: 'Oui' } })
    fireEvent.keyDown(first, { key: 'Enter' })
    fireEvent.blur(first)
    await waitFor(() => expect(api.saveOptions).toHaveBeenCalledWith('s1', 'q1', { multiple: false, options: [{ id: undefined, label: 'Oui', refItemId: null }] }))
    const second = getByLabelText('Réponse 2')
    fireEvent.change(second, { target: { value: 'Non' } })
    fireEvent.blur(second)
    await waitFor(() => expect(api.saveOptions).toHaveBeenLastCalledWith('s1', 'q1', { multiple: false, options: [{ id: 'n0', label: 'Oui', refItemId: null }, { id: undefined, label: 'Non', refItemId: null }] }))
    expect(api.saveOptions).toHaveBeenCalledTimes(2)
  })

  it('réponse liée : lien vers la fiche de l’élément ; sans élément lisible, libellé seul', async () => {
    const base = view()
    api.get.mockResolvedValue(view({
      options: [
        { ...base.options[0], refItemId: 'p1', refItem: { id: 'p1', title: 'Fournisseur A', type: 'PROJECT', spaceId: 's9' } },
        { ...base.options[1], refItemId: 'x', refItem: null },
      ],
    }))
    const { findByText, getByText } = renderPanel()
    const link = (await findByText('Oui')).closest('a')
    expect(link?.getAttribute('href')).toBe('/spaces/s9?item=p1')
    expect(getByText('Non').closest('a')).toBeNull()
  })

  it('lier une réponse : le bouton lien ouvre le choix de l’élément sur sa ligne', async () => {
    api.get.mockResolvedValue(view({ canEditOptions: true }))
    api.saveOptions.mockResolvedValue(view({ canEditOptions: true }))
    const { findAllByLabelText } = renderPanel()
    const linkButtons = await findAllByLabelText('Lier un élément')
    expect(linkButtons).toHaveLength(2)
    fireEvent.click(linkButtons[1])
    expect((await findAllByLabelText('Lier un élément'))[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('retirer une réponse qui a des votes demande confirmation', async () => {
    api.get.mockResolvedValue(view({ canEditOptions: true }))
    api.saveOptions.mockResolvedValue(view({ canEditOptions: true }))
    const { findAllByLabelText, findByText } = renderPanel()
    fireEvent.click((await findAllByLabelText('Retirer'))[0])
    expect(api.saveOptions).not.toHaveBeenCalled()
    fireEvent.click(await findByText('Retirer', { selector: 'button.text-destructive' }))
    await waitFor(() => expect(api.saveOptions).toHaveBeenCalledWith('s1', 'q1', { multiple: false, options: [{ id: 'o2', label: 'Non', refItemId: null }] }))
  })
})
