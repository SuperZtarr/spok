/*
 * Section « À réviser » de /today (spec 2026-07-19-horizons-revue-design) : bac à trier
 * + items en horizon dépassé, jamais fusionnés (deux groupes distincts). 4 actions inline
 * par ligne : Fait, Plus d'actualité, Reporter à un horizon (select), Planifier (premier
 * créneau libre, même mécanisme que DayPlanList.onPlace).
 * Repliée par défaut si vide, dépliable sinon — le badge affiche le total des deux groupes.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Ban, CalendarClock, ClipboardList } from 'lucide-react';
import { HORIZON_LABELS, HORIZON_ORDER, type HorizonBucket } from '@spok/shared';
import type { ReviewQueueItem } from '@/lib/api';

export function ReviewQueueSection({ toTriage, overdue, onDone, onDismiss, onSetHorizon, onPlanNow }: {
  toTriage: ReviewQueueItem[];
  overdue: ReviewQueueItem[];
  onDone: (item: ReviewQueueItem) => void;
  onDismiss: (item: ReviewQueueItem) => void;
  onSetHorizon: (item: ReviewQueueItem, horizon: HorizonBucket) => void;
  onPlanNow: (item: ReviewQueueItem) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const total = toTriage.length + overdue.length;
  if (total === 0) return null;

  const row = (item: ReviewQueueItem) => (
    <div key={item.id} className="group flex items-center gap-2 px-2 py-1.5 text-sm border-b border-border/30">
      <span className="truncate min-w-0 flex-1">{item.title}</span>
      <select
        className="text-xs border border-input rounded px-1 py-0.5 bg-background opacity-0 group-hover:opacity-100 focus:opacity-100"
        value=""
        onChange={(e) => { if (e.target.value) onSetHorizon(item, e.target.value as HorizonBucket); }}
      >
        <option value="" disabled>Reporter à…</option>
        {HORIZON_ORDER.map((h) => <option key={h} value={h}>{HORIZON_LABELS[h]}</option>)}
      </select>
      <button onClick={() => onPlanNow(item)} className="text-muted-foreground hover:text-foreground" title="Planifier dans un créneau">
        <CalendarClock className="w-4 h-4" />
      </button>
      <button onClick={() => onDone(item)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Fait">
        <Check className="w-4 h-4" />
      </button>
      <button onClick={() => onDismiss(item)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" title="Plus d'actualité">
        <Ban className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="mb-3 max-w-xl border border-border rounded-lg overflow-hidden">
      <button onClick={() => setCollapsed((c) => !c)} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium bg-muted/30 hover:bg-muted/50">
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <ClipboardList className="w-4 h-4" />
        À réviser
        <span className="ml-auto text-xs text-muted-foreground">{total}</span>
      </button>
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto">
          {toTriage.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] text-muted-foreground uppercase tracking-wider">Bac à trier ({toTriage.length})</div>
              {toTriage.map(row)}
            </>
          )}
          {overdue.length > 0 && (
            <>
              <div className="px-2 py-1 text-[11px] text-muted-foreground uppercase tracking-wider">Horizon dépassé ({overdue.length})</div>
              {overdue.map(row)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
