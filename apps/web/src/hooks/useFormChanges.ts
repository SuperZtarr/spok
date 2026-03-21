import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to track form changes and provide save/cancel/unsaved guard logic.
 *
 * Usage:
 *   const form = useFormChanges(originalValues);
 *   // form.values — current editable values
 *   // form.set('fieldName', value) — update a field
 *   // form.hasChanges — true if any field differs from original
 *   // form.reset() — revert to original values
 *   // form.markSaved() — update original to current (after successful save)
 */
export function useFormChanges<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const originalRef = useRef<T>(initial);

  // Sync when initial values change (e.g., data loaded from server)
  useEffect(() => {
    originalRef.current = initial;
    setValues(initial);
  }, [JSON.stringify(initial)]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const setAll = useCallback((updates: Partial<T>) => {
    setValues(prev => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setValues(originalRef.current);
  }, []);

  const markSaved = useCallback(() => {
    originalRef.current = values;
  }, [values]);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(originalRef.current);

  return { values, set, setAll, hasChanges, reset, markSaved };
}
