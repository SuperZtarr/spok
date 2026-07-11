/* Vue Todo : liste simple des tâches cochables (statut done au clic). */
import { useMemo } from 'react';
import { CheckSquare } from 'lucide-react';
import { ListView } from './ListView';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item, SpaceReferentiels } from '@spok/shared';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface TodoViewProps {
  items: Item[] | undefined;
  currentSpaceId?: string;
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
  portalGroups?: PortalGroup[];
  onNewItem?: () => void;
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function TodoView({ items, portalGroups, onNewItem, spaceName, viewContainerRef, onStartTour, pulseHelp, canEdit = true, ...rest }: TodoViewProps) {
  const todos = useMemo(() => {
    if (!items) return [];
    return items.filter(item =>
      item.type === 'TASK' &&
      item.status !== 'done' &&
      item.status !== 'cancelled'
    );
  }, [items]);

  const todoPortalGroups = useMemo(() => {
    if (!portalGroups?.length) return undefined;
    return portalGroups
      .map(g => ({
        ...g,
        items: g.items.filter(item =>
          item.type === 'TASK' &&
          item.status !== 'done' &&
          item.status !== 'cancelled'
        ),
      }))
      .filter(g => g.items.length > 0);
  }, [portalGroups]);

  const header = (
    <div id="view-header" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
      {canEdit && onNewItem && (
        <button onClick={onNewItem} className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
          + Nouveau
        </button>
      )}
      <div className="flex-1" />
      <ViewHelpButton viewMode="todo" onStartTour={onStartTour} pulse={pulseHelp} />
      {spaceName && viewContainerRef && (
        <SpaceExportButton items={items ?? []} spaceName={spaceName} viewMode="todo" viewContainerRef={viewContainerRef} />
      )}
    </div>
  );

  if (todos.length === 0 && (!todoPortalGroups || todoPortalGroups.length === 0)) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {header}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-lg font-medium">Aucune tâche en cours</p>
            <p className="text-sm text-muted-foreground">Toutes les tâches sont terminées ou annulées.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {header}
      <ListView items={todos} portalGroups={todoPortalGroups} hideToolbar canEdit={canEdit} {...rest} />
    </div>
  );
}
