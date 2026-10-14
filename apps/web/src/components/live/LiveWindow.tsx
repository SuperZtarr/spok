/*
 * LiveWindow — fenêtre flottante « en direct » de la séance active, rendue par LiveSessionHost sur TOUTES les
 * pages tant que la séance est LIVE. Onglet Direct : copie présentée (titre, « présenté par », description,
 * sous-items révélés) + pour l'animateur SEUL la section « À révéler » (PendingChildren).
 * Onglets Préparation (anciennement « Programme » : AgendaPanel compact) et Rechercher (PresenterPanel) pour l'animateur/les présentateurs.
 * Déplaçable (barre de titre), redimensionnable (poignée bas-droite), réductible, plein écran ; géométrie
 * mémorisée (liveWindowGeometry). Portail sur document.body (z-40, sous les modales z-50) : ne jamais l'insérer
 * dans Layout.tsx. « Aller à la séance » ouvre l'espace de séance ; « Quitter le direct » oublie la séance active.
 * Écran étroit (< 768px, useIsNarrowScreen) : plein écran, sans déplacement ni redimensionnement ; « Voir l'espace »
 * réduit la fenêtre en barre en bas d'écran, « Retour au direct » la rouvre ; chaque nouvel affichage la ramène au premier plan.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Maximize2, Minimize2, Radio, LogIn, X } from 'lucide-react';
import type { LiveSessionState } from '@spok/shared';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';
import { clampGeometry, loadGeometry, saveGeometry, type Geometry } from './liveWindowGeometry';
import { AgendaPanel } from './AgendaPanel';
import { PresenterPanel } from './PresenterPanel';
import { PendingChildren } from './PendingChildren';
import { PageHelpButton } from '../../help/PageHelpButton';

interface Props {
  state: LiveSessionState;
  live: LiveSessionHandle;
  onOpenItem: (itemId: string) => void;
  onGoToSession: () => void;
  onLeave: () => void;
}

type Tab = 'live' | 'agenda' | 'search';

const viewport = () => ({ width: window.innerWidth, height: window.innerHeight });

const NARROW_QUERY = '(max-width: 767px)';

/** Écran étroit (mobile) — suit les changements de taille / d'orientation. */
function useIsNarrowScreen() {
  const [narrow, setNarrow] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
}

export function LiveWindow({ state, live, onOpenItem, onGoToSession, onLeave }: Props) {
  const [geo, setGeo] = useState<Geometry>(() => clampGeometry(loadGeometry(), viewport()));
  const [tab, setTab] = useState<Tab>('live');
  const [flash, setFlash] = useState(false);
  const drag = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; origin: Geometry } | null>(null);
  const currentId = state.current?.entry.id;
  const presenter = state.myRole !== 'PARTICIPANT';
  const narrow = useIsNarrowScreen();
  const [mobileView, setMobileView] = useState<'live' | 'space'>('live');

  useEffect(() => { saveGeometry(geo); }, [geo]);
  useEffect(() => {
    if (!currentId) return;
    setTab('live');
    setMobileView('live');
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 1500);
    return () => clearTimeout(t);
  }, [currentId]);

  const onPointerDown = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
    if (geo.mode === 'maximized' || narrow) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { kind, startX: e.clientX, startY: e.clientY, origin: geo };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const next = d.kind === 'move'
      ? { ...d.origin, x: d.origin.x + dx, y: d.origin.y + dy }
      : { ...d.origin, width: d.origin.width + dx, height: d.origin.height + dy };
    setGeo(clampGeometry(next, viewport()));
  };
  const onPointerUp = () => { drag.current = null; };

  const current = state.current;

  // Mobile, espace visible : barre compacte en bas d'écran
  if (narrow && mobileView === 'space') {
    return createPortal(
      <div data-testid="live-window" className="fixed z-40 left-0 right-0 bottom-0 flex items-center gap-2 border-t border-border bg-background px-3 py-2 shadow-2xl">
        <Radio className="h-4 w-4 shrink-0 text-red-500" />
        <span className="flex-1 truncate text-sm">{current ? current.item.title || 'Sans titre' : 'En direct'}</span>
        <button className="rounded bg-orange-500 px-2 py-1 text-xs text-white" onClick={() => setMobileView('live')}>Retour au direct</button>
      </div>,
      document.body,
    );
  }

  const style: React.CSSProperties = narrow
    ? { inset: 0 }
    : geo.mode === 'maximized'
    ? { inset: 16 }
    : geo.mode === 'minimized'
      ? { left: geo.x, top: geo.y, width: 300 }
      : { left: geo.x, top: geo.y, width: geo.width, height: geo.height };
  const headerBtn = 'p-1 hover:bg-muted rounded';
  const tabBtn = (t: Tab) => `px-2 py-1 text-xs rounded ${tab === t ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent'}`;

  return createPortal(
    <div
      data-testid="live-window"
      className={`fixed z-40 flex flex-col rounded-lg border bg-background shadow-2xl ${flash ? 'border-orange-500 ring-2 ring-orange-500' : 'border-border'}`}
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div data-tour="live-header" className="flex items-center gap-1 px-3 py-2 border-b border-border cursor-move select-none" onPointerDown={onPointerDown('move')}>
        <Radio className="h-4 w-4 shrink-0 text-red-500" />
        <span className="text-sm font-medium truncate flex-1" title={state.spaceName}>
          {current ? current.item.title || 'Sans titre' : 'En attente du premier élément'}
        </span>
        {narrow && (
          <button className="rounded border border-border px-2 py-0.5 text-xs" onClick={() => { setMobileView('space'); onGoToSession(); }}>Voir l'espace</button>
        )}
        {/* Aide : hors de la zone de déplacement */}
        <span onPointerDown={(e) => e.stopPropagation()}><PageHelpButton pageKey="live-window" /></span>
        <button aria-label="Aller à la séance" title="Aller à la séance" className={headerBtn} onPointerDown={(e) => e.stopPropagation()} onClick={onGoToSession}>
          <LogIn className="h-4 w-4" />
        </button>
        {!narrow && <>
        <button aria-label={geo.mode === 'minimized' ? 'Agrandir' : 'Réduire'} className={headerBtn} onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setGeo((g) => ({ ...g, mode: g.mode === 'minimized' ? 'normal' : 'minimized' }))}>
          <Minus className="h-4 w-4" />
        </button>
        <button aria-label={geo.mode === 'maximized' ? 'Restaurer' : 'Plein écran'} className={headerBtn} onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setGeo((g) => ({ ...g, mode: g.mode === 'maximized' ? 'normal' : 'maximized' }))}>
          {geo.mode === 'maximized' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        </>}
        <button aria-label="Quitter le direct" title="Quitter le direct" className={headerBtn} onPointerDown={(e) => e.stopPropagation()} onClick={onLeave}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {(narrow || geo.mode !== 'minimized') && presenter && (
        <div data-tour="live-tabs" className="flex items-center gap-1 px-2 py-1 border-b border-border">
          <button className={tabBtn('live')} onClick={() => setTab('live')}>Direct</button>
          <button className={tabBtn('agenda')} onClick={() => setTab('agenda')}>Préparation ({state.agenda.length})</button>
          <button className={tabBtn('search')} onClick={() => setTab('search')}>Rechercher</button>
        </div>
      )}
      {(narrow || geo.mode !== 'minimized') && tab === 'agenda' && presenter && (
        <div className="flex-1 overflow-auto"><AgendaPanel state={state} live={live} compact /></div>
      )}
      {(narrow || geo.mode !== 'minimized') && tab === 'search' && presenter && (
        <div className="flex-1 overflow-auto">
          <PresenterPanel sessionSpaceId={state.session.spaceId} onDisplay={(spaceId, itemId) => live.displayItem(itemId, spaceId)} />
        </div>
      )}
      {(narrow || geo.mode !== 'minimized') && (tab === 'live' || !presenter) && (
        <div data-tour="live-content" className="flex-1 overflow-auto p-4 cursor-pointer" onClick={() => current && onOpenItem(current.item.id)}>
          {current && (
            <>
              <p className="text-xs text-muted-foreground mb-2">Présenté par {current.entry.user.name}</p>
              {current.item.description && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-foreground"
                  dangerouslySetInnerHTML={{ __html: current.item.description }}
                />
              )}
              {current.item.url && current.item.type === 'IMAGE' && (
                <img src={current.item.url} alt="" className="mt-3 max-w-full rounded" />
              )}
              {current.children.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm list-disc pl-5">
                  {current.children.map((c) => <li key={c.id}>{c.title || 'Sans titre'}</li>)}
                </ul>
              )}
              {state.myRole === 'HOST' && <PendingChildren sessionId={state.session.id} entryId={current.entry.id} live={live} />}
            </>
          )}
        </div>
      )}
      {!narrow && geo.mode === 'normal' && (
        <div aria-label="Redimensionner" className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize" onPointerDown={onPointerDown('resize')} />
      )}
    </div>,
    document.body,
  );
}
