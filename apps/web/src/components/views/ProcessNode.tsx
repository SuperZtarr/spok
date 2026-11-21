/*
 * ProcessNode — nœud xyflow du canevas d'un élément Process : carte d'un élément posé (icône du type, titre sur 2 lignes,
 * carte entière teintée de la couleur du statut — demande Thomas 2026-10-29 —, texte sombre lisible sur le fond pastel,
 * menu ⋯ construit par ProcessView : Ouvrir, Définir comme couloir, Retirer du process).
 * Trois formes (2026-11-21) :
 * - élément ordinaire : carte arrondie ;
 * - Question (type QUESTION, demande Thomas 2026-11-21) : losange (nœud de décision) ; ses réponses possibles en
 *   pastilles sous le losange, la réponse retenue en vert ; les réponses qui renvoient à un élément posé deviennent
 *   des flèches en pointillés (buildQuestionEdges, ProcessView) ;
 * - élément indisponible (devenu illisible pour la personne qui l'a posé) : case grise en pointillés, sans titre réel,
 *   menu réduit à « Retirer du process ».
 * Boîte commune PROCESS_NODE_WIDTH × PROCESS_NODE_HEIGHT (rangement, voies des flèches, couloirs en dépendent) ; les
 * pastilles d'une Question débordent dessous, dans l'écart entre lignes (PROCESS_ROW_GAP).
 * Poignées : entrée à gauche, sortie à droite — tirer de l'une vers un autre nœud ouvre la modale de relation
 * (gérée par ProcessView). Masquées si !canEdit. Clic = ouvrir l'élément : géré par ProcessView (onNodeClick) ;
 * le double-clic est seulement arrêté pour ne pas créer de note sur le canevas.
 * Toutes les données/actions arrivent par `data` (ProcessNodeData), construites par ProcessView.
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { EyeOff } from 'lucide-react';
import { getTypeIcon } from '../../constants/ui';
import { ItemActionMenu, type ItemActionGroup } from '../ui/ItemActionMenu';
import { PROCESS_NODE_HEIGHT, PROCESS_NODE_WIDTH, type CanvasItem } from './process-utils';

export type ProcessNodeData = {
  item: CanvasItem;
  statusHex: string;
  dimmed: boolean;
  canEdit: boolean;
  menuGroups: ItemActionGroup[];
};

export type ProcessFlowNode = Node<ProcessNodeData, 'process'>;

function ProcessNodeComponent({ data }: NodeProps<ProcessFlowNode>) {
  const { item, statusHex, dimmed, canEdit, menuGroups } = data;
  const Icon = getTypeIcon(item.type);
  const handleClass = `!w-2.5 !h-2.5 !bg-slate-400 !border-white ${canEdit ? '' : '!opacity-0 !pointer-events-none'}`;
  const menu = (
    <div className="nodrag flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
      <ItemActionMenu groups={menuGroups} triggerClassName="p-0.5 rounded hover:bg-accent" />
    </div>
  );

  if (!item.available) {
    return (
      <div
        className={`group relative w-48 rounded-lg border border-dashed border-slate-400 bg-slate-100 text-slate-500 px-2.5 py-2 ${dimmed ? 'opacity-30' : ''}`}
        onDoubleClick={(e) => e.stopPropagation()}
        data-tour="process-node"
        data-help-zone="process:indisponible"
      >
        <Handle type="target" position={Position.Left} className="!opacity-0 !pointer-events-none" isConnectable={false} />
        <div className="flex items-start gap-1.5">
          <EyeOff className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span className="flex-1 min-w-0 text-xs italic leading-snug">{item.title}</span>
          {menu}
        </div>
        <Handle type="source" position={Position.Right} className="!opacity-0 !pointer-events-none" isConnectable={false} />
      </div>
    );
  }

  if (item.question) {
    const q = item.question;
    return (
      <div
        className={`group relative text-slate-900 transition-opacity ${dimmed ? 'opacity-30' : ''}`}
        style={{ width: PROCESS_NODE_WIDTH, height: PROCESS_NODE_HEIGHT }}
        onDoubleClick={(e) => e.stopPropagation()}
        data-tour="process-question"
        data-help-zone="process:question"
      >
        <svg className="absolute inset-0" width={PROCESS_NODE_WIDTH} height={PROCESS_NODE_HEIGHT} aria-hidden>
          <polygon
            points={`${PROCESS_NODE_WIDTH / 2},1 ${PROCESS_NODE_WIDTH - 1},${PROCESS_NODE_HEIGHT / 2} ${PROCESS_NODE_WIDTH / 2},${PROCESS_NODE_HEIGHT - 1} 1,${PROCESS_NODE_HEIGHT / 2}`}
            fill={statusHex}
            stroke={q.decided ? '#16a34a' : 'rgba(0,0,0,0.25)'}
            strokeWidth={q.decided ? 2 : 1}
          />
        </svg>
        <Handle type="target" position={Position.Left} className={handleClass} isConnectable={canEdit} />
        <div className="absolute inset-0 flex items-center justify-center gap-1 px-10">
          <Icon className="w-3.5 h-3.5 flex-shrink-0 text-slate-600" />
          <span className="min-w-0 text-[11px] font-semibold leading-tight line-clamp-2 break-words text-center">
            {item.title || 'Sans titre'}
          </span>
        </div>
        <div className="absolute right-1 top-1">{menu}</div>
        <Handle type="source" position={Position.Right} className={handleClass} isConnectable={canEdit} />
        {q.options.length > 0 && (
          <ul className="absolute left-0 right-0 flex flex-wrap justify-center gap-1 pointer-events-none" style={{ top: PROCESS_NODE_HEIGHT + 2 }}>
            {q.options.map((o) => {
              const chosen = q.chosenOptionId === o.id;
              return (
                <li
                  key={o.id}
                  className={`max-w-[90px] truncate rounded-full border px-1.5 text-[10px] leading-4 ${chosen ? 'border-green-600 bg-green-50 text-green-800 font-semibold' : 'border-indigo-300 bg-white text-indigo-700'}`}
                  title={o.label}
                >
                  {o.label}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div
      className={`group relative w-48 rounded-lg border border-black/10 text-slate-900 shadow-sm px-2.5 py-2 transition-opacity ${dimmed ? 'opacity-30' : ''}`}
      style={{ backgroundColor: statusHex }}
      onDoubleClick={(e) => e.stopPropagation()}
      data-tour="process-node"
      data-help-zone="process:noeud"
    >
      <Handle type="target" position={Position.Left} className={handleClass} isConnectable={canEdit} />
      <div className="flex items-start gap-1.5">
        <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-slate-600" />
        <span className="flex-1 min-w-0 text-xs font-medium leading-snug line-clamp-2 break-words">
          {item.title || 'Sans titre'}
        </span>
        {menu}
      </div>
      <Handle type="source" position={Position.Right} className={handleClass} isConnectable={canEdit} />
    </div>
  );
}

export const ProcessNode = memo(ProcessNodeComponent);
