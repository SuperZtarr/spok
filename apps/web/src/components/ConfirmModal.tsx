import { AlertTriangle, LogOut } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  confirmVariant?: 'destructive' | 'default';
  isPending?: boolean;
  icon?: 'warning' | 'leave';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  warning,
  confirmLabel = 'Confirmer',
  confirmVariant = 'destructive',
  isPending = false,
  icon = 'warning',
}: ConfirmModalProps) {
  const IconComponent = icon === 'leave' ? LogOut : AlertTriangle;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="small">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
          <IconComponent className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm">{message}</p>
        </div>

        {warning && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{warning}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="bordered" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            disabled={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
