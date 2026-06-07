import { useState, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_LABELS, getTypeColor } from '../../constants/ui';

export interface FilterToolbarProps {
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  totalItemCount?: number;
  filteredItemCount?: number;
  searchMatchCount?: number;
  referentiels?: SpaceReferentiels;
  isHighlightMode?: boolean;
}

export function FilterToolbar({
  filter = 'ALL',
  onFilterChange,
  statusFilter = 'ALL',
  onStatusFilterChange,
  searchQuery = '',
  onSearchQueryChange,
  totalItemCount,
  filteredItemCount,
  searchMatchCount,
  referentiels,
  isHighlightMode = false,
}: FilterToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
  const visibleStatuses = statuses.filter((s: any) => s.visible);
  const activeStatus = statusFilter !== 'ALL' ? statuses.find((s: any) => s.id === statusFilter) : null;

  const itemCountLabel = (() => {
    if (searchQuery?.trim() && searchMatchCount !== undefined)
      return `${searchMatchCount}/${totalItemCount} éléments`;
    if (filteredItemCount !== undefined && filteredItemCount !== totalItemCount)
      return `${filteredItemCount}/${totalItemCount} éléments`;
    return `${totalItemCount} éléments`;
  })();

  return (
    <>
      {/* Filtre / Lumière toggle */}
      <button
        onClick={() => setVisible(v => !v)}
        className={`inline-flex items-center gap-1 text-xs font-medium rounded px-2 py-0.5 flex-shrink-0 transition-colors border ${
          isHighlightMode
            ? 'text-yellow-700 bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
            : 'text-blue-700 bg-blue-50 border-blue-300 hover:bg-blue-100'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isHighlightMode ? 'bg-yellow-400' : 'bg-blue-400'}`} />
        {isHighlightMode ? 'Lumière' : 'Filtre'}
        <ChevronDown className={`w-3 h-3 transition-transform ${visible ? '' : '-rotate-90'}`} />
      </button>

      {visible && (
        <>
          {/* Type filter */}
          {onFilterChange && (
            <div ref={typeRef} className="relative">
              <button
                onClick={() => { setTypeOpen(v => !v); setStatusOpen(false); }}
                className={`flex items-center gap-1 h-7 text-xs px-2 rounded border transition-colors ${filter !== 'ALL' ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
              >
                {filter !== 'ALL' ? TYPE_LABELS[filter as ItemType] ?? filter : 'Types'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {typeOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-lg shadow-xl py-1 min-w-[160px]">
                  {(['ALL', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const).map(t => (
                    <button key={t} onClick={() => { onFilterChange(t); setTypeOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${filter === t ? 'bg-accent font-medium' : 'text-foreground/80 hover:bg-accent'}`}>
                      {t !== 'ALL' && <span className={`w-2 h-2 rounded-full ${getTypeColor(t, referentiels?.typeLabels).bgHover}`} />}
                      {t === 'ALL' ? 'Tous les types' : TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Status filter */}
          {onStatusFilterChange && (
            <div ref={statusRef} className="relative">
              <button
                onClick={() => { setStatusOpen(v => !v); setTypeOpen(false); }}
                className={`flex items-center gap-1 h-7 text-xs px-2 rounded border transition-colors ${activeStatus ? 'border-primary text-foreground font-medium' : 'border-transparent text-muted-foreground hover:bg-accent'}`}
              >
                {activeStatus ? activeStatus.label : 'Statuts'}
                <ChevronDown className="w-3 h-3" />
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border rounded-lg shadow-xl py-1 min-w-[160px]">
                  <button onClick={() => { onStatusFilterChange('ALL'); setStatusOpen(false); }}
                    className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${statusFilter === 'ALL' ? 'bg-accent font-medium' : 'text-foreground/80 hover:bg-accent'}`}>
                    Tous les statuts
                  </button>
                  {visibleStatuses.map((s: any) => (
                    <button key={s.id} onClick={() => { onStatusFilterChange(s.id); setStatusOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${statusFilter === s.id ? 'bg-accent font-medium' : 'text-foreground/80 hover:bg-accent'}`}>
                      <span className={`w-2 h-2 rounded-full ${s.borderColor.split(' ')[1] || s.borderColor.split(' ')[0]}`} />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search */}
          {onSearchQueryChange && (
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={e => onSearchQueryChange(e.target.value)}
                className="h-7 w-40 pl-8 pr-7 text-xs border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button onClick={() => onSearchQueryChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Item count — always visible, pushed right */}
      {totalItemCount !== undefined && (
        <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
          {itemCountLabel}
        </span>
      )}
    </>
  );
}
