/*
 * AgendaPanel — préparation d'une séance : lignes ordonnées (titre, espace source, présentateur, « présenté à HH:MM »).
 * Animateur/présentateurs : ↑/↓ (règles agendaOrder, miroir de l'API), Retirer (sa ligne ou animateur),
 * Afficher (séance LIVE). Participants : lecture seule. compact = version resserrée pour la fenêtre en direct.
 * Les lignes sont des liens vers les sources : rien n'est copié avant « Afficher ».
 * Libellés affichés : « préparation » (anciennement « programme », renommé 2026-10-11).
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Play, X } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import { useAuthStore } from '../../stores/auth';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';
import { moveTarget, swapIds } from './agendaOrder';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

interface Props { state: LiveSessionState; live: LiveSessionHandle; compact?: boolean }

export function AgendaPanel({ state, live, compact }: Props) {
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const [error, setError] = useState<string | null>(null);
  const isHost = state.myRole === 'HOST';
  const canEdit = state.myRole !== 'PARTICIPANT' && state.session.status !== 'ENDED';
  const canDisplay = state.myRole !== 'PARTICIPANT' && state.session.status === 'LIVE';
  const agenda = state.agenda;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible'); }
  };

  if (agenda.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-3">
        Préparation vide.{canEdit && ' Ajoutez des éléments depuis le menu d\'un item (« Ajouter à la préparation ») ou la recherche.'}
      </p>
    );
  }

  return (
    <div className={compact ? 'p-2' : 'p-3'}>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <ol className={`divide-y divide-border text-sm overflow-auto ${compact ? 'max-h-full' : 'max-h-96'}`}>
        {agenda.map((a, i) => {
          const up = canEdit ? moveTarget(agenda, i, -1, userId, isHost) : null;
          const down = canEdit ? moveTarget(agenda, i, 1, userId, isHost) : null;
          const canRemove = canEdit && (isHost || a.presenter.id === userId);
          return (
            <li key={a.id} className={`flex items-center gap-2 py-1.5 ${a.presentedAt ? 'opacity-60' : ''}`}>
              <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
              <span className="flex-1 min-w-0">
                <span className="block truncate font-medium">{a.title}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {a.sourceSpaceName ?? 'Espace indisponible'} · {a.presenter.name}
                  {a.presentedAt && ` · présenté à ${time(a.presentedAt)}`}
                </span>
              </span>
              {canEdit && (
                <span className="flex items-center">
                  <button aria-label="Monter" disabled={up === null} className="p-1 rounded hover:bg-accent disabled:opacity-30"
                    onClick={() => up !== null && run(() => live.reorderAgenda(swapIds(agenda, i, up)))}>
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button aria-label="Descendre" disabled={down === null} className="p-1 rounded hover:bg-accent disabled:opacity-30"
                    onClick={() => down !== null && run(() => live.reorderAgenda(swapIds(agenda, i, down)))}>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  {canRemove && (
                    <button aria-label="Retirer de la préparation" className="p-1 rounded hover:bg-accent text-muted-foreground"
                      onClick={() => run(() => live.removeFromAgenda(a.id))}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              )}
              {canDisplay && (
                <button className="inline-flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 text-white text-xs"
                  onClick={() => run(() => live.displayAgenda(a.id))}>
                  <Play className="w-3 h-3" /> Afficher
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
