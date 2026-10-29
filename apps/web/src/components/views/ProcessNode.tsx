/*
 * ProcessNode — nœud xyflow de la vue Process : carte d'un item placé (icône du type, titre sur 2 lignes,
 * carte entière teintée de la couleur du statut — demande Thomas 2026-10-29, avant : liseré gauche seul —,
 * texte sombre pour rester lisible sur le fond pastel, menu contextuel habituel + « Retirer du process »).
 * Poignées : entrée à gauche, sortie à droite — tirer de l'une vers un autre nœud ouvre la modale de relation
 * (gérée par ProcessView). Masquées si !canEdit. Double-clic = ouvrir l'item (onEdit).
 * Toutes les données/actions arrivent par `data` (ProcessNodeData), construites par ProcessView.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Item } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { ItemActionMenu, type ItemActionGroup } from '../ui/ItemActionMenu';

export type ProcessNodeData = {
  item: Item;
  statusHex: string;
  dimmed: boolean;
  canEdit: boolean;
  menuGroups: ItemActionGroup[];
  onEdit?: (id: string) => void;
};

export type ProcessFlowNode = Node<ProcessNodeData, 'process'>;

function ProcessNodeComponent({ data }: NodeProps<ProcessFlowNode>) {
  const { item, statusHex, dimmed, canEdit, menuGroups, onEdit } = data;
  const Icon = getTypeIcon(item.type, item.url);
  const handleClass = `!w-2.5 !h-2.5 !bg-slate-400 !border-white ${canEdit ? '' : '!opacity-0 !pointer-events-none'}`;

  return (
    <div
      className={`group relative w-48 rounded-lg border border-black/10 text-slate-900 shadow-sm px-2.5 py-2 transition-opacity ${dimmed ? 'opacity-30' : ''}`}
      style={{ backgroundColor: statusHex }}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit?.(item.id); }}
      data-tour="process-node"
      data-help-zone="process:noeud"
    >
      <Handle type="target" position={Position.Left} className={handleClass} isConnectable={canEdit} />
      <div className="flex items-start gap-1.5">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-600" />
        <span className="flex-1 min-w-0 text-xs font-medium leading-snug line-clamp-2 break-words">
          {item.title || 'Sans titre'}
        </span>
        <div className="nodrag flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <ItemActionMenu groups={menuGroups} triggerClassName="p-0.5 rounded hover:bg-accent" />
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} isConnectable={canEdit} />
    </div>
  );
}

export const ProcessNode = memo(ProcessNodeComponent);
