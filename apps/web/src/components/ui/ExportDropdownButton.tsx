/* Bouton Exporter avec dropdown en portal (groupes d'options par format) — partagé par les vues (direct ou via
   SpaceExportButton). Aide : infobulle HelpHint (SPACE_TOOLBAR_HINTS.export) et repère data-tour="view-export"
   (étape commune des tours de vues) — pas de `title` natif. Libellé `vh-label` : icône seule quand la barre de vue
   manque de place (règle dans index.css), le nom reste dans aria-label.
   Export de données en tableau (CSV, Excel, PDF données) : option `fieldsExport` au lieu de `onClick` — ouvre la fenêtre
   « Champs à exporter » (ExportFieldsModal), puis lance `run(fields)` avec les champs choisis (mémorisés par espace). */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download } from 'lucide-react';
import type { ExportFieldId } from '@spok/shared';
import { HelpHint } from '../../help/HelpHint';
import { SPACE_TOOLBAR_HINTS } from '../../help/spaceToolbar.hints';
import { useExportFieldsDialog } from '../ExportFieldsModal';

export interface ExportOption {
  label: string;
  /** Export direct (JSON, PNG, SVG, PDF visuel…). */
  onClick?: () => void | Promise<void>;
  /** Export de données en tableau : `format` = nom court affiché sur le bouton de la fenêtre (« CSV »). */
  fieldsExport?: { format: string; run: (fields: ExportFieldId[]) => void | Promise<void> };
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
  const { ask, dialog } = useExportFieldsDialog();

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

  const run = async (action: () => void | Promise<void>) => {
    setExporting(true);
    try { await action(); } finally { setExporting(false); }
  };
  const handleOption = (opt: ExportOption) => {
    setOpen(false);
    if (opt.fieldsExport) {
      const { format, run: exportWith } = opt.fieldsExport;
      ask(format, fields => run(() => exportWith(fields)));
    } else if (opt.onClick) {
      void run(opt.onClick);
    }
  };

  return (
    <>
      <HelpHint text={SPACE_TOOLBAR_HINTS.export}>
        <button
          type="button"
          ref={btnRef}
          data-tour="view-export"
          onClick={() => setOpen(v => !v)}
          disabled={disabled || exporting}
          aria-label="Exporter"
          className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-input transition-colors disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="vh-label">{exporting ? 'Export…' : 'Exporter'}</span>
        </button>
      </HelpHint>
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
                  onClick={() => handleOption(opt)}
                >
                  {opt.label}{opt.fieldsExport ? '…' : ''}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}
      {dialog}
    </>
  );
}
