/* Carte d'item de l'Activité (ActivityPage) : vignette d'élément commune au format carte (components/item/ItemVignette,
 * règle lib/itemFace.ts, décision Thomas 2026-11-08) — miniature, titre, infos du type, pastilles de contenus.
 * Cadre propre à l'Activité : largeur fixe, pied « il y a… · auteur » (qui a changé l'élément et quand).
 * Props : item (feed /activity : contents et url inclus, sans description) ; onClick (ouvrir l'élément). */
import { buildStatusLabelMap } from '@spok/shared';
import { TYPE_LABELS, getTypeIcon, getTypeTextColor } from '../../constants/ui';
import { itemFace, type FaceContent } from '../../lib/itemFace';
import { ItemVignette } from '../item/ItemVignette';

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
  url?: string | null;
  contents?: FaceContent[] | null;
  activityAt: string | Date;
  spaceId: string;
  updatedBy?: { name: string } | null;
}

interface ItemCardProps {
  item: ItemCardItem;
  onClick?: () => void;
}

export function ItemCard({ item, onClick }: ItemCardProps) {
  const labels = {
    type: TYPE_LABELS[item.type as keyof typeof TYPE_LABELS] ?? item.type,
    status: item.status && item.status !== 'undefined' ? STATUS_LABEL_MAP[item.status] ?? item.status : null,
  };
  return (
    <div
      className="w-48 flex-shrink-0 bg-card border border-border rounded-lg p-3 hover:bg-muted/40 cursor-pointer transition-colors flex flex-col gap-1.5"
      onClick={onClick}
    >
      <ItemVignette
        format="carte"
        title={item.title}
        Icon={getTypeIcon(item.type)}
        iconClass={getTypeTextColor(item.type)}
        face={itemFace(item, 'carte', labels)}
      />
      <div className="mt-auto flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="whitespace-nowrap">{timeAgo(item.activityAt)}</span>
        {item.updatedBy && <span className="truncate">· {item.updatedBy.name}</span>}
      </div>
    </div>
  );
}
