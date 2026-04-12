import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  HelpCircle,
  FolderKanban,
  CheckSquare,
} from 'lucide-react';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups, hasHeadings } from '../../lib/itemMenuGroups';
import type { Item, ItemType, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { getTypeIcon, getTypeColor } from '../../constants/ui';

// Get start of today (midnight)
function getStartOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

// Get end of today (23:59:59)
function getEndOfToday(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

// Get end of this week (Sunday 23:59:59)
function getEndOfWeek(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

// Get end of this month (last day 23:59:59)
function getEndOfMonth(): Date {
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  endOfMonth.setHours(23, 59, 59, 999);
  return endOfMonth;
}

// Format date for display
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

// Format date with time for display
function formatDateTime(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Period grouping
type PeriodGroup = 'overdue' | 'today' | 'thisWeek' | 'thisMonth' | 'later' | 'noDate';

interface PeriodConfig {
  id: PeriodGroup;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
}

const PERIOD_CONFIGS: PeriodConfig[] = [
  { id: 'overdue', label: 'En retard', icon: AlertTriangle, colorClass: 'text-red-600', bgClass: 'bg-red-50 border-red-200' },
  { id: 'today', label: "Aujourd'hui", icon: Calendar, colorClass: 'text-blue-600', bgClass: 'bg-blue-50 border-blue-200' },
  { id: 'thisWeek', label: 'Cette semaine', icon: CalendarDays, colorClass: 'text-green-600', bgClass: 'bg-green-50 border-green-200' },
  { id: 'thisMonth', label: 'Ce mois', icon: CalendarRange, colorClass: 'text-purple-600', bgClass: 'bg-purple-50 border-purple-200' },
  { id: 'later', label: 'Plus tard', icon: Clock, colorClass: 'text-gray-600', bgClass: 'bg-gray-50 border-gray-200' },
  { id: 'noDate', label: 'Sans date', icon: HelpCircle, colorClass: 'text-gray-400', bgClass: 'bg-gray-50 border-gray-200' },
];

// Categorize item into period group based on dueDate or endDate
function getPeriodGroup(item: Item): PeriodGroup {
  const dateString = item.dueDate || item.endDate;
  if (!dateString) return 'noDate';

  const date = new Date(dateString);
  const startOfToday = getStartOfToday();
  const endOfToday = getEndOfToday();
  const endOfWeek = getEndOfWeek();
  const endOfMonth = getEndOfMonth();

  if (date < startOfToday) return 'overdue';
  if (date <= endOfToday) return 'today';
  if (date <= endOfWeek) return 'thisWeek';
  if (date <= endOfMonth) return 'thisMonth';
  return 'later';
}

// Get effective date for sorting (dueDate or endDate)
function getEffectiveDate(item: Item): Date | null {
  const dateString = item.dueDate || item.endDate;
  return dateString ? new Date(dateString) : null;
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface PlanningViewProps {
  items: Item[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

interface PlanningItemProps {
  item: Item;
  portalSpaceName?: string;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  statuses: StatusConfig[];
  typeLabels?: Record<string, { labelShort: string }>;
  referentiels?: SpaceReferentiels;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isSearchMatch?: boolean;
  highlightColor?: { border: string; bg: string };
  canEdit?: boolean;
}

function PlanningItem({ item, portalSpaceName, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, statuses, referentiels, isHighlighted, isDimmed, isSearchMatch, highlightColor, canEdit = true }: PlanningItemProps) {
  const Icon = getTypeIcon(item.type, item.url);
  const statusConfig = statuses.find((s) => s.id === item.status) || statuses.find((s) => s.id === 'undefined');
  const effectiveDate = item.dueDate || item.endDate;
  const typeLabels = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;
  const typeLabel = typeLabels[item.type]?.labelShort || item.type;
  const isPortal = !!portalSpaceName;

  return (
    <div
      className={`grid grid-cols-[auto_1fr_5rem_5rem_6rem_auto] items-center gap-3 px-4 py-2.5 bg-card border rounded-lg hover:shadow-sm transition-all cursor-pointer group ${
        isHighlighted && highlightColor ? `${highlightColor.bg} border-l-2 ${highlightColor.border}` : ''
      } ${isSearchMatch ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-950/30' : ''} ${isDimmed ? 'opacity-40' : ''} ${isPortal ? 'border-dashed border-primary/30' : ''}`}
      onClick={() => onEdit(item.id)}
    >
      {/* Type icon */}
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

      {/* Title */}
      <div className="min-w-0 flex items-center gap-2">
        <span className="truncate">{item.title}</span>
        {isPortal && (
          <Link
            to={`/spaces/${item.spaceId}`}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title={`Espace : ${portalSpaceName}`}
          >
            <FolderKanban className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{portalSpaceName}</span>
          </Link>
        )}
        {item.url && (item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url)) && (
          <img src={item.url} alt="" className="w-6 h-6 object-cover rounded border border-border flex-shrink-0" />
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 flex-shrink-0"
            onClick={(e) => e.stopPropagation()}
            title="Ouvrir le lien"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* Type badge */}
      <span className="flex justify-center">
        <Badge variant="outline" className={`text-xs border ${getTypeColor(item.type, referentiels?.typeLabels).color}`}>
          {typeLabel}
        </Badge>
      </span>

      {/* Date */}
      <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        {effectiveDate ? (
          <>
            <Calendar className="w-3 h-3" />
            <span>{item.type === 'MEETING' ? formatDateTime(effectiveDate) : formatDate(effectiveDate)}</span>
          </>
        ) : null}
      </span>

      {/* Status badge */}
      <span className="flex justify-center">
        {statusConfig && (
          <Badge
            className={`text-xs ${statusConfig.color}`}
            variant="secondary"
          >
            {statusConfig.label}
          </Badge>
        )}
      </span>

      {/* Action menu */}
      <span className="flex items-center justify-end w-20 opacity-0 group-hover:opacity-100 transition-opacity">
        {canEdit && !isPortal && (
          <ItemActionMenu
            groups={buildItemMenuGroups(item.id, {
              onEdit,
              onDelete,
              onUpdateStatus,
              onAddChild,
              onMoveToSpace,
              onDuplicateToSpace,
              onConvertToSpace,
              onSelfAssign,
              onMerge,
              onAbsorbChildren,
              onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined,
            }, {
              statusAction: item.status && item.status !== 'done' ? { label: 'Marquer terminé', statusId: 'done' } : null,
            })}
          />
        )}
      </span>
    </div>
  );
}

interface PeriodSectionProps {
  config: PeriodConfig;
  items: Item[];
  portalSpaceNames?: Map<string, string>;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  statuses: StatusConfig[];
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
  highlightStatus?: string;
  highlightColor?: { border: string; bg: string };
  searchMatchIds?: Set<string>;
  canEdit?: boolean;
}

function PeriodSection({ config, items, portalSpaceNames, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, statuses, referentiels, highlightType, highlightStatus, highlightColor, searchMatchIds, canEdit }: PeriodSectionProps) {
  if (items.length === 0) return null;

  const IconComponent = config.icon;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border ${config.bgClass}`}>
        <IconComponent className={`w-5 h-5 ${config.colorClass}`} />
        <h3 className={`font-semibold ${config.colorClass}`}>{config.label}</h3>
        <span className="text-sm text-muted-foreground">({items.length})</span>
      </div>

      {/* Items list */}
      <div className="space-y-2 mt-2">
        {items.map((item) => (
          <PlanningItem
            key={item.id}
            item={item}
            portalSpaceName={portalSpaceNames?.get(item.spaceId)}
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateStatus={onUpdateStatus}
            onAddChild={onAddChild}
            onMoveToSpace={onMoveToSpace}
            onDuplicateToSpace={onDuplicateToSpace}
            onConvertToSpace={onConvertToSpace}
            onSelfAssign={onSelfAssign}
            onMerge={onMerge}
            onAbsorbChildren={onAbsorbChildren}
            onSplitDescription={onSplitDescription}
            statuses={statuses}
            referentiels={referentiels}
            isHighlighted={(highlightType ? item.type === highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !item.status : item.status === highlightStatus) : false)}
            isDimmed={(highlightType ? item.type !== highlightType : false) || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false) || (searchMatchIds ? !searchMatchIds.has(item.id) : false)}
            isSearchMatch={!!(searchMatchIds && searchMatchIds.has(item.id))}
            highlightColor={highlightColor}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}

export function PlanningView({ items, currentSpaceId: _currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, referentiels, highlightType, highlightStatus, highlightColor, searchMatchIds, canEdit = true }: PlanningViewProps) {
  // Use referentiels or defaults
  const statuses = useMemo(() => {
    const statusList = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return statusList.filter((s) => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

  // Map portal spaceId → spaceName for quick lookup
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  // Filter out completed items and group by period
  const groupedItems = useMemo(() => {
    // Filter: exclude done items
    const activeItems = items.filter((item) => item.status !== 'done');

    // Group by period
    const groups: Record<PeriodGroup, Item[]> = {
      overdue: [],
      today: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
      noDate: [],
    };

    activeItems.forEach((item) => {
      const group = getPeriodGroup(item);
      groups[group].push(item);
    });

    // Sort each group by effective date
    Object.keys(groups).forEach((key) => {
      const group = key as PeriodGroup;
      groups[group].sort((a, b) => {
        const dateA = getEffectiveDate(a);
        const dateB = getEffectiveDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.getTime() - dateB.getTime();
      });
    });

    return groups;
  }, [items]);

  // Count total active items
  const totalActiveItems = useMemo(() => {
    return Object.values(groupedItems).reduce((sum, group) => sum + group.length, 0);
  }, [groupedItems]);

  if (totalActiveItems === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Aucune tâche en cours</p>
        <p className="text-sm">Toutes les tâches sont terminées ou il n'y a pas encore d'éléments.</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full" data-tour="planning-sections">
      {PERIOD_CONFIGS.map((config) => (
        <PeriodSection
          key={config.id}
          config={config}
          items={groupedItems[config.id]}
          portalSpaceNames={portalSpaceNames}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          onMoveToSpace={onMoveToSpace}
          onDuplicateToSpace={onDuplicateToSpace}
          onConvertToSpace={onConvertToSpace}
          onSelfAssign={onSelfAssign}
          onMerge={onMerge}
          onAbsorbChildren={onAbsorbChildren}
          onSplitDescription={onSplitDescription}
          statuses={statuses}
          referentiels={referentiels}
          highlightType={highlightType}
          highlightStatus={highlightStatus}
          highlightColor={highlightColor}
          searchMatchIds={searchMatchIds}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
