/* Tests du bandeau « saisie retrouvée » (ItemDraftBanner, règle item-draft-local) : explication visible, avertissement
 * seulement si l'élément a changé depuis, boutons Reprendre / Ignorer. */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { ItemDraftBanner } from './ItemDraftBanner'

const texts = { explain: 'Explication', changedSince: 'Modifié depuis' }

describe('ItemDraftBanner', () => {
  it('explication visible, pas d\'avertissement sans changement', () => {
    render(<ItemDraftBanner savedAt={Date.now()} changedSince={false} onResume={() => {}} onDiscard={() => {}} texts={texts} />)
    expect(screen.getByText('Explication')).toBeTruthy()
    expect(screen.queryByText('Modifié depuis')).toBeNull()
  })

  it('avertissement si l\'élément a été modifié depuis', () => {
    render(<ItemDraftBanner savedAt={Date.now()} changedSince onResume={() => {}} onDiscard={() => {}} texts={texts} />)
    expect(screen.getByText('Modifié depuis')).toBeTruthy()
  })

  it('Reprendre et Ignorer appellent leur action', () => {
    const onResume = vi.fn(); const onDiscard = vi.fn()
    render(<ItemDraftBanner savedAt={Date.now()} changedSince={false} onResume={onResume} onDiscard={onDiscard} />)
    fireEvent.click(screen.getByText('Reprendre'))
    fireEvent.click(screen.getByText('Ignorer'))
    expect(onResume).toHaveBeenCalledOnce()
    expect(onDiscard).toHaveBeenCalledOnce()
  })
})
