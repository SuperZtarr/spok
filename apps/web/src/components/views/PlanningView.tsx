import { useMemo } from 'react';
import {
  Trash2,
  ExternalLink,
  CheckSquare,
  Plus,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Clock,
  HelpCircle,
  User,
} from 'lucide-react';
import type { Item, ItemType, SpaceReferentiels, StatusConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { TYPE_ICONS } from '../../constants/ui';
import { stripMarkup } from '../../lib/bbcode';

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

interface PlanningViewProps {
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  referentiels?: SpaceReferentiels;
  highlightType?: ItemType;
}

interface PlanningItemProps {
  item: Item;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  statuses: StatusConfig[];
  isHighlighted?: boolean;
  isDimmed?: boolean;
}

function PlanningItem({ item, onEdit, onDelete, onUpdateStatus, onAddChild, statuses, isHighlighted, isDimmed }: PlanningItemProps) {
  const Icon = TYPE_ICONS[item.type];
  const statusConfig = statuses.find((s) => s.id === item.status) || statuses.find((s) => s.id === 'undefined');
  const effectiveDate = item.dueDate || item.endDate;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-card border rounded-lg hover:shadow-sm transition-all cursor-pointer group ${
        isHighlighted ? 'ring-2 ring-primary ring-offset-2 scale-[1.01]' : ''
      } ${isDimmed ? 'opacity-40' : ''}`}
      onClick={() => onEdit(item.id)}
    >
      {/* Type icon */}
      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />

      {/* Title and description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium truncate">{item.title}</h4>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-700 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
              title="Ouvrir le lien"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
        {item.description && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {stripMarkup(item.description)}
          </p>
        )}
      </div>

      {/* Date */}
      {effectiveDate && (
        <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
          <Calendar className="w-4 h-4" />
          <span>{item.type === 'MEETING' ? formatDateTime(effectiveDate) : formatDate(effectiveDate)}</span>
        </div>
      )}

      {/* Status badge */}
      {statusConfig && (
        <Badge
          className={`text-xs flex-shrink-0 ${statusConfig.borderColor.split(' ')[0] || ''}`}
          variant="secondary"
          style={{
            backgroundColor: statusConfig.borderColor.includes('bg-')
              ? undefined
              : statusConfig.borderColor.split(' ')[1]?.replace('bg-', '') || undefined,
          }}
        >
          {statusConfig.label}
        </Badge>
      )}

      {/* Assignee placeholder */}
      <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
        <User className="w-4 h-4" />
        <span className="text-xs">-</span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {item.status && item.status !== 'done' && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(item.id, 'done');
            }}
            title="Marquer comme terminé"
          >
            <CheckSquare className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(item.id);
          }}
          title="Ajouter un enfant"
        >
          <Plus className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

interface PeriodSectionProps {
  config: PeriodConfig;
  items: Item[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  statuses: StatusConfig[];
  highlightType?: ItemType;
}

function PeriodSection({ config, items, onEdit, onDelete, onUpdateStatus, onAddChild, statuses, highlightType }: PeriodSectionProps) {
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
            onEdit={onEdit}
            onDelete={onDelete}
            onUpdateStatus={onUpdateStatus}
            onAddChild={onAddChild}
            statuses={statuses}
            isHighlighted={highlightType ? item.type === highlightType : false}
            isDimmed={highlightType ? item.type !== highlightType : false}
          />
        ))}
      </div>
    </div>
  );
}

export function PlanningView({ items, onEdit, onDelete, onUpdateStatus, onAddChild, referentiels, highlightType }: PlanningViewProps) {
  // Use referentiels or defaults
  const statuses = useMemo(() => {
    const statusList = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return statusList.filter((s) => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

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
    <div className="p-4 overflow-y-auto h-full">
      {PERIOD_CONFIGS.map((config) => (
        <PeriodSection
          key={config.id}
          config={config}
          items={groupedItems[config.id]}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateStatus={onUpdateStatus}
          onAddChild={onAddChild}
          statuses={statuses}
          highlightType={highlightType}
        />
      ))}
    </div>
  );
}
