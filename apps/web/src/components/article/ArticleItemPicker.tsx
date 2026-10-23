/*
 * Choix d'un élément existant à référencer dans un article (mode Composer). Recherche avancée (searchApi.advanced,
 * types « items ») : l'API ne renvoie que les éléments que l'utilisateur peut lire, tous espaces et communautés.
 * Exclut les articles (pas d'article dans un article) et les éléments déjà présents (excludeIds).
 * Props : isOpen, onClose, onPick(itemId), excludeIds. L'avertissement « moins visible » est géré par l'appelant.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { searchApi } from '../../lib/api';
import { TYPE_ICONS, TYPE_LABELS } from '../../constants/ui';
import { pageHint } from '../../help/pageHint';

export function ArticleItemPicker({ isOpen, onClose, onPick, excludeIds }: {
  isOpen: boolean;
  onClose: () => void;
  onPick: (itemId: string) => void;
  excludeIds: Set<string>;
}) {
  const [q, setQ] = useState('');
  const term = q.trim();
  const { data, isFetching } = useQuery({
    queryKey: ['article-picker', term],
    queryFn: () => searchApi.advanced({ q: term, types: 'items', pageSize: 30 }),
    enabled: isOpen && term.length >= 2,
  });
  const items = (data?.items ?? []).filter((i) => i.type !== 'ARTICLE' && !excludeIds.has(i.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter un élément" devName="ArticleItemPicker">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{pageHint('article', 'addItem')}</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un élément (2 caractères minimum)…"
            className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto border rounded-md divide-y">
          {term.length >= 2 && !isFetching && items.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">{pageHint('article', 'pickerEmpty')}</div>
          )}
          {items.map((i) => {
            const Icon = TYPE_ICONS[i.type] || TYPE_ICONS.NOTE;
            return (
              <button key={i.id} type="button" onClick={() => onPick(i.id)} className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent transition-colors">
                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm truncate flex-1">{i.title}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0 truncate max-w-[40%]">
                  {TYPE_LABELS[i.type] || i.type} · {i.communityName ? `${i.communityName} › ` : ''}{i.spaceName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
