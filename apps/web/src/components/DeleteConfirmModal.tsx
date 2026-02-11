import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { TYPE_ICONS, TYPE_LABELS } from '../constants/ui';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { deleteChildren: boolean }) => void;
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
  const [deleteChildren, setDeleteChildren] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) setDeleteChildren(false);
  }, [isOpen]);

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
              <div className={`flex items-start gap-2 p-3 rounded-md text-sm border ${
                deleteChildren
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-yellow-50 border-yellow-200 text-yellow-800'
              }`}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>{childCount}</strong> élément{childCount > 1 ? 's' : ''} enfant{childCount > 1 ? 's' : ''}{' '}
                  {deleteChildren
                    ? (childCount > 1 ? 'seront aussi supprimés' : 'sera aussi supprimé')
                    : (childCount > 1 ? 'seront déplacés' : 'sera déplacé') + ' à la racine'
                  }
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

        {/* Delete children option */}
        {childCount > 0 && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteChildren}
              onChange={(e) => setDeleteChildren(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm">
              Supprimer aussi les {childCount} enfant{childCount > 1 ? 's' : ''}
            </span>
          </label>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={() => onConfirm({ deleteChildren })}>
            Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
