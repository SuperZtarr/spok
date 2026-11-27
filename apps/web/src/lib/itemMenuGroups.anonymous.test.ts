/* TNR menu des éléments : « Marquer comme non lu » absent pour un visiteur anonyme, présent connecté ;
 * vocabulaire unique (2026-11-26) : « Lire » (mode read) pour tous, « Modifier » (mode edit) seulement avec le droit. */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { buildItemMenuGroups } from './itemMenuGroups'
import { useAuthStore } from '../stores/auth'

vi.mock('../stores/theme', () => ({
  useThemeStore: { getState: () => ({ initTheme: vi.fn() }) },
}))

const actionIds = () =>
  buildItemMenuGroups('item-1', { onOpen: () => {} }, { canEdit: false }).flatMap((g) => g.actions.map((a) => a.id))

describe('buildItemMenuGroups — visiteur anonyme', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
  })

  it('anonyme : Lire seulement, pas de « Marquer comme non lu »', () => {
    expect(actionIds()).toContain('read')
    expect(actionIds()).not.toContain('edit')
    expect(actionIds()).not.toContain('mark-unread')
  })

  it('avec le droit : Lire et Modifier, avec le mode demandé', () => {
    const calls: Array<[string, string | undefined]> = []
    const groups = buildItemMenuGroups('item-1', { onOpen: (id, mode) => { calls.push([id, mode]) }, onEdit: () => {} }, { canEdit: true })
    const actions = groups.flatMap((g) => g.actions)
    actions.find((a) => a.id === 'read')!.onClick()
    actions.find((a) => a.id === 'edit')!.onClick()
    expect(calls).toEqual([['item-1', 'read'], ['item-1', 'edit']])
    expect(actions.filter((a) => a.id === 'read' || a.id === 'edit').map((a) => a.label)).toEqual(['Lire', 'Modifier'])
  })

  it('sans onOpen : onEdit sert de « Modifier » avec le droit, de « Lire » sans', () => {
    const ids = (canEdit: boolean) => buildItemMenuGroups('item-1', { onEdit: () => {} }, { canEdit }).flatMap((g) => g.actions.map((a) => a.id))
    expect(ids(true)).toContain('edit')
    expect(ids(true)).not.toContain('read')
    expect(ids(false)).toContain('read')
    expect(ids(false)).not.toContain('edit')
  })

  it('connecté sans droit d\'édition : « Marquer comme non lu » présent', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true })
    expect(actionIds()).toContain('mark-unread')
  })
})
