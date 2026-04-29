import { useMemo } from 'react';
import { Bug } from 'lucide-react';
import { ListView } from './ListView';
import type { Item, SpaceReferentiels } from '@spok/shared';

interface PortalGroup {
  spaceId: string;
  spaceName: string;
  items: Item[];
}

interface BugsViewProps {
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
}

export function BugsView({ items, portalGroups, ...rest }: BugsViewProps) {
  const bugs = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'BUG');
  }, [items]);

  const bugPortalGroups = useMemo(() => {
    if (!portalGroups?.length) return undefined;
    return portalGroups
      .map(g => ({ ...g, items: g.items.filter(item => item.type === 'BUG') }))
      .filter(g => g.items.length > 0);
  }, [portalGroups]);

  if (bugs.length === 0 && (!bugPortalGroups || bugPortalGroups.length === 0)) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Bug className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-lg font-medium">Aucun bug</p>
          <p className="text-sm text-muted-foreground">Cet espace ne contient aucun item de type BUG.</p>
        </div>
      </div>
    );
  }

  return <ListView items={bugs} portalGroups={bugPortalGroups} {...rest} />;
}
