import { useState, useRef, useEffect } from 'react';
import { ListTree, ArrowDownAZ, Check } from 'lucide-react';
import { type TreeSort, TREE_SORT_LABELS } from '../../lib/treeSort';

interface TreeSortButtonProps {
  value: TreeSort;
  onChange: (mode: TreeSort) => void;
}

export function TreeSortButton({ value, onChange }: TreeSortButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-accent transition-colors ${value !== 'manual' ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
        title="Tri de l'arborescence"
      >
        {value === 'manual' ? <ListTree className="w-3.5 h-3.5" /> : <ArrowDownAZ className="w-3.5 h-3.5" />}
        {TREE_SORT_LABELS[value]}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-card border rounded-lg shadow-xl py-1 min-w-[220px] z-50">
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
        </div>
      )}
    </div>
  );
}
