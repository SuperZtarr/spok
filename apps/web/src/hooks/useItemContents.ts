/*
 * useItemContents(spaceId, itemId) — écritures des contenus d'un élément (images, fichiers, liens, schémas ; contenus
 * multiples, lot 2). Pas de lecture propre : les contenus arrivent avec l'élément (item.contents, clé
 * ['item', spaceId, itemId]) — détail complet avec le xml des schémas.
 * Mutations : add (lien, image par adresse, schéma), upload (image ou fichier ; previewOf = aperçu PNG d'un schéma),
 * refreshPreview (aperçu d'un lien, 2026-11-25), update (nom, adresse, xml), remove, reorder (ordre complet d'une sorte), move (vers un autre élément, 2026-11-21).
 * Après chaque écriture, la fiche ['item', …] et les listes ['items', spaceId] sont relues : updatedAt a changé (sinon
 * faux conflit 409 à l'enregistrement de la fiche) et les vignettes des listes reprennent les contenus.
 * Réservé à ItemContentsSection.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itemContentsApi, type ItemContentInput } from '../lib/api';

/** Délai avant de relire la fiche après l'ajout d'un lien (aperçu cherché en tâche de fond, 5 s max par requête) */
export const LINK_PREVIEW_DELAY_MS = 6000;

export function useItemContents(spaceId: string, itemId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] }),
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] }),
  ]);

  const add = useMutation({
    mutationFn: (body: ItemContentInput) => itemContentsApi.add(spaceId, itemId!, body),
    onSuccess: (_d, body) => {
      // Lien : l'API cherche l'image du site en tâche de fond — fiche relue un peu plus tard pour l'afficher
      if (body.kind === 'LINK') setTimeout(() => { void refresh(); }, LINK_PREVIEW_DELAY_MS);
      return refresh();
    },
  });
  // Actualiser l'aperçu d'un lien (2026-11-25) : récupération synchrone côté API
  const refreshPreview = useMutation({
    mutationFn: (contentId: string) => itemContentsApi.refreshPreview(spaceId, itemId!, contentId),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: ({ kind, file, previewOf }: { kind: 'image' | 'file'; file: File | Blob; previewOf?: string }) =>
      itemContentsApi.upload(spaceId, itemId!, kind, file, previewOf),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string | null; url?: string | null; xml?: string }) =>
      itemContentsApi.update(spaceId, itemId!, id, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (contentId: string) => itemContentsApi.remove(spaceId, itemId!, contentId),
    onSuccess: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => itemContentsApi.reorder(spaceId, itemId!, ids),
    onSuccess: refresh,
  });

  // Déplacement vers un autre élément (2026-11-21) : la fiche de la cible est relue aussi
  const move = useMutation({
    mutationFn: ({ id, target }: { id: string; target: { id: string; spaceId: string } }) =>
      itemContentsApi.move(spaceId, itemId!, id, target.id),
    onSuccess: (_d, { target }) => Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ['item', target.spaceId, target.id] }),
      queryClient.invalidateQueries({ queryKey: ['items', target.spaceId] }),
    ]),
  });

  return { add, upload, update, remove, reorder, move, refreshPreview };
}
