/*
 * Import en masse de fichiers dans un espace (vues Images / Documents) : un élément « Élément » (type UNDEFINED) par
 * fichier, qui porte ce fichier comme contenu Image (kind 'image') ou Fichier (kind 'document') — contenus multiples,
 * lot 3a, décision Thomas 2026-11-08 (règle bulk-upload-element-content). Le titre est le nom du fichier sans extension.
 * Branche runBulkUpload (lib/bulkUpload) sur itemsApi (création, suppression si l'envoi échoue) et itemContentsApi
 * (envoi du contenu), et expose l'état d'avancement au composant.
 * Params : spaceId (espace cible, items créés à la racine), kind ('image' | 'document').
 * Les images sont réduites dans le navigateur avant envoi (lib/imageResize). À la fin, invalide
 * ['items', spaceId] et ['space', spaceId] (compteur d'items) — une seule fois, pas à chaque fichier.
 */
import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { itemsApi, itemContentsApi } from '../lib/api';
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
        createItem: async (title) => (await itemsApi.create(spaceId, { type: 'UNDEFINED', title })).id,
        upload: async (itemId, file) => {
          await itemContentsApi.upload(spaceId, itemId, kind === 'image' ? 'image' : 'file', file);
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
