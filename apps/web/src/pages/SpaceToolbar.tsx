/*
 * Barre d'outils d'espace : sélecteur de vues, filtres, highlight, tri, création.
 * Les vues (spaceViews, filtrées par niveau d'accès via useMenuItems) sont réparties en 3 familles
 * fixes — Discussion/Pilotage/Exploration (cf. getViewGroup) — le mode d'interface courant
 * (forum/projet/tous) choisit la famille affichée en boutons directs (MODE_PRIMARY_GROUP) ;
 * les 2 autres familles restent accessibles via le dropdown "Autres vues", jamais masquées.
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
  type LucideIcon,
} from 'lucide-react';
import type { ItemType, MenuItemConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS, VIEW_REGISTRY } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';
import type { ViewMode } from '../stores/viewMode';
import { useInterfaceModeStore } from '../stores/interfaceMode';
import type { TreeSort } from '../lib/treeSort';

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

const MOBILE_HIDDEN_VIEWS = new Set([
  'kanban', 'types', 'members',
  'timeline', 'planning', 'graph', 'sunburst', 'relations',
  'bubble', 'radialTree', 'treemap', 'burndown', 'cfd', 'chord',
  'crossTable', 'heatmap', 'ego',
]);

const VIEW_ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock, GitMerge,
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
  // Space
  spaceId?: string;
  spaceRole?: string;
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
  spaceId,
  spaceRole,
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
    <div className={`flex flex-col gap-2 z-20 bg-background flex-shrink-0 relative ${['list','types','thread','members','recent','text','tree','crossTable','links','images','documents','bugs','todo','kanban','timeline','pert','calendar','planning','graph','sunburst','relations','bubble','radialTree','treemap','burndown','cfd','chord','heatmap','ego','priority','mindmap'].includes(viewMode) ? '' : 'mb-3 pb-2'}`}>

      {/* View mode buttons row */}
      {(() => {
        const baseViews = spaceViews.filter(
          (v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode))
        );
        const primaryGroup = MODE_PRIMARY_GROUP[interfaceMode] ?? null;
        const primaryViews = primaryGroup
          ? baseViews.filter((v) => getViewGroup(v.viewMode!) === primaryGroup)
          : baseViews;

        const sectionMap = new Map<string, { sectionOrder: number; views: typeof primaryViews }>();
        for (const v of primaryViews) {
          if (!sectionMap.has(v.section)) {
            sectionMap.set(v.section, { sectionOrder: v.sectionOrder, views: [] });
          }
          sectionMap.get(v.section)!.views.push(v);
        }
        const sections = [...sectionMap.values()].sort((a, b) => a.sectionOrder - b.sectionOrder);

        const secondaryGroups = primaryGroup
          ? (['discussion', 'pilotage', 'exploration'] as ViewGroupKey[])
              .filter((g) => g !== primaryGroup)
              .map((g) => ({ key: g, views: baseViews.filter((v) => getViewGroup(v.viewMode!) === g) }))
              .filter((g) => g.views.length > 0)
          : [];

        if (sections.length === 0 && secondaryGroups.length === 0) return null;
        return (
          <div className="flex items-start gap-3 overflow-x-auto pb-0.5 scrollbar-none">
            {sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-0.5 flex-shrink-0">
                <span className="hidden sm:block text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                  {section.views[0]?.sectionLabel}
                </span>
                <div className="flex items-center gap-0.5">
                  {section.views.map((v) => {
                    const Icon = VIEW_ICON_MAP[v.icon];
                    const isActive = viewMode === v.viewMode;
                    const isDefault = defaultView && v.viewMode === defaultView;
                    const showPulse = isDefault && !isActive;
                    return (
                      <button
                        key={v.key}
                        onClick={() => onSetMode(v.viewMode as ViewMode)}
                        title={isDefault ? `${v.label} (vue par défaut)` : v.label}
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
                    <button
                      key={group.key}
                      ref={(el) => { otherGroupBtnRefs.current[group.key] = el; }}
                      onClick={() => toggleOtherGroup(group.key)}
                      title={`Autres vues — ${VIEW_GROUP_LABELS[group.key]}`}
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                        containsActive ? 'bg-accent text-foreground font-semibold' : isOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">{VIEW_GROUP_LABELS[group.key]}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
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
        const group = (['discussion', 'pilotage', 'exploration'] as ViewGroupKey[])
          .map((g) => ({ key: g, views: spaceViews.filter((v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode)) && getViewGroup(v.viewMode) === g) }))
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
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {([
                  { value: 'manual', label: 'Position' },
                  { value: 'alpha-flat', label: 'A→Z à plat' },
                  { value: 'alpha-tree', label: 'A→Z par groupe' },
                ] as const).map(({ value, label }) => (
                  <button key={value} onClick={() => onTreeSortChange(value)}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      treeSort === value ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}>
                    <ArrowUpDown className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setFiltreOpen(v => !v); setAperçuOpen(false); }}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      hasActive ? 'bg-accent text-foreground font-semibold' : filtreOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">Filtre</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${filtreOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {filtreOpen && (
                    <div className="flex items-center gap-1">
                      {/* Types */}
                      <div ref={typeDropdownRef} className="relative flex-shrink-0" data-tour="toolbar-filters">
                        <button
                          onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); }}
                          className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${
                            activeTypeFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {activeTypeFilter ? TYPE_LABELS[activeTypeFilter] : 'Types'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
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
                              <button onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeStatus ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {activeStatus ? activeStatus.label : 'Statuts'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
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
                      <div className="relative flex-shrink-0" data-tour="toolbar-search">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                        <input type="text" placeholder="Rechercher..." value={searchQuery} onChange={(e) => onSearchQueryChange(e.target.value)}
                          className="h-7 w-28 pl-6 pr-6 text-xs border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        {searchQuery && (
                          <button onClick={() => onSearchQueryChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setAperçuOpen(v => !v); setFiltreOpen(false); }}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      hasActive ? 'bg-accent text-foreground font-semibold' : aperçuOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    Aperçu
                    <ChevronDown className={`w-3 h-3 transition-transform ${aperçuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {aperçuOpen && (
                    <div className="flex items-center gap-1">
                      {/* HL Types */}
                      <div ref={hlTypeDropdownRef} className="relative flex-shrink-0">
                        <button onClick={() => { setHlTypeDropdownOpen(!hlTypeDropdownOpen); setHlStatusDropdownOpen(false); }}
                          className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeHlTypeFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                          {activeHlTypeFilter ? TYPE_LABELS[activeHlTypeFilter] : 'Types'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${hlTypeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
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
                              <button onClick={() => { setHlStatusDropdownOpen(!hlStatusDropdownOpen); setHlTypeDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeHlStatus ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {activeHlStatus ? activeHlStatus.label : 'Statuts'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${hlStatusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
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
                          <button onClick={() => onHighlightSearchChange('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </>}
        </div>{/* end mobile filters wrapper */}

        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {/* Item count */}
          {showFiltersForView && (
            <span className="inline-flex items-center justify-center h-7 rounded px-2 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {(() => {
                const hasFilter = filter !== 'ALL' || statusFilter !== 'ALL';
                const hasSearch = searchQuery.trim().length > 0;
                if (hasSearch) return `${searchMatchCount ?? 0}/${totalItemCount} éléments`;
                if (hasFilter) return `${filteredItemCount}/${totalItemCount} éléments`;
                return `${totalItemCount} éléments`;
              })()}
            </span>
          )}
          {/* Mobile filter toggle */}
          <button
            className={`sm:hidden relative inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors flex-shrink-0 ${
              showMobileFilters ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-background text-muted-foreground hover:bg-accent'
            }`}
            onClick={() => setShowMobileFilters(v => !v)}
            title="Filtres"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {(activeTypeFilter || activeStatusFilter) && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />}
          </button>
          {canEdit && (
            <Link to={`/spaces/${spaceId}/history`}>
              <Button variant="ghost" size="sm" title="Historique des modifications">
                <History className="w-4 h-4" />
              </Button>
            </Link>
          )}
          {spaceRole === 'OWNER' && (
            <Link to={`/spaces/${spaceId}/settings`}>
              <Button variant="ghost" size="sm" title="Paramètres de l'espace">
                <Settings className="w-4 h-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}
