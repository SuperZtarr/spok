/* Vue Todo : liste simple des tâches cochables (statut done au clic). */
import { useMemo } from 'react';
import { CheckSquare } from 'lucide-react';
import { ListView } from './ListView';
import { SpaceExportButton } from '../SpaceExportButton';
import { ViewHelpButton } from '../ViewHelpButton';
import type { Item, SpaceReferentiels } from '@spok/shared';
import { EmptyHelp } from '../../help/EmptyHelp';

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
  spaceName?: string;
  viewContainerRef?: React.RefObject<HTMLDivElement>;
  onStartTour?: () => void;
  pulseHelp?: boolean;
}

export function TodoView({ items, portalGroups, spaceName, viewContainerRef, onStartTour, pulseHelp, canEdit = true, ...rest }: TodoViewProps) {
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
    <div id="view-header" data-devzone="contenu-barre-vue" className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background flex-shrink-0">
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
        <EmptyHelp mode="todo" title="Aucune tâche en cours" icon={CheckSquare} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-help-zone="todo:contenu">
      {header}
      <ListView items={todos} portalGroups={todoPortalGroups} hideToolbar canEdit={canEdit} {...rest} />
    </div>
  );
}
