/*
 * ParentSessionsButton — bouton « Séances » de la barre d'outils d'un espace de communauté.
 * Liste les séances de l'espace (en direct d'abord), « Rejoindre » (devient membre de l'espace de séance
 * puis y navigue) ; « Nouvelle séance » visible seulement pour un OWNER de la communauté (canCreate),
 * nommée par la date locale du jour et créée « préparée ». Créer ou rejoindre en fait la séance active
 * (useActiveLiveSessionStore) et rafraîchit la barre latérale (['sidebar-spaces']). Une seule séance en cours par espace : si une séance est préparée ou en direct,
 * « Nouvelle séance » est remplacé par « Ouvrir la séance en cours » (l'API refuse aussi la création, 409).
 * N'apparaît ni dans un espace de séance ni hors communauté (géré par l'appelant).
 * « Nouvelle séance » ouvre d'abord NewSessionDialog (« Préparer la séance ») : les éléments cochés de cet espace
 * forment la préparation initiale (champ agenda de la création) ; les invités cochés sont transmis (invitees).
 * Aide : infobulle HelpHint (SPACE_TOOLBAR_HINTS.sessions) et repère de tour data-tour="toolbar-sessions"
 * (étape commune des tours de vues, help/commonTourSteps.ts) — pas de `title` natif.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { liveSessionsApi } from '../../lib/api';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';
import { todayLocal } from './sessionName';
import { NewSessionDialog } from './NewSessionDialog';
import { HelpHint } from '../../help/HelpHint';
import { SPACE_TOOLBAR_HINTS } from '../../help/spaceToolbar.hints';


export function ParentSessionsButton({ spaceId, canCreate }: { spaceId: string; canCreate: boolean }) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActive = useActiveLiveSessionStore((s) => s.setActive);
  const { data: sessions = [] } = useQuery({
    queryKey: ['live-sessions', spaceId],
    queryFn: () => liveSessionsApi.listForParent(spaceId),
    enabled: open,
  });

  const run = async (fn: () => Promise<string>) => {
    setError(null);
    try {
      const target = await fn();
      setActive(target);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] }); // barre latérale (Layout.tsx)
      queryClient.invalidateQueries({ queryKey: ['live-sessions-ongoing'] }); // bouton de l'en-tête
      setOpen(false);
      setPreparing(false);
      navigate(`/spaces/${target}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    }
  };
  const go = (id: string, sessionSpaceId: string, isMember: boolean) => run(async () => {
    if (!isMember) await liveSessionsApi.join(id);
    return sessionSpaceId;
  });
  const create = async (agenda: Array<{ sourceItemId: string; includeChildren?: boolean }>, invitees: string[]) => {
    setCreating(true);
    await run(async () => (await liveSessionsApi.create(spaceId, todayLocal(), agenda, invitees)).session.spaceId);
    setCreating(false);
  };

  const rank = { LIVE: 0, PREPARED: 1, ENDED: 2 } as const;
  const sorted = [...sessions].sort((a, b) => rank[a.status] - rank[b.status]);
  const ongoing = sorted.find((s) => s.status !== 'ENDED');

  return (
    <div className="relative">
      <HelpHint text={SPACE_TOOLBAR_HINTS.sessions}>
        <button
          type="button"
          data-tour="toolbar-sessions"
          className="flex items-center gap-1 rounded px-2 py-1 text-sm hover:bg-muted"
          onClick={() => setOpen((o) => !o)}
        >
          <Radio className="h-4 w-4" /> Séances
        </button>
      </HelpHint>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-background p-2 shadow-xl text-sm">
          {ongoing ? (
            <button className="w-full rounded bg-orange-500 px-2 py-1 text-white mb-2" onClick={() => go(ongoing.id, ongoing.spaceId, ongoing.isMember)}>
              {ongoing.isMember ? 'Ouvrir' : 'Rejoindre'} la séance en cours
            </button>
          ) : canCreate && (
            <button className="w-full rounded bg-orange-500 px-2 py-1 text-white mb-2" onClick={() => { setError(null); setOpen(false); setPreparing(true); }}>Nouvelle séance</button>
          )}
          {error && <p className="text-xs text-red-600 px-1 mb-1">{error}</p>}
          {sorted.length === 0 && <p className="text-muted-foreground px-1">Aucune séance.</p>}
          <ul className="divide-y divide-border">
            {sorted.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 truncate">
                  {s.spaceName}
                  {s.status === 'LIVE' && <span className="text-red-600"> ● direct</span>}
                  {s.status === 'PREPARED' && <span className="text-orange-600"> préparée</span>}
                </span>
                <button className="hover:underline" onClick={() => go(s.id, s.spaceId, s.isMember)}>
                  {s.isMember ? 'Ouvrir' : 'Rejoindre'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {preparing && (
        <NewSessionDialog
          spaceId={spaceId}
          busy={creating}
          error={error}
          onCreate={(agenda, invitees) => { void create(agenda, invitees); }}
          onClose={() => { setPreparing(false); setError(null); }}
        />
      )}
    </div>
  );
}
