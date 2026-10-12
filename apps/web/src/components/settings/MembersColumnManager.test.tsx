/* Tests de MembersColumnManager : actions sur sa propre ligne (se rétrograder, quitter) — espaces seulement (onLeave). */
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { MembersColumnManager } from './MembersColumnManager'

const me = { id: 'm-me', userId: 'me', email: 'me@x.fr', name: 'Moi' }
const other = { id: 'm-o', userId: 'o', email: 'o@x.fr', name: 'Autre' }

function setup(members: Array<typeof me & { role: string }>, onLeave?: () => void) {
  const onUpdateRole = vi.fn()
  const utils = render(
    <MembersColumnManager
      members={members} availableUsers={[]} isLoading={false} isOwner={false} currentUserId="me"
      onAddMember={vi.fn()} onRemoveMember={vi.fn()} onUpdateRole={onUpdateRole} onLeave={onLeave}
    />,
  )
  return { ...utils, onUpdateRole }
}

describe('MembersColumnManager — actions sur soi', () => {
  it('se rétrograder : possible avec un autre propriétaire', () => {
    const { getByLabelText, onUpdateRole } = setup([{ ...me, role: 'OWNER' }, { ...other, role: 'OWNER' }], vi.fn())
    fireEvent.click(getByLabelText('Me rétrograder en membre'))
    expect(onUpdateRole).toHaveBeenCalledWith('m-me', 'MEMBER')
  })

  it('se rétrograder : désactivé pour le dernier propriétaire', () => {
    const { getByLabelText } = setup([{ ...me, role: 'OWNER' }, { ...other, role: 'MEMBER' }], vi.fn())
    expect((getByLabelText('Me rétrograder en membre') as HTMLButtonElement).disabled).toBe(true)
  })

  it('quitter depuis la colonne Membres', () => {
    const onLeave = vi.fn()
    const { getByLabelText } = setup([{ ...me, role: 'MEMBER' }, { ...other, role: 'OWNER' }], onLeave)
    fireEvent.click(getByLabelText("Quitter l'espace"))
    expect(onLeave).toHaveBeenCalled()
  })

  it('sans onLeave (communautés) : aucune action sur sa propre ligne', () => {
    const { queryByLabelText } = setup([{ ...me, role: 'OWNER' }, { ...other, role: 'OWNER' }])
    expect(queryByLabelText('Me rétrograder en membre')).toBeNull()
  })
})
