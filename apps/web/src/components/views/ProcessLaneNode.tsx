/*
 * ProcessLaneNode — nœud de groupe xyflow d'un couloir (flux) de la vue Process : bande horizontale nommée par un
 * item de l'espace, où l'on range visuellement des items (les membres ont parentId = id du couloir, x/y relatifs).
 * Titre à gauche (LANE_HEADER_WIDTH) : clic = fiche de l'item ; menu Ouvrir / Monter / Descendre / Retirer le couloir.
 * La bande n'est ni déplaçable ni reliable ; sa taille vient de computeLaneLayout (ProcessView).
 * data-lane-body : repère du corps de bande, lu par le double-clic de ProcessView (nouvelle note dans le couloir).
 */
import { memo } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { ArrowDown, ArrowUp, ExternalLink, Rows3, X } from 'lucide-react';
import type { Item } from '@spok/shared';
import { ItemActionMenu, type ItemActionGroup } from '../ui/ItemActionMenu';
import { LANE_HEADER_WIDTH } from './process-utils';

export type ProcessLaneData = {
  laneId: string;
  item: Item;
  width: number;
  height: number;
  colorIndex: number;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onOpen?: (itemId: string) => void;
  onMoveUp: (laneId: string) => void;
  onMoveDown: (laneId: string) => void;
  onRemove: (laneId: string) => void;
};

export type ProcessLaneFlowNode = Node<ProcessLaneData, 'lane'>;

const LANE_COLORS = [
  { fill: 'rgba(99,102,241,0.06)', stroke: 'rgba(99,102,241,0.35)' },
  { fill: 'rgba(16,185,129,0.06)', stroke: 'rgba(16,185,129,0.35)' },
  { fill: 'rgba(245,158,11,0.07)', stroke: 'rgba(245,158,11,0.40)' },
  { fill: 'rgba(239,68,68,0.05)', stroke: 'rgba(239,68,68,0.30)' },
  { fill: 'rgba(168,85,247,0.06)', stroke: 'rgba(168,85,247,0.35)' },
];

function ProcessLaneNodeComponent({ data }: NodeProps<ProcessLaneFlowNode>) {
  const { laneId, item, width, height, colorIndex, canEdit, isFirst, isLast, onOpen, onMoveUp, onMoveDown, onRemove } = data;
  const color = LANE_COLORS[colorIndex % LANE_COLORS.length];

  const groups: ItemActionGroup[] = [
    { actions: [{ id: 'lane-open', label: 'Ouvrir l\'item', icon: ExternalLink, onClick: () => onOpen?.(item.id) }] },
    ...(canEdit ? [{
      actions: [
        { id: 'lane-up', label: 'Monter', icon: ArrowUp, onClick: () => onMoveUp(laneId), disabled: isFirst },
        { id: 'lane-down', label: 'Descendre', icon: ArrowDown, onClick: () => onMoveDown(laneId), disabled: isLast },
        { id: 'lane-remove', label: 'Retirer le couloir', icon: X, onClick: () => onRemove(laneId), variant: 'danger' as const },
      ],
    }] : []),
  ];

  return (
    <div
      className="flex rounded-lg"
      style={{ width, height, background: color.fill, border: `1px solid ${color.stroke}` }}
      data-tour="process-lane"
      data-help-zone="process:couloir"
    >
      <div
        className="flex items-start gap-1.5 px-2.5 py-2 flex-shrink-0"
        style={{ width: LANE_HEADER_WIDTH, borderRight: `1px solid ${color.stroke}` }}
      >
        <Rows3 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
        <button
          type="button"
          onClick={() => onOpen?.(item.id)}
          className="nodrag flex-1 min-w-0 text-left text-xs font-semibold leading-snug line-clamp-3 break-words hover:underline"
        >
          {item.title || 'Sans titre'}
        </button>
        <div className="nodrag flex-shrink-0">
          <ItemActionMenu groups={groups} triggerClassName="p-0.5 rounded hover:bg-accent" tourId="process-lane-menu" triggerLabel="Actions du couloir" />
        </div>
      </div>
      <div className="flex-1" data-lane-body={laneId} />
    </div>
  );
}

export const ProcessLaneNode = memo(ProcessLaneNodeComponent);
