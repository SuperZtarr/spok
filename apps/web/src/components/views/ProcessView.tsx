/*
 * ProcessView — canevas d'un élément Process (type PROCESS, 2026-11-21 ; avant : un process unique par espace) : on y
 * pose des éléments de tous les espaces lisibles, puis on les relie par de vraies relations SPOK.
 * - En-tête : « Tous les process » (onBack) ; titre cliquable = fiche de l'élément Process (onOpenProcess, 2026-11-21).
 * - Données : useProcessCanvas(spaceId, processId) — places, couloirs, relations entre éléments montrés, droit de
 *   modifier (canEditProcess). Un élément devenu illisible pour la personne qui l'a posé est une case « indisponible ».
 * - Panneau gauche (ProcessUnplacedPanel) : éléments de l'espace du process non posés (spaceItems, unplacedItems), à
 *   glisser sur le canevas ; bouton « Ajouter d'un autre espace » → recherche (ItemSearchPicker) : l'élément choisi est
 *   posé au centre de la vue. Élément moins visible que le process (409 LESS_VISIBLE) → ConfirmModal puis nouvelle
 *   pose confirmée (texte : process.help.ts, hints.lessVisible).
 * - Double-clic sur le vide : onCreateNote() crée un élément dans l'espace du process (fiche ouverte), posé au point cliqué.
 * - Tirer d'une poignée vers un autre nœud : RelationCreateDialog → relation créée dans l'espace de l'élément source
 *   (connu seulement si le lecteur peut l'ouvrir, sinon message relationBlocked) ; clic sur une flèche :
 *   RelationEditDialog (modifier / supprimer), même règle.
 * - Question (type QUESTION, demande Thomas 2026-11-21) : losange (ProcessNode) ; ses réponses qui renvoient à un
 *   élément posé sont des flèches en pointillés étiquetées (buildQuestionEdges), réponse retenue en vert — non modifiables ici.
 * - Menu ⋯ d'un nœud : Ouvrir (si le lecteur peut l'ouvrir), Définir comme couloir, Retirer du process (l'élément n'est
 *   pas supprimé). Les autres actions (statut, déplacement…) se font depuis la fiche : l'élément peut venir d'un autre espace.
 * - Clic sur un élément : onOpenItem (SpacePage : fiche dans l'espace courant, ou nouvel onglet pour un autre espace).
 * - Filtres type/statut et recherche de la barre d'espace : surbrillance (dim), jamais de retrait de nœud.
 * - Zoom au pincement du pad à vitesse normale hors macOS : useTrackpadPinchZoom (mêmes bornes que <ReactFlow>).
 * - Bouton « Réorganiser en processus » (canEditProcess) : layoutAsProcess (colonnes par rang « Bloque » / « Permet »)
 *   appliqué directement (sans confirmation), enregistré en un appel (placeMany), puis recadrage.
 * - Couloirs (2026-10-21) : « Définir comme couloir » fait d'un élément une bande nommée (ProcessLaneNode, nœud de
 *   groupe placé en tête de liste) ; les membres ont parentId = lane-<id> et x/y relatifs. Fin de glisser / dépôt /
 *   double-clic : toStored choisit le couloir sous le centre du nœud (findLaneAt), sinon libre. Retirer un couloir
 *   rend ses membres libres à leur place à l'écran. Rangement purement visuel.
 * - Liens et couloirs : un lien vers / depuis l'élément d'un couloir est gardé, rattaché au couloir (sous-processus) ;
 *   un couloir replié (préférence locale, localStorage process-collapsed-lanes:<process>) masque ses éléments et
 *   rattache leurs liens au couloir (endpointOverrides de buildProcessEdges) ; ses liens internes sont masqués.
 * Pas d'autre disposition automatique : hors ce bouton, la place choisie par l'utilisateur fait foi.
 */
import { matchesStatus, matchesType } from '../../lib/itemHighlight';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, useNodesState, useReactFlow,
  type Connection, type Edge, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, ExternalLink, Rows3, Undo2, Wand2 } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import { help as processHelp } from './help/process.help';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { ApiError } from '../../lib/api';
import { useProcessCanvas } from '../../hooks/useProcessCanvas';
import { useTrackpadPinchZoom } from '../../hooks/useTrackpadPinchZoom';
import type { ItemActionGroup } from '../ui/ItemActionMenu';
import { ViewHelpButton } from '../ViewHelpButton';
import { EmptyHelp } from '../../help/EmptyHelp';
import { Modal } from '../ui/Modal';
import { ConfirmModal } from '../ConfirmModal';
import { ItemSearchPicker } from '../ItemSearchPicker';
import { RelationCreateDialog } from '../relations/RelationCreateDialog';
import { RelationEditDialog } from '../relations/RelationEditDialog';
import { getStatusColor, tailwindBgToHex } from './mindmap-utils';
import {
  buildProcessEdges, buildQuestionEdges, canvasItemOf, layoutAsProcess, computeLaneLayout, findLaneAt, assignEdgeChannels,
  placedFromView, unplacedItems,
  PROCESS_NODE_WIDTH, PROCESS_NODE_HEIGHT, type CanvasItem, type PlacedItem, type ProcessPosition, type NodeBox,
} from './process-utils';
import { ProcessNode, type ProcessFlowNode } from './ProcessNode';
import { ProcessLaneNode, type ProcessLaneFlowNode } from './ProcessLaneNode';
import { RelationEdge } from './RelationEdge';
import { ProcessUnplacedPanel, PROCESS_DRAG_TYPE } from './ProcessUnplacedPanel';

const NODE_TYPES = { process: ProcessNode, lane: ProcessLaneNode };
// Arête partagée avec la MindMap : icône de commentaire + infobulle (ne pas la modifier ici, zone fragile MindMap)
const EDGE_TYPES = { relation: RelationEdge };
type CanvasNode = ProcessFlowNode | ProcessLaneFlowNode;
const laneNodeId = (laneId: string) => `lane-${laneId}`;
const PROCESS_MIN_ZOOM = 0.2;
const PROCESS_MAX_ZOOM = 2;
/** Infobulles et messages — textes dans la fiche d'aide (process.help.ts, hints). */
const PH = processHelp.hints!;

const errorCode = (e: unknown) => (e instanceof ApiError ? e.code ?? (e.details as { code?: string } | undefined)?.code : undefined);

export interface ProcessViewProps {
  /** Espace de l'élément Process */
  spaceId: string;
  processId: string;
  processTitle?: string;
  /** Éléments de l'espace du process (panneau « Non placés ») */
  spaceItems: Item[];
  referentiels?: SpaceReferentiels;
  highlightType?: string[];
  highlightStatus?: string[];
  searchMatchIds?: Set<string>;
  /** Ouvrir un élément du canevas (appelé seulement si le lecteur peut l'ouvrir) */
  onOpenItem: (item: CanvasItem) => void;
  /** Double-clic : crée un élément dans l'espace du process et ouvre sa fiche */
  onCreateNote?: () => Promise<{ id: string }>;
  /** Retour à la liste des process de l'espace */
  onBack?: () => void;
  /** Ouvre la fiche de l'élément Process (clic sur le titre de l'en-tête) */
  onOpenProcess?: () => void;
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
  spaceId, processId, processTitle, spaceItems, referentiels,
  highlightType, highlightStatus, searchMatchIds,
  onOpenItem, onCreateNote, onBack, onOpenProcess, onStartTour, pulseHelp,
}: ProcessViewProps) {
  const {
    view, isLoading, isError, move, placeNew, remove, placeMany, addLane, reorderLanes, removeLane, moveLanes,
    createRelation, updateRelation, deleteRelation,
  } = useProcessCanvas(spaceId, processId);
  const canEdit = !!view?.canEditProcess;
  const { screenToFlowPosition, fitView } = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  useTrackpadPinchZoom(canvasRef, PROCESS_MIN_ZOOM, PROCESS_MAX_ZOOM);
  const statuses = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;
  const [notice, setNotice] = useState<string | null>(null);

  const relations = useMemo(() => view?.relations ?? [], [view]);
  // Couloirs dans l'ordre d'empilement, avec l'élément qui les nomme
  const lanes = useMemo(
    () => [...(view?.lanes ?? [])].sort((a, b) => a.position - b.position)
      .map((l) => ({ id: l.id, itemId: l.itemId, position: l.position, x: l.x, y: l.y, item: canvasItemOf(l.itemId, l.item) })),
    [view],
  );
  const placed = useMemo(() => placedFromView(view), [view]);
  const unplaced = useMemo(() => unplacedItems(spaceItems, view, processId), [spaceItems, view, processId]);
  const itemById = useMemo(() => {
    const map = new Map<string, CanvasItem>();
    for (const p of placed) map.set(p.item.id, p.item);
    for (const l of lanes) map.set(l.itemId, l.item);
    return map;
  }, [placed, lanes]);
  const takenIds = useMemo(() => new Set([processId, ...itemById.keys()]), [processId, itemById]);

  // Couloirs repliés : préférence locale (par process et par navigateur), non partagée entre membres
  const collapsedKey = `process-collapsed-lanes:${processId}`;
  const [collapsedLaneIds, setCollapsedLaneIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(collapsedKey) || '[]')); } catch { return new Set(); }
  });
  const toggleLaneCollapse = useCallback((laneId: string) => setCollapsedLaneIds((prev) => {
    const next = new Set(prev);
    if (next.has(laneId)) next.delete(laneId); else next.add(laneId);
    try { localStorage.setItem(collapsedKey, JSON.stringify([...next])); } catch { /* stockage indisponible */ }
    return next;
  }), [collapsedKey]);

  const laneLayout = useMemo(() => computeLaneLayout(lanes, placed, collapsedLaneIds), [lanes, placed, collapsedLaneIds]);
  // Origine de chaque couloir sur le canevas (empilé ou déplacé) : les membres y sont relatifs
  const laneOriginById = useMemo(() => new Map(laneLayout.lanes.map((l) => [l.id, { x: l.x, y: l.y }])), [laneLayout]);
  const laneOrigin = useCallback((laneId: string | null | undefined) => (laneId && laneOriginById.get(laneId)) || { x: 0, y: 0 }, [laneOriginById]);
  const placedIds = useMemo(() => new Set(placed.map((p) => p.item.id)), [placed]);
  // Membres des couloirs repliés : masqués, leurs liens rattachés au couloir
  const isHidden = useCallback((p: PlacedItem) => !!p.laneId && collapsedLaneIds.has(p.laneId), [collapsedLaneIds]);
  // Extrémités de lien représentées par un couloir : son élément (sous-processus) et les membres d'un couloir replié
  const endpointOverrides = useMemo(() => {
    const map = new Map<string, string>(lanes.map((l) => [l.itemId, laneNodeId(l.id)]));
    for (const p of placed) if (isHidden(p)) map.set(p.item.id, laneNodeId(p.laneId!));
    return map;
  }, [lanes, placed, isHidden]);
  // Boîtes absolues des nœuds affichés (éléments et couloirs) : servent à donner une voie propre à chaque flèche
  const nodeBoxes = useMemo(() => {
    const boxes = new Map<string, NodeBox>();
    for (const l of laneLayout.lanes) boxes.set(laneNodeId(l.id), { x: l.x, y: l.y, width: l.width, height: l.height });
    const origin = new Map(laneLayout.lanes.map((l) => [l.id, l]));
    for (const p of placed) {
      if (isHidden(p)) continue;
      const o = p.laneId ? origin.get(p.laneId) : undefined;
      boxes.set(p.item.id, { x: p.x + (o?.x ?? 0), y: p.y + (o?.y ?? 0), width: PROCESS_NODE_WIDTH, height: PROCESS_NODE_HEIGHT });
    }
    return boxes;
  }, [laneLayout, placed, isHidden]);
  const edges = useMemo(() => {
    const titleOf = (id: string) => itemById.get(id)?.title || 'Sans titre';
    const relationEdges = assignEdgeChannels(
      buildProcessEdges(relations, placedIds, endpointOverrides, titleOf),
      nodeBoxes,
      (id) => !id.startsWith('lane-'), // un couloir englobe ses éléments : ce n'est pas un obstacle
    );
    const endpoint = (id: string) => endpointOverrides.get(id) ?? (placedIds.has(id) ? id : null);
    return [...relationEdges, ...buildQuestionEdges(placed, endpoint)];
  }, [relations, placedIds, endpointOverrides, itemById, nodeBoxes, placed]);

  /** Position absolue (canevas) → position enregistrée : relative au couloir sous le centre du nœud, ou libre. */
  const toStored = useCallback((abs: { x: number; y: number }): { x: number; y: number; laneId: string | null } => {
    const laneId = findLaneAt(laneLayout, { x: abs.x + PROCESS_NODE_WIDTH / 2, y: abs.y + PROCESS_NODE_HEIGHT / 2 });
    if (!laneId) return { ...abs, laneId: null };
    const o = laneOrigin(laneId);
    return { x: abs.x - o.x, y: abs.y - o.y, laneId };
  }, [laneLayout, laneOrigin]);
  // Extrémités d'une relation pour les modales (titre + statut, affichés en phrase « A bloque B »)
  const relationEnd = (id: string) => {
    const item = itemById.get(id);
    return { title: item?.title || 'Sans titre', status: item?.status ?? undefined };
  };

  // Pose d'un nouvel élément : « moins visible » → confirmation, autre refus → message
  const [lessVisible, setLessVisible] = useState<{ itemId: string; x: number; y: number; laneId: string | null } | null>(null);
  const tryPlaceNew = useCallback(async (itemId: string, x: number, y: number, laneId: string | null, confirm = false) => {
    setNotice(null);
    try {
      await placeNew(itemId, x, y, laneId, confirm);
      return true;
    } catch (e) {
      if (errorCode(e) === 'LESS_VISIBLE') { setLessVisible({ itemId, x, y, laneId }); return false; }
      setNotice(errorCode(e) === 'IS_LANE' ? PH.isLane : (e as Error).message);
      return false;
    }
  }, [placeNew]);
  const makeLane = useCallback((itemId: string) => {
    setNotice(null);
    addLane(itemId).catch((e) => setNotice((e as Error).message));
  }, [addLane]);

  // Couloirs : Monter / Descendre / Retirer (membres rendus libres là où ils sont à l'écran)
  const moveLane = useCallback((laneId: string, delta: -1 | 1) => {
    const ids = lanes.map((l) => l.id);
    const i = ids.indexOf(laneId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorderLanes(ids);
  }, [lanes, reorderLanes]);
  const removeLaneKeepingMembers = useCallback((laneId: string) => {
    const o = laneOrigin(laneId);
    const freed: ProcessPosition[] = placed
      .filter((p) => p.laneId === laneId)
      .map((p) => ({ itemId: p.item.id, x: p.x + o.x, y: p.y + o.y, laneId: null }));
    removeLane(laneId, freed);
  }, [placed, laneOrigin, removeLane]);

  const openRef = useRef(onOpenItem);
  openRef.current = onOpenItem;
  const openById = useCallback((id: string) => {
    const item = itemById.get(id);
    if (item?.canOpen) openRef.current(item);
  }, [itemById]);

  const laneNodes = useMemo<ProcessLaneFlowNode[]>(() => laneLayout.lanes.map((l, index) => ({
    id: laneNodeId(l.id),
    type: 'lane',
    position: { x: l.x, y: l.y },
    // Déplaçable par son titre seulement (dragHandle) ; ses membres suivent (enfants xyflow)
    draggable: canEdit,
    dragHandle: '.process-lane-handle',
    selectable: false,
    // Entrée / sortie du sous-processus reliables (poignées du couloir)
    connectable: canEdit,
    // pointerEvents none : un nœud déplaçable capterait tous les clics ; la bande reste transparente (pan, double-clic),
    // seul son titre (pointer-events: auto) les reçoit
    style: { width: l.width, height: l.height, pointerEvents: 'none' as const },
    data: {
      laneId: l.id, item: lanes.find((x) => x.id === l.id)!.item, width: l.width, height: l.height, colorIndex: index,
      canEdit, isFirst: index === 0, isLast: index === laneLayout.lanes.length - 1,
      collapsed: l.collapsed,
      memberCount: placed.filter((p) => p.laneId === l.id).length,
      onToggleCollapse: toggleLaneCollapse,
      onOpen: openById,
      onMoveUp: (id: string) => moveLane(id, -1),
      onMoveDown: (id: string) => moveLane(id, 1),
      onRemove: removeLaneKeepingMembers,
    },
  })), [laneLayout, lanes, canEdit, placed, toggleLaneCollapse, openById, moveLane, removeLaneKeepingMembers]);

  const itemNodes = useMemo<ProcessFlowNode[]>(() => placed.filter((p) => !isHidden(p)).map(({ item, x, y, laneId }) => {
    const dimmed = (highlightType ? !matchesType(highlightType, item.type) : false)
      || (highlightStatus ? !matchesStatus(highlightStatus, item.status ?? undefined) : false)
      || (searchMatchIds ? !searchMatchIds.has(item.id) : false);
    const menuGroups: ItemActionGroup[] = [
      ...(item.canOpen ? [{ actions: [{ id: 'process-open', label: 'Ouvrir', icon: ExternalLink, onClick: () => openById(item.id) }] }] : []),
      ...(canEdit ? [{ actions: [
        ...(item.available ? [{ id: 'process-lane', label: 'Définir comme couloir', icon: Rows3, onClick: () => makeLane(item.id) }] : []),
        { id: 'process-remove', label: 'Retirer du process', icon: Undo2, onClick: () => remove(item.id) },
      ] }] : []),
    ];
    return {
      id: item.id,
      type: 'process',
      position: { x, y },
      ...(laneId ? { parentId: laneNodeId(laneId) } : {}),
      data: {
        item, dimmed, canEdit: canEdit && item.available, menuGroups,
        statusHex: tailwindBgToHex(getStatusColor(item.status ?? undefined, statuses)),
      },
    };
  }), [placed, isHidden, canEdit, highlightType, highlightStatus, searchMatchIds, statuses, remove, makeLane, openById]);

  // Les couloirs (groupes) doivent précéder leurs membres dans la liste xyflow
  const derivedNodes = useMemo<CanvasNode[]>(() => [...laneNodes, ...itemNodes], [laneNodes, itemNodes]);
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<CanvasNode>(derivedNodes);
  useEffect(() => { setNodes(derivedNodes); }, [derivedNodes, setNodes]);
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    // Pas de suppression au clavier : retirer passe par le menu, supprimer par la fiche de l'élément
    onNodesChangeBase(changes.filter((c) => c.type !== 'remove'));
  }, [onNodesChangeBase]);

  // Fin de glisser : le couloir sous le centre du nœud le reçoit (x/y relatifs), sinon il devient libre
  // Couloir glissé par son titre : nouvelle position libre (ses membres, relatifs, suivent)
  const onNodeDragStop = useCallback((_e: unknown, node: CanvasNode) => {
    if (node.type === 'lane') {
      moveLanes([{ id: node.id.replace(/^lane-/, ''), x: node.position.x, y: node.position.y }]);
      return;
    }
    const o = laneOrigin(node.parentId?.replace(/^lane-/, ''));
    const stored = toStored({ x: node.position.x + o.x, y: node.position.y + o.y });
    move(node.id, stored.x, stored.y, stored.laneId);
  }, [move, toStored, laneOrigin, moveLanes]);

  // Dépôt d'un élément glissé depuis le panneau
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
    const stored = toStored({ x: pos.x - PROCESS_NODE_WIDTH / 2, y: pos.y - PROCESS_NODE_HEIGHT / 2 });
    void tryPlaceNew(itemId, stored.x, stored.y, stored.laneId);
  }, [canEdit, tryPlaceNew, screenToFlowPosition, toStored]);

  // Double-clic sur le vide ou dans un couloir : nouvel élément posé au point cliqué (dans le couloir le cas échéant)
  const onCanvasDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if (!canEdit || !onCreateNote) return;
    const target = e.target as HTMLElement;
    if (!target.classList.contains('react-flow__pane') && !target.closest('[data-lane-body]')) return;
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const stored = toStored(pos);
    const created = await onCreateNote();
    void tryPlaceNew(created.id, stored.x, stored.y, stored.laneId);
  }, [canEdit, onCreateNote, tryPlaceNew, screenToFlowPosition, toStored]);

  // « Ajouter d'un autre espace » : élément choisi posé au centre de la vue (libre ou dans le couloir sous ce point)
  const [pickerOpen, setPickerOpen] = useState(false);
  const centerOfView = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const pos = rect ? screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }) : { x: 0, y: 0 };
    return toStored({ x: pos.x - PROCESS_NODE_WIDTH / 2, y: pos.y - PROCESS_NODE_HEIGHT / 2 });
  }, [screenToFlowPosition, toStored]);
  const pickElsewhere = useCallback(async (itemId: string) => {
    const at = centerOfView();
    if (await tryPlaceNew(itemId, at.x, at.y, at.laneId)) setPickerOpen(false);
  }, [centerOfView, tryPlaceNew]);

  // « Réorganiser en processus » : seule disposition automatique, appliquée directement (décision Thomas 2026-10-21 :
  // pas de confirmation) ; remplace la disposition partagée
  const reorganize = useCallback(() => {
    placeMany(layoutAsProcess(placed, relations, lanes));
    // Couloirs déplacés remis dans la pile (layoutAsProcess range comme si c'était déjà fait)
    const moved = lanes.filter((l) => l.x != null || l.y != null);
    if (moved.length) moveLanes(moved.map((l) => ({ id: l.id, x: null, y: null })));
    setTimeout(() => fitView({ maxZoom: 1, duration: 300 }), 50);
  }, [placeMany, placed, relations, lanes, moveLanes, fitView]);

  // Clic sur un élément : ouvre sa fiche (même geste que la MindMap), s'il est ouvrable
  const onNodeClick = useCallback((e: React.MouseEvent, node: CanvasNode) => {
    if (node.type !== 'process' || (e.target as HTMLElement).closest('.nodrag')) return;
    openById(node.id);
  }, [openById]);

  // Relations : passent par l'espace de l'élément source, connu seulement si le lecteur peut l'ouvrir
  const sourceSpaceOf = useCallback((id: string) => itemById.get(id)?.spaceId ?? null, [itemById]);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  // Une extrémité « couloir » (lane-<id>) désigne l'élément du couloir : la relation est créée avec lui
  const laneItemByNodeId = useMemo(() => new Map(lanes.map((l) => [laneNodeId(l.id), l.itemId])), [lanes]);
  const onConnect = useCallback((c: Connection) => {
    const source = c.source ? laneItemByNodeId.get(c.source) ?? c.source : null;
    const target = c.target ? laneItemByNodeId.get(c.target) ?? c.target : null;
    if (!source || !target || source === target) return;
    if (!sourceSpaceOf(source)) { setNotice(PH.relationBlocked); return; }
    setPendingConnection({ source, target });
  }, [laneItemByNodeId, sourceSpaceOf]);

  const [editingEdge, setEditingEdge] = useState<{ relationId: string; source: string; target: string; type: string; label: string } | null>(null);
  const onEdgeClick = useCallback((_e: React.MouseEvent, edge: Edge) => {
    // Flèche d'une réponse de Question : ce n'est pas une relation
    if (!canEdit || (edge.data as { choice?: boolean } | undefined)?.choice) return;
    // Vrais éléments de la relation (source / target de l'arête peuvent être un couloir)
    const d = edge.data as { relationId: string; type: string; label: string; fromItemId: string; toItemId: string };
    if (!sourceSpaceOf(d.fromItemId)) { setNotice(PH.relationBlocked); return; }
    setEditingEdge({ relationId: d.relationId, source: d.fromItemId, target: d.toItemId, type: d.type, label: d.label });
  }, [canEdit, sourceSpaceOf]);

  if (isError) {
    return <div className="p-6 text-sm text-muted-foreground">{PH.notFound}</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0" id="view-header" data-devzone="contenu-barre-vue">
        {onBack && (
          <HelpHint text={PH.back}>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Tous les process</span>
            </button>
          </HelpHint>
        )}
        {/* Titre = retour à la fiche de l'élément Process (signalement cmwqhjvuf000n7icc1phb14fg, 2026-11-21) */}
        {processTitle && (onOpenProcess ? (
          <HelpHint text={PH.openProcessSheet}>
            <button type="button" onClick={onOpenProcess} data-tour="process-title"
              className="min-w-0 truncate text-sm font-semibold px-1 rounded hover:bg-accent hover:underline">{processTitle}</button>
          </HelpHint>
        ) : <span className="min-w-0 truncate text-sm font-semibold px-1" data-tour="process-title">{processTitle}</span>)}
        {canEdit && (
          <HelpHint text={PH.reorganize}>
            <button
              type="button"
              onClick={reorganize}
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
      {notice && (
        <div className="flex items-start gap-2 px-3 py-1.5 text-xs border-b border-border bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" role="status">
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">Fermer</button>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
        <ProcessUnplacedPanel items={unplaced} canEdit={canEdit} onMakeLane={makeLane} onSearchElsewhere={() => setPickerOpen(true)} />
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
            edgeTypes={EDGE_TYPES}
            onNodesChange={onNodesChange}
            onNodeDragStop={onNodeDragStop}
            onNodeClick={onNodeClick}
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
          {!isLoading && placed.length === 0 && lanes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <EmptyHelp mode="process" title="Process vide" className="max-w-sm p-6 text-center" />
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} title="Ajouter d'un autre espace" devName="ProcessView/AddElsewhere">
        <p className="text-xs text-muted-foreground mb-2">{PH.searchElsewhereIntro}</p>
        <ItemSearchPicker
          spaceId={spaceId}
          defaultScope="community"
          excludeIds={takenIds}
          actionLabel="Poser"
          autoFocus
          onPick={(hit) => pickElsewhere(hit.id)}
        />
      </Modal>
      <ConfirmModal
        isOpen={!!lessVisible}
        onClose={() => setLessVisible(null)}
        onConfirm={() => {
          if (!lessVisible) return;
          const p = lessVisible;
          setLessVisible(null);
          void tryPlaceNew(p.itemId, p.x, p.y, p.laneId, true).then((ok) => { if (ok) setPickerOpen(false); });
        }}
        title="Élément moins visible"
        message={PH.lessVisible}
        confirmLabel="Poser quand même"
        confirmVariant="default"
      />
      {pendingConnection && (
        <RelationCreateDialog
          source={relationEnd(pendingConnection.source)}
          target={relationEnd(pendingConnection.target)}
          statusOptions={statuses}
          onSelect={(type, label) => {
            const sourceSpaceId = sourceSpaceOf(pendingConnection.source);
            if (sourceSpaceId) createRelation({ sourceSpaceId, fromId: pendingConnection.source, toId: pendingConnection.target, type, label });
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
            const sourceSpaceId = sourceSpaceOf(editingEdge.source);
            if (sourceSpaceId) updateRelation({ sourceSpaceId, itemId: editingEdge.source, relationId: editingEdge.relationId, data: { type, label: label || null } });
            setEditingEdge(null);
          }}
          onDelete={() => {
            const sourceSpaceId = sourceSpaceOf(editingEdge.source);
            if (sourceSpaceId) deleteRelation({ sourceSpaceId, itemId: editingEdge.source, relationId: editingEdge.relationId });
            setEditingEdge(null);
          }}
          onCancel={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}
