/* TNR menu des items : « Marquer comme non lu » absent pour un visiteur anonyme, présent connecté ;
 * « Afficher » (mode read) et « Ouvrir » (mode edit) pour tous. */
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

  it('anonyme : pas de « Marquer comme non lu »', () => {
    expect(actionIds()).toContain('open')
    expect(actionIds()).not.toContain('mark-unread')
  })

  it('Afficher et Ouvrir pour tous, avec le mode demandé ; plus d\'entrée « Modifier »', () => {
    const calls: Array<[string, string | undefined]> = []
    const groups = buildItemMenuGroups('item-1', { onOpen: (id, mode) => { calls.push([id, mode]) }, onEdit: () => {} }, { canEdit: true })
    const actions = groups.flatMap((g) => g.actions)
    actions.find((a) => a.id === 'view')!.onClick()
    actions.find((a) => a.id === 'open')!.onClick()
    expect(calls).toEqual([['item-1', 'read'], ['item-1', 'edit']])
    expect(actions.map((a) => a.id)).not.toContain('edit')
  })

  it('sans onOpen : « Ouvrir » passe par onEdit, pas d\'« Afficher »', () => {
    const ids = buildItemMenuGroups('item-1', { onEdit: () => {} }, { canEdit: false }).flatMap((g) => g.actions.map((a) => a.id))
    expect(ids).toContain('open')
    expect(ids).not.toContain('view')
  })

  it('connecté sans droit d\'édition : « Marquer comme non lu » présent', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true })
    expect(actionIds()).toContain('mark-unread')
  })
})
