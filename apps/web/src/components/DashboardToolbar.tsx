import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import { DASHBOARD_DESCRIPTIONS } from '../constants/viewDescriptions';
import type { DashboardTab } from '../stores/dashboardTab';

interface DashboardToolbarProps {
  tab: DashboardTab;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  actions?: React.ReactNode;
}

export function DashboardToolbar({ tab, onStartTour, pulseHelp, actions }: DashboardToolbarProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const desc = DASHBOARD_DESCRIPTIONS[tab];

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
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node) || buttonRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [open]);

  if (!desc) return null;

  return (
    <div className="flex items-center justify-end gap-2 px-6 pt-4 pb-2 flex-shrink-0">
      {actions}
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-md border border-input bg-background shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0${pulseHelp ? ' animate-pulse ring-2 ring-primary ring-offset-2' : ''}`}
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
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
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
    </div>
  );
}
