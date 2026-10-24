/*
 * Choix d'un élément existant à référencer dans un article (mode Composer). Route dédiée
 * GET …/article/candidates (articlesApi.candidates) : éléments lisibles (hors mode admin, comme l'ajout), sans
 * articles ni éléments déjà présents, classés par pertinence sur le texte visible (règle article-picker-relevance).
 * - à l'ouverture : récents de l'espace de l'article ; recherche dès 2 caractères, 250 ms après la frappe ;
 * - portée « Cette communauté » (défaut, remise à chaque ouverture) ou « Partout » ;
 * - partie trouvée en gras dans le titre et l'extrait (highlightSegments, aucun HTML injecté).
 * - cases « Avec ses enfants » / « Avec les éléments qui en découlent » (décochées à chaque ouverture) : transmises
 *   à onPick ; l'appelant fait alors un ajout groupé (aperçu + ArticleBatchConfirm) au lieu d'un ajout unitaire.
 * Props : isOpen, onClose, onPick(itemId, { children, chain }), spaceId / articleId (article composé). L'avertissement « moins visible »
 * est géré par l'appelant. Textes : pages/help/article.help.ts (addItem, pickerScope, pickerRecent, pickerEmpty).
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { articlesApi } from '../../lib/api';
import { TYPE_ICONS, TYPE_LABELS } from '../../constants/ui';
import { pageHint } from '../../help/pageHint';
import { HelpHint } from '../../help/HelpHint';
import { highlightSegments } from './highlight';

type Scope = 'community' | 'all';

function Highlighted({ text, term }: { text: string; term: string }) {
  return <>{highlightSegments(text, term).map((s, i) => (s.match ? <strong key={i} className="font-semibold text-foreground">{s.text}</strong> : <span key={i}>{s.text}</span>))}</>;
}

export function ArticleItemPicker({ isOpen, onClose, onPick, spaceId, articleId }: {
  isOpen: boolean;
  onClose: () => void;
  onPick: (itemId: string, with_: { children: boolean; chain: boolean }) => void;
  spaceId: string;
  articleId: string;
}) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<Scope>('community');
  const [term, setTerm] = useState('');
  const [children, setChildren] = useState(false);
  const [chain, setChain] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQ('');
    setTerm('');
    setScope('community');
    setChildren(false);
    setChain(false);
  }, [isOpen]);

  useEffect(() => {
    const t = q.trim();
    const id = setTimeout(() => setTerm(t.length >= 2 ? t : ''), 250);
    return () => clearTimeout(id);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ['article-candidates', spaceId, articleId, term, scope],
    queryFn: () => articlesApi.candidates(spaceId, articleId, { q: term, scope }),
    enabled: isOpen,
  });
  const items = data?.items ?? [];

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
        <HelpHint text={pageHint('article', 'pickerScope')} className="inline-flex">
        <div className="flex items-center gap-2 text-xs">
          {([['community', 'Cette communauté'], ['all', 'Partout']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              aria-pressed={scope === value}
              className={`px-2.5 py-1 rounded-md border transition-colors ${scope === value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-accent'}`}
            >
              {label}
            </button>
          ))}
        </div>
        </HelpHint>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <HelpHint text={pageHint('article', 'pickChildren')} className="inline-flex">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={children} onChange={(e) => setChildren(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              Avec ses enfants
            </label>
          </HelpHint>
          <HelpHint text={pageHint('article', 'pickChain')} className="inline-flex">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              Avec les éléments qui en découlent
            </label>
          </HelpHint>
        </div>
        {!term &&<p className="text-xs text-muted-foreground">{pageHint('article', 'pickerRecent')}</p>}
        <div className="max-h-[360px] overflow-y-auto border rounded-md divide-y">
          {!isFetching && items.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">{pageHint('article', 'pickerEmpty')}</div>
          )}
          {items.map((i) => {
            const Icon = TYPE_ICONS[i.type] || TYPE_ICONS.NOTE;
            return (
              <button key={i.id} type="button" onClick={() => onPick(i.id, { children, chain })} className="w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-accent transition-colors">
                <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm truncate"><Highlighted text={i.title} term={term} /></span>
                  {i.snippet && <span className="block text-xs text-muted-foreground line-clamp-2"><Highlighted text={i.snippet} term={term} /></span>}
                </span>
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
