/*
 * LiveSessionsButton — bouton de l'en-tête (à côté de la cloche) pour revenir aux séances en cours (préparées ou en
 * direct) auxquelles l'utilisateur est convié (membre de l'espace parent ou de l'espace de séance).
 * Masqué s'il n'y en a aucune ; badge = nombre de séances, icône rouge si l'une est en direct.
 * « Ouvrir » / « Rejoindre » : rejoint si besoin, en fait la séance active, rafraîchit la sidebar et y navigue.
 * Requête ['live-sessions-ongoing'] rafraîchie toutes les 30 s (comme NotificationBell) et invalidée par les actions de
 * séance — indépendante de la sidebar (pas de polling sur ['sidebar-spaces']). Liste en portail (position fixe) pour
 * échapper aux stacking contexts du header (cf. skill spok-layout).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import type { LiveSessionOngoing } from '@spok/shared';
import { liveSessionsApi } from '../../lib/api';
import { useActiveLiveSessionStore } from '../../stores/activeLiveSession';

export const ONGOING_SESSIONS_KEY = ['live-sessions-ongoing'];

export function LiveSessionsButton() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setActive = useActiveLiveSessionStore((s) => s.setActive);
  const { data: sessions = [] } = useQuery({
    queryKey: ONGOING_SESSIONS_KEY,
    queryFn: () => liveSessionsApi.ongoing(),
    refetchInterval: 30000,
  });

  const updatePosition = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onDown = (e: MouseEvent) => {
      const portal = document.getElementById('live-sessions-portal');
      if (!buttonRef.current?.contains(e.target as Node) && !portal?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', updatePosition);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('resize', updatePosition); };
  }, [open, updatePosition]);

  if (sessions.length === 0) return null;
  const anyLive = sessions.some((s) => s.status === 'LIVE');

  const go = async (s: LiveSessionOngoing) => {
    setError(null);
    try {
      if (!s.isMember) await liveSessionsApi.join(s.id);
      setActive(s.spaceId);
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ONGOING_SESSIONS_KEY });
      setOpen(false);
      navigate(`/spaces/${s.spaceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        data-testid="live-sessions-button"
        onClick={() => setOpen((o) => !o)}
        className={`relative p-2 rounded-md hover:bg-accent transition-colors ${anyLive ? 'text-red-600' : ''}`}
        title={anyLive ? 'Séance en direct' : 'Séances en cours'}
      >
        <Radio className={`w-5 h-5 ${anyLive ? 'animate-pulse' : ''}`} />
        <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1 ${anyLive ? 'bg-red-500' : 'bg-orange-500'}`}>
          {sessions.length}
        </span>
      </button>
      {open && pos && createPortal(
        <div
          id="live-sessions-portal"
          className="fixed z-50 w-80 max-w-[calc(100vw-16px)] rounded-lg border border-border bg-background p-2 shadow-xl text-sm"
          style={{ top: pos.top, right: pos.right }}
        >
          <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">Séances en cours</p>
          {error && <p className="px-1 pb-1 text-xs text-red-600">{error}</p>}
          <ul className="divide-y divide-border">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-1.5">
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">
                    {s.spaceName}
                    {s.status === 'LIVE' ? <span className="text-red-600"> ● direct</span> : <span className="text-orange-600"> préparée</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{s.parentSpaceName}</span>
                </span>
                <button className="rounded bg-orange-500 px-2 py-0.5 text-xs text-white" onClick={() => go(s)}>
                  {s.isMember ? 'Ouvrir' : 'Rejoindre'}
                </button>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
