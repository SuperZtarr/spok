import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './auth'

// Mock the theme store to avoid side effects
vi.mock('./theme', () => ({
  useThemeStore: {
    getState: () => ({
      initTheme: vi.fn(),
    }),
  },
}))

const mockUser = {
  id: 'user-1',
  email: 'test@test.com',
  name: 'Test User',
  globalRole: 'USER' as const,
  emailVerified: true,
  themePreference: 'system' as const,
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  })

  describe('setAuth', () => {
    it('should set user, tokens and isAuthenticated', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-123', 'refresh-456')

      const state = useAuthStore.getState()
      expect(state.user).toEqual(mockUser)
      expect(state.accessToken).toBe('access-123')
      expect(state.refreshToken).toBe('refresh-456')
      expect(state.isAuthenticated).toBe(true)
    })

    it('should store accessToken in localStorage', () => {
      useAuthStore.getState().setAuth(mockUser, 'access-123', 'refresh-456')
      expect(localStorage.getItem('accessToken')).toBe('access-123')
    })
  })

  describe('updateTokens', () => {
    it('should update tokens without changing user', () => {
      useAuthStore.getState().setAuth(mockUser, 'old-access', 'old-refresh')
      useAuthStore.getState().updateTokens('new-access', 'new-refresh')

      const state = useAuthStore.getState()
      expect(state.accessToken).toBe('new-access')
      expect(state.refreshToken).toBe('new-refresh')
      expect(state.user).toEqual(mockUser)
    })

    it('should update localStorage accessToken', () => {
      useAuthStore.getState().updateTokens('new-access', 'new-refresh')
      expect(localStorage.getItem('accessToken')).toBe('new-access')
    })
  })

  describe('updateUser', () => {
    it('should partially update user fields', () => {
      useAuthStore.getState().setAuth(mockUser, 'a', 'r')
      useAuthStore.getState().updateUser({ name: 'New Name' })
      expect(useAuthStore.getState().user?.name).toBe('New Name')
      expect(useAuthStore.getState().user?.email).toBe('test@test.com')
    })

    it('should be no-op if no user set', () => {
      useAuthStore.getState().updateUser({ name: 'Ghost' })
      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.getState().setAuth(mockUser, 'a', 'r')
      useAuthStore.getState().logout()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('should remove accessToken from localStorage', () => {
      localStorage.setItem('accessToken', 'old')
      useAuthStore.getState().logout()
      expect(localStorage.getItem('accessToken')).toBeNull()
    })
  })
})
