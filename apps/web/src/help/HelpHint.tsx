/* Infobulle d'aide (aide utilisateur, phase 3) : remplace le `title` natif (lent, non stylé, absent au clavier) sur
   les commandes dont le rôle n'est pas évident. S'affiche au survol et au focus clavier, en portail (échappe aux
   overflow des barres), au-dessus de l'élément (en dessous s'il n'y a pas la place).
   Props : text (le texte — à prendre dans une fiche d'aide : `hints` d'une HelpEntry, help/spaceToolbar.hints.ts ou
   l'accroche `short` d'une vue, jamais écrit en dur dans le composant), children (la commande), className (wrapper).
   Règles : ne pas cumuler avec un `title` sur l'enfant (double infobulle) ; un bouton à icône seule garde son
   `aria-label` (l'infobulle n'est pas lue par les lecteurs d'écran). */
import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface HelpHintProps {
  text: string | undefined;
  children: ReactNode;
  className?: string;
}

const DELAY_MS = 250;

export function HelpHint({ text, children, className }: HelpHintProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  if (!text) return <>{children}</>;

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const below = r.top < 60;
      setPos({ x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
    }, DELAY_MS);
  };
  const hide = () => { window.clearTimeout(timer.current); setPos(null); };

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
      {pos && createPortal(
        <div
          role="tooltip"
          className="fixed z-[10000] max-w-[260px] rounded-md bg-card text-foreground border border-border shadow-md px-2.5 py-1.5 text-xs leading-snug pointer-events-none"
          style={{
            left: Math.min(Math.max(pos.x, 140), window.innerWidth - 140),
            top: pos.y,
            transform: `translate(-50%, ${pos.below ? '0' : '-100%'})`,
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}
