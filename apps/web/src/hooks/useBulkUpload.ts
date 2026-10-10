/*
 * Import en masse de fichiers dans un espace : un item IMAGE ou DOCUMENT par fichier (vues Images / Documents).
 * Branche runBulkUpload (lib/bulkUpload) sur itemsApi et expose l'état d'avancement au composant.
 * Params : spaceId (espace cible, items créés à la racine), kind ('image' | 'document').
 * Les images sont réduites dans le navigateur avant envoi (lib/imageResize). À la fin, invalide
 * ['items', spaceId] et ['space', spaceId] (compteur d'items) — une seule fois, pas à chaque fichier.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';
import { runBulkUpload, type BulkUploadResult } from '../lib/bulkUpload';
import { resizeImageFile } from '../lib/imageResize';
import type { UploadKind } from '../lib/uploadRules';

export interface BulkUploadProgress {
  done: number;
  total: number;
}

export function useBulkUpload(spaceId: string | undefined, kind: UploadKind) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BulkUploadProgress | null>(null);
  const [result, setResult] = useState<BulkUploadResult | null>(null);

  const start = useCallback(async (files: File[]) => {
    if (!spaceId || files.length === 0) return;
    setResult(null);
    setProgress({ done: 0, total: files.length });
    try {
      const res = await runBulkUpload(files, kind, {
        prepare: kind === 'image' ? resizeImageFile : async (f) => f,
        createItem: async (title) => (await itemsApi.create(spaceId, { type: kind === 'image' ? 'IMAGE' : 'DOCUMENT', title })).id,
        upload: async (itemId, file) => {
          if (kind === 'image') await itemsApi.uploadImage(spaceId, itemId, file);
          else await itemsApi.uploadDocument(spaceId, itemId, file);
        },
        deleteItem: async (itemId) => { await itemsApi.delete(spaceId, itemId); },
      }, {
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
    } finally {
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: ['items', spaceId] });
      queryClient.invalidateQueries({ queryKey: ['space', spaceId] });
    }
  }, [spaceId, kind, queryClient]);

  const dismissResult = useCallback(() => setResult(null), []);

  return { start, progress, result, dismissResult, running: progress !== null };
}
