/* Infobulle d'aide (aide utilisateur, phase 3) : remplace le `title` natif (lent, non stylé, absent au clavier) sur
   les commandes dont le rôle n'est pas évident. S'affiche au survol et au focus clavier, en portail (échappe aux
   overflow des barres). Placement (placeHint) calculé sur la taille réelle de l'infobulle, mesurée avant affichage :
   au-dessus de l'élément s'il y a la place, sinon en dessous, sinon du côté le plus large — toujours ramenée dans
   la fenêtre (un texte long ne sort plus de l'écran, constat 2026-10-23 sur « Copier la fiche »).
   Au toucher (constat 2026-11-06) : l'appui court reste l'action, sans infobulle. L'appui long (LONG_PRESS_MS) affiche
   le texte sans déclencher l'action, jusqu'au toucher ou au défilement suivant ; glisser le doigt l'annule. Les
   événements souris et focus que le navigateur simule après un toucher sont ignorés. Le geste est annoncé par
   TouchHelpCard et l'encart « ? » (help/touch.ts).
   Mode Aide : le wrapper porte le texte (data-help-hint), lu par help/helpZones.ts — toucher la commande l'affiche.
   Props : text (le texte — à prendre dans une fiche d'aide : `hints` d'une HelpEntry, help/spaceToolbar.hints.ts ou
   l'accroche `short` d'une vue, jamais écrit en dur dans le composant), children (la commande), className (wrapper).
   Règles : ne pas cumuler avec un `title` sur l'enfant (double infobulle) ; un bouton à icône seule garde son
   `aria-label` (l'infobulle n'est pas lue par les lecteurs d'écran) ; un texte à lire AVANT d'agir (une condition, un
   avertissement) va en ligne visible, pas ici. */
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { useHelpModeStore } from '../stores/helpMode';

interface HelpHintProps {
  text: string | undefined;
  children: ReactNode;
  className?: string;
}

const DELAY_MS = 250;
/** Écart entre l'élément et l'infobulle */
const GAP = 6;
/** Marge minimale avec les bords de la fenêtre */
const MARGIN = 8;
/** Durée d'appui au-delà de laquelle le toucher affiche l'infobulle au lieu de déclencher l'action */
const LONG_PRESS_MS = 450;
/** Déplacement du doigt (px) au-delà duquel l'appui est un défilement */
const MOVE_TOLERANCE = 10;
/** Durée après un toucher pendant laquelle les événements souris et focus sont tenus pour simulés */
const EMULATED_EVENTS_MS = 1000;

type Anchor = { top: number; bottom: number; left: number; width: number };

/** Position (coin haut-gauche, en px fenêtre) d'une infobulle w × h autour de l'élément `a`, dans une fenêtre vw × vh. */
export function placeHint(a: Anchor, w: number, h: number, vw: number, vh: number): { left: number; top: number } {
  const above = a.top - GAP - h;
  const below = a.bottom + GAP;
  const fitsAbove = above >= MARGIN;
  const fitsBelow = below + h <= vh - MARGIN;
  let top = fitsAbove ? above : fitsBelow ? below : a.top > vh - a.bottom ? above : below;
  top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - MARGIN - h));
  const left = Math.min(Math.max(a.left + a.width / 2 - w / 2, MARGIN), Math.max(MARGIN, vw - MARGIN - w));
  return { left, top };
}

export function HelpHint({ text, children, className }: HelpHintProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const pressTimer = useRef<number>();
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const lastTouch = useRef(0);
  const longPressed = useRef(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);
  const [heldByTouch, setHeldByTouch] = useState(false);

  // Mesure de l'infobulle rendue invisible, puis placement avant que le navigateur ne l'affiche
  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) { setPlace(null); return; }
    const { width, height } = tipRef.current.getBoundingClientRect();
    setPlace(placeHint(anchor, width, height, window.innerWidth, window.innerHeight));
  }, [anchor]);

  // Infobulle d'appui long : reste après le relâchement, se ferme au toucher ou au défilement suivant
  useEffect(() => {
    if (!heldByTouch) return;
    const close = () => { setHeldByTouch(false); setAnchor(null); };
    window.addEventListener('touchstart', close, true);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('touchstart', close, true);
      window.removeEventListener('scroll', close, true);
    };
  }, [heldByTouch]);

  useEffect(() => () => { window.clearTimeout(timer.current); window.clearTimeout(pressTimer.current); }, []);

  if (!text) return <>{children}</>;

  const measure = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAnchor({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
  };
  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(measure, DELAY_MS);
  };
  const hide = () => { window.clearTimeout(timer.current); setAnchor(null); };

  const afterTouch = () => Date.now() - lastTouch.current < EMULATED_EVENTS_MS;
  const showUnlessTouch = () => { if (!afterTouch()) show(); };
  const hideUnlessTouch = () => { if (!afterTouch()) hide(); };

  const cancelPress = () => { window.clearTimeout(pressTimer.current); pressStart.current = null; };
  const holdHint = () => {
    cancelPress();
    longPressed.current = true;
    measure();
    setHeldByTouch(true);
  };
  const onTouchStart = (e: TouchEvent) => {
    lastTouch.current = Date.now();
    longPressed.current = false;
    cancelPress();
    // Un toucher dans un portail ouvert par l'enfant remonte ici par React : il ne vise pas cette commande
    if (e.touches.length !== 1 || !ref.current?.contains(e.target as Node)) return;
    if (useHelpModeStore.getState().active) return; // le mode Aide gère déjà le toucher
    pressStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    pressTimer.current = window.setTimeout(holdHint, LONG_PRESS_MS);
  };
  const onTouchMove = (e: TouchEvent) => {
    const start = pressStart.current;
    if (!start) return;
    const t = e.touches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > MOVE_TOLERANCE) cancelPress();
  };
  const onTouchEnd = () => { lastTouch.current = Date.now(); cancelPress(); };
  // Android annonce l'appui long par un menu contextuel : on le remplace par l'infobulle
  const onContextMenu = (e: MouseEvent) => {
    if (!afterTouch() || useHelpModeStore.getState().active) return;
    e.preventDefault();
    if (pressStart.current) holdHint();
  };
  // L'action ne doit jamais partir à la fin d'un appui long
  const onClickCapture = (e: MouseEvent) => {
    if (!longPressed.current) return;
    longPressed.current = false;
    if (!afterTouch()) return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <span
      ref={ref}
      className={`${className ?? 'inline-flex'} [@media(hover:none)]:select-none`}
      style={{ WebkitTouchCallout: 'none' }}
      data-help-hint={text}
      onMouseEnter={showUnlessTouch}
      onMouseLeave={hideUnlessTouch}
      onFocus={showUnlessTouch}
      onBlur={hideUnlessTouch}
      onMouseDown={hideUnlessTouch}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onContextMenu={onContextMenu}
      onClickCapture={onClickCapture}
    >
      {children}
      {anchor && createPortal(
        <div
          ref={tipRef}
          role="tooltip"
          className="fixed z-[10000] max-w-[260px] rounded-md bg-card text-foreground border border-border shadow-md px-2.5 py-1.5 text-xs leading-snug pointer-events-none"
          style={{ left: place?.left ?? 0, top: place?.top ?? 0, visibility: place ? 'visible' : 'hidden' }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
