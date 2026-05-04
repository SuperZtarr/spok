import { useRef, useState, useCallback, useEffect } from 'react';

const MIN_HOUR    = 7;
const MAX_HOUR    = 22;
const DAY_START   = MIN_HOUR * 60;   // 420 min
const DAY_END     = MAX_HOUR * 60;   // 1320 min
const DAY_RANGE   = DAY_END - DAY_START; // 900 min
const SNAP        = 15;
const MIN_DURATION = 15;
const HOUR_PX     = 32; // px par heure
const TOTAL_PX    = HOUR_PX * (MAX_HOUR - MIN_HOUR); // 480px
const SCROLL_MAX_H = 320; // hauteur max avant scroll (≈10h visibles)

function snapTo(min: number) { return Math.round(min / SNAP) * SNAP; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function parseHHmm(s: string | null | undefined): number | null {
  if (!s) return null;
  const [h, m] = s.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function toHHmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function minToPx(min: number): number {
  return (min - DAY_START) / 60 * HOUR_PX;
}

interface DragState {
  mode: 'start' | 'end' | 'move';
  startY: number;
  origStart: number;
  origEnd: number;
  containerTop: number;
  containerHeight: number;
}

interface TimeRangePickerProps {
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  onChange: (startTime: string, endTime: string) => void;
}

const HOURS = Array.from({ length: MAX_HOUR - MIN_HOUR + 1 }, (_, i) => MIN_HOUR + i);

export function TimeRangePicker({ startTime, endTime, onChange }: TimeRangePickerProps) {
  const scrollRef    = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef      = useRef<DragState | null>(null);
  const latestRef    = useRef<{ start: number; end: number } | null>(null);
  const didDragRef   = useRef(false);
  const [preview, setPreview] = useState<{ start: number; end: number } | null>(null);

  const startMin = preview?.start ?? parseHHmm(startTime);
  const endMin   = preview?.end   ?? parseHHmm(endTime);
  const hasRange = startMin !== null && endMin !== null;

  // Auto-scroll pour centrer la sélection à l'ouverture
  useEffect(() => {
    if (!scrollRef.current || startMin === null) return;
    const targetPx = minToPx(startMin) - SCROLL_MAX_H / 4;
    scrollRef.current.scrollTop = Math.max(0, targetPx);
  }, [startTime]); // seulement sur changement externe (pas pendant drag)

  // Current time indicator
  const now    = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const showNow = nowMin >= DAY_START && nowMin <= DAY_END;

  const startDrag = useCallback((e: React.PointerEvent, mode: DragState['mode']) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    dragRef.current = {
      mode,
      startY: e.clientY,
      origStart: startMin ?? 9 * 60,
      origEnd:   endMin   ?? 10 * 60,
      containerTop:    rect.top,
      containerHeight: rect.height,
    };
    didDragRef.current = false;
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [startMin, endMin]);

  const onMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    e.preventDefault();

    const rawDeltaMin = ((e.clientY - drag.startY) / drag.containerHeight) * DAY_RANGE;
    const duration = drag.origEnd - drag.origStart;
    let newStart: number;
    let newEnd: number;

    if (drag.mode === 'start') {
      newStart = clamp(snapTo(drag.origStart + rawDeltaMin), DAY_START, drag.origEnd - MIN_DURATION);
      newEnd   = drag.origEnd;
    } else if (drag.mode === 'end') {
      newStart = drag.origStart;
      newEnd   = clamp(snapTo(drag.origEnd + rawDeltaMin), drag.origStart + MIN_DURATION, DAY_END);
    } else {
      newStart = clamp(snapTo(drag.origStart + rawDeltaMin), DAY_START, DAY_END - duration);
      newEnd   = newStart + duration;
    }

    const pending = { start: newStart, end: newEnd };
    latestRef.current = pending;
    didDragRef.current = true;
    setPreview(pending);
  }, []);

  const onUp = useCallback((_e: React.PointerEvent) => {
    dragRef.current = null;
    const p = latestRef.current;
    latestRef.current = null;
    setPreview(null);
    if (p) onChange(toHHmm(p.start), toHHmm(p.end));
  }, [onChange]);

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rawMin = ((e.clientY - rect.top) / rect.height) * DAY_RANGE + DAY_START;
    const clickedMin = clamp(snapTo(rawMin), DAY_START, DAY_END);
    const newStart = clamp(clickedMin - 30, DAY_START, DAY_END - 60);
    onChange(toHHmm(newStart), toHHmm(newStart + 60));
  }, [onChange]);

  const blockTop    = hasRange ? minToPx(startMin!) : 0;
  const blockHeight = hasRange ? minToPx(endMin!) - minToPx(startMin!) : 0;
  const showLabel   = blockHeight >= 28;
  const dur         = hasRange ? endMin! - startMin! : null;

  return (
    <div
      ref={scrollRef}
      className="overflow-y-auto rounded-md border border-border"
      style={{ maxHeight: SCROLL_MAX_H }}
    >
    <div className="flex gap-1.5 select-none px-1 py-1">
      {/* Hour labels */}
      <div className="relative flex-shrink-0 w-7" style={{ height: TOTAL_PX }}>
        {HOURS.map(h => (
          <div
            key={h}
            className="absolute right-0 flex items-center justify-end"
            style={{ top: (h - MIN_HOUR) * HOUR_PX - 7, height: 14 }}
          >
            <span className="text-[9px] leading-none text-muted-foreground/60 tabular-nums">
              {h}h
            </span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div
        ref={containerRef}
        className="flex-1 relative cursor-crosshair bg-muted/30 overflow-hidden"
        style={{ height: TOTAL_PX }}
        onClick={handleTrackClick}
      >
        {/* Hour bands */}
        {HOURS.slice(0, -1).map((h, i) => (
          <div
            key={h}
            className={`absolute left-0 right-0 ${i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30'}`}
            style={{ top: (h - MIN_HOUR) * HOUR_PX, height: HOUR_PX }}
          />
        ))}

        {/* Hour grid lines */}
        {HOURS.map(h => (
          <div
            key={h}
            className="absolute left-0 right-0 h-px bg-border/50 pointer-events-none"
            style={{ top: (h - MIN_HOUR) * HOUR_PX }}
          />
        ))}

        {/* Half-hour ticks */}
        {HOURS.slice(0, -1).map(h => (
          <div
            key={`${h}:30`}
            className="absolute right-0 w-2 h-px bg-border/30 pointer-events-none"
            style={{ top: (h - MIN_HOUR) * HOUR_PX + HOUR_PX / 2 }}
          />
        ))}

        {/* Now indicator */}
        {showNow && (
          <div
            className="absolute left-0 right-0 h-px bg-red-400/80 z-10 pointer-events-none"
            style={{ top: minToPx(nowMin) }}
          >
            <div className="absolute -left-0.5 -top-0.5 w-1.5 h-1.5 rounded-full bg-red-400/80" />
          </div>
        )}

        {/* Event block */}
        {hasRange && (
          <div
            className="absolute left-1 right-1 bg-primary/20 border border-primary/50 rounded z-20"
            style={{ top: blockTop + 1, height: Math.max(blockHeight - 2, 10) }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top handle (start) */}
            <div
              className="absolute top-0 left-0 right-0 h-2.5 cursor-ns-resize bg-primary/70 rounded-t hover:bg-primary transition-colors touch-none"
              onPointerDown={e => startDrag(e, 'start')}
              onPointerMove={onMove}
              onPointerUp={onUp}
            />
            {/* Body */}
            <div
              className="absolute inset-0 top-2.5 bottom-2.5 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center gap-0.5 overflow-hidden"
              onPointerDown={e => startDrag(e, 'move')}
              onPointerMove={onMove}
              onPointerUp={onUp}
            >
              {showLabel && (
                <>
                  <span className="text-[10px] font-semibold text-primary leading-none pointer-events-none">
                    {toHHmm(startMin!)} → {toHHmm(endMin!)}
                  </span>
                  {dur !== null && blockHeight >= 44 && (
                    <span className="text-[9px] text-primary/70 leading-none pointer-events-none">
                      {formatDuration(dur)}
                    </span>
                  )}
                </>
              )}
            </div>
            {/* Bottom handle (end) */}
            <div
              className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize bg-primary/70 rounded-b hover:bg-primary transition-colors touch-none"
              onPointerDown={e => startDrag(e, 'end')}
              onPointerMove={onMove}
              onPointerUp={onUp}
            />
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
