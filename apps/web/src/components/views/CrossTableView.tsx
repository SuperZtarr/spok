import { useState, useMemo } from 'react';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { TYPE_ICONS, TYPE_LABELS } from '../../constants/ui';

type Dimension = 'status' | 'type' | 'assignee' | 'space';

interface DimensionConfig {
  id: Dimension;
  label: string;
}

const DIMENSIONS: DimensionConfig[] = [
  { id: 'status', label: 'Statut' },
  { id: 'type', label: 'Type' },
  { id: 'assignee', label: 'Assigné' },
  { id: 'space', label: 'Espace' },
];

interface CrossTableViewProps {
  items: Item[];
  currentSpaceId?: string;
  onEdit: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  portalGroups?: { spaceId: string; spaceName: string; items: any[] }[];
}

function getDimensionValue(item: Item, dim: Dimension): string {
  switch (dim) {
    case 'status': return item.status || '_none';
    case 'type': return item.type;
    case 'assignee': return (item as any).assignedTo?.name || (item as any).assignedToId || '_unassigned';
    case 'space': return item.spaceId;
    default: return '_unknown';
  }
}

function getDimensionLabel(value: string, dim: Dimension, referentiels?: SpaceReferentiels, spaceNames?: Map<string, string>): string {
  switch (dim) {
    case 'status': {
      if (value === '_none') return 'Sans statut';
      const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
      return statuses.find(s => s.id === value)?.label || value;
    }
    case 'type': {
      const typeLabels = referentiels?.typeLabels;
      if (typeLabels?.[value]?.label) return typeLabels[value].label;
      return TYPE_LABELS[value] || value;
    }
    case 'assignee':
      return value === '_unassigned' ? 'Non assigné' : value;
    case 'space':
      return spaceNames?.get(value) || value.slice(0, 8);
    default:
      return value;
  }
}

export function CrossTableView({ items, onEdit, referentiels, highlightType, highlightStatus, searchMatchIds }: CrossTableViewProps) {
  const [rowDim, setRowDim] = useState<Dimension>('type');
  const [colDim, setColDim] = useState<Dimension>('status');
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  // Build space name map from items
  const spaceNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.spaceId && !map.has(item.spaceId)) {
        map.set(item.spaceId, (item as any).space?.name || item.spaceId.slice(0, 8));
      }
    }
    return map;
  }, [items]);

  // Compute unique values for each dimension
  const rowValues = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => set.add(getDimensionValue(item, rowDim)));
    return [...set].sort((a, b) => {
      if (a.startsWith('_')) return 1;
      if (b.startsWith('_')) return -1;
      return getDimensionLabel(a, rowDim, referentiels, spaceNames)
        .localeCompare(getDimensionLabel(b, rowDim, referentiels, spaceNames), 'fr');
    });
  }, [items, rowDim, referentiels, spaceNames]);

  const colValues = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => set.add(getDimensionValue(item, colDim)));
    // For status, sort by referentiel order
    if (colDim === 'status') {
      const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
      const orderMap = new Map(statuses.map((s, i) => [s.id, i]));
      return [...set].sort((a, b) => {
        if (a === '_none') return 1;
        if (b === '_none') return -1;
        return (orderMap.get(a) ?? 999) - (orderMap.get(b) ?? 999);
      });
    }
    return [...set].sort((a, b) => {
      if (a.startsWith('_')) return 1;
      if (b.startsWith('_')) return -1;
      return getDimensionLabel(a, colDim, referentiels, spaceNames)
        .localeCompare(getDimensionLabel(b, colDim, referentiels, spaceNames), 'fr');
    });
  }, [items, colDim, referentiels, spaceNames]);

  // Build the grid: row -> col -> items[]
  const grid = useMemo(() => {
    const map = new Map<string, Map<string, Item[]>>();
    for (const item of items) {
      const rv = getDimensionValue(item, rowDim);
      const cv = getDimensionValue(item, colDim);
      if (!map.has(rv)) map.set(rv, new Map());
      const row = map.get(rv)!;
      if (!row.has(cv)) row.set(cv, []);
      row.get(cv)!.push(item);
    }
    return map;
  }, [items, rowDim, colDim]);

  // Row and column totals
  const rowTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const rv of rowValues) {
      let count = 0;
      const row = grid.get(rv);
      if (row) for (const cellItems of row.values()) count += cellItems.length;
      totals.set(rv, count);
    }
    return totals;
  }, [grid, rowValues]);

  const colTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const cv of colValues) {
      let count = 0;
      for (const row of grid.values()) {
        count += row.get(cv)?.length || 0;
      }
      totals.set(cv, count);
    }
    return totals;
  }, [grid, colValues]);

  const getStatusColor = (statusId: string) => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return statuses.find(s => s.id === statusId)?.color || '#6b7280';
  };

  const cellKey = (rv: string, cv: string) => `${rv}::${cv}`;

  return (
    <div className="flex flex-col h-full">
      {/* Dimension selectors */}
      <div data-tour="crosstable-dimensions" className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Lignes :</span>
          <select
            value={rowDim}
            onChange={(e) => {
              const v = e.target.value as Dimension;
              if (v === colDim) setColDim(rowDim);
              setRowDim(v);
              setExpandedCell(null);
            }}
            className="px-2 py-1 border rounded bg-background text-sm"
          >
            {DIMENSIONS.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <span className="text-muted-foreground">×</span>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Colonnes :</span>
          <select
            value={colDim}
            onChange={(e) => {
              const v = e.target.value as Dimension;
              if (v === rowDim) setRowDim(colDim);
              setColDim(v);
              setExpandedCell(null);
            }}
            className="px-2 py-1 border rounded bg-background text-sm"
          >
            {DIMENSIONS.map(d => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <span className="ml-auto text-muted-foreground">{items.length} éléments</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            <tr>
              <th className="border px-3 py-2 text-left font-medium text-muted-foreground bg-muted/50 sticky left-0 z-20 min-w-[140px]">
                {DIMENSIONS.find(d => d.id === rowDim)?.label} \ {DIMENSIONS.find(d => d.id === colDim)?.label}
              </th>
              {colValues.map(cv => (
                <th key={cv} className="border px-3 py-2 text-center font-medium min-w-[100px]">
                  <div className="flex items-center justify-center gap-1.5">
                    {colDim === 'status' && cv !== '_none' && (
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(cv) }} />
                    )}
                    {colDim === 'type' && TYPE_ICONS[cv] && (() => {
                      const Icon = TYPE_ICONS[cv];
                      return <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />;
                    })()}
                    <span className="truncate">{getDimensionLabel(cv, colDim, referentiels, spaceNames)}</span>
                  </div>
                </th>
              ))}
              <th className="border px-3 py-2 text-center font-semibold bg-muted/50 min-w-[60px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rowValues.map(rv => (
              <>
                <tr key={rv} className="hover:bg-muted/20">
                  <td className="border px-3 py-2 font-medium sticky left-0 bg-background z-[5]">
                    <div className="flex items-center gap-1.5">
                      {rowDim === 'status' && rv !== '_none' && (
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(rv) }} />
                      )}
                      {rowDim === 'type' && TYPE_ICONS[rv] && (() => {
                        const Icon = TYPE_ICONS[rv];
                        return <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />;
                      })()}
                      <span className="truncate">{getDimensionLabel(rv, rowDim, referentiels, spaceNames)}</span>
                    </div>
                  </td>
                  {colValues.map(cv => {
                    const cellItems = grid.get(rv)?.get(cv) || [];
                    const count = cellItems.length;
                    const key = cellKey(rv, cv);
                    const isExpanded = expandedCell === key;

                    // Highlight logic
                    const hasHighlighted = cellItems.some(item =>
                      (highlightType && item.type === highlightType) ||
                      (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus))
                    );
                    const hasSearchMatch = cellItems.some(item => searchMatchIds?.has(item.id));

                    return (
                      <td
                        key={cv}
                        className={`border px-2 py-1.5 text-center transition-colors ${
                          count > 0 ? 'cursor-pointer hover:bg-accent/50' : ''
                        } ${isExpanded ? 'bg-primary/5 ring-1 ring-primary ring-inset' : ''} ${
                          hasSearchMatch ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''
                        } ${hasHighlighted ? 'bg-primary/5' : ''}`}
                        onClick={() => count > 0 && setExpandedCell(isExpanded ? null : key)}
                        title={count > 0 ? cellItems.map(i => i.title).join('\n') : undefined}
                      >
                        {count > 0 ? (
                          <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full text-xs font-medium ${
                            count >= 5 ? 'bg-primary/20 text-primary font-bold' :
                            count >= 3 ? 'bg-primary/10 text-primary' :
                            'text-muted-foreground'
                          }`}>
                            {count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border px-3 py-1.5 text-center font-semibold bg-muted/20">
                    {rowTotals.get(rv) || 0}
                  </td>
                </tr>
                {/* Expanded cell: show item list */}
                {colValues.map(cv => {
                  const key = cellKey(rv, cv);
                  if (expandedCell !== key) return null;
                  const cellItems = grid.get(rv)?.get(cv) || [];
                  if (cellItems.length === 0) return null;
                  return (
                    <tr key={`${key}-detail`}>
                      <td colSpan={colValues.length + 2} className="border px-4 py-2 bg-muted/10">
                        <div className="flex flex-wrap gap-1.5">
                          {cellItems.map(item => {
                            const Icon = TYPE_ICONS[item.type];
                            const isDimmed = searchMatchIds && !searchMatchIds.has(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => onEdit(item.id)}
                                className={`flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-accent transition-colors ${
                                  isDimmed ? 'opacity-30' : ''
                                }`}
                                title={item.title}
                              >
                                {item.status && (
                                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getStatusColor(item.status) }} />
                                )}
                                {Icon && <Icon className="w-3 h-3 flex-shrink-0 text-muted-foreground" />}
                                <span className="truncate max-w-[200px]">{item.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </>
            ))}
            {/* Total row */}
            <tr className="bg-muted/30 font-semibold">
              <td className="border px-3 py-2 sticky left-0 bg-muted/50 z-[5]">Total</td>
              {colValues.map(cv => (
                <td key={cv} className="border px-3 py-2 text-center">
                  {colTotals.get(cv) || 0}
                </td>
              ))}
              <td className="border px-3 py-2 text-center bg-muted/50">{items.length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
