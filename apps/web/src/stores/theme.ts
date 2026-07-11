/*
 * Store Zustand : thème light/dark — applique la classe sur <html>, synchronise la préférence
 * utilisateur côté API. initTheme(pref) à l'ouverture de session.
 */
import { create } from 'zustand';
import type { ThemePreference } from '@spok/shared';
import { userApi } from '../lib/api';

type Theme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initTheme: (pref: ThemePreference) => void;
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: getSystemTheme(),

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
    userApi.updatePreferences({ themePreference: theme }).catch(() => {});
  },

  initTheme: (pref) => {
    // "system" → resolve to OS theme, otherwise use the saved value
    const theme: Theme = pref === 'system' ? getSystemTheme() : pref;
    applyTheme(theme);
    set({ theme });
  },
}));
