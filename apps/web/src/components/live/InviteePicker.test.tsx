/* Tests de InviteePicker : filtre par nom/e-mail, cocher/décocher, message si personne n'est invitable. */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { InviteePicker } from './InviteePicker'

const candidates = [
  { userId: 'a', name: 'Alice Martin', email: 'alice@x.fr' },
  { userId: 'b', name: 'Bruno', email: 'bruno@y.fr' },
]

describe('InviteePicker', () => {
  it('filtre par nom ou e-mail', () => {
    const { getByPlaceholderText, queryByText } = render(<InviteePicker candidates={candidates} selected={[]} onChange={() => {}} />)
    fireEvent.change(getByPlaceholderText('Rechercher un membre de la communauté'), { target: { value: 'y.fr' } })
    expect(queryByText('Alice Martin')).toBeNull()
    expect(queryByText('Bruno')).not.toBeNull()
  })

  it('cocher ajoute, décocher retire', () => {
    const onChange = vi.fn()
    const { getByLabelText, rerender } = render(<InviteePicker candidates={candidates} selected={[]} onChange={onChange} />)
    fireEvent.click(getByLabelText('Alice Martin'))
    expect(onChange).toHaveBeenLastCalledWith(['a'])
    rerender(<InviteePicker candidates={candidates} selected={['a']} onChange={onChange} />)
    fireEvent.click(getByLabelText('Alice Martin'))
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('personne à inviter : message par défaut, ou état vide fourni par l\'appelant', () => {
    const { getByText, rerender } = render(<InviteePicker candidates={[]} selected={[]} onChange={() => {}} />)
    getByText(/Aucun membre de la communauté à inviter/)
    rerender(<InviteePicker candidates={[]} selected={[]} onChange={() => {}} emptyState={<p>Ajoutez vos joueurs</p>} />)
    getByText('Ajoutez vos joueurs')
  })
})
