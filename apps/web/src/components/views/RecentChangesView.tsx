import { useMemo, useEffect, useRef } from 'react';
import { Clock, Plus, Pencil } from 'lucide-react';
import { ListView } from './ListView';
import { ViewToolbar } from '../ui/ViewToolbar';
import type { Item, ItemType, SpaceReferentiels } from '@spok/shared';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface RecentChangesViewProps {
  items: Item[] | undefined;
  spaceId?: string;
  currentSpaceId?: string;
  portalGroups?: PortalGroup[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onAddChild: (parentId: string) => void;
  onMoveToSpace?: (id: string) => void;
  onDuplicateToSpace?: (id: string) => void;
  onConvertToSpace?: (id: string) => void;
  onSelfAssign?: (id: string) => void;
  onMerge?: (id: string) => void;
  onAbsorbChildren?: (id: string) => void;
  onSplitDescription?: (id: string) => void;
  onOpen?: (id: string) => void;
  onOpenInNewTab?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  filter?: ItemType | 'ALL';
  onFilterChange?: (filter: ItemType | 'ALL') => void;
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  totalItemCount?: number;
  filteredItemCount?: number;
  searchMatchCount?: number;
  spaceRole?: string;
  onNewItem?: () => void;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

const STORAGE_KEY_PREFIX = 'spok-last-visit-';

function getLastVisit(spaceId: string): Date | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${spaceId}`);
    return stored ? new Date(stored) : null;
  } catch {
    return null;
  }
}

function saveLastVisit(spaceId: string) {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${spaceId}`, new Date().toISOString());
  } catch { /* ignore */ }
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 2) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function RecentChangesView({
  items,
  spaceId,
  portalGroups,
  filter = 'ALL', onFilterChange,
  statusFilter = 'ALL', onStatusFilterChange,
  searchQuery = '', onSearchQueryChange,
  totalItemCount, filteredItemCount, searchMatchCount,
  referentiels,
  spaceRole, onNewItem, spaceName, viewContainerRef, onStartTour, pulseHelp,
  ...rest
}: RecentChangesViewProps) {
  const savedAtMount = useRef<Date | null>(null);

  // Capture la date de dernière visite au montage, AVANT de la mettre à jour
  useEffect(() => {
    if (!spaceId) return;
    savedAtMount.current = getLastVisit(spaceId);
    // Met à jour la date de visite pour la prochaine fois
    saveLastVisit(spaceId);
  }, [spaceId]);

  const { newItems, modifiedItems, lastVisit } = useMemo(() => {
    const lastVisit = savedAtMount.current;
    if (!items) return { newItems: [], modifiedItems: [], lastVisit: null };

    if (!lastVisit) {
      // Première visite : montrer les 20 plus récents
      const sorted = [...items].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      return { newItems: [], modifiedItems: sorted.slice(0, 20), lastVisit: null };
    }

    const newItems: Item[] = [];
    const modifiedItems: Item[] = [];

    for (const item of items) {
      const created = new Date(item.createdAt);
      const updated = new Date(item.updatedAt);
      if (created > lastVisit) {
        newItems.push(item);
      } else if (updated > lastVisit) {
        modifiedItems.push(item);
      }
    }

    newItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    modifiedItems.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const applyFilters = (arr: Item[]) => {
      let r = arr;
      if (filter !== 'ALL') r = r.filter(i => i.type === filter);
      if (statusFilter !== 'ALL') r = r.filter(i => i.status === statusFilter);
      return r;
    };

    return { newItems: applyFilters(newItems), modifiedItems: applyFilters(modifiedItems), lastVisit };
  }, [items, filter, statusFilter]);

  const isEmpty = newItems.length === 0 && modifiedItems.length === 0;

  return (
    <div className="flex flex-col h-full">
      <ViewToolbar
        viewMode="recent"
        spaceId={spaceId}
        spaceRole={spaceRole}
        canEdit={!!onNewItem}
        onNewItem={onNewItem}
        exportItems={items}
        spaceName={spaceName}
        viewContainerRef={viewContainerRef}
        onStartTour={onStartTour}
        pulseHelp={pulseHelp}
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
      />
      {/* Info dernière visite */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b bg-muted/30 text-sm text-muted-foreground flex-shrink-0">
        <Clock className="w-4 h-4" />
        {lastVisit ? (
          <span>Depuis votre dernière visite — <strong className="text-foreground">{formatRelativeTime(lastVisit)}</strong></span>
        ) : (
          <span>20 éléments les plus récents</span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-16">
            <Clock className="w-10 h-10 opacity-30" />
            <p className="text-sm font-medium">Aucune modification depuis votre dernière visite</p>
            <p className="text-xs opacity-70">{lastVisit ? formatRelativeTime(lastVisit) : ''}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {newItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Plus className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                    Nouveaux ({newItems.length})
                  </h3>
                </div>
                <ListView items={newItems} portalGroups={[]} hideToolbar {...rest} />
              </section>
            )}

            {modifiedItems.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Pencil className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                    Modifiés ({modifiedItems.length})
                  </h3>
                </div>
                <ListView items={modifiedItems} portalGroups={[]} hideToolbar {...rest} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
