import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TYPE_ICONS, TYPE_LABELS } from '../constants/ui';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  itemTitle: string;
  itemType: string;
  childCount: number;
  contributionCount: number;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  itemType,
  childCount,
  contributionCount,
}: DeleteConfirmModalProps) {
  const Icon = TYPE_ICONS[itemType];
  const hasWarnings = childCount > 0 || contributionCount > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Supprimer cet élément ?" size="small">
      <div className="space-y-4">
        {/* Item info */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          <span className="text-sm text-muted-foreground">{TYPE_LABELS[itemType] || itemType}</span>
          <span className="font-semibold truncate">{itemTitle}</span>
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="space-y-2">
            {childCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{childCount}</strong> élément{childCount > 1 ? 's' : ''} enfant{childCount > 1 ? 's' : ''}{' '}
                  {childCount > 1 ? 'seront déplacés' : 'sera déplacé'} à la racine
                </span>
              </div>
            )}
            {contributionCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{contributionCount}</strong> contribution{contributionCount > 1 ? 's' : ''}{' '}
                  {contributionCount > 1 ? 'seront' : 'sera'} définitivement supprimée{contributionCount > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
