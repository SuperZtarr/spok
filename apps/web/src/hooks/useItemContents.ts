/*
 * useItemContents(spaceId, itemId) — écritures des contenus d'un élément (images, fichiers, liens, schémas ; contenus
 * multiples, lot 2). Pas de lecture propre : les contenus arrivent avec l'élément (item.contents, clé
 * ['item', spaceId, itemId]) — détail complet avec le xml des schémas.
 * Mutations : add (lien, image par adresse, schéma), upload (image ou fichier ; previewOf = aperçu PNG d'un schéma),
 * update (nom, adresse, xml), remove, reorder (ordre complet d'une sorte).
 * Après chaque écriture, la fiche ['item', …] et les listes ['items', spaceId] sont relues : updatedAt a changé (sinon
 * faux conflit 409 à l'enregistrement de la fiche) et les vignettes des listes reprennent les contenus.
 * Réservé à ItemContentsSection.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itemContentsApi, type ItemContentInput } from '../lib/api';

export function useItemContents(spaceId: string, itemId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] }),
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] }),
  ]);

  const add = useMutation({
    mutationFn: (body: ItemContentInput) => itemContentsApi.add(spaceId, itemId!, body),
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

  return { add, upload, update, remove, reorder };
}
