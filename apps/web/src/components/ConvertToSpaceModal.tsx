import { useState, useEffect } from 'react';
import { FolderPlus, Loader2, ArrowRight } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

interface ConvertToSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (spaceName: string) => void;
  itemTitle: string;
  childCount: number;
  isPending?: boolean;
}

export function ConvertToSpaceModal({
  isOpen,
  onClose,
  onConfirm,
  itemTitle,
  childCount,
  isPending = false,
}: ConvertToSpaceModalProps) {
  const [spaceName, setSpaceName] = useState(itemTitle);

  useEffect(() => {
    setSpaceName(itemTitle);
  }, [itemTitle]);

  const handleConfirm = () => {
    if (spaceName.trim()) {
      onConfirm(spaceName.trim());
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convertir en espace" size="small">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
          <FolderPlus className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p>
              L'item <strong>{itemTitle}</strong> et ses{' '}
              <strong>{childCount} enfant{childCount !== 1 ? 's' : ''}</strong> seront
              d\u00e9plac\u00e9s dans un nouvel espace.
            </p>
            <p className="text-muted-foreground">
              La hi\u00e9rarchie parent-enfant sera pr\u00e9serv\u00e9e. Les tags seront recr\u00e9\u00e9s dans le nouvel espace.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="spaceName" className="block text-sm font-medium mb-1.5">
            Nom du nouvel espace
          </label>
          <input
            id="spaceName"
            type="text"
            value={spaceName}
            onChange={(e) => setSpaceName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Nom de l'espace"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && spaceName.trim()) {
                handleConfirm();
              }
            }}
          />
        </div>

        <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md text-sm text-primary">
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
          <span>{childCount + 1} \u00e9l\u00e9ment{childCount > 0 ? 's' : ''} seront d\u00e9plac\u00e9s vers le nouvel espace.</span>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !spaceName.trim()}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <FolderPlus className="w-4 h-4 mr-2" />
            )}
            Convertir
          </Button>
        </div>
      </div>
    </Modal>
  );
}
