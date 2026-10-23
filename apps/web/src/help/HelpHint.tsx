/* Infobulle d'aide (aide utilisateur, phase 3) : remplace le `title` natif (lent, non stylé, absent au clavier) sur
   les commandes dont le rôle n'est pas évident. S'affiche au survol et au focus clavier, en portail (échappe aux
   overflow des barres). Placement (placeHint) calculé sur la taille réelle de l'infobulle, mesurée avant affichage :
   au-dessus de l'élément s'il y a la place, sinon en dessous, sinon du côté le plus large — toujours ramenée dans
   la fenêtre (un texte long ne sort plus de l'écran, constat 2026-10-23 sur « Copier la fiche »).
   Props : text (le texte — à prendre dans une fiche d'aide : `hints` d'une HelpEntry, help/spaceToolbar.hints.ts ou
   l'accroche `short` d'une vue, jamais écrit en dur dans le composant), children (la commande), className (wrapper).
   Règles : ne pas cumuler avec un `title` sur l'enfant (double infobulle) ; un bouton à icône seule garde son
   `aria-label` (l'infobulle n'est pas lue par les lecteurs d'écran). */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  // Mesure de l'infobulle rendue invisible, puis placement avant que le navigateur ne l'affiche
  useLayoutEffect(() => {
    if (!anchor || !tipRef.current) { setPlace(null); return; }
    const { width, height } = tipRef.current.getBoundingClientRect();
    setPlace(placeHint(anchor, width, height, window.innerWidth, window.innerHeight));
  }, [anchor]);

  if (!text) return <>{children}</>;

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (r) setAnchor({ top: r.top, bottom: r.bottom, left: r.left, width: r.width });
    }, DELAY_MS);
  };
  const hide = () => { window.clearTimeout(timer.current); setAnchor(null); };

  return (
    <span
      ref={ref}
      className={className ?? 'inline-flex'}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onMouseDown={hide}
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
