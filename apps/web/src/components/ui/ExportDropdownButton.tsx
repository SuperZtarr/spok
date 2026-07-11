/* Bouton Exporter avec dropdown en portal (groupes d'options par format) — partagé par les vues. */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';

export interface ExportOption {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface ExportOptionGroup {
  options: ExportOption[];
}

interface ExportDropdownButtonProps {
  groups: ExportOptionGroup[];
  disabled?: boolean;
}

export function ExportDropdownButton({ groups, disabled }: ExportDropdownButtonProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) { setPos(null); return; }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    const close = (e: MouseEvent) => {
      const target = e.target as globalThis.Node;
      if (btnRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleOption = async (onClick: () => void | Promise<void>) => {
    setOpen(false);
    setExporting(true);
    try { await onClick(); } finally { setExporting(false); }
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        disabled={disabled || exporting}
        title="Exporter"
        className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-input transition-colors disabled:opacity-50"
      >
        <Download className="w-3.5 h-3.5" />
        {exporting ? 'Export…' : 'Exporter'}
      </button>
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-card border rounded-lg shadow-xl py-1 min-w-[200px]"
          style={{ top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          {groups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="h-px bg-border mx-2 my-1" />}
              {group.options.map((opt, oi) => (
                <button
                  key={oi}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                  onClick={() => handleOption(opt.onClick)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
