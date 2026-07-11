/* TNR du store theme : toggle, classe DOM, sync préférence API (mockée). */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the API before importing the store
vi.mock('../lib/api', () => ({
  userApi: {
    updatePreferences: vi.fn().mockResolvedValue({}),
  },
}))

import { useThemeStore } from './theme'

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store
    useThemeStore.setState({ theme: 'light' })
    // Reset DOM
    document.documentElement.classList.remove('dark')
  })

  describe('initTheme', () => {
    it('should apply light theme when preference is light', () => {
      useThemeStore.getState().initTheme('light')
      expect(useThemeStore.getState().theme).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('should apply dark theme when preference is dark', () => {
      useThemeStore.getState().initTheme('dark')
      expect(useThemeStore.getState().theme).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should resolve system preference when preference is system', () => {
      useThemeStore.getState().initTheme('system')
      // In jsdom matchMedia defaults to false (light)
      expect(useThemeStore.getState().theme).toBe('light')
    })
  })

  describe('setTheme', () => {
    it('should set theme to dark and update DOM', () => {
      useThemeStore.getState().setTheme('dark')
      expect(useThemeStore.getState().theme).toBe('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('should set theme to light and update DOM', () => {
      useThemeStore.getState().setTheme('dark')
      useThemeStore.getState().setTheme('light')
      expect(useThemeStore.getState().theme).toBe('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})
