import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { matrixLayoutApi } from '../../lib/api';
import { TYPE_ICONS } from '../../constants/ui';

const QUADRANT_LABELS = [
  { x: 25, y: 25, label: 'Quick wins', sub: 'Faible effort, fort impact', color: 'text-green-600' },
  { x: 75, y: 25, label: 'Stratégique', sub: 'Fort effort, fort impact', color: 'text-blue-600' },
  { x: 25, y: 75, label: 'Remplissage', sub: 'Faible effort, faible impact', color: 'text-gray-500' },
  { x: 75, y: 75, label: 'À éviter', sub: 'Fort effort, faible impact', color: 'text-red-500' },
];

const TYPE_HEX: Record<string, string> = {
  NOTE: '#3b82f6',
  TASK: '#22c55e',
  PROJECT: '#8b5cf6',
  MEETING: '#f59e0b',
  PERIOD: '#06b6d4',
  LINK: '#06b6d4',
  CONFIG: '#6b7280',
  DOCUMENT: '#f59e0b',
  IMAGE: '#ec4899',
  BUG: '#ef4444',
};

interface MatrixViewProps {
  items: Item[];
  spaceId: string;
  onEdit: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

export function MatrixView({ items, spaceId, onEdit, referentiels, highlightType, highlightStatus, searchMatchIds, canEdit = true }: MatrixViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const statuses = useMemo(() => referentiels?.statuses || DEFAULT_REFERENTIELS.statuses, [referentiels]);

  const { data: savedLayout } = useQuery({
    queryKey: ['matrix-layout', spaceId],
    queryFn: () => matrixLayoutApi.get(spaceId),
  });

  // Load saved positions
  useEffect(() => {
    if (savedLayout?.positions) {
      setPositions(savedLayout.positions);
    }
  }, [savedLayout]);

  // Observe container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PADDING = 40;
  const areaW = containerSize.width - PADDING * 2;
  const areaH = containerSize.height - PADDING * 2;

  // Compute default positions using a grid layout when no saved positions exist
  const defaultPositions = useMemo(() => {
    const map: Record<string, { x: number; y: number }> = {};
    const unpositioned = items.filter(i => !positions[i.id]);
    if (unpositioned.length === 0) return map;

    const cols = Math.ceil(Math.sqrt(unpositioned.length));
    const rows = Math.ceil(unpositioned.length / cols);
    const padX = 8; // margin from edges in %
    const padY = 8;
    const rangeX = 100 - padX * 2;
    const rangeY = 100 - padY * 2;

    unpositioned.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      map[item.id] = {
        x: padX + (cols > 1 ? (col / (cols - 1)) * rangeX : rangeX / 2),
        y: padY + (rows > 1 ? (row / (rows - 1)) * rangeY : rangeY / 2),
      };
    });
    return map;
  }, [items, positions]);

  const getItemPos = (item: Item) => {
    if (positions[item.id]) return positions[item.id];
    return defaultPositions[item.id] || { x: 50, y: 50 };
  };

  const toPixel = (pos: { x: number; y: number }) => ({
    px: PADDING + (pos.x / 100) * areaW,
    py: PADDING + (pos.y / 100) * areaH,
  });

  const fromPixel = (px: number, py: number) => ({
    x: Math.max(0, Math.min(100, ((px - PADDING) / areaW) * 100)),
    y: Math.max(0, Math.min(100, ((py - PADDING) / areaH) * 100)),
  });

  const persistPositions = useCallback((newPositions: Record<string, { x: number; y: number }>) => {
    if (!canEdit) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(() => {
      matrixLayoutApi.update(spaceId, newPositions);
    }, 1000);
    setSaveTimeout(t);
  }, [spaceId, canEdit, saveTimeout]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = getItemPos(items.find(i => i.id === id)!);
    const { px, py } = toPixel(pos);
    setDragging({ id, startX: e.clientX, startY: e.clientY, origX: px, origY: py });
  }, [canEdit, items, positions, areaW, areaH]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    const newPx = dragging.origX + dx;
    const newPy = dragging.origY + dy;
    const newPos = fromPixel(newPx, newPy);
    setPositions(prev => {
      const updated = { ...prev, [dragging.id]: newPos };
      return updated;
    });
  }, [dragging, areaW, areaH]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setPositions(prev => {
        persistPositions(prev);
        return prev;
      });
      setDragging(null);
    }
  }, [dragging, persistPositions]);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const getStatusColor = (statusId: string) => {
    const status = statuses.find(s => s.id === statusId);
    return status?.color || '#6b7280';
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-background select-none">
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Axis lines */}
        <line
          x1={PADDING + areaW / 2} y1={PADDING}
          x2={PADDING + areaW / 2} y2={PADDING + areaH}
          stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="4 4"
        />
        <line
          x1={PADDING} y1={PADDING + areaH / 2}
          x2={PADDING + areaW} y2={PADDING + areaH / 2}
          stroke="currentColor" strokeOpacity={0.15} strokeWidth={1} strokeDasharray="4 4"
        />

        {/* Border */}
        <rect
          x={PADDING} y={PADDING} width={areaW} height={areaH}
          fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={1}
        />

        {/* Axis labels */}
        <text x={PADDING + areaW / 2} y={PADDING + areaH + 30} textAnchor="middle" className="fill-muted-foreground text-xs">
          Effort / Complexité →
        </text>
        <text
          x={PADDING - 30} y={PADDING + areaH / 2}
          textAnchor="middle" className="fill-muted-foreground text-xs"
          transform={`rotate(-90, ${PADDING - 30}, ${PADDING + areaH / 2})`}
        >
          ← Impact / Priorité
        </text>
      </svg>

      {/* Quadrant labels */}
      {QUADRANT_LABELS.map((q) => {
        const px = PADDING + (q.x / 100) * areaW;
        const py = PADDING + (q.y / 100) * areaH;
        return (
          <div
            key={q.label}
            className="absolute pointer-events-none text-center"
            style={{ left: px, top: py, transform: 'translate(-50%, -50%)' }}
          >
            <div className={`text-sm font-semibold opacity-20 ${q.color}`}>{q.label}</div>
            <div className="text-[10px] opacity-15 text-muted-foreground">{q.sub}</div>
          </div>
        );
      })}

      {/* Items */}
      {items.map((item) => {
        const pos = getItemPos(item);
        const { px, py } = toPixel(pos);
        const Icon = TYPE_ICONS[item.type];
        const typeColor = TYPE_HEX[item.type] || '#6b7280';
        const statusColor = item.status ? getStatusColor(item.status) : '#6b7280';
        const isHighlighted = (highlightType && item.type === highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus));
        const isDimmed = (highlightType && item.type !== highlightType) || (highlightStatus && (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus)) || (searchMatchIds && !searchMatchIds.has(item.id));
        const isSearchMatch = !!(searchMatchIds && searchMatchIds.has(item.id));
        const isDraggingThis = dragging?.id === item.id;

        return (
          <div
            key={item.id}
            className={`absolute flex items-center gap-1.5 px-2 py-1 rounded-md border shadow-sm text-xs cursor-grab transition-shadow hover:shadow-md ${
              isDraggingThis ? 'z-30 shadow-lg cursor-grabbing ring-2 ring-primary' : 'z-10'
            } ${isDimmed ? 'opacity-25' : ''} ${isHighlighted ? 'ring-2 ring-primary ring-offset-1' : ''} ${isSearchMatch ? 'ring-2 ring-yellow-400 ring-offset-1 shadow-lg' : ''}`}
            style={{
              left: px,
              top: py,
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'var(--card)',
              borderColor: typeColor,
              maxWidth: 160,
            }}
            onMouseDown={(e) => handleMouseDown(e, item.id)}
            onDoubleClick={() => onEdit(item.id)}
            title={`${item.title}\nDouble-clic pour éditer`}
          >
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: statusColor }}
            />
            {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color: typeColor }} />}
            <span className="truncate">{item.title}</span>
          </div>
        );
      })}
    </div>
  );
}
