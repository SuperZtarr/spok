/*
 * Vue Loupe : explorer les items à travers leurs liens (parent, enfants, relations), y compris vers d'autres espaces.
 * Gestes : survol (ouverture après 0,1 s, fermeture immédiate, décision Thomas 2026-11-06) = zoom sur l'item et zoom intermédiaire sur ses liés ; clic = fige le zoom et ajoute
 * l'item au chemin ; clic sur la vignette figée, bouton « Libérer le zoom » ou Échap = le survol reprend, chemin conservé ; clic sur le fond ou bouton
 * Départ = retour au départ, chemin effacé ; double-clic = fiche ; molette et glisser = déplacer la carte.
 * Aperçu : zoom figé, le survol d'un autre item l'agrandit à mi-taille sans déplacer la carte ni charger ses liens.
 * Menu ⋮ : seulement sur la vignette zoomée (décision Thomas 2026-11-06). Le zoom reste figé tant que le menu est ouvert.
 * Autre espace : un item n'apparaît qu'en suivant un lien, avec le nom de son espace, et seulement si l'API le renvoie
 * (droit de lecture vérifié côté serveur, GET /:id/links). Son menu se limite aux actions d'ouverture et sa fiche s'ouvre
 * dans un nouvel onglet, pour garder le chemin : les actions de SpacePage sont liées à l'espace courant.
 * Props : items = TOUS les items de l'espace (la vue estompe sans masquer) ; callbacks du menu comme les autres vues.
 * Calculs (positions, liens, chemin) : loupe-scene.ts. Contenu des vignettes par type et taille : loupe-vignette.ts. Textes : help/loupe.help.ts. Zones fragiles : aucune modification
 * de la carte mentale ici, radialLayout est seulement importé.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, RotateCcw, Unlock } from 'lucide-react';
import { DEFAULT_REFERENTIELS, type SpaceReferentiels } from '@spok/shared';
import type { LinkedItem } from '../../lib/api';
import { getRelationMeta } from '../../constants/relationTypes';
import { getTypeIcon, getTypeTextColor } from '../../constants/ui';
import { useItemLinks } from '../../hooks/useItemLinks';
import { EmptyHelp } from '../../help/EmptyHelp';
import { HelpHint } from '../../help/HelpHint';
import { matchesCriteria } from '../../lib/itemHighlight';
import { buildItemMenuGroups, hasChildItems, hasHeadings, type ItemMenuCallbacks } from '../../lib/itemMenuGroups';
import { itemUrl, type ItemOpenMode } from '../../lib/itemOpenMode';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { help } from './help/loupe.help';
import { LoupeVignette } from './LoupeVignette';
import { hasImage, vignetteContent, type VignetteSource } from './loupe-vignette';
import {
  VIGNETTE_SIZES, advanceTrail, buildIndex, buildLocalEdges, collectLocalLinks, computeScene, edgesFromLinks,
  externalPosition, fitMap, levelOf, mergeLinks, orderedLinkedIds, settlePositions, worldPositions,
  type LoupeEdge, type LoupeSourceItem, type MapView, type Point, type SceneNode, type TrailEntry,
} from './loupe-scene';

const HOVER_DELAY_MS = 100;
const TRANSITION_MS = 200;
const DRAG_THRESHOLD_PX = 4;
const MIN_SCALE = 0.05;
const MAX_SCALE = 2;

const TYPE_COLORS: Record<string, string> = {
  NOTE: '#22c55e', TASK: '#f97316', PROJECT: '#3b82f6', MEETING: '#a855f7', PERIOD: '#06b6d4', LINK: '#6366f1',
  CONFIG: '#64748b', DOCUMENT: '#78716c', IMAGE: '#ec4899', BUG: '#ef4444',
};

interface ExternalNode { item: LinkedItem; pos: Point }

interface LoupeViewProps extends ItemMenuCallbacks {
  items: LoupeSourceItem[];
  spaceId: string;
  spaceName?: string;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: any) => boolean;
  highlightType?: string[];
  highlightStatus?: string[];
  searchMatchIds?: Set<string>;
}

export function LoupeView(props: LoupeViewProps) {
  const { items, spaceId, spaceName, referentiels, canEdit, canEditItem, highlightType, highlightStatus, searchMatchIds, ...menuCallbacks } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const lineRefs = useRef(new Map<string, SVGLineElement>());
  const labelRefs = useRef(new Map<string, SVGTextElement>());
  const previousScene = useRef<Map<string, SceneNode>>(new Map());
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpen = useRef(false);
  const pointerOver = useRef<string | null>(null);
  const drag = useRef<{ startX: number; startY: number; viewX: number; viewY: number; moved: boolean } | null>(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapView>({ x: 0, y: 0, k: 1 });
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailEntry[]>([]);
  const [externals, setExternals] = useState<Map<string, ExternalNode>>(() => new Map());
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [remoteEdges, setRemoteEdges] = useState<Map<string, LoupeEdge>>(() => new Map());
  const [interacting, setInteracting] = useState(false);
  /** Les vignettes n'apparaissent qu'une fois la carte cadrée : sinon elles s'animeraient depuis un mauvais cadrage. */
  const [fitted, setFitted] = useState(false);

  const index = useMemo(() => buildIndex(items), [items]);
  const world = useMemo(() => worldPositions(index), [index]);
  const localEdges = useMemo(() => buildLocalEdges(index), [index]);

  const focusId = pinnedId ?? hoverId;
  const focusSpaceId = focusId ? (index.byId.has(focusId) ? spaceId : externals.get(focusId)?.item.spaceId) : undefined;
  const { data: linksData } = useItemLinks(focusSpaceId, focusId);
  const remote = linksData && linksData.item.id === focusId ? linksData : undefined;

  const links = useMemo(() => {
    if (!focusId) return [];
    return mergeLinks(collectLocalLinks(index, focusId, spaceId, spaceName), remote?.links);
  }, [focusId, index, spaceId, spaceName, remote]);
  const linkedIds = useMemo(() => orderedLinkedIds(links), [links]);

  // Taille du cadre
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Mesure immédiate : l'observateur ne se déclenche pas tant que la page est masquée (onglet en arrière-plan)
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [items.length > 0]);

  // Cadrage à l'ouverture
  useEffect(() => {
    if (fitted || size.width === 0 || world.size === 0) return;
    setFitted(true);
    setView(fitMap(world, size.width, size.height));
  }, [fitted, size, world]);

  // Les liens reçus font apparaître les items des autres espaces ; ils restent sur la carte une fois le zoom figé
  useEffect(() => {
    if (!remote || !focusId) return;
    const outside = remote.links.filter((l) => !index.byId.has(l.item.id));
    setExternals((previous) => {
      const fresh = outside.filter((l) => !previous.has(l.item.id));
      const source = world.get(focusId) ?? previous.get(focusId)?.pos;
      if (fresh.length === 0 || !source) return previous;
      const next = new Map(previous);
      fresh.forEach((l, i) => next.set(l.item.id, { item: l.item, pos: externalPosition(source, i, fresh.length) }));
      return next;
    });
    setRemoteEdges((previous) => {
      const fresh = edgesFromLinks(focusId, remote.links).filter((e) => !previous.has(e.id));
      if (fresh.length === 0) return previous;
      const next = new Map(previous);
      fresh.forEach((e) => next.set(e.id, e));
      return next;
    });
    if (focusId === pinnedId && outside.length > 0) {
      setSeen((previous) => {
        if (outside.every((l) => previous.has(l.item.id))) return previous;
        const next = new Set(previous);
        outside.forEach((l) => next.add(l.item.id));
        return next;
      });
    }
  }, [remote, focusId, pinnedId, index, world]);

  // Externes visibles : parcourus, ou liés à l'item zoomé
  const visibleExternals = useMemo(() => {
    const ids = new Set(seen);
    if (focusId && externals.has(focusId)) ids.add(focusId);
    linkedIds.forEach((id) => { if (externals.has(id)) ids.add(id); });
    return ids;
  }, [seen, focusId, linkedIds, externals]);

  const positions = useMemo(() => {
    const all = new Map(world);
    visibleExternals.forEach((id) => {
      const external = externals.get(id);
      if (external) all.set(id, external.pos);
    });
    return all;
  }, [world, visibleExternals, externals]);

  const tallIds = useMemo(() => {
    const ids = new Set<string>();
    items.forEach((item) => { if (hasImage(item.type, item.url)) ids.add(item.id); });
    externals.forEach(({ item }) => { if (hasImage(item.type, item.url)) ids.add(item.id); });
    return ids;
  }, [items, externals]);

  // L'écartement ne porte que sur l'espace courant et ne dépend que de l'échelle : ni le survol ni le déplacement de la
  // carte ne le relancent (calcul coûteux, il saturait l'interface sur un grand espace). Les autres espaces s'y ajoutent.
  const settledWorld = useMemo(() => settlePositions(world, view.k), [world, view.k]);
  const settled = useMemo(() => {
    if (visibleExternals.size === 0) return settledWorld;
    const all = new Map(settledWorld);
    visibleExternals.forEach((id) => {
      const external = externals.get(id);
      if (external) all.set(id, { x: external.pos.x * view.k, y: external.pos.y * view.k });
    });
    return all;
  }, [settledWorld, visibleExternals, externals, view.k]);

  const scene = useMemo(
    () => computeScene({ positions: settled, offset: { x: view.x, y: view.y }, width: size.width, height: size.height, focusId, linkedIds, previewId, tallIds }),
    [settled, view.x, view.y, size, focusId, linkedIds, previewId, tallIds],
  );

  const edges = useMemo(() => {
    const all = new Map<string, LoupeEdge>();
    localEdges.forEach((e) => all.set(e.id, e));
    remoteEdges.forEach((e) => all.set(e.id, e));
    return [...all.values()].filter((e) => scene.has(e.from) && scene.has(e.to));
  }, [localEdges, remoteEdges, scene]);

  // Les traits suivent les vignettes pendant leur animation : lecture des positions réelles, image par image, mais
  // seulement pour les traits d'une vignette qui a changé ou d'un trait neuf (tout relire saturait un grand espace)
  useLayoutEffect(() => {
    let frame = 0;
    const start = performance.now();
    const previous = previousScene.current;
    const changed = (id: string) => {
      const before = previous.get(id);
      const now = scene.get(id);
      return !before || !now || before.cx !== now.cx || before.cy !== now.cy || before.size !== now.size;
    };
    const moving = edges.filter((edge) => !lineRefs.current.get(edge.id)?.hasAttribute('x1') || changed(edge.from) || changed(edge.to));
    previousScene.current = scene;
    const update = () => {
      const box = containerRef.current?.getBoundingClientRect();
      if (box) {
        for (const edge of moving) {
          const line = lineRefs.current.get(edge.id);
          const from = nodeRefs.current.get(edge.from)?.getBoundingClientRect();
          const to = nodeRefs.current.get(edge.to)?.getBoundingClientRect();
          if (!line || !from || !to) continue;
          const x1 = from.left + from.width / 2 - box.left;
          const y1 = from.top + from.height / 2 - box.top;
          const x2 = to.left + to.width / 2 - box.left;
          const y2 = to.top + to.height / 2 - box.top;
          line.setAttribute('x1', String(x1));
          line.setAttribute('y1', String(y1));
          line.setAttribute('x2', String(x2));
          line.setAttribute('y2', String(y2));
          const label = labelRefs.current.get(edge.id);
          if (label) {
            label.setAttribute('x', String((x1 + x2) / 2));
            label.setAttribute('y', String((y1 + y2) / 2 - 4));
          }
        }
      }
      if (moving.length > 0 && !interacting && performance.now() - start < TRANSITION_MS + 80) frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [edges, scene, interacting]);

  const clearHoverTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  const scheduleHover = (id: string) => {
    if (menuOpen.current) return;
    clearHoverTimer();
    if (pinnedId) {
      if (id !== pinnedId) hoverTimer.current = setTimeout(() => setPreviewId(id), HOVER_DELAY_MS);
      return;
    }
    hoverTimer.current = setTimeout(() => setHoverId(id), HOVER_DELAY_MS);
  };

  useEffect(() => clearHoverTimer, []);

  // L'aperçu n'a de sens que pour le zoom figé en cours
  useEffect(() => setPreviewId(null), [pinnedId]);

  // Le menu ⋮ est en portail : tant qu'il est ouvert, le survol ne change rien
  const handleMenuOpenChange = useCallback((open: boolean) => {
    const wasOpen = menuOpen.current;
    menuOpen.current = open;
    if (wasOpen && !open && pointerOver.current === null) setHoverId(null);
  }, []);

  const describe = (id: string): TrailEntry | null => {
    const local = index.byId.get(id);
    if (local) return { id, title: local.title };
    const external = externals.get(id);
    return external ? { id, title: external.item.title, spaceName: external.item.spaceName } : null;
  };

  const pin = (id: string) => {
    const entry = describe(id);
    if (!entry) return;
    clearHoverTimer();
    setHoverId(null);
    setPinnedId(id);
    setTrail((current) => advanceTrail(current, entry));
    if (externals.has(id)) setSeen((previous) => (previous.has(id) ? previous : new Set(previous).add(id)));
  };

  const releaseZoom = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    // Souris encore sur une vignette : elle reste zoomée comme au survol, jusqu'à ce que la souris la quitte
    setHoverId(pointerOver.current);
    setPinnedId(null);
  }, []);

  // Échap libère le zoom, sauf si la touche sert déjà à fermer le menu ⋮ ou une fiche ouverte
  useEffect(() => {
    if (!pinnedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !menuOpen.current && !document.querySelector('[role="dialog"]')) releaseZoom();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [pinnedId, releaseZoom]);

  const togglePin = (id: string) => {
    if (id === pinnedId) releaseZoom();
    else pin(id);
  };

  const resetExploration = () => {
    clearHoverTimer();
    menuOpen.current = false;
    setHoverId(null);
    setPinnedId(null);
    setTrail([]);
    setSeen(new Set());
  };

  const openExternal = (id: string, mode?: ItemOpenMode) => {
    const external = externals.get(id);
    if (external) window.open(itemUrl(external.item.spaceId, id, mode), '_blank');
  };

  const openItem = (id: string) => {
    if (index.byId.has(id)) menuCallbacks.onEdit?.(id);
    else openExternal(id);
  };

  // Déplacer la carte au glisser ; un clic sans déplacement sur le fond revient au départ
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { startX: event.clientX, startY: event.clientY, viewX: view.x, viewY: view.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!current.moved) {
      current.moved = true;
      setInteracting(true);
    }
    setView((v) => ({ ...v, x: current.viewX + dx, y: current.viewY + dy }));
  };

  const handlePointerUp = () => {
    const current = drag.current;
    drag.current = null;
    if (!current) return;
    if (current.moved) setInteracting(false);
    else resetExploration();
  };

  // Molette : écouteur natif, le zoom autour du curseur doit empêcher le défilement de la page
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = el.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      setInteracting(true);
      setView((v) => {
        const k = Math.max(MIN_SCALE, Math.min(MAX_SCALE, v.k * Math.exp(-event.deltaY * 0.0015)));
        return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
      });
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => setInteracting(false), 150);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      if (wheelTimer.current) clearTimeout(wheelTimer.current);
    };
  }, [items.length > 0]);

  const statuses = referentiels?.statuses ?? DEFAULT_REFERENTIELS.statuses;
  const statusOptions = useMemo(() => statuses.filter((s) => s.visible).sort((a, b) => a.order - b.order), [statuses]);
  const hasCriteria = !!highlightType || !!highlightStatus || !!searchMatchIds;

  const matchesActiveCriteria = (id: string, type: string, status: string | null | undefined) => {
    const byCriteria = !highlightType && !highlightStatus ? true : matchesCriteria(highlightType, highlightStatus, type, status);
    return byCriteria && (!searchMatchIds || searchMatchIds.has(id));
  };

  const menuGroups = (id: string) => {
    const item = index.byId.get(id) as (LoupeSourceItem & { description?: string | null }) | undefined;
    if (!item) {
      return buildItemMenuGroups(id, { onOpen: openExternal, onOpenInNewTab: (target) => openExternal(target) }, { canEdit: false });
    }
    return buildItemMenuGroups(id, {
      ...menuCallbacks,
      onAbsorbChildren: hasChildItems(item) || index.children.has(id) ? menuCallbacks.onAbsorbChildren : undefined,
      onSplitDescription: hasHeadings(item.description) ? menuCallbacks.onSplitDescription : undefined,
    }, {
      canEdit: canEditItem ? canEditItem(item) : canEdit,
      statusOptions,
      currentStatusId: item.status || undefined,
      itemSpaceId: spaceId,
    });
  };

  if (items.length === 0) {
    return <EmptyHelp mode="loupe" title="Aucun élément à explorer" />;
  }

  const renderNode = (id: string, isFirst: boolean) => {
    const node = scene.get(id);
    const local = index.byId.get(id);
    const external = externals.get(id)?.item;
    const data = local ?? external;
    if (!node || !data) return null;

    const { w, h } = VIGNETTE_SIZES[node.size];
    const level = levelOf(node.size);
    const typeLabel = referentiels?.typeLabels?.[data.type]?.label ?? data.type;
    const statusLabel = data.status && data.status !== 'undefined' ? statuses.find((s) => s.id === data.status)?.label ?? data.status : null;
    const matches = hasCriteria && matchesActiveCriteria(id, data.type, data.status);
    const fadedByCriteria = hasCriteria && !matches && node.state !== 'focus' && node.state !== 'preview';
    const source: VignetteSource = local
      ? {
          ...local,
          assigneeName: local.assignedTo?.name ?? local.assignedToName,
          childCount: index.children.get(id)?.length ?? 0,
        }
      : { ...external!, description: remote?.item.id === id ? remote.item.description : undefined };

    return (
      <div
        key={id}
        ref={(el) => {
          if (el) nodeRefs.current.set(id, el);
          else nodeRefs.current.delete(id);
        }}
        role="button"
        tabIndex={0}
        aria-label={data.title}
        {...(isFirst ? { 'data-tour': 'loupe-node', 'data-help-zone': 'loupe:vignette' } : {})}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseEnter={() => {
          pointerOver.current = id;
          scheduleHover(id);
        }}
        onMouseLeave={() => {
          pointerOver.current = null;
          if (menuOpen.current) return;
          clearHoverTimer();
          if (pinnedId) setPreviewId(null);
          else setHoverId(null);
        }}
        onClick={(event) => {
          event.stopPropagation();
          togglePin(id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          openItem(id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') togglePin(id);
        }}
        style={{
          width: w,
          height: h,
          transform: `translate(${node.cx - w / 2}px, ${node.cy - h / 2}px)`,
          borderLeftColor: TYPE_COLORS[data.type] ?? '#6b7280',
          opacity: node.state === 'dim' ? 0.2 : fadedByCriteria ? 0.35 : 1,
          zIndex: node.state === 'preview' ? 40 : node.state === 'focus' ? 30 : level === 'mid' ? 20 : node.state === 'linked' ? 15 : 10,
        }}
        className={[
          'absolute left-0 top-0 overflow-hidden cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-primary',
          interacting ? '' : 'transition-[transform,width,height,opacity] duration-200 ease-out',
          'rounded-md border border-l-4 text-foreground',
          external ? 'border-dashed border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'border-border bg-card',
          node.state === 'focus' ? 'shadow-xl p-3' : level === 'mid' ? 'shadow-sm px-2 py-1' : 'px-1.5 py-0.5',
          pinnedId === id ? 'ring-2 ring-primary' : '',
          matches ? 'ring-2 ring-amber-400' : '',
        ].join(' ')}
      >
        <LoupeVignette
          level={level}
          title={data.title}
          Icon={getTypeIcon(data.type, data.url)}
          iconClass={getTypeTextColor(data.type, referentiels?.typeLabels)}
          spaceName={external?.spaceName}
          content={vignetteContent(source, level, { type: typeLabel, status: statusLabel })}
          openHint={help.hints?.openLink}
          menu={level === 'big' ? <ItemActionMenu groups={menuGroups(id)} onOpenChange={handleMenuOpenChange} /> : undefined}
        />
      </div>
    );
  };

  const renderedIds = [...index.byId.keys(), ...[...visibleExternals].filter((id) => !index.byId.has(id))];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div
        data-tour="loupe-trail"
        data-help-zone="loupe:chemin"
        className="flex min-h-[38px] flex-shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-muted/30 px-3 py-1 text-xs"
      >
        {trail.length === 0 && <span className="text-muted-foreground">{help.hints?.trailEmpty}</span>}
        {trail.map((entry, i) => (
          <div key={entry.id} className="flex flex-shrink-0 items-center gap-1">
            {i > 0 && <span className="text-muted-foreground">›</span>}
            <button
              type="button"
              onClick={() => pin(entry.id)}
              className={`h-6 max-w-[220px] truncate rounded border px-2 ${entry.id === pinnedId ? 'border-primary bg-primary text-primary-foreground' : 'border-input hover:bg-accent'}`}
            >
              {entry.spaceName ? `${entry.spaceName} / ${entry.title}` : entry.title}
            </button>
          </div>
        ))}
        <div className="flex-1" />
        {pinnedId && (
          <HelpHint text={help.hints?.release} className="inline-flex flex-shrink-0">
            <button
              type="button"
              data-tour="loupe-release"
              onClick={releaseZoom}
              className="inline-flex h-7 items-center gap-1 rounded border border-input px-2 font-medium text-foreground transition-colors hover:bg-accent"
            >
              <Unlock className="h-3.5 w-3.5" />
              Libérer le zoom
            </button>
          </HelpHint>
        )}
        {trail.length > 0 && (
          <HelpHint text={help.hints?.reset} className="inline-flex flex-shrink-0">
            <button type="button" onClick={resetExploration} className="inline-flex h-7 items-center gap-1 rounded px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Départ</span>
            </button>
          </HelpHint>
        )}
        <HelpHint text={help.hints?.fit} className="inline-flex flex-shrink-0">
          <button
            type="button"
            data-tour="loupe-fit"
            onClick={() => setView(fitMap(positions, size.width, size.height))}
            className="inline-flex h-7 items-center gap-1 rounded px-2 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ajuster</span>
          </button>
        </HelpHint>
      </div>

      <div
        ref={containerRef}
        data-tour="loupe-map"
        data-help-zone="loupe:carte"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative min-h-0 flex-1 touch-none overflow-hidden bg-background ${interacting ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {edges.map((edge) => {
            const touchesFocus = !!focusId && (edge.from === focusId || edge.to === focusId);
            const meta = edge.kind === 'relation' ? getRelationMeta(edge.relationType) : null;
            return (
              <g key={edge.id}>
                <line
                  ref={(el) => {
                    if (el) lineRefs.current.set(edge.id, el);
                    else lineRefs.current.delete(edge.id);
                  }}
                  stroke={meta ? meta.hex : '#94a3b8'}
                  strokeWidth={touchesFocus ? 2 : 1}
                  strokeDasharray={meta ? '5 4' : undefined}
                  opacity={!focusId ? 0.55 : touchesFocus ? 1 : 0.07}
                />
                {meta && touchesFocus && (
                  <text
                    ref={(el) => {
                      if (el) labelRefs.current.set(edge.id, el);
                      else labelRefs.current.delete(edge.id);
                    }}
                    fontSize={11}
                    fill={meta.hex}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: 'var(--background, transparent)', strokeWidth: 3 }}
                  >
                    {meta.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {fitted && renderedIds.map((id, i) => renderNode(id, i === 0))}
      </div>
    </div>
  );
}
