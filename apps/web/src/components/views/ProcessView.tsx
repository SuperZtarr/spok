/*
 * ProcessView — vue d'espace « Process » : canevas libre (xyflow) où l'on pose les items de l'espace à la main,
 * puis où on les relie par de vraies relations SPOK (brainstorm → enchaînement de tâches).
 * - Positions : table process_nodes via useProcessNodes, partagées entre membres, jamais recalculées.
 * - Panneau gauche (ProcessUnplacedPanel) : items non placés, à glisser sur le canevas.
 * - Double-clic sur le vide : onCreateNote() crée une NOTE et ouvre sa modale, le nœud est posé au point cliqué.
 * - Tirer d'une poignée vers un autre nœud : RelationCreateDialog → onCreateRelation ; clic sur une flèche :
 *   RelationEditDialog → onUpdateRelation / onDeleteRelation. Seules les relations entre items placés s'affichent.
 * - « Retirer du process » (menu du nœud) : l'item revient dans le panneau, il n'est pas supprimé.
 * - Filtres type/statut et recherche de la barre d'espace : surbrillance (dim), jamais de retrait de nœud.
 * - Zoom au pincement du pad à vitesse normale hors macOS : useTrackpadPinchZoom (mêmes bornes que <ReactFlow>).
 * Props : celles de PERT (items de l'espace non filtrés, relations, callbacks du menu d'item) + onCreateNote.
 * - Bouton « Réorganiser en processus » (canEdit) : layoutAsProcess (colonnes par rang « Bloque » / « Permet »)
 *   après ConfirmModal, enregistré en un appel (placeMany), puis recadrage.
 * Pas d'autre disposition automatique : hors ce bouton, la place choisie par l'utilisateur fait foi.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, useNodesState, useReactFlow,
  type Connection, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Undo2, Wand2 } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import { ConfirmModal } from '../ConfirmModal';
import { help as processHelp } from './help/process.help';
import type { Item, ItemRelation, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { useProcessNodes } from '../../hooks/useProcessNodes';
import { useTrackpadPinchZoom } from '../../hooks/useTrackpadPinchZoom';
import { buildItemMenuGroups, type ItemMenuCallbacks } from '../../lib/itemMenuGroups';
import { NewItemButton } from '../ui/NewItemButton';
import { ViewHelpButton } from '../ViewHelpButton';
import { EmptyHelp } from '../../help/EmptyHelp';
import { RelationCreateDialog } from '../relations/RelationCreateDialog';
import { RelationEditDialog } from '../relations/RelationEditDialog';
import { getStatusColor, tailwindBgToHex } from './mindmap-utils';
import { splitPlaced, buildProcessEdges, layoutAsProcess } from './process-utils';
import { ProcessNode, type ProcessFlowNode } from './ProcessNode';
import { ProcessUnplacedPanel, PROCESS_DRAG_TYPE } from './ProcessUnplacedPanel';

const NODE_TYPES = { process: ProcessNode };
const PROCESS_MIN_ZOOM = 0.2;
const PROCESS_MAX_ZOOM = 2;
/** Infobulles de l'en-tête — textes dans la fiche d'aide (process.help.ts, hints). */
const PH = processHelp.hints!;

export interface ProcessViewProps extends ItemMenuCallbacks {
  items: Item[];
  relations: ItemRelation[];
  spaceId: string;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: Item) => boolean;
  highlightType?: ItemType;
  highlightStatus?: string;
  searchMatchIds?: Set<string>;
  onCreateNote?: () => Promise<{ id: string }>;
  onNewItem?: () => void;
  onCreateRelation?: (fromId: string, toId: string, type: string, label?: string) => void;
  onUpdateRelation?: (itemId: string, relationId: string, data: { type?: string; label?: string | null }) => void;
  onDeleteRelation?: (itemId: string, relationId: string) => void;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function ProcessView(props: ProcessViewProps) {
  return (
    <ReactFlowProvider>
      <ProcessCanvas {...props} />
    </ReactFlowProvider>
  );
}

function ProcessCanvas({
  items, relations, spaceId, referentiels, canEdit = false, canEditItem,
  highlightType, highlightStatus, searchMatchIds,
  onCreateNote, onNewItem, onCreateRelation, onUpdateRelation, onDeleteRelation, onStartTour, pulseHelp,
  ...menuCallbacks
}: ProcessViewProps) {
  const { positions, place, remove, placeMany } = useProcessNodes(spaceId);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  useTrackpadPinchZoom(canvasRef, PROCESS_MIN_ZOOM, PROCESS_MAX_ZOOM);
  const statuses = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;
  const statusOptions = useMemo(() => statuses.map((s) => ({ id: s.id, label: s.label })), [statuses]);

  const { placed, unplaced } = useMemo(() => splitPlaced(items, positions), [items, positions]);
  const placedIds = useMemo(() => new Set(placed.map((p) => p.item.id)), [placed]);
  const edges = useMemo(() => buildProcessEdges(relations, placedIds), [relations, placedIds]);
  // Extrémités d'une relation pour les modales (titre + statut, affichés en phrase « A bloque B »)
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const relationEnd = (id: string) => {
    const item = itemById.get(id);
    return { title: item?.title || 'Sans titre', status: item?.status };
  };

  // Callbacks du menu dans une ref : les nœuds ne sont pas reconstruits à chaque rendu de SpacePage
  const menuRef = useRef(menuCallbacks);
  menuRef.current = menuCallbacks;

  const derivedNodes = useMemo<ProcessFlowNode[]>(() => placed.map(({ item, x, y }) => {
    const itemCanEdit = canEditItem ? canEditItem(item) : canEdit;
    const dimmed = (highlightType ? item.type !== highlightType : false)
      || (highlightStatus ? (highlightStatus === 'undefined' ? !!item.status : item.status !== highlightStatus) : false)
      || (searchMatchIds ? !searchMatchIds.has(item.id) : false);
    const cb = menuRef.current;
    const menuGroups = buildItemMenuGroups(item.id, {
      onOpen: cb.onOpen, onOpenInNewTab: cb.onOpenInNewTab, onEdit: cb.onEdit, onDelete: cb.onDelete,
      onUpdateStatus: cb.onUpdateStatus, onAddChild: cb.onAddChild, onMoveToSpace: cb.onMoveToSpace,
      onDuplicateToSpace: cb.onDuplicateToSpace, onConvertToSpace: cb.onConvertToSpace, onSelfAssign: cb.onSelfAssign,
      onMerge: cb.onMerge, onAbsorbChildren: cb.onAbsorbChildren, onSplitDescription: cb.onSplitDescription,
    }, {
      canEdit: itemCanEdit, statusOptions, currentStatusId: item.status || undefined,
      extraSections: canEdit ? [{ actions: [{ id: 'process-remove', label: 'Retirer du process', icon: Undo2, onClick: () => remove(item.id) }] }] : undefined,
    });
    return {
      id: item.id,
      type: 'process',
      position: { x, y },
      data: {
        item, dimmed, canEdit, menuGroups,
        statusHex: tailwindBgToHex(getStatusColor(item.status, statuses)),
        onEdit: cb.onEdit,
      },
    };
  }), [placed, canEdit, canEditItem, highlightType, highlightStatus, searchMatchIds, statusOptions, statuses, remove]);

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<ProcessFlowNode>(derivedNodes);
  useEffect(() => { setNodes(derivedNodes); }, [derivedNodes, setNodes]);
  const onNodesChange = useCallback((changes: NodeChange<ProcessFlowNode>[]) => {
    // Pas de suppression au clavier : retirer passe par le menu, supprimer par la modale de l'item
    onNodesChangeBase(changes.filter((c) => c.type !== 'remove'));
  }, [onNodesChangeBase]);

  const onNodeDragStop = useCallback((_e: unknown, node: ProcessFlowNode) => {
    place(node.id, node.position.x, node.position.y);
  }, [place]);

  // Dépôt d'un item glissé depuis le panneau
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!canEdit || !e.dataTransfer.types.includes(PROCESS_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [canEdit]);
  const onDrop = useCallback((e: React.DragEvent) => {
    const itemId = e.dataTransfer.getData(PROCESS_DRAG_TYPE);
    if (!canEdit || !itemId) return;
    e.preventDefault();
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    place(itemId, pos.x, pos.y);
  }, [canEdit, place, screenToFlowPosition]);

  // Double-clic sur le vide : nouvelle NOTE posée au point cliqué
  const onCanvasDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (!canEdit || !onCreateNote) return;
    if (!(e.target as HTMLElement).classList.contains('react-flow__pane')) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const created = await onCreateNote();
    place(created.id, pos.x, pos.y);
  }, [canEdit, onCreateNote, place, screenToFlowPosition]);

  // « Réorganiser en processus » : seule disposition automatique, après confirmation (écrase la disposition partagée)
  const [confirmReorganize, setConfirmReorganize] = useState(false);
  const reorganize = useCallback(() => {
    placeMany(layoutAsProcess(placed, relations));
    setConfirmReorganize(false);
    setTimeout(() => fitView({ maxZoom: 1, duration: 300 }), 50);
  }, [placeMany, placed, relations, fitView]);

  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const onConnect = useCallback((c: Connection) => {
    if (c.source && c.target && c.source !== c.target) setPendingConnection({ source: c.source, target: c.target });
  }, []);

  const [editingEdge, setEditingEdge] = useState<{ relationId: string; source: string; target: string; type: string; label: string } | null>(null);
  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    if (!canEdit) return;
    const d = edge.data as { relationId: string; type: string; label: string };
    setEditingEdge({ relationId: d.relationId, source: edge.source, target: edge.target, type: d.type, label: d.label });
  }, [canEdit]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0" id="view-header" data-devzone="contenu-barre-vue">
        {canEdit && onNewItem && <NewItemButton onClick={onNewItem} />}
        {canEdit && (
          <HelpHint text={PH.reorganize}>
            <button
              type="button"
              onClick={() => setConfirmReorganize(true)}
              disabled={placed.length === 0}
              data-tour="process-reorganize"
              aria-label="Réorganiser en processus"
              className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              <Wand2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="hidden sm:inline">Réorganiser en processus</span>
            </button>
          </HelpHint>
        )}
        <div className="flex-1" />
        <ViewHelpButton viewMode="process" onStartTour={onStartTour} pulse={pulseHelp} />
      </div>
      <div className="flex flex-1 min-h-0">
        <ProcessUnplacedPanel items={unplaced} canEdit={canEdit} />
        <div
          ref={canvasRef}
          className="relative flex-1 min-w-0"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDoubleClick={onCanvasDoubleClick}
          data-tour="process-canvas"
          data-help-zone="process:canevas"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onConnect={canEdit ? onConnect : undefined}
            onEdgeClick={onEdgeClick}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            edgesFocusable={canEdit}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            minZoom={PROCESS_MIN_ZOOM}
            maxZoom={PROCESS_MAX_ZOOM}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {placed.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <EmptyHelp mode="process" title="Process vide" className="max-w-sm p-6 text-center" />
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmReorganize}
        onClose={() => setConfirmReorganize(false)}
        onConfirm={reorganize}
        title="Réorganiser en processus"
        message="Les items placés seront rangés de gauche à droite selon leurs liens « Bloque » et « Permet » ; ceux sans lien d'ordre iront dans la première colonne."
        warning="La disposition actuelle sera remplacée pour tous les membres de l'espace."
        confirmLabel="Réorganiser"
        confirmVariant="default"
      />

      {pendingConnection && (
        <RelationCreateDialog
          source={relationEnd(pendingConnection.source)}
          target={relationEnd(pendingConnection.target)}
          statusOptions={statuses}
          onSelect={(type, label) => {
            onCreateRelation?.(pendingConnection.source, pendingConnection.target, type, label);
            setPendingConnection(null);
          }}
          onCancel={() => setPendingConnection(null)}
        />
      )}
      {editingEdge && (
        <RelationEditDialog
          source={relationEnd(editingEdge.source)}
          target={relationEnd(editingEdge.target)}
          statusOptions={statuses}
          type={editingEdge.type}
          label={editingEdge.label}
          onSave={(type, label) => {
            onUpdateRelation?.(editingEdge.source, editingEdge.relationId, { type, label: label || null });
            setEditingEdge(null);
          }}
          onDelete={() => {
            onDeleteRelation?.(editingEdge.source, editingEdge.relationId);
            setEditingEdge(null);
          }}
          onCancel={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}
