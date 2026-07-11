/* Boutons standard de formulaire (Enregistrer/Annuler) avec état dirty/saving. */
import { Loader2 } from 'lucide-react';
import { Button } from './Button';

interface FormActionsProps {
  hasChanges: boolean;
  isPending: boolean;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}

export function FormActions({
  hasChanges,
  isPending,
  onSave,
  onCancel,
  saveLabel = 'Enregistrer',
  cancelLabel = 'Annuler',
}: FormActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {hasChanges && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
      )}
      <Button
        size="sm"
        onClick={onSave}
        disabled={!hasChanges || isPending}
        className={!hasChanges ? 'opacity-40 cursor-not-allowed' : ''}
      >
        {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  );
}
