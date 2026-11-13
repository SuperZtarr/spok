/*
 * Barre d'outils d'espace : sélecteur de vues, filtre ou aperçu, tri, création. Types du filtre : ITEM_TYPES (registre).
 * Filtre / Aperçu (décision Thomas 2026-11-04) : un seul bloc, selon la vue (prop highlightMode, calculée par SpacePage) —
 * « Aperçu » sur les vues qui estompent sans masquer, « Filtre » sur celles qui réduisent la liste. Mêmes états
 * (filter, statusFilter, searchQuery) : un critère posé reste actif en changeant de vue, et change juste d'effet.
 * Types et Statuts à choix multiple (2026-11-05) : listes de valeurs cochées, liste vide = tous ; le menu reste ouvert
 * pendant qu'on coche. Bloc toujours déplié à partir de xl (1280 px) ; en dessous, le bouton Filtre/Aperçu le déplie.
 * Critère posé (type, statut, tag ou texte) : bouton Filtre/Aperçu en ambre et bouton « Effacer » rouge à droite des
 * composants de filtre (2026-11-11), hors du bloc dépliable pour rester accessible, qui vide les quatre critères.
 * Tags (2026-11-11) : choix multiple parmi tagOptions (tags proposés dans l'espace, fournis par SpacePage, groupés
 * par portée — globaux, communauté, espace — via lib/tagScope.ts, 2026-11-12) et « Sans tag » (NO_TAG) ; la
 * comparaison est faite par SpacePage (lib/itemHighlight matchesTags), jamais ici.
 * Sélecteur de vues (ligne 1) : composant SpaceViewSelector (2026-11-13) — favoris du mode d'interface, bouton
 * « Présentation », panneau « Toutes les vues » par catégorie ; logique dans lib/viewFavorites.ts. Les familles,
 * ajustements par mode et menus « Autres vues » sont supprimés (décision Thomas 2026-11-13).
 * Le rôle ne retire aucune vue, lecture seule comprise (décision Thomas 2026-11-06).
 * liveSessionsSlot : bouton « Séances » (ParentSessionsButton) fourni par SpacePage, rendu avant le compteur ;
 * liveSessionBarSlot : bandeau de séance (LiveSessionBar) fourni par SpacePage dans un espace de séance, rendu en
 * 3e ligne sous les filtres (décision Thomas 2026-10-11 : dans la toolbar, pas entre la toolbar et la vue) ;
 * la barre d'outils ne connaît pas la logique des séances live.
 * presentTypes (SpacePage) : filtre Statuts sans les statuts réservés d'un type absent de l'espace (statusesForItems).
 * Création (2026-10-28) : « Nouveau » (NewItemButton) et « Modèle » (InsertTemplateButton), bleus, en tête de
 * toolbar-actions pour TOUTES les vues — les vues n'ont plus leur propre « Nouveau » dans #view-header.
 * Aide : chaque commande est enveloppée d'un HelpHint (textes dans help/spaceToolbar.hints.ts) — jamais de `title`
 * natif (contrôlé par help/coverage.test.ts) ; repères data-tour toolbar-* pour les étapes communes des tours.
 * Zones data-devzone toolbar-vues/ordre/filtre/apercu/actions : vocabulaire de DevZoneInspector ET zones du mode Aide
 * (textes : help/shellZones.ts).
 * Bouton Historique : en mode admin seulement (règle space-history-admin-only).
 */
import { Fragment, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAdminMode } from '../components/DevDbStatus';
import {
  ChevronDown,
  Search,
  X,
  Settings,
  History,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react';
import type { ItemType, MenuItemConfig, StatusConfig, Tag } from '@spok/shared';
import { groupTagsByScope } from '../lib/tagScope';
import { DEFAULT_REFERENTIELS, ITEM_TYPES, statusesForItems } from '@spok/shared';
import { Button } from '../components/ui/Button';
import { NewItemButton } from '../components/ui/NewItemButton';
import { InsertTemplateButton } from '../components/ui/InsertTemplateButton';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';
import type { ViewMode } from '../stores/viewMode';
import type { TreeSort } from '../lib/treeSort';
import { HelpHint } from '../help/HelpHint';
import { SPACE_TOOLBAR_HINTS as H } from '../help/spaceToolbar.hints';
import { NO_TAG } from '../lib/itemHighlight';
import { SpaceViewSelector } from './SpaceViewSelector';

export interface SpaceToolbarProps {
  // Bloc Filtre ou Aperçu
  /** Types cochés ; liste vide = tous */
  filter: ItemType[];
  onFilterChange: (filter: ItemType[]) => void;
  /** Statuts cochés ; liste vide = tous */
  statusFilter: string[];
  onStatusFilterChange: (statuses: string[]) => void;
  /** Tags cochés (ids, NO_TAG = « Sans tag ») ; liste vide = tous */
  tagFilter: string[];
  onTagFilterChange: (tagIds: string[]) => void;
  /** Tags proposés dans l'espace (communauté + globaux, GET /spaces/:id/tags) */
  tagOptions?: Tag[];
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
  /** Types présents dans l'espace : les statuts réservés (issues d'une question) ne sont proposés au filtre que si leur type est présent */
  presentTypes?: string[];
  // View mode
  viewMode: ViewMode;
  onSetMode: (mode: ViewMode) => void;
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
  tagFilter,
  onTagFilterChange,
  tagOptions,
  searchQuery,
  onSearchQueryChange,
  highlightMode,
  totalItemCount,
  filteredItemCount,
  searchMatchCount,
  referentiels,
  presentTypes,
  viewMode,
  onSetMode,
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
  const adminMode = useAdminMode();
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filtreOpen, setFiltreOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  const activeTypeFilter = filter.length > 0;
  const activeStatusFilter = statusFilter.length > 0;
  const activeTagFilter = tagFilter.length > 0;
  const toggleValue = <T,>(list: T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const showFiltersForView = true;

  // Close all dropdowns on click outside or Escape
  useEffect(() => {
    if (!typeDropdownOpen && !statusDropdownOpen && !tagDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) setTypeDropdownOpen(false);
      if (statusDropdownOpen && statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) setStatusDropdownOpen(false);
      if (tagDropdownOpen && tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setTagDropdownOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setTypeDropdownOpen(false); setStatusDropdownOpen(false); setTagDropdownOpen(false); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [typeDropdownOpen, statusDropdownOpen, tagDropdownOpen]);


  return (
    <div data-devzone="toolbar" className={`flex flex-col gap-2 z-20 bg-muted/60 flex-shrink-0 relative`}>

      {/* Ligne 1 : sélecteur de vues (favoris du mode, Présentation, « Toutes les vues ») */}
      <SpaceViewSelector viewMode={viewMode} onSetMode={onSetMode} spaceViews={spaceViews} defaultView={defaultView} spaceId={spaceId} />

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
              const hasActive = !!(activeTypeFilter || activeStatusFilter || activeTagFilter || searchQuery);
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
                  <div className={`${filtreOpen ? 'flex' : 'hidden'} xl:flex items-center gap-1`}>
                      {/* Types */}
                      <div ref={typeDropdownRef} className="relative flex-shrink-0">
                        <HelpHint text={highlightMode ? H.highlightType : H.filterType}>
                        <button
                          onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setStatusDropdownOpen(false); setTagDropdownOpen(false); }}
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
                            {ITEM_TYPES.map((t) => {
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
                          const visibleStatuses = statusesForItems(statuses as StatusConfig[], (presentTypes ?? []).map((type) => ({ type }))).filter((s: any) => s.visible);
                          return (
                            <>
                              <HelpHint text={highlightMode ? H.highlightStatus : H.filterStatus}>
                              <button onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setTypeDropdownOpen(false); setTagDropdownOpen(false); }}
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
                      {/* Tags (2026-11-11) : tags proposés dans l'espace + « Sans tag » ; liste vide = tous */}
                      <div ref={tagDropdownRef} className="relative flex-shrink-0">
                        {(() => {
                          const options = tagOptions ?? [];
                          const single = tagFilter.length === 1
                            ? (tagFilter[0] === NO_TAG ? 'Sans tag' : options.find((t) => t.id === tagFilter[0])?.name)
                            : null;
                          return (
                            <>
                              <HelpHint text={highlightMode ? H.highlightTag : H.filterTag}>
                              <button onClick={() => { setTagDropdownOpen(!tagDropdownOpen); setTypeDropdownOpen(false); setStatusDropdownOpen(false); }}
                                className={`inline-flex items-center gap-1.5 h-7 rounded px-2 text-xs font-medium transition-all whitespace-nowrap ${activeTagFilter ? 'bg-accent text-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                                {single ?? (tagFilter.length > 1 ? `Tags (${tagFilter.length})` : 'Tags')}
                                <ChevronDown className={`w-3 h-3 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              </HelpHint>
                              {tagDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 z-50 border border-border bg-card rounded-md shadow-md py-1 w-[200px] max-h-80 overflow-y-auto">
                                  <button onClick={() => { onTagFilterChange([]); setTagDropdownOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${tagFilter.length === 0 ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                    <span className="flex-1 text-left">Tous les tags</span>
                                  </button>
                                  {[{ id: NO_TAG, name: 'Sans tag', color: null as string | null | undefined, header: null as string | null },
                                    // Groupes de portée (lib/tagScope.ts) : un intertitre avant le premier tag de chaque groupe
                                    ...groupTagsByScope(options).flatMap((g) => g.tags.map((t, i) => ({ ...t, header: i === 0 ? g.label : null })))].map((t) => {
                                    const isActive = tagFilter.includes(t.id);
                                    return (
                                      <Fragment key={t.id}>
                                      {t.header && <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t.header}</div>}
                                      <button aria-pressed={isActive} onClick={() => onTagFilterChange(toggleValue(tagFilter, t.id))}
                                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${isActive ? 'bg-accent text-foreground font-medium' : 'text-foreground/80 hover:bg-accent hover:text-foreground'}`}>
                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.color ? '' : 'bg-muted-foreground/40'}`} style={t.color ? { backgroundColor: t.color } : undefined} />
                                        <span className={`flex-1 text-left truncate ${t.id === NO_TAG ? 'italic' : ''}`}>{t.name}</span>
                                        {isActive && <span className="text-primary text-xs">✓</span>}
                                      </button>
                                      </Fragment>
                                    );
                                  })}
                                  {options.length === 0 && <p className="px-3 py-1.5 text-xs text-muted-foreground">Aucun tag dans cet espace</p>}
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
                  {hasActive && (
                    <HelpHint text={highlightMode ? H.clearHighlight : H.clearFilters}>
                      <button
                        type="button"
                        onClick={() => { onFilterChange([]); onStatusFilterChange([]); onTagFilterChange([]); onSearchQueryChange(''); }}
                        aria-label={highlightMode ? H.clearHighlight : H.clearFilters}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                      >
                        <X className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline">Effacer</span>
                      </button>
                    </HelpHint>
                  )}
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
            <span data-tour="toolbar-count" className="inline-flex items-center justify-center h-7 rounded px-2 text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
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
          {adminMode && (
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
