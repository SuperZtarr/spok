/*
 * ItemSearchPicker — recherche d'éléments avec portée (Cet espace / Communauté / Tous mes espaces), réutilisée par
 * l'ajout à la préparation d'une séance, le panneau Présenter et les relations de la fiche (demande Thomas 2026-11-04).
 * S'appuie sur GET /search/advanced : l'API borne les résultats aux espaces que l'utilisateur peut lire — aucun contrôle ici.
 * Props clés :
 * - spaceId : espace de la portée « Cet espace » ; communitySpaceId : espace dont on lit la communauté, si celui-là n'est
 *   pas lisible (invité d'une séance : l'espace de séance). Sans communauté (espace personnel) : pas de portée Communauté.
 * - excludeIds / excludeSpaceId : éléments ou espace à ne jamais proposer ; doneIds : proposés mais grisés (déjà ajoutés)
 * - browseItems : liste affichée tant que rien n'est saisi (relations : les éléments de l'espace, comme l'ancien menu)
 * - actionLabel / onPick : bouton de chaque ligne ; une erreur de onPick s'affiche sous le champ
 * Textes d'aide : help/itemSearch.hints.ts. Ne pas y ajouter de logique propre à la séance ou aux relations.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi, spacesApi } from '../lib/api';
import { useDebouncedValue } from './live/useDebouncedValue';
import { HelpHint } from '../help/HelpHint';
import { ITEM_SEARCH_HINTS as H } from '../help/itemSearch.hints';

export interface ItemSearchHit {
  id: string;
  title: string | null;
  spaceId: string;
  spaceName?: string;
}

type Scope = 'space' | 'community' | 'all';

interface Props {
  spaceId: string;
  communitySpaceId?: string;
  excludeIds?: Set<string>;
  excludeSpaceId?: string;
  doneIds?: Set<string>;
  browseItems?: ItemSearchHit[];
  actionLabel: string;
  onPick: (hit: ItemSearchHit) => void | Promise<void>;
  autoFocus?: boolean;
  /** Portée à l'ouverture : « Cet espace » par défaut */
  defaultScope?: Scope;
}

export function ItemSearchPicker({ spaceId, communitySpaceId, excludeIds, excludeSpaceId, doneIds, browseItems, actionLabel, onPick, autoFocus, defaultScope = 'space' }: Props) {
  const [scope, setScope] = useState<Scope>(defaultScope);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebouncedValue(q.trim(), 300);

  const communitySource = communitySpaceId ?? spaceId;
  const { data: space } = useQuery({
    queryKey: ['space', communitySource],
    queryFn: () => spacesApi.get(communitySource),
  });
  const communityId = space?.communityId ?? undefined;

  const { data, isFetching } = useQuery({
    queryKey: ['item-search', scope, spaceId, communityId, debounced],
    queryFn: () => searchApi.advanced({
      q: debounced,
      types: 'items',
      pageSize: 30,
      ...(scope === 'space' ? { spaceId } : scope === 'community' ? { communityId } : {}),
    }),
    enabled: debounced.length >= 1,
  });

  const searching = debounced.length >= 1;
  const hits: ItemSearchHit[] = (searching ? (data?.items ?? []) : (browseItems ?? []))
    .filter((i) => !excludeIds?.has(i.id) && i.spaceId !== excludeSpaceId);

  const pick = async (hit: ItemSearchHit) => {
    setBusyId(hit.id);
    setError(null);
    try {
      await onPick(hit);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusyId(null);
    }
  };

  const scopes: Array<{ id: Scope; label: string; hint: string }> = [
    { id: 'space', label: 'Cet espace', hint: H.space },
    ...(communityId ? [{ id: 'community' as const, label: 'Communauté', hint: H.community }] : []),
    { id: 'all', label: 'Tous mes espaces', hint: H.all },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center rounded-md bg-muted p-0.5 w-fit" role="group" aria-label="Portée de la recherche">
        {scopes.map((s) => (
          <HelpHint key={s.id} text={s.hint}>
            <button
              type="button"
              aria-pressed={scope === s.id}
              onClick={() => setScope(s.id)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${scope === s.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {s.label}
            </button>
          </HelpHint>
        ))}
      </div>
      <input
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un élément…"
        aria-label="Rechercher un élément"
        className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
      />
      <p className="text-xs text-muted-foreground">{H.rights}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {searching && !isFetching && hits.length === 0 && <p className="text-xs text-muted-foreground">Aucun résultat.</p>}
      {hits.length > 0 && (
        <ul className="max-h-60 overflow-auto divide-y divide-border text-sm">
          {hits.map((i) => {
            const done = doneIds?.has(i.id);
            return (
              <li key={i.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0 truncate">
                  {i.title || 'Sans titre'}
                  {i.spaceName && <span className="text-muted-foreground"> · {i.spaceName}</span>}
                </span>
                <button
                  type="button"
                  disabled={busyId === i.id || done}
                  className="flex-shrink-0 rounded bg-orange-500 px-2 py-0.5 text-white text-xs disabled:opacity-50"
                  onClick={() => pick(i)}
                >
                  {done ? 'Déjà ajouté' : actionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
