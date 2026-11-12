/* Tests de la confirmation de fermeture (useUnsavedGuard) : sans modification l'action part directement ; avec
 * modifications, deux choix (Rester / Quitter sans enregistrer) ou trois si onSaveAndLeave est fourni
 * (« Enregistrer et quitter » appelle onSaveAndLeave, pas l'action de fermeture). */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { useUnsavedGuard, type UnsavedGuardOptions } from './UnsavedChangesGuard'

function Harness({ hasChanges, onClose, options }: { hasChanges: boolean; onClose: () => void; options?: UnsavedGuardOptions }) {
  const { guard, ConfirmDialog } = useUnsavedGuard(hasChanges, options)
  return (
    <>
      <button onClick={() => guard(onClose)}>Fermer</button>
      {ConfirmDialog}
    </>
  )
}

describe('useUnsavedGuard', () => {
  it('ferme directement sans modification', () => {
    const onClose = vi.fn()
    render(<Harness hasChanges={false} onClose={onClose} />)
    fireEvent.click(screen.getByText('Fermer'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByText('Rester')).toBeNull()
  })

  it('sans onSaveAndLeave : Rester et Quitter sans enregistrer seulement', () => {
    const onClose = vi.fn()
    render(<Harness hasChanges onClose={onClose} />)
    fireEvent.click(screen.getByText('Fermer'))
    expect(screen.getByText('Rester')).toBeTruthy()
    expect(screen.queryByText('Enregistrer et quitter')).toBeNull()
    fireEvent.click(screen.getByText('Quitter sans enregistrer'))
    expect(onClose).toHaveBeenCalledOnce()
    expect(screen.queryByText('Rester')).toBeNull()
  })

  it('Rester garde ouvert sans rien appeler', () => {
    const onClose = vi.fn()
    const onSaveAndLeave = vi.fn()
    render(<Harness hasChanges onClose={onClose} options={{ onSaveAndLeave }} />)
    fireEvent.click(screen.getByText('Fermer'))
    fireEvent.click(screen.getByText('Rester'))
    expect(onClose).not.toHaveBeenCalled()
    expect(onSaveAndLeave).not.toHaveBeenCalled()
    expect(screen.queryByText('Rester')).toBeNull()
  })

  it('Enregistrer et quitter appelle onSaveAndLeave, pas la fermeture directe', () => {
    const onClose = vi.fn()
    const onSaveAndLeave = vi.fn()
    render(<Harness hasChanges onClose={onClose} options={{ onSaveAndLeave }} />)
    fireEvent.click(screen.getByText('Fermer'))
    fireEvent.click(screen.getByText('Enregistrer et quitter'))
    expect(onSaveAndLeave).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByText('Rester')).toBeNull()
  })
})
