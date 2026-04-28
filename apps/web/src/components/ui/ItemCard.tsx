import { buildStatusColorMap, buildStatusLabelMap } from '@spok/shared';
import { TYPE_LABELS } from '../../constants/ui';

const STATUS_COLOR_MAP = buildStatusColorMap();
const STATUS_LABEL_MAP = buildStatusLabelMap();

function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface ItemCardItem {
  id: string;
  title: string;
  type: string;
  status?: string | null;
  activityAt: string | Date;
  spaceId: string;
  updatedBy?: { name: string } | null;
}

interface ItemCardProps {
  item: ItemCardItem;
  onClick?: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  return (
    <div
      className="w-48 flex-shrink-0 bg-card border border-border rounded-lg p-3 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col gap-1.5"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase tracking-wide leading-none">
          {TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] ?? item.type}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {timeAgo(item.activityAt)}
        </span>
      </div>
      <p className="font-medium text-sm line-clamp-2 leading-snug">{item.title}</p>
      <div className="flex items-center gap-1.5 mt-auto flex-wrap">
        {item.status && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR_MAP[item.status] ?? 'bg-muted text-muted-foreground'}`}>
            {STATUS_LABEL_MAP[item.status] ?? item.status}
          </span>
        )}
        {item.updatedBy && (
          <span className="text-xs text-muted-foreground truncate">{item.updatedBy.name}</span>
        )}
      </div>
    </div>
  );
}
