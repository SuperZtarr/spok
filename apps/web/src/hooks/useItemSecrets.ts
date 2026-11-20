/*
 * useItemSecrets(spaceId, itemId) — données sécurisées d'un élément (2026-11-20, routes/item-secrets.ts).
 * - list : libellés et droits (ItemSecretSummary), clé ['item-secrets', spaceId, itemId] ; jamais de valeur.
 * - add / update / remove : écritures ; relisent la liste, la fiche ['item', …] (updatedAt a changé : sinon faux
 *   conflit 409 à l'enregistrement de la fiche) et les listes ['items', spaceId].
 * La révélation n'est PAS ici : ItemSecretsSection appelle itemSecretsApi.reveal directement et garde la valeur dans
 * son seul état local, jamais dans le cache React Query (requêtes ni mutations).
 * Réservé à ItemSecretsSection et ItemContentsSection (présence de la section).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemSecretsApi, type ItemSecretInput } from '../lib/api';

export const itemSecretsKey = (spaceId: string, itemId: string | undefined) => ['item-secrets', spaceId, itemId] as const;

export function useItemSecretList(spaceId: string, itemId: string | undefined) {
  return useQuery({
    queryKey: itemSecretsKey(spaceId, itemId),
    queryFn: () => itemSecretsApi.list(spaceId, itemId!),
    enabled: !!itemId,
  });
}

export function useItemSecrets(spaceId: string, itemId: string | undefined) {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: itemSecretsKey(spaceId, itemId) }),
    queryClient.invalidateQueries({ queryKey: ['item', spaceId, itemId] }),
    queryClient.invalidateQueries({ queryKey: ['items', spaceId] }),
  ]);

  const add = useMutation({
    mutationFn: (body: ItemSecretInput) => itemSecretsApi.add(spaceId, itemId!, body),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<ItemSecretInput> & { id: string }) => itemSecretsApi.update(spaceId, itemId!, id, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (secretId: string) => itemSecretsApi.remove(spaceId, itemId!, secretId),
    onSuccess: refresh,
  });
  return { add, update, remove };
}
