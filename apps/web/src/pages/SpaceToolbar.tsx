/*
 * Barre d'outils d'espace : sélecteur de vues, filtres, highlight, tri, création.
 * Les vues (spaceViews, filtrées par niveau d'accès via useMenuItems) sont réparties en 3 familles
 * fixes — Discussion/Pilotage/Exploration (cf. getViewGroup) — le mode d'interface courant
 * (forum/projet/tous) choisit la famille affichée en boutons directs (MODE_PRIMARY_GROUP) ;
 * les 2 autres familles restent accessibles via le dropdown "Autres vues", jamais masquées.
 * Mode JDR : liste de vues choisie (MODE_PRIMARY_VIEWS, ordre imposé) au lieu d'une famille ; le reste par
 * famille dans « Autres vues ».
 * liveSessionsSlot : bouton « Séances » (ParentSessionsButton) fourni par SpacePage, rendu avant le compteur ;
 * liveSessionBarSlot : bandeau de séance (LiveSessionBar) fourni par SpacePage dans un espace de séance, rendu en
 * 3e ligne sous les filtres (décision Thomas 2026-10-11 : dans la toolbar, pas entre la toolbar et la vue) ;
 * la barre d'outils ne connaît pas la logique des séances live.
 * Aide : chaque commande est enveloppée d'un HelpHint (textes dans help/spaceToolbar.hints.ts) — jamais de `title`
 * natif (contrôlé par help/coverage.test.ts) ; repères data-tour toolbar-* pour les étapes communes des tours.
 * Zones data-devzone toolbar-vues/ordre/filtre/apercu/actions : vocabulaire de DevZoneInspector ET zones du mode Aide
 * (textes : help/shellZones.ts).
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  Search,
  X,
  Settings,
  History,
  SlidersHorizontal,
  List,
  GitBranch,
  Columns3,
  FileText,
  CalendarCheck,
  GanttChart,
  Calendar,
  LayoutGrid,
  Share2,
  Network,
  CircleDot,
  Waypoints,
  Circle,
  Orbit,
  SquareStack,
  Disc,
  TrendingDown,
  Layers,
  Users,
  Flame,
  Table2,
  Grid3x3,
  Focus,
  ExternalLink,
  Image,
  Bug,
  CheckSquare,
  MessageSquare,
  Clock,
  ArrowUpDown,
  GitMerge,
  Workflow,
  LayoutTemplate,
  type LucideIcon,
} from 'lucide-react';
import type { ItemType, MenuItemConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS, VIEW_REGISTRY } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';
import type { ViewMode } from '../stores/viewMode';
import { useInterfaceModeStore } from '../stores/interfaceMode';
import type { TreeSort } from '../lib/treeSort';
import { HelpHint } from '../help/HelpHint';
import { SPACE_TOOLBAR_HINTS as H } from '../help/spaceToolbar.hints';
import { VIEW_HELP } from '../components/views/help';

/**
 * Vues d'espace groupées en 3 familles fixes (Discussion/Pilotage/Exploration).
 * Le mode d'interface (forum/projet/tous) choisit quelle famille s'affiche en boutons directs —
 * les 2 autres passent dans des menus déroulants repliés (voir MODE_PRIMARY_GROUP ci-dessous).
 * `exploration` reprend telle quelle la catégorie `exploration` de VIEW_REGISTRY.
 */
type ViewGroupKey = 'discussion' | 'pilotage' | 'exploration';

const DISCUSSION_VIEWS = new Set(['thread', 'recent', 'text']);
const EXPLORATION_VIEWS = new Set(VIEW_REGISTRY.filter((v) => v.category === 'exploration').map((v) => v.id));

function getViewGroup(viewMode: string): ViewGroupKey {
  if (DISCUSSION_VIEWS.has(viewMode)) return 'discussion';
  if (EXPLORATION_VIEWS.has(viewMode)) return 'exploration';
  return 'pilotage';
}

const VIEW_GROUP_LABELS: Record<ViewGroupKey, string> = {
  discussion: 'Discussion',
  pilotage: 'Pilotage',
  exploration: 'Exploration',
};

const VIEW_GROUP_ICONS: Record<ViewGroupKey, LucideIcon> = {
  discussion: MessageSquare,
  pilotage: LayoutGrid,
  exploration: Network,
};

/** Famille affichée en direct par mode — null = aucune restriction (toutes les vues à plat, comme aujourd'hui) */
const MODE_PRIMARY_GROUP: Record<string, ViewGroupKey | null> = {
  forum:       'discussion',
  projet:      'pilotage',
  exploration: null,
  tous:        null,
};

/**
 * Modes à liste de vues choisie (au lieu d'une famille) : ces vues, dans cet ordre, en boutons directs ;
 * toutes les autres restent dans « Autres vues » (par famille). JDR : décision Thomas 2026-10-13.
 */
export const MODE_PRIMARY_VIEWS: Record<string, string[]> = {
  jdr: ['list', 'thread', 'mindmap', 'images', 'documents', 'links', 'recent'],
};
export const MODE_PRIMARY_VIEWS_LABEL: Record<string, string> = { jdr: 'Vues JDR' };

/** Vues en boutons directs pour un mode à liste choisie, dans l'ordre de la liste (vues inaccessibles ignorées). */
export function curatedPrimaryViews<T extends { viewMode?: string | null }>(views: T[], mode: string): T[] | null {
  const ids = MODE_PRIMARY_VIEWS[mode];
  if (!ids) return null;
  return ids.map((id) => views.find((v) => v.viewMode === id)).filter((v): v is T => !!v);
}

const MOBILE_HIDDEN_VIEWS = new Set([
  'kanban', 'types', 'members',
  'timeline', 'planning', 'graph', 'sunburst', 'relations',
  'bubble', 'radialTree', 'treemap', 'burndown', 'cfd', 'chord',
  'crossTable', 'heatmap', 'ego', 'process',
]);

const VIEW_ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock, GitMerge, Workflow,
};

export interface SpaceToolbarProps {
  // Filtre block
  filter: ItemType | 'ALL';
  onFilterChange: (filter: ItemType | 'ALL') => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  // Highlight block
  highlightFilter: ItemType | 'ALL';
  onHighlightFilterChange: (filter: ItemType | 'ALL') => void;
  highlightStatus: string;
  onHighlightStatusChange: (status: string) => void;
  highlightSearch: string;
  onHighlightSearchChange: (q: string) => void;
  // Counts
  totalItemCount: number;
  filteredItemCount: number;
  searchMatchCount?: number;
  // Referentiels
  referentiels?: any;
  // View mode
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
  allowedViews: ViewMode[] | null;
  spaceViews: MenuItemConfig[];
  defaultView?: ViewMode;
  // Ordre
  treeSort: TreeSort;
  onTreeSortChange: (sort: TreeSort) => void;
  // Actions
  canEdit: boolean;
  onNewItem?: () => void;
  onInsertTemplate?: () => void;
  // Space
  spaceId?: string;
  spaceRole?: string;
  // Séances live (bouton fourni par SpacePage)
  liveSessionsSlot?: React.ReactNode;
  // Bandeau de séance (LiveSessionBar, espace de séance uniquement) — 3e ligne de la toolbar
  liveSessionBarSlot?: React.ReactNode;
}

export function SpaceToolbar({
  filter,
  onFilterChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchQueryChange,
  highlightFilter,
  onHighlightFilterChange,
  highlightStatus,
  onHighlightStatusChange,
  highlightSearch,
  onHighlightSearchChange,
  totalItemCount,
  filteredItemCount,
  searchMatchCount,
  referentiels,
  viewMode,
  onSetMode,
  allowedViews,
  spaceViews,
  defaultView,
  treeSort,
  onTreeSortChange,
  canEdit,
  onInsertTemplate,
  spaceId,
  spaceRole,
  liveSessionsSlot,
  liveSessionBarSlot,
}: SpaceToolbarProps) {
  const { mode: interfaceMode } = useInterfaceModeStore();
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [hlTypeDropdownOpen, setHlTypeDropdownOpen] = useState(false);
  const [hlStatusDropdownOpen, setHlStatusDropdownOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filtreOpen, setFiltreOpen] = useState(false);
  const [aperçuOpen, setAperçuOpen] = useState(false);
  const [otherGroupOpen, setOtherGroupOpen] = useState<ViewGroupKey | null>(null);
  const [otherGroupPos, setOtherGroupPos] = useState<{ top: number; left: number } | null>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const hlTypeDropdownRef = useRef<HTMLDivElement>(null);
  const hlStatusDropdownRef = useRef<HTMLDivElement>(null);
  const otherGroupsRef = useRef<HTMLDivElement>(null);
  const otherGroupPanelRef = useRef<HTMLDivElement>(null);
  const otherGroupBtnRefs = useRef<Partial<Record<ViewGroupKey, HTMLButtonElement | null>>>({});

  const toggleOtherGroup = (key: ViewGroupKey) => {
    if (otherGroupOpen === key) { setOtherGroupOpen(null); setOtherGroupPos(null); return; }
    const btn = otherGroupBtnRefs.current[key];
    if (btn) {
      const r = btn.getBoundingClientRect();
      setOtherGroupPos({ top: r.bottom + 4, left: r.left });
    }
    setOtherGroupOpen(key);
  };

  const activeTypeFilter = filter !== 'ALL' ? filter : undefined;
  const activeStatusFilter = statusFilter !== 'ALL' ? statusFilter : undefined;
  const activeHlTypeFilter = highlightFilter !== 'ALL' ? highlightFilter : undefined;
  const activeHlStatusFilter = highlightStatus !== 'ALL' ? highlightStatus : undefined;

  const showFiltersForView = true;

  // Close all dropdowns on click outside or Escape
  useEffect(() => {
    if (!typeDropdownOpen && !statusDropdownOpen && !hlTypeDropdownOpen && !hlStatusDropdownOpen && !otherGroupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setTypeDropdownOpen(false);
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false);
      if (hlTypeDropdownOpen && hlTypeDropdownRef.current && !hlTypeDropdownRef.current.contains(e.target as Node)) setHlTypeDropdownOpen(false);
      if (hlStatusDropdownOpen && hlStatusDropdownRef.current && !hlStatusDropdownRef.current.contains(e.target as Node)) setHlStatusDropdownOpen(false);
      if (
        otherGroupOpen
        && otherGroupsRef.current && !otherGroupsRef.current.contains(e.target as Node)
        && otherGroupPanelRef.current && !otherGroupPanelRef.current.contains(e.target as Node)
      ) { setOtherGroupOpen(null); setOtherGroupPos(null); }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTypeDropdownOpen(false); setStatusDropdownOpen(false); setHlTypeDropdownOpen(false); setHlStatusDropdownOpen(false); setOtherGroupOpen(null); setOtherGroupPos(null); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [typeDropdownOpen, statusDropdownOpen, hlTypeDropdownOpen, hlStatusDropdownOpen, otherGroupOpen]);


  return (
    <div data-devzone="toolbar" className={`flex flex-col gap-2 z-20 bg-muted/60 flex-shrink-0 relative ${['list','types','thread','members','recent','text','tree','crossTable','links','images','documents','bugs','todo','kanban','timeline','pert','calendar','planning','graph','sunburst','relations','bubble','radialTree','treemap','burndown','cfd','chord','heatmap','ego','priority','mindmap','process'].includes(viewMode) ? '' : 'mb-3 pb-2'}`}>

      {/* View mode buttons row */}
      {(() => {
        const baseViews = spaceViews.filter(
          (v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode))
        );
        // Mode à liste choisie (JDR) : une seule section ordonnée ; sinon famille principale (forum/projet) ou tout
        const curated = curatedPrimaryViews(baseViews, interfaceMode);
        const primaryGroup = curated ? null : MODE_PRIMARY_GROUP[interfaceMode] ?? null;
        const primaryViews = curated
          ?? (primaryGroup ? baseViews.filter((v) => getViewGroup(v.viewMode!) === primaryGroup) : baseViews);

        const sectionMap = new Map<string, { sectionOrder: number; label?: string; views: typeof primaryViews }>();
        if (curated) {
          sectionMap.set('curated', { sectionOrder: 0, label: MODE_PRIMARY_VIEWS_LABEL[interfaceMode], views: curated });
        } else {
          for (const v of primaryViews) {
            if (!sectionMap.has(v.section)) {
              sectionMap.set(v.section, { sectionOrder: v.sectionOrder, views: [] });
            }
            sectionMap.get(v.section)!.views.push(v);
          }
        }
        const sections = [...sectionMap.values()].sort((a, b) => a.sectionOrder - b.sectionOrder);

        const curatedIds = new Set((curated ?? []).map((v) => v.viewMode));
        const secondaryGroups = curated || primaryGroup
          ? (['discussion', 'pilotage', 'exploration'] as ViewGroupKey[])
              .filter((g) => g !== primaryGroup)
              .map((g) => ({ key: g, views: baseViews.filter((v) => getViewGroup(v.viewMode!) === g && !curatedIds.has(v.viewMode)) }))
              .filter((g) => g.views.length > 0)
          : [];

        if (sections.length === 0 && secondaryGroups.length === 0) return null;
        return (
          <div data-devzone="toolbar-vues" className="flex items-start gap-3 overflow-x-auto pb-0.5 scrollbar-none">
            {sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-0.5 flex-shrink-0">
                <span className="hidden sm:block text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {section.label ?? section.views[0]?.sectionLabel}
                </span>
                <div className="flex items-center gap-0.5">
                  {section.views.map((v) => {
                    const Icon = VIEW_ICON_MAP[v.icon];
                    const isActive = viewMode === v.viewMode;
                    const isDefault = defaultView && v.viewMode === defaultView;
                    const showPulse = isDefault && !isActive;
                    const short = VIEW_HELP[v.viewMode as ViewMode]?.short;
                    return (
                      <HelpHint key={v.key} text={`${v.label}${isDefault ? ` (${H.defaultView})` : ''}${short ? ` : ${short}` : ''}`} className={`inline-flex flex-shrink-0 ${v.viewMode && MOBILE_HIDDEN_VIEWS.has(v.viewMode) ? 'hidden sm:inline-flex' : ''}`}>
                      <button
                        onClick={() => onSetMode(v.viewMode as ViewMode)}
                        aria-label={v.label}
                        className={`relative inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                        } ${v.viewMode && MOBILE_HIDDEN_VIEWS.has(v.viewMode) ? 'hidden sm:inline-flex' : ''}`}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span className="hidden sm:inline">{v.label}</span>
                        {showPulse && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        )}
                      </button>
                      </HelpHint>
                    );
                  })}
                </div>
              </div>
            ))}

            {secondaryGroups.length > 0 && (
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <span className="hidden sm:block text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  Autres vues
                </span>
                <div ref={otherGroupsRef} className="flex items-center gap-1">
                {secondaryGroups.map((group) => {
                  const GroupIcon = VIEW_GROUP_ICONS[group.key];
                  const isOpen = otherGroupOpen === group.key;
                  const containsActive = group.views.some((v) => v.viewMode === viewMode);
                  return (
                    <HelpHint key={group.key} text={`${VIEW_GROUP_LABELS[group.key]} : ${H.otherViews}`}>
                    <button
                      ref={(el) => { otherGroupBtnRefs.current[group.key] = el; }}
                      onClick={() => toggleOtherGroup(group.key)}
                      aria-label={`Autres vues — ${VIEW_GROUP_LABELS[group.key]}`}
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                        containsActive ? 'bg-accent text-foreground font-semibold' : isOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">{VIEW_GROUP_LABELS[group.key]}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    </HelpHint>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Panneau "Autres vues" — en portal (fixed) pour échapper au overflow-x-auto de la barre de vues */}
      {otherGroupOpen && otherGroupPos && (() => {
        // Mode à liste choisie : les vues déjà en boutons directs ne sont pas répétées dans « Autres vues »
        const curatedIds = new Set(MODE_PRIMARY_VIEWS[interfaceMode] ?? []);
        const group = (['discussion', 'pilotage', 'exploration'] as ViewGroupKey[])
          .map((g) => ({ key: g, views: spaceViews.filter((v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode)) && getViewGroup(v.viewMode) === g && !curatedIds.has(v.viewMode)) }))
          .find((g) => g.key === otherGroupOpen);
        if (!group) return null;

        const sectionMap = new Map<string, { sectionOrder: number; sectionLabel: string; views: typeof group.views }>();
        for (const v of group.views) {
          if (!sectionMap.has(v.section)) {
            sectionMap.set(v.section, { sectionOrder: v.sectionOrder, sectionLabel: v.sectionLabel, views: [] });
          }
          sectionMap.get(v.section)!.views.push(v);
        }
        const panelSections = [...sectionMap.values()].sort((a, b) => a.sectionOrder - b.sectionOrder);

        return createPortal(
          <div
            ref={otherGroupPanelRef}
            className="fixed bg-card border border-border rounded-md shadow-xl py-1 w-[190px]"
            style={{ top: otherGroupPos.top, left: otherGroupPos.left, zIndex: 9999 }}
          >
            {panelSections.map((section, idx) => (
              <div key={section.sectionLabel}>
                {idx > 0 && <div className="h-px bg-border mx-2 my-1" />}
                <div className="px-3 pt-1 pb-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {section.sectionLabel}
                </div>
                {section.views.map((v) => {
                  const Icon = VIEW_ICON_MAP[v.icon];
                  const isActive = viewMode === v.viewMode;
                  return (
                    <button
                      key={v.key}
                      onClick={() => { onSetMode(v.viewMode as ViewMode); setOtherGroupOpen(null); setOtherGroupPos(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span className="flex-1 text-left">{v.label}</span>
                      {isActive && <span className="text-primary text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        );
      })()}

      {/* GlobalToolbar */}
      <div id="global-toolbar" className="flex gap-1.5 flex-wrap items-center pb-1">
        <div className={`${showMobileFilters ? 'flex' : 'hidden'} sm:flex gap-1.5 items-center flex-wrap`}>
          {/* === ORDRE === */}
          {(['list', 'tree', 'thread', 'kanban', 'timeline', 'pert'] as const).includes(viewMode as any) && (
            <>
              <div className="flex items-center gap-0.5 flex-shrink-0" data-tour="toolbar-order" data-devzone="toolbar-ordre">
                {([
                  { value: 'manual', label: 'Position', hint: H.orderManual },
                  { value: 'alpha-flat', label: 'A→Z à plat', hint: H.orderAlphaFlat },
                  { value: 'alpha-tree', label: 'A→Z par groupe', hint: H.orderAlphaTree },
                ] as const).map(({ value, label, hint }) => (
                  <HelpHint key={value} text={hint}>
                  <button onClick={() => onTreeSortChange(value)} aria-label={label}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      treeSort === value ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}>
                    <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                  </HelpHint>
                ))}
              </div>
              <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />
            </>
          )}

          {showFiltersForView && <>
            {/* === FILTRE toggle === */}
            {(() => {
              const hasActive = !!(activeTypeFilter || activeStatusFilter || searchQuery);
              return (
                <div className="flex items-center gap-1 flex-shrink-0" data-tour="toolbar-filter" data-devzone="toolbar-filtre">
                  <HelpHint text={H.filter}>
                  <button
                    onClick={() => { setFiltreOpen(v => !v); setAperçuOpen(false); }}
                    aria-label="Filtre"
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      hasActive ? 'bg-accent text-foreground font-semibold' : filtreOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Filtre</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${filtreOpen ? 'rotate-180' : ''}`} />
                  </button>
                  </HelpHint>
                  {filtreOpen && (
                    <div className="flex items-center gap-1">
                      {/* Types */}
                      <div ref={typeDropdownRef} className="relative flex-shrink-0">
                        <HelpHint text={H.filterType}>
                        <button
                          onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); }}
                          className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${
                            activeTypeFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {activeTypeFilter ? TYPE_LABELS[activeTypeFilter] : 'Types'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        </HelpHint>
                        {typeDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[160px]">
                            {(['ALL', 'UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const).map((t) => {
                              const isActive = filter === t;
                              const typeColor = t !== 'ALL' ? getTypeColor(t, referentiels?.typeLabels) : null;
                              return (
                                <button key={t} onClick={() => { onFilterChange(t); setTypeDropdownOpen(false); }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                  {typeColor && <span className={`w-2 h-2 rounded-full ${typeColor.bgHover}`} />}
                                  <span className="flex-1 text-left">{t === 'ALL' ? 'Tous les types' : TYPE_LABELS[t]}</span>
                                  {isActive && t !== 'ALL' && <span className="text-primary text-xs">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Statuts */}
                      <div ref={statusDropdownRef} className="relative flex-shrink-0">
                        {(() => {
                          const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
                          const activeStatus = activeStatusFilter ? statuses.find((s: any) => s.id === activeStatusFilter) : null;
                          const visibleStatuses = statuses.filter((s: any) => s.visible);
                          return (
                            <>
                              <HelpHint text={H.filterStatus}>
                              <button onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeStatus ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {activeStatus ? activeStatus.label : 'Statuts'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              </HelpHint>
                              {statusDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[180px]">
                                  <button onClick={() => { onStatusFilterChange('ALL'); setStatusDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${statusFilter === 'ALL' ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                    <span className="flex-1 text-left">Tous les statuts</span>
                                  </button>
                                  {visibleStatuses.map((s: any) => {
                                    const isActive = statusFilter === s.id;
                                    const dotColor = s.borderColor.split(' ')[1] || s.borderColor.split(' ')[0];
                                    return (
                                      <button key={s.id} onClick={() => { onStatusFilterChange(s.id); setStatusDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                        <span className="flex-1 text-left">{s.label}</span>
                                        {isActive && <span className="text-primary text-xs">✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {/* Recherche */}
                      <div className="relative flex-shrink-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)}
                          className="h-7 w-28 pl-6 pr-6 text-xs border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        {searchQuery && (
                          <HelpHint text={H.clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex">
                            <button type="button" onClick={() => onSearchQueryChange('')} aria-label={H.clearSearch} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          </HelpHint>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />

            {/* === APERÇU toggle === */}
            {(() => {
              const hasActive = !!(activeHlTypeFilter || activeHlStatusFilter || highlightSearch);
              return (
                <div className="flex items-center gap-1 flex-shrink-0" data-tour="toolbar-highlight" data-devzone="toolbar-apercu">
                  <HelpHint text={H.highlight}>
                  <button
                    onClick={() => { setAperçuOpen(v => !v); setFiltreOpen(false); }}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      hasActive ? 'bg-accent text-foreground font-semibold' : aperçuOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    Aperçu
                    <ChevronDown className={`w-3 h-3 transition-transform ${aperçuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  </HelpHint>
                  {aperçuOpen && (
                    <div className="flex items-center gap-1">
                      {/* HL Types */}
                      <div ref={hlTypeDropdownRef} className="relative flex-shrink-0">
                        <HelpHint text={H.highlightType}>
                        <button onClick={() => { setHlTypeDropdownOpen(!hlTypeDropdownOpen); setHlStatusDropdownOpen(false); }}
                          className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeHlTypeFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                          {activeHlTypeFilter ? TYPE_LABELS[activeHlTypeFilter] : 'Types'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${hlTypeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        </HelpHint>
                        {hlTypeDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[160px]">
                            {(['ALL', 'UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM'] as const).map((t) => {
                              const isActive = highlightFilter === t;
                              const typeColor = t !== 'ALL' ? getTypeColor(t, referentiels?.typeLabels) : null;
                              return (
                                <button key={t} onClick={() => { onHighlightFilterChange(t); setHlTypeDropdownOpen(false); }}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                  {typeColor && <span className={`w-2 h-2 rounded-full ${typeColor.bgHover}`} />}
                                  <span className="flex-1 text-left">{t === 'ALL' ? 'Tous les types' : TYPE_LABELS[t]}</span>
                                  {isActive && t !== 'ALL' && <span className="text-primary text-xs">✓</span>}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* HL Statuts */}
                      <div ref={hlStatusDropdownRef} className="relative flex-shrink-0">
                        {(() => {
                          const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
                          const activeHlStatus = activeHlStatusFilter ? statuses.find((s: any) => s.id === activeHlStatusFilter) : null;
                          const visibleStatuses = statuses.filter((s: any) => s.visible);
                          return (
                            <>
                              <HelpHint text={H.highlightStatus}>
                              <button onClick={() => { setHlStatusDropdownOpen(!hlStatusDropdownOpen); setHlTypeDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeHlStatus ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {activeHlStatus ? activeHlStatus.label : 'Statuts'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${hlStatusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              </HelpHint>
                              {hlStatusDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[180px]">
                                  <button onClick={() => { onHighlightStatusChange('ALL'); setHlStatusDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${highlightStatus === 'ALL' ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                    <span className="flex-1 text-left">Tous les statuts</span>
                                  </button>
                                  {visibleStatuses.map((s: any) => {
                                    const isActive = highlightStatus === s.id;
                                    const dotColor = s.borderColor.split(' ')[1] || s.borderColor.split(' ')[0];
                                    return (
                                      <button key={s.id} onClick={() => { onHighlightStatusChange(s.id); setHlStatusDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                                        <span className="flex-1 text-left">{s.label}</span>
                                        {isActive && <span className="text-primary text-xs">✓</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {/* HL Recherche */}
                      <div className="relative flex-shrink-0">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <input type="text" placeholder="Rechercher..." value={highlightSearch} onChange={(e) => onHighlightSearchChange(e.target.value)}
                          className="h-7 w-28 pl-6 pr-6 text-xs border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        {highlightSearch && (
                          <HelpHint text={H.clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex">
                            <button type="button" onClick={() => onHighlightSearchChange('')} aria-label={H.clearSearch} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          </HelpHint>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </>}
        </div>{/* end mobile filters wrapper */}

        <div className="ml-auto flex items-center gap-1 flex-shrink-0" data-devzone="toolbar-actions">
          {liveSessionsSlot}
          {/* Item count */}
          {showFiltersForView && (
            <HelpHint text={H.count}>
            <span className="inline-flex items-center justify-center h-7 rounded px-2 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {(() => {
                const hasFilter = filter !== 'ALL' || statusFilter !== 'ALL';
                const hasSearch = searchQuery.trim().length > 0;
                if (hasSearch) return `${searchMatchCount ?? 0}/${totalItemCount} éléments`;
                if (hasFilter) return `${filteredItemCount}/${totalItemCount} éléments`;
                return `${totalItemCount} éléments`;
              })()}
            </span>
            </HelpHint>
          )}
          {/* Mobile filter toggle */}
          <HelpHint text={H.mobileFilters} className="sm:hidden inline-flex">
          <button
            type="button"
            className={`relative inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors flex-shrink-0 ${
              showMobileFilters ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setShowMobileFilters(v => !v)}
            aria-label={H.mobileFilters}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(activeTypeFilter || activeStatusFilter) && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />}
          </button>
          </HelpHint>
          {canEdit && onInsertTemplate && (
            <HelpHint text={H.insertTemplate}>
              <Button variant="ghost" size="sm" aria-label="Insérer un modèle" data-tour="toolbar-template" onClick={onInsertTemplate}>
                <LayoutTemplate className="w-4 h-4" />
              </Button>
            </HelpHint>
          )}
          {canEdit && (
            <HelpHint text={H.history}>
              {/* Un seul arrêt clavier : le lien porte le nom, le bouton n'est que l'habillage */}
              <Link to={`/spaces/${spaceId}/history`} aria-label="Historique des modifications" className="inline-flex">
                <Button variant="ghost" size="sm" tabIndex={-1}>
                  <History className="w-4 h-4" />
                </Button>
              </Link>
            </HelpHint>
          )}
          {spaceRole === 'OWNER' && (
            <HelpHint text={H.settings}>
              <Link to={`/spaces/${spaceId}/settings`} aria-label="Paramètres de l'espace" data-tour="toolbar-settings" className="inline-flex">
                <Button variant="ghost" size="sm" tabIndex={-1}>
                  <Settings className="w-4 h-4" />
                </Button>
              </Link>
            </HelpHint>
          )}
        </div>
      </div>

      {/* Bandeau de séance — 3e ligne, espace de séance uniquement (fourni par SpacePage) */}
      {liveSessionBarSlot}

    </div>
  );
}
