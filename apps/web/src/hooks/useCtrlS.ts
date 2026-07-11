/* Hook : raccourci Ctrl+S/Cmd+S → onSave si activé (formulaires d'édition). */
import { useEffect } from 'react';

/**
 * Hook to handle Ctrl+S / Cmd+S keyboard shortcut.
 * Calls onSave when pressed, only if enabled.
 */
export function useCtrlS(enabled: boolean, onSave: () => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, onSave]);
}
