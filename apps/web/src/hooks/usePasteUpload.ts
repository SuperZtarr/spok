import { useEffect } from 'react';

/**
 * Hook to handle Ctrl+V paste of images.
 * Calls onPaste with the pasted File when an image is pasted.
 */
export function usePasteUpload(enabled: boolean, onPaste: (file: File) => void) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onPaste(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [enabled, onPaste]);
}
