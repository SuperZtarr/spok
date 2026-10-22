/* TNR : « Marquer comme non lu » absent du menu d'un item pour un visiteur anonyme (lecture seule), présent connecté. */
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

  it('connecté sans droit d\'édition : « Marquer comme non lu » présent', () => {
    useAuthStore.setState({ user: { id: 'u1' } as never, isAuthenticated: true })
    expect(actionIds()).toContain('mark-unread')
  })
})
