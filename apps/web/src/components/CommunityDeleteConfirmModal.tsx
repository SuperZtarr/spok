import { useState, useEffect } from 'react';
import { AlertTriangle, Folder, Loader2, FileText, Users } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { communitiesApi, adminApi } from '../lib/api';

interface CommunityDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteChildren: boolean) => void;
  communityId: string;
  communityName: string;
  isPending?: boolean;
  isAdmin?: boolean;
}

interface DeletePreview {
  spaces: Array<{ id: string; name: string; itemCount: number }>;
  totalItemCount: number;
  totalMemberCount: number;
}

export function CommunityDeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  communityId,
  communityName,
  isPending = false,
  isAdmin = false,
}: CommunityDeleteConfirmModalProps) {
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteChildren, setDeleteChildren] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && communityId) {
      setLoading(true);
      setError(null);
      setDeleteChildren(false);
      const api = isAdmin ? adminApi.communities : communitiesApi;
      api.deletePreview(communityId)
        .then(setPreview)
        .catch((err: any) => setError(err.message || 'Erreur lors du chargement'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, communityId, isAdmin]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Supprimer la communaut\u00e9 "${communityName}"`} size="small">
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
                <p className="font-medium">Cette communaut\u00e9 contient :</p>
                <ul className="list-disc list-inside text-muted-foreground">
                  <li>{preview.spaces.length} espace{preview.spaces.length !== 1 ? 's' : ''}</li>
                  <li>{preview.totalItemCount} item{preview.totalItemCount !== 1 ? 's' : ''} au total</li>
                  <li>{preview.totalMemberCount} membre{preview.totalMemberCount !== 1 ? 's' : ''}</li>
                </ul>
              </div>
            </div>

            {/* Spaces list */}
            {preview.spaces.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {preview.spaces.map(space => (
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
            {preview.spaces.length > 0 && (
              <label className="flex items-start gap-3 p-3 border border-border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="checkbox"
                  checked={deleteChildren}
                  onChange={(e) => setDeleteChildren(e.target.checked)}
                  className="mt-0.5"
                />
                <div className="text-sm">
                  <span className="font-medium">
                    Supprimer aussi les {preview.spaces.length} espace{preview.spaces.length !== 1 ? 's' : ''} et leurs {preview.totalItemCount} item{preview.totalItemCount !== 1 ? 's' : ''}
                  </span>
                  <p className="text-muted-foreground mt-1">
                    {deleteChildren
                      ? 'Tous les espaces, items et contributions seront supprim\u00e9s (restaurable depuis l\u2019admin).'
                      : 'Les espaces seront d\u00e9tach\u00e9s de la communaut\u00e9 et deviendront ind\u00e9pendants.'}
                  </p>
                </div>
              </label>
            )}

            {/* Warning */}
            {deleteChildren && preview.totalItemCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  {preview.spaces.length} espace{preview.spaces.length !== 1 ? 's' : ''} et {preview.totalItemCount} item{preview.totalItemCount !== 1 ? 's' : ''} seront supprim\u00e9s.
                  Toutes les donn\u00e9es seront sauvegard\u00e9es dans les logs d'audit.
                </span>
              </div>
            )}

            {/* Members warning */}
            <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md text-sm text-amber-800 dark:text-amber-200">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>{preview.totalMemberCount} membre{preview.totalMemberCount !== 1 ? 's' : ''} perdront leur acc\u00e8s \u00e0 la communaut\u00e9.</span>
            </div>
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
