/*
 * Barre d'outils d'espace : sélecteur de vues, filtre ou aperçu, tri, création.
 * Filtre / Aperçu (décision Thomas 2026-11-04) : un seul bloc, selon la vue (prop highlightMode, calculée par SpacePage) —
 * « Aperçu » sur les vues qui estompent sans masquer, « Filtre » sur celles qui réduisent la liste. Mêmes états
 * (filter, statusFilter, searchQuery) : un critère posé reste actif en changeant de vue, et change juste d'effet.
 * Types et Statuts à choix multiple (2026-11-05) : listes de valeurs cochées, liste vide = tous ; le menu reste ouvert
 * pendant qu'on coche. Bloc toujours déplié à partir de xl (1280 px) ; en dessous, le bouton Filtre/Aperçu le déplie.
 * Critère posé (type, statut ou texte) : bouton Filtre/Aperçu en ambre et bouton « Effacer » rouge à côté, hors du bloc
 * dépliable pour rester accessible, qui vide les trois critères.
 * Les vues (spaceViews, filtrées par niveau d'accès via useMenuItems) sont réparties en 3 familles
 * fixes — Discussion/Pilotage/Exploration (cf. getViewGroup) — le mode d'interface courant
 * (forum/projet/tous) choisit la famille affichée en boutons directs (MODE_PRIMARY_GROUP) ; toutes les autres vues
 * restent accessibles dans « Autres vues », un menu par catégorie (Basique, Types, Planification, Exploration), jamais masquées.
 * Mode Loisirs : liste de vues choisie (MODE_PRIMARY_VIEWS, ordre imposé) au lieu d'une famille ; le reste par
 * catégorie dans « Autres vues ». Famille ajustable par mode (MODE_PRIMARY_ADJUST — Forum : + Images, Calendrier ; Projet : sans Liste/Types/Images/
 * Liens/Documents, avec Carte mentale). Répartition calculée par splitViewsForMode, seule source des deux affichages.
 * liveSessionsSlot : bouton « Séances » (ParentSessionsButton) fourni par SpacePage, rendu avant le compteur ;
 * liveSessionBarSlot : bandeau de séance (LiveSessionBar) fourni par SpacePage dans un espace de séance, rendu en
 * 3e ligne sous les filtres (décision Thomas 2026-10-11 : dans la toolbar, pas entre la toolbar et la vue) ;
 * la barre d'outils ne connaît pas la logique des séances live.
 * Création (2026-10-28) : « Nouveau » (NewItemButton) et « Modèle » (InsertTemplateButton), bleus, en tête de
 * toolbar-actions pour TOUTES les vues — les vues n'ont plus leur propre « Nouveau » dans #view-header.
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
  ZoomIn,
  ExternalLink,
  Image,
  Bug,
  CheckSquare,
  MessageSquare,
  Clock,
  ArrowUpDown,
  GitMerge,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { ItemType, MenuItemConfig } from '@spok/shared';
import { DEFAULT_REFERENTIELS, VIEW_REGISTRY } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { NewItemButton } from '../components/ui/NewItemButton';
import { InsertTemplateButton } from '../components/ui/InsertTemplateButton';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';
import type { ViewMode } from '../stores/viewMode';
import { useInterfaceModeStore } from '../stores/interfaceMode';
import type { TreeSort } from '../lib/treeSort';
import { HelpHint } from '../help/HelpHint';
import { SPACE_TOOLBAR_HINTS as H } from '../help/spaceToolbar.hints';
import { VIEW_HELP } from '../components/views/help';

/**
 * Vues d'espace groupées en 3 familles fixes (Discussion/Pilotage/Exploration).
 * Le mode d'interface (forum/projet/tous) choisit quelle famille s'affiche en boutons directs (MODE_PRIMARY_GROUP) ;
 * le reste va dans les menus « Autres vues » par catégorie (OTHER_MENU_KEYS).
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

/**
 * Menus « Autres vues » : un menu par catégorie de VIEW_REGISTRY (Basique, Types, Planification, Exploration),
 * avec les vues de la catégorie qui ne sont pas déjà en boutons directs (décision Thomas 2026-10-21 — auparavant
 * un menu par famille). Les familles ne servent plus qu'à choisir les boutons directs d'un mode.
 */
type OtherMenuKey = 'basic' | 'itemTypes' | 'planning' | 'exploration';
const OTHER_MENU_KEYS: OtherMenuKey[] = ['basic', 'itemTypes', 'planning', 'exploration'];
const VIEW_CATEGORY_OF = new Map(VIEW_REGISTRY.map((v) => [v.id, v.category as OtherMenuKey]));

const OTHER_MENU_LABELS: Record<OtherMenuKey, string> = {
  basic: 'Basique',
  itemTypes: 'Types',
  planning: 'Planification',
  exploration: 'Exploration',
};

const OTHER_MENU_ICONS: Record<OtherMenuKey, LucideIcon> = {
  basic: List,
  itemTypes: LayoutGrid,
  planning: CalendarCheck,
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
 * toutes les autres restent dans « Autres vues » (par catégorie). Loisirs : décision Thomas 2026-10-13.
 */
export const MODE_PRIMARY_VIEWS: Record<string, string[]> = {
  loisirs: ['thread', 'mindmap', 'images', 'documents', 'recent'],
};
export const MODE_PRIMARY_VIEWS_LABEL: Record<string, string> = { loisirs: 'Vues Loisirs' };

/**
 * Ajustements de la famille principale d'un mode : vues retirées des boutons directs (elles restent dans
 * « Autres vues ») et vues d'une autre famille ajoutées en boutons directs. Forum et Projet : décisions Thomas 2026-10-21.
 */
export const MODE_PRIMARY_ADJUST: Record<string, { remove: string[]; add: string[] }> = {
  forum:  { remove: [], add: ['images', 'calendar'] },
  projet: { remove: ['list', 'types', 'images', 'links', 'documents'], add: ['mindmap'] },
};

/**
 * Répartition des vues accessibles pour un mode : boutons directs (primary) et menus « Autres vues » par catégorie
 * (secondary, uniquement les vues qui ne sont pas déjà en direct). Source unique de la ligne de boutons ET du panneau
 * déroulant — ne pas recalculer l'un sans l'autre. Mode sans famille ni liste (tous, exploration) : tout en direct.
 */
export function splitViewsForMode<T extends { viewMode?: string | null }>(views: T[], mode: string): { curated: boolean; primary: T[]; secondary: { key: OtherMenuKey; views: T[] }[] } {
  const curated = curatedPrimaryViews(views, mode);
  const group = curated ? null : MODE_PRIMARY_GROUP[mode] ?? null;
  if (!curated && !group) return { curated: false, primary: views, secondary: [] };
  const adjust = MODE_PRIMARY_ADJUST[mode];
  const primary = curated ?? views.filter((v) => (getViewGroup(v.viewMode!) === group && !adjust?.remove.includes(v.viewMode!)) || !!adjust?.add.includes(v.viewMode!));
  const direct = new Set(primary.map((v) => v.viewMode));
  const secondary = OTHER_MENU_KEYS
    .map((key) => ({ key, views: views.filter((v) => VIEW_CATEGORY_OF.get(v.viewMode!) === key && !direct.has(v.viewMode)) }))
    .filter((g) => g.views.length > 0);
  return { curated: !!curated, primary, secondary };
}

/** Vues en boutons directs pour un mode à liste choisie, dans l'ordre de la liste (vues inaccessibles ignorées). */
export function curatedPrimaryViews<T extends { viewMode?: string | null }>(views: T[], mode: string): T[] | null {
  const ids = MODE_PRIMARY_VIEWS[mode];
  if (!ids) return null;
  return ids.map((id) => views.find((v) => v.viewMode === id)).filter((v): v is T => !!v);
}

// Bouton de la vue Process en couleur (demande Thomas 2026-10-29) : violet, distinct du bleu des créations et de
// l'orange des séances. Repos = fond clair, vue active = violet plein.
const PROCESS_VIEW_IDLE = 'bg-violet-100 text-violet-800 hover:bg-violet-200';
const PROCESS_VIEW_ACTIVE = 'bg-violet-600 text-white shadow-sm';

const MOBILE_HIDDEN_VIEWS = new Set([
  'kanban', 'types', 'members',
  'timeline', 'planning', 'graph', 'sunburst', 'relations',
  'bubble', 'radialTree', 'treemap', 'burndown', 'cfd', 'chord',
  'crossTable', 'heatmap', 'ego', 'loupe', 'process',
]);

const VIEW_ICON_MAP: Record<string, LucideIcon> = {
  List, GitBranch, Columns3, FileText, CalendarCheck, GanttChart, Calendar,
  LayoutGrid, Share2, Network, CircleDot, Waypoints, Circle, Orbit, SquareStack,
  Disc, TrendingDown, Layers, Users, Flame, Table2, Grid3x3, Focus, ZoomIn,
  ExternalLink, Image, Bug, CheckSquare, MessageSquare, Clock, GitMerge, Workflow,
};

export interface SpaceToolbarProps {
  // Bloc Filtre ou Aperçu
  /** Types cochés ; liste vide = tous */
  filter: ItemType[];
  onFilterChange: (filter: ItemType[]) => void;
  /** Statuts cochés ; liste vide = tous */
  statusFilter: string[];
  onStatusFilterChange: (statuses: string[]) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  /** true : la vue affichée met en évidence sans masquer — le bloc s'appelle « Aperçu » */
  highlightMode: boolean;
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
  highlightMode,
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
  onNewItem,
  onInsertTemplate,
  spaceId,
  spaceRole,
  liveSessionsSlot,
  liveSessionBarSlot,
}: SpaceToolbarProps) {
  const { mode: interfaceMode } = useInterfaceModeStore();
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filtreOpen, setFiltreOpen] = useState(false);
  const [otherGroupOpen, setOtherGroupOpen] = useState<OtherMenuKey | null>(null);
  const [otherGroupPos, setOtherGroupPos] = useState<{ top: number; left: number } | null>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const otherGroupsRef = useRef<HTMLDivElement>(null);
  const otherGroupPanelRef = useRef<HTMLDivElement>(null);
  const otherGroupBtnRefs = useRef<Partial<Record<OtherMenuKey, HTMLButtonElement | null>>>({});

  const toggleOtherGroup = (key: OtherMenuKey) => {
    if (otherGroupOpen === key) { setOtherGroupOpen(null); setOtherGroupPos(null); return; }
    const btn = otherGroupBtnRefs.current[key];
    if (btn) {
      const r = btn.getBoundingClientRect();
      setOtherGroupPos({ top: r.bottom + 4, left: r.left });
    }
    setOtherGroupOpen(key);
  };

  const activeTypeFilter = filter.length > 0;
  const activeStatusFilter = statusFilter.length > 0;
  const toggleValue = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const showFiltersForView = true;

  // Close all dropdowns on click outside or Escape
  useEffect(() => {
    if (!typeDropdownOpen && !statusDropdownOpen && !otherGroupOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setTypeDropdownOpen(false);
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false);
      if (
        otherGroupOpen
        && otherGroupsRef.current && !otherGroupsRef.current.contains(e.target as Node)
        && otherGroupPanelRef.current && !otherGroupPanelRef.current.contains(e.target as Node)
      ) { setOtherGroupOpen(null); setOtherGroupPos(null); }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTypeDropdownOpen(false); setStatusDropdownOpen(false); setOtherGroupOpen(null); setOtherGroupPos(null); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [typeDropdownOpen, statusDropdownOpen, otherGroupOpen]);


  return (
    <div data-devzone="toolbar" className={`flex flex-col gap-2 z-20 bg-muted/60 flex-shrink-0 relative ${['list','types','thread','members','recent','text','tree','crossTable','links','images','documents','bugs','todo','kanban','timeline','pert','calendar','planning','graph','sunburst','relations','bubble','radialTree','treemap','burndown','cfd','chord','heatmap','ego','loupe','priority','mindmap','process'].includes(viewMode) ? '' : 'mb-3 pb-2'}`}>

      {/* View mode buttons row */}
      {(() => {
        const baseViews = spaceViews.filter(
          (v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode))
        );
        // Mode à liste choisie (Loisirs) : une seule section ordonnée ; sinon famille principale ajustée (forum/projet) ou tout
        const { curated, primary: primaryViews, secondary: secondaryGroups } = splitViewsForMode(baseViews, interfaceMode);

        const sectionMap = new Map<string, { sectionOrder: number; label?: string; views: typeof primaryViews }>();
        if (curated) {
          sectionMap.set('curated', { sectionOrder: 0, label: MODE_PRIMARY_VIEWS_LABEL[interfaceMode], views: primaryViews });
        } else {
          for (const v of primaryViews) {
            if (!sectionMap.has(v.section)) {
              sectionMap.set(v.section, { sectionOrder: v.sectionOrder, views: [] });
            }
            sectionMap.get(v.section)!.views.push(v);
          }
        }
        const sections = [...sectionMap.values()].sort((a, b) => a.sectionOrder - b.sectionOrder);

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
                          v.viewMode === 'process'
                            ? (isActive ? PROCESS_VIEW_ACTIVE : PROCESS_VIEW_IDLE)
                            : isActive
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
                  const GroupIcon = OTHER_MENU_ICONS[group.key];
                  const isOpen = otherGroupOpen === group.key;
                  const containsActive = group.views.some((v) => v.viewMode === viewMode);
                  return (
                    <HelpHint key={group.key} text={`${OTHER_MENU_LABELS[group.key]} : ${H.otherViews}`}>
                    <button
                      ref={(el) => { otherGroupBtnRefs.current[group.key] = el; }}
                      onClick={() => toggleOtherGroup(group.key)}
                      aria-label={`Autres vues — ${OTHER_MENU_LABELS[group.key]}`}
                      className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                        containsActive ? 'bg-accent text-foreground font-semibold' : isOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      <GroupIcon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden sm:inline">{OTHER_MENU_LABELS[group.key]}</span>
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
        // Même répartition que la ligne de boutons : les vues déjà en boutons directs ne sont pas répétées ici
        const group = splitViewsForMode(
          spaceViews.filter((v) => v.viewMode && (allowedViews === null || allowedViews.includes(v.viewMode as ViewMode))),
          interfaceMode,
        ).secondary.find((g) => g.key === otherGroupOpen);
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
                      {Icon && <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${v.viewMode === 'process' ? 'text-violet-600' : ''}`} />}
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
            {/* === FILTRE ou APERÇU, selon la vue === */}
            {(() => {
              const hasActive = !!(activeTypeFilter || activeStatusFilter || searchQuery);
              const controls = (
                <>
                  <HelpHint text={highlightMode ? H.highlight : H.filter}>
                  <button
                    onClick={() => setFiltreOpen(v => !v)}
                    aria-label={highlightMode ? 'Aperçu' : 'Filtre'}
                    className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium transition-colors whitespace-nowrap xl:pointer-events-none ${
                      hasActive ? 'bg-amber-200 text-amber-950 font-semibold hover:bg-amber-300 dark:bg-amber-500/30 dark:text-amber-100 dark:hover:bg-amber-500/40' : filtreOpen ? 'bg-accent/60 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="hidden sm:inline">{highlightMode ? 'Aperçu' : 'Filtre'}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform xl:hidden ${filtreOpen ? 'rotate-180' : ''}`} />
                  </button>
                  </HelpHint>
                  {hasActive && (
                    <HelpHint text={highlightMode ? H.clearHighlight : H.clearFilters}>
                      <button
                        type="button"
                        onClick={() => { onFilterChange([]); onStatusFilterChange([]); onSearchQueryChange(''); }}
                        aria-label={highlightMode ? H.clearHighlight : H.clearFilters}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline">Effacer</span>
                      </button>
                    </HelpHint>
                  )}
                  <div className={`${filtreOpen ? 'flex' : 'hidden'} xl:flex items-center gap-1`}>
                      {/* Types */}
                      <div ref={typeDropdownRef} className="relative flex-shrink-0">
                        <HelpHint text={highlightMode ? H.highlightType : H.filterType}>
                        <button
                          onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); }}
                          className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${
                            activeTypeFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          {filter.length === 1 ? TYPE_LABELS[filter[0]] : filter.length > 1 ? `Types (${filter.length})` : 'Types'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        </HelpHint>
                        {typeDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[160px]">
                            <button onClick={() => { onFilterChange([]); setTypeDropdownOpen(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${filter.length === 0 ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                              <span className="flex-1 text-left">Tous les types</span>
                            </button>
                            {(['UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG', 'DIAGRAM', 'ARTICLE'] as const).map((t) => {
                              const isActive = filter.includes(t);
                              const typeColor = getTypeColor(t, referentiels?.typeLabels);
                              return (
                                <button key={t} aria-pressed={isActive} onClick={() => onFilterChange(toggleValue<ItemType>(filter, t))}
                                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                  <span className={`w-2 h-2 rounded-full ${typeColor.bgHover}`} />
                                  <span className="flex-1 text-left">{TYPE_LABELS[t]}</span>
                                  {isActive && <span className="text-primary text-xs">✓</span>}
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
                          const singleStatus = statusFilter.length === 1 ? statuses.find((s: any) => s.id === statusFilter[0]) : null;
                          const visibleStatuses = statuses.filter((s: any) => s.visible);
                          return (
                            <>
                              <HelpHint text={highlightMode ? H.highlightStatus : H.filterStatus}>
                              <button onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeStatusFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {singleStatus ? singleStatus.label : statusFilter.length > 1 ? `Statuts (${statusFilter.length})` : 'Statuts'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              </HelpHint>
                              {statusDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[180px]">
                                  <button onClick={() => { onStatusFilterChange([]); setStatusDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${statusFilter.length === 0 ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                    <span className="flex-1 text-left">Tous les statuts</span>
                                  </button>
                                  {visibleStatuses.map((s: any) => {
                                    const isActive = statusFilter.includes(s.id);
                                    const dotColor = s.borderColor.split(' ')[1] || s.borderColor.split(' ')[0];
                                    return (
                                      <button key={s.id} aria-pressed={isActive} onClick={() => onStatusFilterChange(toggleValue(statusFilter, s.id))}
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
                          className="h-7 w-40 xl:w-48 2xl:w-64 pl-6 pr-6 text-xs border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                        {searchQuery && (
                          <HelpHint text={H.clearSearch} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex">
                            <button type="button" onClick={() => onSearchQueryChange('')} aria-label={H.clearSearch} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          </HelpHint>
                        )}
                      </div>
                  </div>
                </>
              );
              // Deux zones nommées (DevZoneInspector, mode Aide, tours) pour une seule commande
              return highlightMode
                ? <div className="flex items-center gap-1 flex-shrink-0" data-tour="toolbar-highlight" data-devzone="toolbar-apercu">{controls}</div>
                : <div className="flex items-center gap-1 flex-shrink-0" data-tour="toolbar-filter" data-devzone="toolbar-filtre">{controls}</div>;
            })()}
          </>}
        </div>{/* end mobile filters wrapper */}

        <div className="ml-auto flex items-center gap-1 flex-shrink-0" data-devzone="toolbar-actions">
          {/* Création : « Nouveau » + « Modèle », bleus, côte à côte, pour toutes les vues (2026-10-28) */}
          {canEdit && onNewItem && <NewItemButton onClick={onNewItem} />}
          {canEdit && onInsertTemplate && <InsertTemplateButton onClick={onInsertTemplate} />}
          {liveSessionsSlot}
          {/* Item count */}
          {showFiltersForView && (
            <HelpHint text={H.count}>
            <span className="inline-flex items-center justify-center h-7 rounded px-2 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
              {(() => {
                const hasFilter = activeTypeFilter || activeStatusFilter;
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
