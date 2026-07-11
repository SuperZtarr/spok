/*
 * Hook : préférences par espace et par utilisateur (MindMap : nœuds repliés/épinglés/portails...),
 * persistées côté API (space-preferences). Debounce les écritures.
 */
import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface MindMapPreferences {
  collapsedIds?: string[];
  pinnedIds?: string[];
  portals?: unknown[];
}

export interface SpacePreferences {
  mindmap?: MindMapPreferences;
}

const API_URL = import.meta.env.VITE_API_URL || '';

function getToken(): string {
  return localStorage.getItem('accessToken') ?? '';
}

async function fetchPreferences(spaceId: string): Promise<SpacePreferences> {
  const token = getToken();
  const res = await fetch(`${API_URL}/spaces/${spaceId}/preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return {};
  return res.json();
}

async function patchPreferences(spaceId: string, data: SpacePreferences): Promise<SpacePreferences> {
  const token = getToken();
  const res = await fetch(`${API_URL}/spaces/${spaceId}/preferences`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return data;
  return res.json();
}

export function useSpacePreferences(spaceId: string | undefined) {
  const queryClient = useQueryClient();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: preferences, isSuccess } = useQuery({
    queryKey: ['space-preferences', spaceId],
    queryFn: () => fetchPreferences(spaceId!),
    enabled: !!spaceId,
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: (data: SpacePreferences) => patchPreferences(spaceId!, data),
    onSuccess: (data) => {
      queryClient.setQueryData(['space-preferences', spaceId], data);
    },
  });

  const savePreferences = useCallback((data: SpacePreferences) => {
    if (!spaceId) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      mutation.mutate(data);
    }, 800);
  }, [spaceId, mutation]);

  return { preferences: preferences ?? {}, isPrefsLoaded: isSuccess, savePreferences };
}
