import { create } from 'zustand';
import type { ThemePreference } from '@spok/shared';
import { userApi } from '../lib/api';

type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  initTheme: (theme: ThemePreference) => void;
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export const useThemeStore = create<ThemeState>()((set) => {
  // Listen for OS theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', () => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const resolved = getSystemTheme();
      applyTheme(resolved);
      set({ resolvedTheme: resolved });
    }
  });

  return {
    theme: 'system',
    resolvedTheme: getSystemTheme(),

    setTheme: (theme) => {
      const resolved = resolveTheme(theme);
      applyTheme(resolved);
      set({ theme, resolvedTheme: resolved });

      // Persist to server (fire and forget)
      userApi.updatePreferences({ themePreference: theme }).catch(() => {});
    },

    initTheme: (theme) => {
      const resolved = resolveTheme(theme);
      applyTheme(resolved);
      set({ theme, resolvedTheme: resolved });
    },
  };
});
