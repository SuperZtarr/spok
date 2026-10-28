/* Tests de NewSessionDialog (« Préparer la séance ») : éléments de premier niveau cochés par défaut,
 * « avec ses N sous-éléments » activé, envoi de la sélection, « Tout décocher » → préparation vide, invités cochés envoyés,
 * nom tiré de la date prévue (« Date de la séance »). */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const api = vi.hoisted(() => ({
  list: vi.fn(async () => ({ data: [
    { id: 'a', title: 'Accueil', parentId: null, position: 1 },
    { id: 'a1', title: 'Accueil 1', parentId: 'a', position: 1 },
    { id: 'a2', title: 'Accueil 2', parentId: 'a', position: 2 },
    { id: 'b', title: 'Bilan', parentId: null, position: 2 },
  ] })),
}))
const live = vi.hoisted(() => ({ inviteCandidates: vi.fn(async () => [{ userId: 'u1', name: 'Alice', email: 'alice@x.fr' }]) }))
vi.mock('../../lib/api', () => ({ itemsApi: api, liveSessionsApi: live }))

import { NewSessionDialog } from './NewSessionDialog'

const renderDialog = (onCreate = vi.fn()) => ({
  onCreate,
  ...render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NewSessionDialog spaceId="parent" onCreate={onCreate} onClose={() => {}} />
    </QueryClientProvider>,
  ),
})

describe('NewSessionDialog', () => {
  it('propose le premier niveau, tout coché avec les sous-éléments, et envoie la sélection', async () => {
    const { findByText, getByText, queryByText, onCreate } = renderDialog()
    await findByText('Accueil')
    expect(queryByText('Accueil 1')).toBeNull()
    getByText('avec ses 2 sous-éléments')
    fireEvent.click(getByText('Créer la séance'))
    expect(onCreate).toHaveBeenCalledWith([{ sourceItemId: 'a', includeChildren: true }, { sourceItemId: 'b' }], [], expect.stringMatching(/^Séance \d{4}-\d{2}-\d{2}$/))
  })

  it('la date prévue choisie donne le nom de la séance', async () => {
    const { findByText, getByLabelText, getByText, onCreate } = renderDialog()
    await findByText('Accueil')
    fireEvent.change(getByLabelText(/Date de la séance/), { target: { value: '2026-11-05' } })
    getByText('→ « Séance 2026-11-05 »')
    fireEvent.click(getByText('Créer la séance'))
    expect(onCreate.mock.calls[0][2]).toBe('Séance 2026-11-05')
  })

  it('« Tout décocher » crée une séance à préparation vide', async () => {
    const { findByText, getByText, onCreate } = renderDialog()
    await findByText('Accueil')
    fireEvent.click(getByText('Tout décocher'))
    fireEvent.click(getByText('Créer la séance'))
    expect(onCreate).toHaveBeenCalledWith([], [], expect.any(String))
  })

  it('invités cochés envoyés avec la création', async () => {
    const { findByText, findByLabelText, getByText, onCreate } = renderDialog()
    await findByText('Accueil')
    fireEvent.click(await findByLabelText('Alice'))
    fireEvent.click(getByText('Créer la séance'))
    expect(onCreate).toHaveBeenCalledWith([{ sourceItemId: 'a', includeChildren: true }, { sourceItemId: 'b' }], ['u1'], expect.any(String))
  })
})
