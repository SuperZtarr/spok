/*
 * ProcessLaneNode — nœud de groupe xyflow d'un couloir (flux) de la vue Process : bande horizontale nommée par un
 * item de l'espace, où l'on range visuellement des items (les membres ont parentId = id du couloir, x/y relatifs).
 * Titre à gauche (LANE_HEADER_WIDTH) : chevron = replier / déplier (préférence locale, items masqués, compteur ;
 * replié = petite boîte LANE_COLLAPSED_WIDTH × LANE_COLLAPSED_HEIGHT, réduite en hauteur ET en longueur) ;
 * clic sur le nom = fiche de l'item ; menu Ouvrir / Monter / Descendre / Retirer le couloir.
 * Poignées entrée (gauche) / sortie (droite), reliables si canEdit : les liens vers l'item du couloir (ou vers un
 * membre d'un couloir replié) s'y rattachent ; en tirer une crée une relation avec l'item du couloir (sous-processus).
 * La bande n'est ni déplaçable ni reliable ; sa taille vient de computeLaneLayout (ProcessView).
 * Clics : xyflow rend ce nœud transparent aux clics (pointer-events: none) ; seule la zone de titre les réactive
 * (pointer-events: auto) — ne pas le retirer, sinon le titre et son menu deviennent inaccessibles (bug 2026-10-21).
 * data-lane-body : repère du corps de bande, lu par le double-clic de ProcessView (nouvelle note dans le couloir).
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, ExternalLink, X } from 'lucide-react';
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
  /** Replié : titre seul, items masqués (leurs liens sont rattachés au couloir) — préférence locale */
  collapsed: boolean;
  memberCount: number;
  onToggleCollapse: (laneId: string) => void;
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
  const { laneId, item, width, height, colorIndex, canEdit, isFirst, isLast, collapsed, memberCount, onToggleCollapse, onOpen, onMoveUp, onMoveDown, onRemove } = data;
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

  // Poignées reliables (si canEdit) : entrée à gauche, sortie à droite — même aspect que celles d'un item ;
  // pointer-events auto car la bande est transparente aux clics
  const handleClass = `!w-2.5 !h-2.5 !bg-slate-400 !border-white ${canEdit ? '' : '!opacity-0'}`;
  const handleStyle = { pointerEvents: (canEdit ? 'auto' : 'none') as 'auto' | 'none' };

  return (
    <div
      className="relative flex rounded-lg"
      style={{ width, height, background: color.fill, border: `1px solid ${color.stroke}` }}
      data-tour="process-lane"
      data-help-zone="process:couloir"
    >
      {/* Entrée (gauche) et sortie (droite) du sous-processus : un lien vers l'item du couloir y arrive, un lien qui
          en part (ou d'un item d'un couloir replié) en sort ; tirer depuis / vers elles crée une relation avec l'item
          du couloir (ProcessView traduit lane-<id> en itemId) */}
      <Handle type="target" position={Position.Left} className={handleClass} style={handleStyle} isConnectable={canEdit} data-tour="process-lane-entry" />
      <Handle type="source" position={Position.Right} className={handleClass} style={handleStyle} isConnectable={canEdit} />

      <div
        // process-lane-handle : poignée de déplacement du couloir (dragHandle xyflow) ; les boutons sont en nodrag
        className={`process-lane-handle ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''} flex ${collapsed ? 'items-center' : 'items-start'} gap-1 px-2 py-2 flex-shrink-0`}
        // xyflow met pointer-events: none sur un nœud ni sélectionnable ni déplaçable : seul le titre les réactive
        // (la bande reste transparente aux clics → déplacement de la vue et double-clic du canevas intacts)
        style={{
          // Replié : la boîte entière est le titre (réduite en hauteur et en longueur)
          width: collapsed ? '100%' : LANE_HEADER_WIDTH,
          borderRight: collapsed ? 'none' : `1px solid ${color.stroke}`,
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => onToggleCollapse(laneId)}
          className="nodrag h-4 w-4 flex items-center justify-center flex-shrink-0 rounded text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label={collapsed ? 'Déplier le couloir' : 'Replier le couloir'}
          aria-expanded={!collapsed}
          data-tour="process-lane-collapse"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => onOpen?.(item.id)}
          className={`nodrag flex-1 min-w-0 text-left text-xs font-semibold leading-snug break-words hover:underline ${collapsed ? 'truncate' : 'line-clamp-3'}`}
        >
          {item.title || 'Sans titre'}
          {collapsed && memberCount > 0 && <span className="ml-1 font-normal text-muted-foreground">({memberCount})</span>}
        </button>
        <div className="nodrag flex-shrink-0">
          <ItemActionMenu groups={groups} triggerClassName="p-0.5 rounded hover:bg-accent" tourId="process-lane-menu" triggerLabel="Actions du couloir" />
        </div>
      </div>
      {!collapsed && <div className="flex-1" data-lane-body={laneId} />}
    </div>
  );
}

export const ProcessLaneNode = memo(ProcessLaneNodeComponent);
