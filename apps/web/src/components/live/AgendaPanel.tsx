/*
 * AgendaPanel — préparation d'une séance : lignes ordonnées (vignette image/schéma, titre, espace source, présentateur,
 * « présenté à HH:MM »). La vignette (thumbnailUrl) : l'animateur les reçoit toutes, un présentateur seulement
 * celles de ses lignes, un participant aucune (filtré par l'API) — afficher la vignette seulement si présente.
 * Animateur/présentateurs : ↑/↓ (règles agendaOrder, miroir de l'API), Retirer (sa ligne ou animateur),
 * Afficher (séance LIVE). Participants : lecture seule. compact = version resserrée pour la fenêtre en direct.
 * « Ajouter des éléments » (animateur/présentateurs, séance non terminée, aussi quand la préparation est vide) :
 * ajout groupé d'éléments de l'espace parent (AddAgendaItemsDialog) ; infobulle dans live-window.help.ts (hints).
 * Les lignes sont des liens vers les sources : rien n'est copié avant « Afficher ».
 * Libellés affichés : « préparation » (anciennement « programme », renommé 2026-10-11).
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, ListPlus, Play, X } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import { useAuthStore } from '../../stores/auth';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';
import { HelpHint } from '../../help/HelpHint';
import { PAGE_HELP } from '../../help/pageHelp';
import { moveTarget, swapIds } from './agendaOrder';
import { AddAgendaItemsDialog } from './AddAgendaItemsDialog';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

interface Props { state: LiveSessionState; live: LiveSessionHandle; compact?: boolean }

export function AgendaPanel({ state, live, compact }: Props) {
  const userId = useAuthStore((s) => s.user?.id) ?? '';
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const isHost = state.myRole === 'HOST';
  const canEdit = state.myRole !== 'PARTICIPANT' && state.session.status !== 'ENDED';
  const canDisplay = state.myRole !== 'PARTICIPANT' && state.session.status === 'LIVE';
  const agenda = state.agenda;
  // Colonne de vignettes seulement si au moins une ligne en a une (titres alignés entre eux)
  const anyThumbnail = agenda.some((a) => a.thumbnailUrl);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Action impossible'); }
  };

  // Ajout groupé d'éléments de l'espace parent (animateur / présentateurs, séance non terminée)
  const addButton = canEdit && (
    <>
      <HelpHint text={PAGE_HELP['live-window'].hints?.addAgendaItems} className="inline-flex">
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => setAdding(true)}>
          <ListPlus className="w-3.5 h-3.5" /> Ajouter des éléments
        </button>
      </HelpHint>
      {adding && <AddAgendaItemsDialog state={state} live={live} onClose={() => setAdding(false)} />}
    </>
  );

  if (agenda.length === 0) {
    return (
      <div className={`space-y-2 ${compact ? 'p-2' : 'p-3'}`}>
        <p className="text-sm text-muted-foreground">
          Préparation vide.{canEdit && ' Ajoutez des éléments de l\'espace ci-dessous, depuis le menu d\'un item (« Ajouter à la préparation ») ou la recherche.'}
        </p>
        {addButton}
      </div>
    );
  }

  return (
    <div className={compact ? 'p-2' : 'p-3'}>
      {addButton && <div className="mb-1">{addButton}</div>}
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      <ol className={`divide-y divide-border text-sm overflow-auto ${compact ? 'max-h-full' : 'max-h-96'}`}>
        {agenda.map((a, i) => {
          const up = canEdit ? moveTarget(agenda, i, -1, userId, isHost) : null;
          const down = canEdit ? moveTarget(agenda, i, 1, userId, isHost) : null;
          const canRemove = canEdit && (isHost || a.presenter.id === userId);
          return (
            <li key={a.id} className={`flex items-center gap-2 py-1.5 ${a.presentedAt ? 'opacity-60' : ''}`}>
              <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}.</span>
              {/* Vignette de l'image / du schéma source (null pour les participants : jamais d'URL source chez eux) */}
              {anyThumbnail && (
                <span className={`shrink-0 rounded border bg-muted overflow-hidden ${compact ? 'w-6 h-6' : 'w-8 h-8'}`}>
                  {a.thumbnailUrl && (
                    <img src={a.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  )}
                </span>
              )}
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
