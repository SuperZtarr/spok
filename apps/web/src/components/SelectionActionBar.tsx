import { X, FolderInput, CheckSquare, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useSelectionStore } from '../stores/selection';

interface SelectionActionBarProps {
  onMoveToSpace: () => void;
  onBulkDelete?: () => void;
  onBulkStatusChange?: (status: string) => void;
}

export function SelectionActionBar({
  onMoveToSpace,
  onBulkDelete,
  onBulkStatusChange,
}: SelectionActionBarProps) {
  const { selectedIds, clearSelection } = useSelectionStore();
  const selectedCount = selectedIds.size;

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
      <span className="text-sm font-medium">
        {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
      </span>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onMoveToSpace}
          title="Déplacer vers un autre espace"
        >
          <FolderInput className="w-4 h-4 mr-2" />
          Déplacer
        </Button>

        {onBulkStatusChange && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onBulkStatusChange('done')}
            title="Marquer comme terminé"
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Terminer
          </Button>
        )}

        {onBulkDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkDelete}
            className="text-destructive hover:text-destructive"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      <Button
        variant="ghost"
        size="sm"
        onClick={clearSelection}
        title="Annuler la sélection"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
