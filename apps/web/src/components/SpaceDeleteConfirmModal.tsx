import { useState, useEffect } from 'react';
import { AlertTriangle, Folder, Loader2, FileText } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { spacesApi, adminApi } from '../lib/api';

interface SpaceDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteChildren: boolean) => void;
  spaceId: string;
  spaceName: string;
  isPending?: boolean;
  isAdmin?: boolean;
}

interface DeletePreview {
  childSpaces: Array<{ id: string; name: string; itemCount: number }>;
  directItemCount: number;
  totalItemCount: number;
  totalContributionCount: number;
}

export function SpaceDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  spaceId,
  spaceName,
  isPending = false,
  isAdmin = false,
}: SpaceDeleteConfirmModalProps) {
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && spaceId) {
      setLoading(true);
      setError(null);
      setDeleteChildren(false);
      const api = isAdmin ? adminApi.spaces : spacesApi;
      api.deletePreview(spaceId)
        .then(setPreview)
        .catch((err: any) => setError(err.message || 'Erreur lors du chargement'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, spaceId, isAdmin]);

  const _hasChildren = preview && (preview.childSpaces.length > 0 || preview.directItemCount > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Supprimer l'espace "${spaceName}"`} size="small">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
        ) : preview ? (
          <>
            {/* Summary */}
            <div className="flex items-start gap-3 p-3 bg-muted rounded-md">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium">Cet espace contient :</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>{preview.directItemCount} item{preview.directItemCount !== 1 ? 's' : ''} direct{preview.directItemCount !== 1 ? 's' : ''}</li>
                  {preview.childSpaces.length > 0 && (
                    <li>{preview.childSpaces.length} sous-espace{preview.childSpaces.length !== 1 ? 's' : ''}</li>
                  )}
                  {preview.totalContributionCount > 0 && (
                    <li>{preview.totalContributionCount} contribution{preview.totalContributionCount !== 1 ? 's' : ''} au total</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Child spaces list */}
            {preview.childSpaces.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {preview.childSpaces.map(space => (
                  <div key={space.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{space.name}</span>
                    </div>
                    <span className="text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <FileText className="w-3 h-3" />
                      {space.itemCount}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Delete children checkbox */}
            {preview.childSpaces.length > 0 && (
              <label className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteChildren}
                  onChange={(e) => setDeleteChildren(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <span className="font-medium">
                    Supprimer aussi les {preview.childSpaces.length} sous-espace{preview.childSpaces.length !== 1 ? 's' : ''} et leurs {preview.totalItemCount - preview.directItemCount} item{(preview.totalItemCount - preview.directItemCount) !== 1 ? 's' : ''}
                  </span>
                  <p className="text-muted-foreground mt-1">
                    {deleteChildren
                      ? 'Tout sera supprim\u00e9 d\u00e9finitivement (restaurable depuis l\u2019admin).'
                      : 'Les sous-espaces seront d\u00e9tach\u00e9s et deviendront des espaces ind\u00e9pendants.'}
                  </p>
                </div>
              </label>
            )}

            {/* Warning */}
            {deleteChildren && preview.totalItemCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {preview.totalItemCount} item{preview.totalItemCount !== 1 ? 's' : ''} et {preview.childSpaces.length} sous-espace{preview.childSpaces.length !== 1 ? 's' : ''} seront supprim\u00e9s.
                  Toutes les donn\u00e9es seront sauvegard\u00e9es dans les logs d'audit.
                </span>
              </div>
            )}
          </>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(deleteChildren)}
            disabled={isPending || loading}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Supprimer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
