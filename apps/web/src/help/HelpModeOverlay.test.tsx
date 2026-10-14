/* Tests du mode Aide : raccourci Maj+? (hors champs), lecture seule, Échap sans fermer la modale, carte épinglée. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { HelpModeOverlay } from './HelpModeOverlay'
import { useHelpModeStore } from '../stores/helpMode'

const shiftQ = (target: EventTarget = document.body) =>
  fireEvent.keyDown(target, { key: '?', shiftKey: true })

describe('HelpModeOverlay', () => {
  beforeEach(() => { act(() => useHelpModeStore.setState({ active: false })) })

  it('Maj+? active puis désactive ; ignoré dans un champ ou un éditeur', () => {
    const { container } = render(<><input data-testid="i" /><div contentEditable data-testid="e" /><HelpModeOverlay /></>)
    shiftQ(container.querySelector('[data-testid="i"]')!)
    shiftQ(container.querySelector('[data-testid="e"]')!)
    expect(useHelpModeStore.getState().active).toBe(false)
    shiftQ()
    expect(useHelpModeStore.getState().active).toBe(true)
    shiftQ()
    expect(useHelpModeStore.getState().active).toBe(false)
  })

  it('lecture seule : un clic dans l\'appli ne déclenche rien et épingle la carte de la zone', async () => {
    const onClick = vi.fn()
    const onOver = vi.fn()
    const { getByText, findByRole } = render(<>
      <aside data-devzone="sidebar"><button onClick={onClick} onMouseOver={onOver}>Action</button></aside>
      <HelpModeOverlay />
    </>)
    act(() => useHelpModeStore.getState().enter())
    fireEvent.mouseOver(getByText('Action'))
    fireEvent.click(getByText('Action'))
    expect(onClick).not.toHaveBeenCalled()
    expect(onOver).not.toHaveBeenCalled()
    const card = await findByRole('dialog')
    expect(card.textContent).toContain('Barre latérale')
  })

  it('Échap quitte le mode sans atteindre l\'appli (une modale ouverte ne se ferme pas)', () => {
    const onKey = vi.fn()
    const { getByTestId } = render(<><div onKeyDown={onKey} tabIndex={0} data-testid="m" /><HelpModeOverlay /></>)
    act(() => useHelpModeStore.getState().enter())
    fireEvent.keyDown(getByTestId('m'), { key: 'Escape' })
    expect(useHelpModeStore.getState().active).toBe(false)
    expect(onKey).not.toHaveBeenCalled()
  })

  it('le bandeau reste cliquable et Quitter sort du mode', () => {
    const { getByRole } = render(<HelpModeOverlay />)
    act(() => useHelpModeStore.getState().enter())
    fireEvent.click(getByRole('button', { name: 'Quitter le mode Aide' }))
    expect(useHelpModeStore.getState().active).toBe(false)
  })

  it('survol immobile : la carte reste affichée au-delà du rafraîchissement périodique', async () => {
    const { getByText, queryByRole } = render(<><aside data-devzone="sidebar"><span>Z</span></aside><HelpModeOverlay /></>)
    act(() => useHelpModeStore.getState().enter())
    fireEvent.pointerMove(getByText('Z'))
    expect(queryByRole('dialog')).not.toBeNull()
    await act(async () => { await new Promise((r) => setTimeout(r, 650)) })
    expect(queryByRole('dialog')).not.toBeNull()
  })

  it('zone épinglée retirée du DOM : la carte se ferme', async () => {
    const { getByText, queryByRole, rerender } = render(<><aside data-devzone="sidebar"><span>Z</span></aside><HelpModeOverlay /></>)
    act(() => useHelpModeStore.getState().enter())
    fireEvent.click(getByText('Z'))
    rerender(<HelpModeOverlay />)
    await act(async () => { window.dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 30)) })
    expect(queryByRole('dialog')).toBeNull()
  })
})
