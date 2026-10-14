/*
 * HelpModeOverlay — mode Aide (aide utilisateur, phase 4). Monté une fois dans Layout (à côté de DevZoneInspector).
 * - Raccourci Maj+? (toujours écouté, ignoré dans input/textarea/select/contenteditable) : bascule le mode.
 * - Mode actif = LECTURE SEULE : écouteurs en capture sur window qui bloquent clics, pointer/mouse down-up, double-clic,
 *   menu contextuel, glisser, survols (mouseover/out : ni infobulle HelpHint ni menu ⋮ au survol) et touches (sauf
 *   Échap = quitter, Maj+? = basculer). Seul le bandeau (data-help-mode-ui) reste cliquable.
 * - Survol : la zone la plus interne ayant un texte (findHelpZone) est encadrée + carte (titre, texte) ; clic = carte
 *   épinglée ; zone retirée du DOM = carte fermée.
 * Textes : jamais ici — SHELL_ZONES (cadre) et fiches des vues (zones). z-index : au-dessus de l'appli, des modales et
 * des tours (10001-10002), sous DevZoneInspector.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X } from 'lucide-react';
import { useHelpModeStore } from '../stores/helpMode';
import { findHelpZone } from './helpZones';
import type { HelpZone } from './types';

interface Hit { el: HTMLElement; zone: HelpZone; rect: DOMRect }

const BLOCKED = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'contextmenu', 'dragstart', 'mouseover', 'mouseout', 'submit'] as const;
const CARD_W = 280;

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true' || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};
const isShiftQuestion = (e: KeyboardEvent) => e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey;
const inUi = (t: EventTarget | null) => !!(t as Element | null)?.closest?.('[data-help-mode-ui]');

function cardPosition(r: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = r.right + 8;
  if (left + CARD_W > vw - 8) left = r.left - CARD_W - 8;
  let top = r.top;
  if (left < 8) { left = Math.min(Math.max(8, r.left), vw - CARD_W - 8); top = r.bottom + 8; }
  return { top: Math.min(Math.max(48, top), vh - 140), left };
}

export function HelpModeOverlay() {
  const active = useHelpModeStore((s) => s.active);
  const [hover, setHover] = useState<Hit | null>(null);
  const [pinned, setPinned] = useState<Hit | null>(null);
  const pinnedRef = useRef<HTMLElement | null>(null);

  // Raccourci Maj+? : toujours actif
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isShiftQuestion(e) && !isTyping(e.target)) { e.preventDefault(); e.stopPropagation(); useHelpModeStore.getState().toggle(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Lecture seule + survol, seulement mode actif
  useEffect(() => {
    if (!active) { setHover(null); setPinned(null); pinnedRef.current = null; return; }
    const hit = (t: EventTarget | null): Hit | null => {
      const z = findHelpZone(t as Element | null);
      return z ? { el: z.el, zone: z.zone, rect: z.el.getBoundingClientRect() } : null;
    };
    const block = (e: Event) => {
      if (inUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'click') { const h = hit(e.target); pinnedRef.current = h?.el ?? null; setPinned(h); }
    };
    const onMove = (e: PointerEvent) => { if (!inUi(e.target)) setHover(hit(e.target)); };
    const onKey = (e: KeyboardEvent) => {
      if (isShiftQuestion(e)) return; // géré par le raccourci
      if (inUi(e.target) && (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') useHelpModeStore.getState().exit();
    };
    // Recale encadré et carte (défilement, redimensionnement, re-rendu) ; une zone retirée du DOM ferme sa carte.
    const recalc = (h: Hit | null) => (h && h.el.isConnected ? { ...h, rect: h.el.getBoundingClientRect() } : null);
    const refresh = () => {
      if (pinnedRef.current && !pinnedRef.current.isConnected) pinnedRef.current = null;
      setPinned(recalc);
      setHover(recalc);
    };
    BLOCKED.forEach((t) => window.addEventListener(t, block, true));
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    const tick = window.setInterval(refresh, 500); // zone épinglée retirée par un re-rendu
    return () => {
      BLOCKED.forEach((t) => window.removeEventListener(t, block, true));
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
      window.clearInterval(tick);
    };
  }, [active]);

  if (!active) return null;
  const shown = pinned ?? hover;
  const pos = shown ? cardPosition(shown.rect) : null;

  return createPortal(
    <>
      <div
        data-help-mode-ui
        role="status"
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[10002] flex items-center gap-3 rounded-lg border border-primary/40 bg-card shadow-lg px-3 py-1.5 text-xs"
      >
        <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
        <span><strong>Mode Aide</strong> — survolez une zone pour savoir à quoi elle sert · cliquez pour épingler · Échap pour quitter</span>
        <button type="button" onClick={() => useHelpModeStore.getState().exit()} aria-label="Quitter le mode Aide"
          className="inline-flex items-center gap-1 h-6 px-2 rounded border border-input hover:bg-accent">
          <X className="w-3 h-3" /> Quitter
        </button>
      </div>
      {shown && pos && (
        <>
          <div aria-hidden className="fixed z-[10001] pointer-events-none rounded border-2 border-primary bg-primary/5"
            style={{ top: shown.rect.top, left: shown.rect.left, width: shown.rect.width, height: shown.rect.height }} />
          <div role="dialog" aria-label={shown.zone.title} aria-live="polite"
            className={`fixed z-[10002] rounded-lg border bg-card shadow-xl p-3 text-xs ${pinned ? 'border-primary' : 'border-border pointer-events-none'}`}
            style={{ top: pos.top, left: pos.left, width: CARD_W }} data-help-mode-ui={pinned ? '' : undefined}>
            <p className="text-sm font-semibold text-foreground mb-1">{shown.zone.title}</p>
            <p className="text-muted-foreground leading-relaxed">{shown.zone.text}</p>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
