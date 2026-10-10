/*
 * PresenterPanel — panneau des présentateurs : recherche dans tous les espaces accessibles (searchApi,
 * borné aux memberships de l'utilisateur côté API) puis « Afficher » → copie verrouillée + diffusion.
 * Les résultats issus de l'espace de séance lui-même sont exclus (on n'affiche pas une copie de copie).
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../lib/api';
import { useDebouncedValue } from './useDebouncedValue';

interface Props {
  sessionSpaceId: string;
  onDisplay: (sourceSpaceId: string, sourceItemId: string) => Promise<void>;
}

export function PresenterPanel({ sessionSpaceId, onDisplay }: Props) {
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(q.trim(), 300);
  const { data, isFetching } = useQuery({
    queryKey: ['live-presenter-search', debounced],
    queryFn: () => searchApi.search(debounced, 1, 20),
    enabled: debounced.length >= 2,
  });
  const items = (data?.items ?? []).filter((i) => i.spaceId !== sessionSpaceId);

  const display = async (spaceId: string, itemId: string) => {
    setBusyId(itemId);
    setError(null);
    try {
      await onDisplay(spaceId, itemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Affichage impossible');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-3 space-y-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un élément dans vos espaces…"
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {debounced.length >= 2 && !isFetching && items.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun résultat.</p>
      )}
      <ul className="max-h-72 overflow-auto divide-y divide-border text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1 min-w-0 truncate">
              {i.title || 'Sans titre'} <span className="text-muted-foreground">· {i.spaceName}</span>
            </span>
            <button
              disabled={busyId === i.id}
              className="rounded bg-orange-500 px-2 py-0.5 text-white text-xs disabled:opacity-50"
              onClick={() => display(i.spaceId, i.id)}
            >
              Afficher
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
