/* Garde de navigation : confirme si modifications non enregistrées (useFormChanges).
 * Dialogue de confirmation : focus sur « Rester » (action destructive = quitter), Tab piégé (useDialogFocus).
 * useUnsavedGuard(hasChanges, options) :
 *   - options.onSaveAndLeave : ajoute « Enregistrer et quitter » (bouton principal). L'appelant enregistre et ferme
 *     lui-même après succès (ItemEditModal : doSubmit(true)) ; en cas d'échec (conflit, validation) il reste ouvert.
 *     Ne le passer que si l'utilisateur peut enregistrer ; absent = deux boutons (Rester / Quitter sans enregistrer).
 *   - options.hints : rappels fonctionnels (HelpHint) des deux boutons à effet, textes lus dans la fiche d'aide de l'appelant. */
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { DevModalBadge } from './DevModalBadge';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { HelpHint } from '../../help/HelpHint';

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

export interface UnsavedGuardOptions {
  /** Enregistre puis ferme (fermeture à la charge de l'appelant, après succès) */
  onSaveAndLeave?: () => void;
  /** Infobulles des boutons à effet */
  hints?: { leave?: string; saveAndLeave?: string };
}

/**
 * Hook for modal/page close confirmation.
 * Returns a wrapper for onClose that shows a confirm dialog if there are unsaved changes.
 */
export function useUnsavedGuard(hasChanges: boolean, options: UnsavedGuardOptions = {}) {
  const { onSaveAndLeave, hints } = options;
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(panelRef, showConfirm);

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

  const saveAndLeave = () => {
    setShowConfirm(false);
    setPendingAction(null);
    onSaveAndLeave?.();
  };

  const ConfirmDialog = showConfirm ? (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={cancel}>
      <div ref={panelRef} className="bg-card border rounded-lg shadow-xl p-6 max-w-md mx-4 outline-none" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">Modifications non enregistrées <DevModalBadge name="UnsavedChangesGuard" /></h3>
        <p className="text-sm text-muted-foreground mb-4">
          {onSaveAndLeave
            ? 'Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de quitter ?'
            : 'Vous avez des modifications non enregistrées. Voulez-vous quitter sans sauvegarder ?'}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="bordered" size="sm" onClick={cancel} data-autofocus>
            Rester
          </Button>
          <HelpHint text={hints?.leave}>
            <Button variant="destructive" size="sm" onClick={confirm}>
              Quitter sans enregistrer
            </Button>
          </HelpHint>
          {onSaveAndLeave && (
            <HelpHint text={hints?.saveAndLeave}>
              <Button size="sm" onClick={saveAndLeave} className="bg-orange-500 text-white hover:bg-orange-600">
                Enregistrer et quitter
              </Button>
            </HelpHint>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return { guard, ConfirmDialog };
}
