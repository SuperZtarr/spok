import { useState, useCallback, useEffect, useRef } from 'react';

export function useCollapsedIds(spaceId: string) {
  const key = `spok_collapsed_${spaceId}`;

  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) return new Set<string>(JSON.parse(stored));
    } catch {}
    return new Set<string>();
  });

  // Sync to sessionStorage on every change, without re-creating the effect
  const collapsedIdsRef = useRef(collapsedIds);
  collapsedIdsRef.current = collapsedIds;

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify([...collapsedIds]));
    } catch {}
  }, [key, collapsedIds]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return { collapsedIds, setCollapsedIds, toggleCollapse };
}
