import { useMemo, useCallback, useRef } from 'react';
import { ViewToolbar } from '../ui/ViewToolbar';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventInput, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface CalendarViewProps {
  items: Item[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onUpdateDates?: (id: string, startDate: string | null, endDate: string | null) => void;
  onCreateItem?: (startDate: string, endDate?: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
  spaceId?: string;
  spaceRole?: string;
  onNewItem?: () => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  totalItemCount?: number;
}

// Convert hex-like tailwind color refs to usable CSS
function typeColorToHex(type: ItemType, _referentiels?: SpaceReferentiels['typeLabels']): { bg: string; border: string; text: string } {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    NOTE: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
    TASK: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
    PROJECT: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
    MEETING: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
    PERIOD: { bg: '#e0e7ff', border: '#6366f1', text: '#3730a3' },
    LINK: { bg: '#cffafe', border: '#06b6d4', text: '#155e75' },
    BUG: { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
    DOCUMENT: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
    IMAGE: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
    DIAGRAM: { bg: '#ecfdf5', border: '#10b981', text: '#065f46' },
    CONFIG: { bg: '#f5f5f4', border: '#78716c', text: '#44403c' },
  };
  return colorMap[type] || colorMap.NOTE;
}

export function CalendarView({
  items,
  currentSpaceId,
  portalGroups,
  onEdit,
  onUpdateDates,
  onCreateItem,
  referentiels,
  highlightType,
  highlightStatus,
  searchMatchIds,
  canEdit = true,
  spaceId, spaceRole, onNewItem, onStartTour, pulseHelp,
  filter = 'ALL', onFilterChange, statusFilter = 'ALL', onStatusFilterChange, totalItemCount,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);

  // Portal space names for tooltips
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  // Convert SPOK items to FullCalendar events
  const events = useMemo<EventInput[]>(() => {
    return items
      .filter(item => item.startDate || item.endDate || item.dueDate)
      .map(item => {
        const colors = typeColorToHex(item.type as ItemType, referentiels?.typeLabels);
        const isPortal = !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId);
        const portalName = isPortal ? portalSpaceNames.get(item.spaceId) : undefined;
        const isDimmed =
          (highlightType ? item.type !== highlightType : false) ||
          (highlightStatus
            ? highlightStatus === 'undefined'
              ? !!item.status
              : item.status !== highlightStatus
            : false) ||
          (searchMatchIds ? !searchMatchIds.has(item.id) : false);

        // Determine start/end
        let start: string;
        let end: string | undefined;

        if (item.startDate) {
          start = item.startDate.split('T')[0];
          if (item.endDate) {
            // FullCalendar exclusive end: add 1 day
            const endDate = new Date(item.endDate);
            endDate.setDate(endDate.getDate() + 1);
            end = endDate.toISOString().split('T')[0];
          }
        } else if (item.dueDate) {
          start = item.dueDate.split('T')[0];
        } else {
          return null;
        }

        return {
          id: item.id,
          title: `${portalName ? `[${portalName}] ` : ''}${item.title}`,
          start,
          end,
          allDay: true,
          backgroundColor: isDimmed ? '#e5e7eb' : colors.bg,
          borderColor: isDimmed ? '#9ca3af' : colors.border,
          textColor: isDimmed ? '#9ca3af' : colors.text,
          editable: canEdit,
          extendedProps: {
            itemId: item.id,
            isPortal,
            type: item.type,
          },
          classNames: [
            isPortal ? 'fc-event-portal' : '',
            isDimmed ? 'fc-event-dimmed' : '',
          ].filter(Boolean),
        };
      })
      .filter(Boolean) as EventInput[];
  }, [items, currentSpaceId, portalSpaceNames, referentiels, highlightType, highlightStatus, searchMatchIds, canEdit]);

  // Click on event → edit
  const handleEventClick = useCallback((info: EventClickArg) => {
    const itemId = info.event.extendedProps.itemId || info.event.id;
    onEdit(itemId);
  }, [onEdit]);

  // Drag event to new date → update dates
  const handleEventDrop = useCallback((info: EventDropArg) => {
    if (!onUpdateDates) { info.revert(); return; }
    const itemId = info.event.id;
    const startDate = info.event.start?.toISOString() || null;
    // FullCalendar end is exclusive, subtract 1 day for SPOK
    let endDate: string | null = null;
    if (info.event.end) {
      const end = new Date(info.event.end);
      end.setDate(end.getDate() - 1);
      endDate = end.toISOString();
    }
    onUpdateDates(itemId, startDate, endDate);
  }, [onUpdateDates]);

  // Resize event → update end date
  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    if (!onUpdateDates) { info.revert(); return; }
    const itemId = info.event.id;
    const startDate = info.event.start?.toISOString() || null;
    let endDate: string | null = null;
    if (info.event.end) {
      const end = new Date(info.event.end);
      end.setDate(end.getDate() - 1);
      endDate = end.toISOString();
    }
    onUpdateDates(itemId, startDate, endDate);
  }, [onUpdateDates]);

  // Click on empty date → create item
  const handleDateSelect = useCallback((info: DateSelectArg) => {
    if (!onCreateItem || !canEdit) return;
    const end = new Date(info.end);
    end.setDate(end.getDate() - 1);
    if (end.getTime() === new Date(info.start).getTime()) {
      onCreateItem(info.start.toISOString());
    } else {
      onCreateItem(info.start.toISOString(), end.toISOString());
    }
  }, [onCreateItem, canEdit]);

  return (
    <div className="flex flex-col h-full">
      <ViewToolbar
        viewMode="calendar"
        spaceId={spaceId}
        spaceRole={spaceRole}
        canEdit={canEdit}
        onNewItem={onNewItem}
        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
        isHighlightMode={true}
        filter={filter}
        onFilterChange={onFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        totalItemCount={totalItemCount}
        referentiels={referentiels}
      />
    <div data-tour="calendar-toolbar" className="flex-1 min-h-0 flex flex-col fc-spok-wrapper">
      <style>{`
        .fc-spok-wrapper {
          --fc-border-color: hsl(var(--border));
          --fc-page-bg-color: hsl(var(--background));
          --fc-neutral-bg-color: hsl(var(--muted));
          --fc-today-bg-color: hsl(var(--primary) / 0.05);
          --fc-event-text-color: inherit;
        }
        .fc-spok-wrapper .fc {
          height: 100%;
          font-family: inherit;
          font-size: 0.8125rem;
        }
        .fc-spok-wrapper .fc-toolbar-title {
          font-size: 1.1rem !important;
          font-weight: 600;
          text-transform: capitalize;
        }
        .fc-spok-wrapper .fc-button {
          font-size: 0.8125rem;
          padding: 0.25rem 0.625rem;
          border-radius: 0.375rem;
          background-color: hsl(var(--background));
          border-color: hsl(var(--border));
          color: hsl(var(--foreground));
        }
        .fc-spok-wrapper .fc-button:hover {
          background-color: hsl(var(--accent));
        }
        .fc-spok-wrapper .fc-button-active {
          background-color: hsl(var(--primary)) !important;
          border-color: hsl(var(--primary)) !important;
          color: hsl(var(--primary-foreground)) !important;
        }
        .fc-spok-wrapper .fc-daygrid-event {
          border-radius: 0.25rem;
          padding: 1px 4px;
          font-size: 0.75rem;
          border-left-width: 3px;
          cursor: pointer;
        }
        .fc-spok-wrapper .fc-event-portal {
          border-style: dashed !important;
        }
        .fc-spok-wrapper .fc-event-dimmed {
          opacity: 0.35;
        }
        .fc-spok-wrapper .fc-daygrid-day-number {
          font-size: 0.75rem;
          padding: 4px 6px;
          color: hsl(var(--muted-foreground));
        }
        .fc-spok-wrapper .fc-day-today .fc-daygrid-day-number {
          background-color: hsl(var(--primary));
          color: hsl(var(--primary-foreground));
          border-radius: 9999px;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .fc-spok-wrapper .fc-col-header-cell-cushion {
          font-size: 0.75rem;
          font-weight: 500;
          color: hsl(var(--muted-foreground));
          text-transform: capitalize;
        }
        .fc-spok-wrapper .fc-scrollgrid {
          border-color: hsl(var(--border));
        }
        .fc-spok-wrapper .fc-daygrid-more-link {
          font-size: 0.7rem;
          color: hsl(var(--primary));
        }
      `}</style>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
        initialView="dayGridMonth"
        locale="fr"
        firstDay={1}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,listWeek',
        }}
        buttonText={{
          today: "Aujourd'hui",
          month: 'Mois',
          week: 'Semaine',
          list: 'Liste',
        }}
        events={events}
        editable={canEdit}
        selectable={canEdit}
        selectMirror={true}
        dayMaxEvents={4}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        select={handleDateSelect}
        height="100%"
        nowIndicator={true}
        weekNumbers={true}
        weekText="S"
      />
    </div>
    </div>
  );
}
