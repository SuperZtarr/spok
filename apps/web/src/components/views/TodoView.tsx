import { useMemo } from 'react';
import { CheckSquare } from 'lucide-react';
import { ListView } from './ListView';
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
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
  portalGroups?: PortalGroup[];
}

export function TodoView({ items, portalGroups, ...rest }: TodoViewProps) {
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

  if (todos.length === 0 && (!todoPortalGroups || todoPortalGroups.length === 0)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <CheckSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucune tâche en cours</p>
          <p className="text-sm text-muted-foreground">Toutes les tâches sont terminées ou annulées.</p>
        </div>
      </div>
    );
  }

  return <ListView items={todos} portalGroups={todoPortalGroups} {...rest} />;
}
