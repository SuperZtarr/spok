import { useMemo, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Calendar, MessageSquare, ArrowUp, ArrowDown, FolderKanban, Printer, FileDown, Info } from 'lucide-react';
import { ViewToolbar } from '../ui/ViewToolbar';
import { type TreeSort, applyTreeSort } from '../../lib/treeSort';
import { ItemActionMenu } from '../ui/ItemActionMenu';
import { buildItemMenuGroups } from '../../lib/itemMenuGroups';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';
import { DEFAULT_REFERENTIELS } from '@spok/shared';
import { Badge } from '../ui/Badge';
import { TagBadge } from '../ui/TagBadge';
import { getTypeIcon, getTypeColor, getPriorityConfig } from '../../constants/ui';
import { printItem, exportItemPDF } from '../../lib/itemExport';

// Extended Item type with contribution count
interface ItemWithContributions extends Item {
  contributionCount?: number;
}

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface ListViewProps {
  items: ItemWithContributions[];
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  canEditItem?: (item: { createdById?: string }) => boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  totalItemCount?: number;
  filteredItemCount?: number;
  searchMatchCount?: number;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
  onNewItem?: () => void;
  spaceId?: string;
  spaceRole?: string;
  hideToolbar?: boolean;
}

// Format date for display
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ImageThumbnail({ url }: { url: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setShowPreview(true);
  };

  return (
    <div
      ref={ref}
      className="relative flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowPreview(false)}
    >
      <img
        src={url}
        alt=""
        className="w-6 h-6 object-cover rounded border border-border"
      />
      {showPreview && (
        <div
          className="fixed z-50 p-1 bg-background border border-border rounded-lg shadow-xl"
          style={{ top: position.top, left: position.left }}
        >
          <img
            src={url}
            alt=""
            className="max-w-xs max-h-48 object-contain rounded"
          />
        </div>
      )}
    </div>
  );
}

type SortField = 'title' | 'type' | 'status' | 'priority' | 'parent' | 'date' | 'contributions';
type SortDir = 'asc' | 'desc';

export function ListView({ items, currentSpaceId, portalGroups, onEdit, onDelete, onUpdateStatus, onAddChild, onMoveToSpace, onDuplicateToSpace, onConvertToSpace, onSelfAssign, onMerge, onAbsorbChildren, onSplitDescription, onOpen,
            onOpenInNewTab, referentiels, canEdit = true, canEditItem,
            filter = 'ALL', onFilterChange, statusFilter = 'ALL', onStatusFilterChange,
            searchQuery = '', onSearchQueryChange,
            totalItemCount, filteredItemCount, searchMatchCount,
            spaceName, viewContainerRef, onStartTour, pulseHelp, onNewItem,
            spaceId, spaceRole, hideToolbar = false }: ListViewProps) {
  const hasHeadings = (desc?: string | null) => !!desc && /<h[2-3][^>]*>/i.test(desc);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [treeSort, setTreeSort] = useState<TreeSort>('manual');
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  // Portal support
  const hasPortals = !!(portalGroups && portalGroups.length > 0);
  const portalSpaceNames = useMemo(() => {
    if (!portalGroups?.length) return new Map<string, string>();
    return new Map(portalGroups.map(g => [g.spaceId, g.spaceName]));
  }, [portalGroups]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  // Build parent name map
  const parentNames = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach(item => { map[item.id] = item.title; });
    return map;
  }, [items]);

  const treeSortedItems = useMemo(() => applyTreeSort(items, treeSort), [items, treeSort]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortField) return treeSortedItems;
    const mul = sortDir === 'asc' ? 1 : -1;
    return [...treeSortedItems].sort((a, b) => {
      switch (sortField) {
        case 'title':
          return mul * a.title.localeCompare(b.title, 'fr');
        case 'type':
          return mul * a.type.localeCompare(b.type);
        case 'status': {
          const sa = a.status || '';
          const sb = b.status || '';
          return mul * sa.localeCompare(sb);
        }
        case 'priority': {
          const pa = a.priority ?? 0;
          const pb = b.priority ?? 0;
          return mul * (pa - pb);
        }
        case 'parent': {
          const pa = (a.parentId && parentNames[a.parentId]) || '';
          const pb = (b.parentId && parentNames[b.parentId]) || '';
          return mul * pa.localeCompare(pb, 'fr');
        }
        case 'date': {
          const da = a.startDate || a.createdAt || '';
          const db = b.startDate || b.createdAt || '';
          return mul * da.localeCompare(db);
        }
        case 'contributions': {
          const ca = (a as ItemWithContributions).contributionCount || 0;
          const cb = (b as ItemWithContributions).contributionCount || 0;
          return mul * (ca - cb);
        }
        default:
          return 0;
      }
    });
  }, [treeSortedItems, sortField, sortDir, parentNames]);

  // Build status and type maps from referentiels
  const { statusLabels, statusColors, typeLabelsShort } = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    const types = referentiels?.typeLabels || DEFAULT_REFERENTIELS.typeLabels;

    const sLabels: Record<string, string> = {};
    const sColors: Record<string, string> = {};
    statuses.forEach((s) => {
      sLabels[s.id] = s.label;
      sColors[s.id] = s.color;
    });
    // Add 'none' color for items without status
    sColors['none'] = 'bg-gray-100 text-gray-500 border-dashed';

    const tLabels: Record<string, string> = {};
    Object.entries(types).forEach(([type, config]) => {
      tLabels[type] = config.labelShort;
    });

    return { statusLabels: sLabels, statusColors: sColors, typeLabelsShort: tLabels };
  }, [referentiels]);

  const statusOptions = useMemo(() => {
    const statuses = referentiels?.statuses || DEFAULT_REFERENTIELS.statuses;
    return statuses.filter(s => s.visible).sort((a, b) => a.order - b.order);
  }, [referentiels]);

  const gridColsClass = hasPortals
    ? 'grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_5rem_6rem_auto] md:grid-cols-[auto_1fr_5rem_6rem_4rem_5rem_auto] lg:grid-cols-[auto_1fr_8rem_5rem_6rem_4rem_5rem_auto] xl:grid-cols-[auto_1fr_6rem_8rem_5rem_6rem_4rem_5rem_auto]'
    : 'grid-cols-[auto_1fr_auto_auto] sm:grid-cols-[auto_1fr_5rem_6rem_auto] md:grid-cols-[auto_1fr_5rem_6rem_4rem_5rem_auto] lg:grid-cols-[auto_1fr_8rem_5rem_6rem_4rem_5rem_auto]';

  return (
    <div className="flex flex-col h-full">
      {!hideToolbar && <ViewToolbar
        viewMode="list"
        spaceId={spaceId}
        spaceRole={spaceRole}        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
        onNewItem={onNewItem}
        canEdit={canEdit}
        exportItems={items}
        spaceName={spaceName}
        viewContainerRef={viewContainerRef}
        treeSortValue={treeSort}
        onTreeSortChange={setTreeSort}
        filter={filter}
        onFilterChange={onFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={onStatusFilterChange}
        searchQuery={searchQuery}
        onSearchQueryChange={onSearchQueryChange}
        totalItemCount={totalItemCount}
        filteredItemCount={filteredItemCount}
        searchMatchCount={searchMatchCount}
        referentiels={referentiels}
      />}
      {/* Items list */}
      {sortedItems.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucun élément</p>
          <p className="text-sm">Créez votre premier élément pour commencer</p>
        </div>
      ) : (
        <>

          {/* Header — fixed outside scroll */}
          <div data-tour="list-headers" className={`sticky top-[33px] z-[1] grid ${gridColsClass} items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border bg-muted/50 select-none flex-shrink-0`}>
            <span className="w-4" />
            <button className="flex items-center gap-1 hover:text-foreground transition-colors text-left" onClick={() => toggleSort('title')}>
              Titre
              {sortField === 'title' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            {hasPortals && (
              <span className="hidden xl:block text-left truncate">Espace</span>
            )}
            <button className="hidden lg:flex items-center gap-1 hover:text-foreground transition-colors text-left truncate" onClick={() => toggleSort('parent')}>
              Parent
              {sortField === 'parent' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="hidden sm:flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('type')}>
              Type
              {sortField === 'type' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="hidden sm:flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('status')}>
              Statut
              {sortField === 'status' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="hidden md:flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('priority')}>
              Prio
              {sortField === 'priority' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <button className="hidden md:flex items-center justify-center gap-1 hover:text-foreground transition-colors" onClick={() => toggleSort('date')}>
              Info
              {sortField === 'date' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
            <span className="w-8 sm:w-20" />
          </div>

          {/* Rows — scrollable */}
          <div className="flex-1 overflow-auto">
          <div className="divide-y divide-border">
            {sortedItems.map((item, index) => {
              const Icon = getTypeIcon(item.type, item.url);
              const statusLabel = statusLabels[item.status || ''] || 'Non défini';
              const statusColor = statusColors[item.status || 'none'] || statusColors['none'];
              const typeLabel = typeLabelsShort[item.type] || item.type;
              const hasImage = item.url && (item.type === 'DIAGRAM' || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item.url));
              const isPortal = !!(currentSpaceId && item.spaceId && item.spaceId !== currentSpaceId);
              const portalSpaceName = isPortal ? portalSpaceNames.get(item.spaceId) : undefined;
              const isUrgent = item.priority === 4;
              const _viewedAt = (item as any).viewedAt;
              const isUnseen = _viewedAt === null || (_viewedAt && new Date(item.updatedAt) > new Date(_viewedAt));
              const infoOpen = openInfoId === item.id;

              return (
                <div
                  key={item.id}
                  {...(index === 0 ? { 'data-tour': 'list-row' } : {})}
                  draggable={canEdit !== false}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('application/x-spok-item', JSON.stringify({ itemId: item.id, spaceId: currentSpaceId }));
                  }}
                >
                <div
                  className={`grid ${gridColsClass} items-center gap-3 px-4 py-2.5 hover:bg-accent cursor-pointer group ${isPortal ? 'bg-muted/10' : ''} ${isUrgent ? 'animate-urgent-blink' : isUnseen ? 'animate-unseen-blink' : ''}`}
                  onClick={() => onEdit(item.id)}
                >
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{item.title}</span>
                    {hasImage && (
                      <ImageThumbnail url={item.url!} />
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {item.tags.slice(0, 3).map((tag) => (
                          <TagBadge key={tag.id} tag={tag} size="sm" />
                        ))}
                        {item.tags.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{item.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    <button
                      className={`sm:hidden flex-shrink-0 p-0.5 rounded transition-colors ${infoOpen ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
                      onClick={(e) => { e.stopPropagation(); setOpenInfoId(infoOpen ? null : item.id); }}
                      title="Détails"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {hasPortals && (
                    <span className="hidden xl:block truncate text-xs">
                      {isPortal && portalSpaceName ? (
                        <Link
                          to={`/spaces/${item.spaceId}`}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium hover:bg-primary/20 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          title={`Espace : ${portalSpaceName}`}
                        >
                          <FolderKanban className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{portalSpaceName}</span>
                        </Link>
                      ) : null}
                    </span>
                  )}

                  <span className="hidden lg:block truncate text-xs text-muted-foreground" title={item.parentId ? parentNames[item.parentId] || '' : ''}>
                    {item.parentId ? parentNames[item.parentId] || '' : ''}
                  </span>

                  <span className="hidden sm:flex justify-center">
                    <Badge variant="outline" className={`text-xs border ${getTypeColor(item.type, referentiels?.typeLabels).color}`}>
                      {typeLabel}
                    </Badge>
                  </span>

                  <span className="hidden sm:flex justify-center">
                    <Badge
                      className={`text-xs ${statusColor}`}
                      variant="secondary"
                    >
                      {statusLabel}
                    </Badge>
                  </span>

                  <span className="hidden md:flex justify-center">
                    {(() => {
                      const pConfig = getPriorityConfig(item.priority);
                      return pConfig ? (
                        <span className={`text-xs font-medium ${pConfig.textColor}`} title={pConfig.label}>
                          {pConfig.shortLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      );
                    })()}
                  </span>

                  <span className="hidden md:flex items-center justify-center gap-1.5">
                    {item.type === 'MEETING' && item.startDate && (
                      <span className="text-xs text-muted-foreground" title={formatDate(item.startDate) || ''}>
                        <Calendar className="w-3 h-3" />
                      </span>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700"
                        onClick={(e) => e.stopPropagation()}
                        title="Ouvrir le lien"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {item.contributionCount !== undefined && item.contributionCount > 0 && (
                      <span
                        className="flex items-center gap-0.5 text-xs text-muted-foreground"
                        title={`${item.contributionCount} contribution(s)`}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {item.contributionCount}
                      </span>
                    )}
                  </span>

                  <span className="flex items-center justify-end w-8 sm:w-20 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {!isPortal && (
                      <ItemActionMenu
                        groups={buildItemMenuGroups(item.id, {
                          onEdit,
                          onDelete,
                          onUpdateStatus,
                          onAddChild,
                          onMoveToSpace,
                          onDuplicateToSpace,
                          onConvertToSpace,
                          onSelfAssign,
                          onMerge,
                          onAbsorbChildren,
                          onSplitDescription: hasHeadings(item.description) ? onSplitDescription : undefined,
                          onOpen,
            onOpenInNewTab,
                        }, {
                          canEdit: canEditItem ? canEditItem(item) : canEdit,
                          statusOptions,
                          currentStatusId: item.status || undefined,
                          extraSections: [{
                            label: 'Exporter',
                            actions: [
                              { id: 'print', label: 'Imprimer', icon: Printer, onClick: () => { const children = items.filter(i => i.parentId === item.id); printItem({ item: item as any, children }); } },
                              { id: 'pdf', label: 'Export PDF', icon: FileDown, onClick: () => { const children = items.filter(i => i.parentId === item.id); exportItemPDF({ item: item as any, children }); } },
                            ],
                          }],
                        })}
                      />
                    )}
                  </span>
                </div>
                {infoOpen && (
                  <div className="sm:hidden px-4 pb-2.5 pt-1 bg-accent/30 flex flex-wrap gap-x-4 gap-y-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="outline" className={`text-xs border ${getTypeColor(item.type, referentiels?.typeLabels).color}`}>{typeLabel}</Badge>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">Statut</span>
                      <Badge className={`text-xs ${statusColor}`} variant="secondary">{statusLabel}</Badge>
                    </span>
                    {item.priority != null && (() => { const pc = getPriorityConfig(item.priority); return pc ? <span className={`flex items-center gap-1`}><span className="text-muted-foreground">Prio</span><span className={`font-medium ${pc.textColor}`}>{pc.label}</span></span> : null; })()}
                    {item.parentId && parentNames[item.parentId] && (
                      <span className="flex items-center gap-1"><span className="text-muted-foreground">Parent</span><span className="truncate max-w-[12rem]">{parentNames[item.parentId]}</span></span>
                    )}
                    {item.startDate && <span className="flex items-center gap-1"><span className="text-muted-foreground">Début</span>{formatDate(item.startDate)}</span>}
                    {item.endDate && <span className="flex items-center gap-1"><span className="text-muted-foreground">Fin</span>{formatDate(item.endDate)}</span>}
                    {item.dueDate && <span className="flex items-center gap-1"><span className="text-muted-foreground">Échéance</span>{formatDate(item.dueDate)}</span>}
                  </div>
                )}
                </div>
              );
            })}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
