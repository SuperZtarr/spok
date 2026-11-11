/* Tests de la zone Contenus de la fiche (ItemContentsSection, contenus multiples lot 2) : regroupement dans l'ordre fixe
 * Images, Fichiers, Liens, Schémas ; menu « + Ajouter » ; ajout d'un lien ; retrait confirmé ; ordre dans une sorte ;
 * affichage seul sans droit ; élément non enregistré. API simulée (lib/api). */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ItemContent } from '@spok/shared'

const api = vi.hoisted(() => ({
  add: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  reorder: vi.fn(),
}))
vi.mock('../../lib/api', () => ({ itemContentsApi: api }))

import { ItemContentsSection, groupContents, formatSize } from './ItemContentsSection'

const at = '2026-11-08T00:00:00Z'
const c = (id: string, kind: ItemContent['kind'], position: number, extra: Partial<ItemContent> = {}): ItemContent =>
  ({ id, itemId: 'i1', kind, position, url: `https://x/${id}`, name: id, createdAt: at, updatedAt: at, ...extra })

const renderZone = (props: Partial<React.ComponentProps<typeof ItemContentsSection>> = {}) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ItemContentsSection spaceId="s1" itemId="i1" canEdit contents={[]} {...props} />
  </QueryClientProvider>,
)

describe('groupContents / formatSize', () => {
  it('ordre fixe des sortes puis position, sortes vides retirées', () => {
    const groups = groupContents([c('l1', 'LINK', 0), c('f2', 'FILE', 1), c('f1', 'FILE', 0), c('d1', 'DIAGRAM', 0)])
    expect(groups.map(([k, list]) => [k, list.map((x) => x.id)])).toEqual([
      ['FILE', ['f1', 'f2']], ['LINK', ['l1']], ['DIAGRAM', ['d1']],
    ])
  })
  it('taille lisible', () => {
    expect(formatSize(2048)).toBe('2 Ko')
    expect(formatSize(3 * 1024 * 1024)).toBe('3,0 Mo')
    expect(formatSize(null)).toBeNull()
  })
})

describe('ItemContentsSection', () => {
  beforeEach(() => { Object.values(api).forEach((f) => f.mockReset()) })

  it('titres de sortes dans l\'ordre Images, Fichiers, Liens', () => {
    renderZone({ contents: [c('l1', 'LINK', 0), c('f1', 'FILE', 0), c('m1', 'IMAGE', 0)] })
    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(titles).toEqual(['Images', 'Fichiers', 'Liens'])
  })

  it('menu « + Ajouter » : Fichier, Image, Lien, Schéma ; un lien s\'ajoute', async () => {
    api.add.mockResolvedValue(c('l9', 'LINK', 0))
    const onTitleHint = vi.fn()
    renderZone({ onTitleHint })
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }))
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent?.trim())).toEqual(['Fichier', 'Image', 'Lien', 'Schéma'])
    fireEvent.click(screen.getByRole('menuitem', { name: /Lien/ }))
    fireEvent.change(screen.getByLabelText('Adresse du lien'), { target: { value: 'https://exemple.fr/page' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter le lien' }))
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('s1', 'i1', { kind: 'LINK', url: 'https://exemple.fr/page', name: null }))
    expect(onTitleHint).toHaveBeenCalled()
  })

  it('Schéma : créé vide tout de suite', async () => {
    api.add.mockResolvedValue(c('d1', 'DIAGRAM', 0))
    renderZone()
    fireEvent.click(screen.getByRole('button', { name: /Ajouter/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Schéma/ }))
    await waitFor(() => expect(api.add).toHaveBeenCalledWith('s1', 'i1', { kind: 'DIAGRAM', xml: '' }))
  })

  it('retrait après confirmation ; descente dans la sorte', async () => {
    api.remove.mockResolvedValue(undefined)
    api.reorder.mockResolvedValue([])
    renderZone({ contents: [c('f1', 'FILE', 0), c('f2', 'FILE', 1)] })
    fireEvent.click(screen.getAllByLabelText('Descendre')[0])
    await waitFor(() => expect(api.reorder).toHaveBeenCalledWith('s1', 'i1', ['f2', 'f1']))
    fireEvent.click(screen.getAllByLabelText('Retirer')[1])
    expect(api.remove).not.toHaveBeenCalled()
    const buttons = screen.getAllByRole('button', { name: 'Retirer' })
    fireEvent.click(buttons[buttons.length - 1])
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('s1', 'i1', 'f2'))
  })

  it('sans droit : affichage seul, rien si aucun contenu', () => {
    const { container, rerender } = renderZone({ canEdit: false, contents: [c('f1', 'FILE', 0)] })
    expect(screen.queryByRole('button', { name: /Ajouter/ })).toBeNull()
    expect(screen.queryByLabelText('Retirer')).toBeNull()
    expect(screen.getByText('f1').closest('a')?.getAttribute('href')).toBe('https://x/f1')
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ItemContentsSection spaceId="s1" itemId="i1" canEdit={false} contents={[]} />
      </QueryClientProvider>,
    )
    expect(container.textContent).toBe('')
  })

  it('élément pas encore enregistré : pas d\'ajout, phrase d\'explication', () => {
    renderZone({ itemId: undefined })
    expect(screen.queryByRole('button', { name: /Ajouter/ })).toBeNull()
    expect(screen.getByText(/Enregistrez d'abord l'élément/)).toBeTruthy()
  })
})
