/*
 * Cibles proposées par la modale de fusion (MergeItemModal) : mêmes refus que l'API (routes/item-merge.ts),
 * pour ne jamais proposer une cible qui finirait en 403/404 après le réglage champ par champ.
 * - même espace que la source (l'API lit les deux items dans l'espace de l'URL — sinon 404 ; arrive quand des
 *   sous-espaces sont inclus dans la vue) ;
 * - ni la source ni ses descendants ;
 * - canManage(item) : l'utilisateur peut gérer l'item (OWNER, ou MEMBER auteur / assigné, hors copie de séance
 *   verrouillée) — passer le canEditItem de SpacePage, qui reprend la règle canMemberManageItem de l'API.
 */
import type { Item } from '@spok/shared';

export function mergeTargets(
  source: Item,
  allItems: Item[],
  canManage: (item: Item) => boolean = () => true,
): Item[] {
  const excluded = new Set<string>([source.id]);
  const addDescendants = (parentId: string) => {
    for (const item of allItems) {
      if (item.parentId === parentId && !excluded.has(item.id)) {
        excluded.add(item.id);
        addDescendants(item.id);
      }
    }
  };
  addDescendants(source.id);
  return allItems.filter((i) => !excluded.has(i.id) && i.spaceId === source.spaceId && canManage(i));
}
