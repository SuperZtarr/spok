import { useEffect, useState } from 'react';
import { Button } from './Button';

interface UnsavedChangesGuardProps {
  hasChanges: boolean;
  onConfirmLeave: () => void;
  children?: React.ReactNode;
}

/**
 * Intercepts browser close/refresh and shows a confirmation dialog.
 * For modal close, use the useUnsavedGuard hook instead.
 */
export function UnsavedChangesGuard({ hasChanges }: UnsavedChangesGuardProps) {
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  return null;
}

/**
 * Hook for modal/page close confirmation.
 * Returns a wrapper for onClose that shows a confirm dialog if there are unsaved changes.
 */
export function useUnsavedGuard(hasChanges: boolean) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const guard = (action: () => void) => {
    if (hasChanges) {
      setPendingAction(() => action);
      setShowConfirm(true);
    } else {
      action();
    }
  };

  const confirm = () => {
    setShowConfirm(false);
    pendingAction?.();
    setPendingAction(null);
  };

  const cancel = () => {
    setShowConfirm(false);
    setPendingAction(null);
  };

  const ConfirmDialog = showConfirm ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={cancel}>
      <div className="bg-card border rounded-lg shadow-xl p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Modifications non enregistrees</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Vous avez des modifications non enregistrees. Voulez-vous quitter sans sauvegarder ?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={cancel}>
            Rester
          </Button>
          <Button variant="destructive" size="sm" onClick={confirm}>
            Quitter sans sauvegarder
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { guard, ConfirmDialog };
}
