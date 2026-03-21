import { useMemo } from 'react';
import { Bug } from 'lucide-react';
import { ListView } from './ListView';
import type { Item, SpaceReferentiels } from '@spok/shared';

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
  onConvertToSpace?: (id: string) => void;
  referentiels?: SpaceReferentiels;
  canEdit?: boolean;
}

export function BugsView({ items, ...rest }: BugsViewProps) {
  const bugs = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.type === 'BUG');
  }, [items]);

  if (bugs.length === 0) {
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

  return <ListView items={bugs} {...rest} />;
}
