import { GitBranch } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface StatusPropagationModalProps {
  isOpen: boolean;
  itemTitle: string;
  childCount: number;
  onPropagate: () => void;
  onKeepOnly: () => void;
  onCancel: () => void;
}

export function StatusPropagationModal({
  isOpen,
  itemTitle,
  childCount,
  onPropagate,
  onKeepOnly,
  onCancel,
}: StatusPropagationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onKeepOnly} title="Propager le statut ?" size="small">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
          <GitBranch className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            <span className="font-medium">« {itemTitle} »</span> a{' '}
            {childCount} descendant{childCount > 1 ? 's' : ''}.{' '}
            Voulez-vous appliquer ce statut à tous ses descendants ?
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button variant="default" onClick={onPropagate} className="w-full justify-center">
            Propager aux {childCount} descendant{childCount > 1 ? 's' : ''}
          </Button>
          <Button variant="outline" onClick={onKeepOnly} className="w-full justify-center">
            Cet élément uniquement
          </Button>
          <Button variant="ghost" onClick={onCancel} className="w-full justify-center text-muted-foreground">
            Annuler le changement de statut
          </Button>
        </div>
      </div>
    </Modal>
  );
}
