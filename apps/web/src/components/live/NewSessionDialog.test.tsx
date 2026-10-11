/* Tests de NewSessionDialog (« Préparer la séance ») : éléments de premier niveau cochés par défaut,
 * « avec ses N sous-éléments » activé, envoi de la sélection, « Tout décocher » → préparation vide. */
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
vi.mock('../../lib/api', () => ({ itemsApi: api }))

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
    expect(onCreate).toHaveBeenCalledWith([{ sourceItemId: 'a', includeChildren: true }, { sourceItemId: 'b' }])
  })

  it('« Tout décocher » crée une séance à préparation vide', async () => {
    const { findByText, getByText, onCreate } = renderDialog()
    await findByText('Accueil')
    fireEvent.click(getByText('Tout décocher'))
    fireEvent.click(getByText('Créer la séance'))
    expect(onCreate).toHaveBeenCalledWith([])
  })
})
