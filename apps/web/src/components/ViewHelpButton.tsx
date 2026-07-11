/* Bouton d'aide d'une vue : lance le tour driver.js de la vue courante (viewTours). */
import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import { VIEW_DESCRIPTIONS } from '../constants/viewDescriptions';
import type { ViewMode } from '../stores/viewMode';

interface ViewHelpButtonProps {
  viewMode: ViewMode;
  onStartTour?: () => void;
  pulse?: boolean;
}

export function ViewHelpButton({ viewMode, onStartTour, pulse }: ViewHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const desc = VIEW_DESCRIPTIONS[viewMode];

  useEffect(() => {
    if (!open || !desc) return;
    const btn = buttonRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const popoverW = 320;
      let left = rect.left + rect.width / 2 - popoverW / 2;
      if (left + popoverW > window.innerWidth - 8) left = window.innerWidth - popoverW - 8;
      if (left < 8) left = 8;
      setPos({ top: rect.bottom + 6, left });
    }
  }, [open, desc]);

  useEffect(() => {
    if (!open || !desc) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, desc]);

  if (!desc) return null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center h-7 w-7 rounded transition-colors flex-shrink-0${pulse ? ' animate-pulse text-primary bg-primary/15' : ' text-muted-foreground hover:text-foreground hover:bg-accent'}`}
        title="Aide sur cette vue"
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
            <h3 className="text-sm font-semibold text-foreground">{desc.title}</h3>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="px-4 pb-2 text-xs text-muted-foreground leading-relaxed">{desc.description}</p>
          {desc.tips.length > 0 && (
            <ul className="px-4 pb-3 space-y-1">
              {desc.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                  <span className="text-primary mt-0.5 flex-shrink-0">&#8226;</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          )}
          {onStartTour && (
            <div className="px-4 pb-3">
              <button
                onClick={() => { setOpen(false); setTimeout(onStartTour, 200); }}
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
