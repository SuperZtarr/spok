/*
 * Entrées des vues Images, Documents et Liens (contenus multiples, lot 3a, décision Thomas 2026-11-08) :
 * une vue montre UNE ENTRÉE PAR CONTENU de sa sorte, quel que soit le type de l'élément (un élément à 3 fichiers =
 * 3 entrées dans Documents). Règle de gestion : businessRules.ts (item-contents-views).
 * - contentEntries(items, kinds) : entrées dans l'ordre des éléments puis des contenus (ordre fixe des sortes) ;
 *   seuls les contenus qui ont une adresse sûre (isSafeUrl) — un schéma sans aperçu n'apparaît pas.
 *   Vue Images : ['IMAGE', 'DIAGRAM'] (schémas avec aperçu, comme avant) ; Documents : ['FILE'] ; Liens : ['LINK'].
 * - libellé : titre de l'élément ; si l'élément a plusieurs contenus de ces sortes, « titre — nom du contenu ».
 * - fileExtension : extension en capitales, depuis le nom du contenu, sinon depuis l'adresse.
 * Fonctions pures, sans DOM ni React. L'identifiant d'entrée (key) est celui du contenu : à utiliser comme clé React et
 * id de glisser-déposer ; le déplacement porte toujours sur l'élément (entry.item).
 */
import type { Item, ItemContent, ItemContentKind } from '@spok/shared';
import { isSafeUrl } from './sanitizeHtml';
import { fileNameFromUrl } from './itemClipboard';

export interface ContentEntry<T extends Item = Item> {
  /** id du contenu — unique dans la vue */
  key: string;
  item: T;
  content: ItemContent;
  url: string;
  /** titre affiché de l'entrée */
  label: string;
  /** nom du contenu (fichier, lien) ou, à défaut, tiré de l'adresse */
  name: string;
}

export function contentEntries<T extends Item>(items: T[] | undefined, kinds: readonly ItemContentKind[]): ContentEntry<T>[] {
  if (!items) return [];
  const entries: ContentEntry<T>[] = [];
  for (const item of items) {
    const kept = (item.contents ?? []).filter((c) => kinds.includes(c.kind) && !!c.url && isSafeUrl(c.url));
    for (const content of kept) {
      const url = content.url!;
      const name = content.name?.trim() || fileNameFromUrl(url);
      entries.push({
        key: content.id,
        item,
        content,
        url,
        name,
        label: kept.length > 1 ? `${item.title} — ${name}` : item.title,
      });
    }
  }
  return entries;
}

export function fileExtension(entry: Pick<ContentEntry, 'name' | 'url'>): string {
  const from = (s: string) => {
    const base = s.split(/[?#]/)[0].split('/').pop() || '';
    const dot = base.lastIndexOf('.');
    return dot > 0 && dot < base.length - 1 ? base.slice(dot + 1).toUpperCase() : '';
  };
  return from(entry.name) || from(entry.url);
}
