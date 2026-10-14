/*
 * HelpButton — point d'interrogation de l'aide utilisateur intégrée : encart « à quoi ça sert / comment
 * s'en servir » lu dans une fiche HelpEntry (help/types.ts), + « Lancer le tutoriel » si la fiche a un tour.
 * Props : help (la fiche), onStartTour (lance le tour — fourni par useViewOnboarding / usePageTourPulse),
 * pulse (clignote à la première visite), buttonTitle (infobulle), variant
 * ('toolbar' dans les barres de vue, 'page' encadré dans les en-têtes de page et de modale).
 * Seul composant à rendre ce type d'encart : ne pas recréer de bouton d'aide maison dans une page.
 * Boutons en type="button" : le « ? » vit souvent dans un <form> (fiche d'item) — sinon un clic enregistre et ferme.
 * Au lancement du tour, le bouton se marque (TOUR_ANCHOR_ATTR) : c'est lui que pointe la dernière étape.
 */
import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { HelpEntry } from './types';
import { TOUR_ANCHOR_ATTR } from '../hooks/useOnboarding';

interface HelpButtonProps {
  help: HelpEntry | undefined;
  onStartTour?: () => void;
  pulse?: boolean;
  buttonTitle?: string;
  /** 'toolbar' (défaut) : discret, barres de vue ; 'page' : encadré, en-têtes de page et de modale. */
  variant?: 'toolbar' | 'page';
}

const BUTTON_CLASSES = {
  toolbar: (pulse?: boolean) => `inline-flex items-center justify-center h-7 w-7 rounded transition-colors flex-shrink-0${pulse ? ' animate-pulse text-primary bg-primary/15' : ' text-muted-foreground hover:text-foreground hover:bg-accent'}`,
  page: (pulse?: boolean) => `inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0${pulse ? ' animate-pulse ring-2 ring-primary ring-offset-2' : ''}`,
};

export function HelpButton({ help, onStartTour, pulse, buttonTitle = 'Aide sur cette vue', variant = 'toolbar' }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !help) return;
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const popoverW = 320;
      let left = rect.left + rect.width / 2 - popoverW / 2;
      if (left + popoverW > window.innerWidth - 8) left = window.innerWidth - popoverW - 8;
      if (left < 8) left = 8;
      setPos({ top: rect.bottom + 6, left });
    }
  }, [open, help]);

  useEffect(() => {
    if (!open || !help) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, help]);

  if (!help) return null;
  const canTour = !!onStartTour && help.tour.length > 0;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={BUTTON_CLASSES[variant](pulse)}
        title={buttonTitle}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-[320px] rounded-lg border border-border bg-card shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h3 className="text-sm font-semibold text-foreground">{help.title}</h3>
            <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="px-4 pb-2 text-xs text-muted-foreground leading-relaxed">{help.summary}</p>
          {help.tips.length > 0 && (
            <ul className="px-4 pb-3 space-y-1">
              {help.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
          {canTour && (
            <div className="px-4 pb-3">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  const btn = buttonRef.current;
                  setTimeout(() => { btn?.setAttribute(TOUR_ANCHOR_ATTR, ''); onStartTour!(); }, 200);
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Lancer le tutoriel interactif
              </button>
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
