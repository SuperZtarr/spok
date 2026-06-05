import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ListTree, ArrowDownAZ, Check } from 'lucide-react';
import { type TreeSort, TREE_SORT_LABELS } from '../../lib/treeSort';

interface TreeSortButtonProps {
  value: TreeSort;
  onChange: (mode: TreeSort) => void;
}

export function TreeSortButton({ value, onChange }: TreeSortButtonProps) {
  const [open, setOpen] = useState(false);
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
      if (btnRef.current?.contains(e.target as Node) || dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 h-7 text-xs px-2 rounded hover:bg-accent transition-colors ${value !== 'manual' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        title="Tri de l'arborescence"
      >
        {value === 'manual' ? <ListTree className="w-3.5 h-3.5" /> : <ArrowDownAZ className="w-3.5 h-3.5" />}
        Ordre
      </button>
      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-card border rounded-lg shadow-xl py-1 min-w-[220px] z-[9999]"
          style={{ top: pos.top, left: pos.left }}
        >
          {(['manual', 'alpha-flat', 'alpha-tree'] as TreeSort[]).map(mode => (
            <button
              key={mode}
              className="w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2"
              onClick={() => { onChange(mode); setOpen(false); }}
            >
              <Check className={`w-3.5 h-3.5 flex-shrink-0 ${value === mode ? 'opacity-100' : 'opacity-0'}`} />
              {TREE_SORT_LABELS[mode]}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
