/*
 * Sélecteur à parcourir d'un article (« Élément » de la barre d'insertion, mode Composer — décision Thomas 2026-10-24) :
 * - colonne gauche : espaces lisibles de la portée (Cette communauté / Partout), avec leur nombre d'éléments ; l'espace
 *   de l'article est choisi à l'ouverture (articlesApi.browseSpaces) ;
 * - onglet « Éléments » : arbre des éléments de l'espace choisi (articlesApi.browseItems, 500 max, articles exclus),
 *   dépliable, type et statut ; pastilles de type (liste à plat) ; recherche dès 2 caractères (articlesApi.candidates,
 *   portée espace ou Partout, extrait surligné) ;
 * - onglet « Processus » si l'espace en a un : tout le processus ou un couloir → onAddProcess ;
 * - sélection multiple gardée d'un espace à l'autre ; éléments déjà présents grisés « déjà ajouté » ; options « avec
 *   ses enfants » / « ce qui en découle » ; « Ajouter (n) » → onAdd(ids dans l'ordre de l'arbre, options).
 * Arbre et ordre : articleBrowserTree.ts. Textes : pages/help/article.help.ts (browser*, pick*, addProcess…).
 * Props : isOpen, onClose, spaceId / articleId (article composé), presentIds (blocs déjà là), onAdd, onAddProcess.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Search, Workflow } from 'lucide-react';
import type { ArticleBatchSource } from '@spok/shared';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { articlesApi } from '../../lib/api';
import { TYPE_ICONS, TYPE_LABELS } from '../../constants/ui';
import { HelpHint } from '../../help/HelpHint';
import { pageHint } from '../../help/pageHint';
import { highlightSegments } from './highlight';
import { buildBrowserRows, orderSelection } from './articleBrowserTree';

type Scope = 'community' | 'all';
type ProcessSource = Extract<ArticleBatchSource, { kind: 'process' }>;

function Highlighted({ text, term }: { text: string; term: string }) {
  return <>{highlightSegments(text, term).map((s, i) => (s.match ? <strong key={i} className="font-semibold text-foreground">{s.text}</strong> : <span key={i}>{s.text}</span>))}</>;
}

function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  return (
    <HelpHint text={pageHint('article', 'pickerScope')} className="inline-flex">
      <div className="flex items-center gap-1.5 text-xs">
        {([['community', 'Cette communauté'], ['all', 'Partout']] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => onChange(value)} aria-pressed={scope === value}
            className={`px-2 py-1 rounded-md border transition-colors ${scope === value ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border hover:bg-accent'}`}>
            {label}
          </button>
        ))}
      </div>
    </HelpHint>
  );
}

export function ArticleBrowser({ isOpen, onClose, spaceId, articleId, presentIds, onAdd, onAddProcess }: {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  articleId: string;
  presentIds: Set<string>;
  onAdd: (itemIds: string[], opts: { children: boolean; chain: boolean }) => void;
  onAddProcess: (source: ProcessSource) => void;
}) {
  const [scope, setScope] = useState<Scope>('community');
  const [activeSpace, setActiveSpace] = useState(spaceId);
  const [tab, setTab] = useState<'items' | 'process'>('items');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [types, setTypes] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checkOrder, setCheckOrder] = useState<string[]>([]);
  const [children, setChildren] = useState(false);
  const [chain, setChain] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setScope('community'); setActiveSpace(spaceId); setTab('items'); setQ(''); setTerm('');
    setTypes(new Set()); setExpanded(new Set()); setSelected(new Set()); setCheckOrder([]);
    setChildren(false); setChain(false);
  }, [isOpen, spaceId]);

  useEffect(() => {
    const t = q.trim();
    const id = setTimeout(() => setTerm(t.length >= 2 ? t : ''), 250);
    return () => clearTimeout(id);
  }, [q]);

  const spacesQuery = useQuery({
    queryKey: ['article-browse-spaces', spaceId, articleId, scope],
    queryFn: () => articlesApi.browseSpaces(spaceId, articleId, scope),
    enabled: isOpen,
  });
  const itemsQuery = useQuery({
    queryKey: ['article-browse-items', spaceId, articleId, activeSpace],
    queryFn: () => articlesApi.browseItems(spaceId, articleId, activeSpace),
    enabled: isOpen && !!activeSpace,
  });
  const searchQuery = useQuery({
    queryKey: ['article-candidates', spaceId, articleId, term, scope, activeSpace],
    queryFn: () => articlesApi.candidates(spaceId, articleId, scope === 'all' ? { q: term, scope: 'all' } : { q: term, scope: 'space', spaceId: activeSpace }),
    enabled: isOpen && !!term,
  });

  const spaces = spacesQuery.data ?? [];
  const space = spaces.find((s) => s.spaceId === activeSpace);
  const items = itemsQuery.data?.items ?? [];
  const typeChoices = useMemo(() => [...new Set(items.map((i) => i.type))], [items]);
  const rows = useMemo(() => buildBrowserRows(items, expanded, types), [items, expanded, types]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setCheckOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };
  const toggleType = (t: string) => setTypes((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const toggleExpand = (id: string) => setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const row = (id: string, type: string, content: React.ReactNode, depth = 0, expander?: React.ReactNode) => {
    const Icon = TYPE_ICONS[type] || TYPE_ICONS.NOTE;
    const present = presentIds.has(id);
    return (
      <div key={id} className={`flex items-start gap-2 px-2 py-1.5 ${present ? 'opacity-50' : 'hover:bg-accent'}`} style={{ paddingLeft: `${0.5 + depth * 1.25}rem` }}>
        <span className="w-4 flex-shrink-0">{expander}</span>
        <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
          <input type="checkbox" className="mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0" disabled={present} checked={selected.has(id)} onChange={() => toggle(id)} aria-label={typeof content === 'string' ? content : undefined} />
          <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
          <span className="min-w-0 flex-1 text-sm">{content}</span>
        </label>
        {present && (
          <HelpHint text={pageHint('article', 'browserPresent')}>
            <span className="text-xs text-muted-foreground flex-shrink-0">déjà ajouté</span>
          </HelpHint>
        )}
      </div>
    );
  };

  const count = selected.size;
  const add = () => onAdd(orderSelection(selected, items, checkOrder), { children, chain });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter des éléments" devName="ArticleBrowser" size="xl">
      <div className="grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-3 h-[65vh] min-h-0">
        <aside className="flex flex-col gap-2 min-h-0 border-b md:border-b-0 md:border-r border-border md:pr-3 pb-2 md:pb-0">
          <ScopeToggle scope={scope} onChange={setScope} />
          <HelpHint text={pageHint('article', 'browserSpaces')} className="inline-flex">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Espaces</span>
          </HelpHint>
          <div className="overflow-y-auto min-h-0 max-h-40 md:max-h-none space-y-0.5">
            {spaces.map((s) => (
              <button key={s.spaceId} type="button" onClick={() => { setActiveSpace(s.spaceId); setTab('items'); setTypes(new Set()); setExpanded(new Set()); }}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${s.spaceId === activeSpace ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent'}`}>
                <span className="truncate flex-1">{s.name}</span>
                {s.process && <Workflow className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground flex-shrink-0">{s.itemCount}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col gap-2 min-h-0">
          <div role="tablist" className="flex items-center gap-1 border-b border-border">
            <button role="tab" type="button" aria-selected={tab === 'items'} onClick={() => setTab('items')}
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === 'items' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'}`}>Éléments</button>
            {space?.process && (
              <button role="tab" type="button" aria-selected={tab === 'process'} onClick={() => setTab('process')}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === 'process' ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'}`}>Processus</button>
            )}
          </div>

          {tab === 'process' && space?.process ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{pageHint('article', 'addProcess')}</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => onAddProcess({ kind: 'process', spaceId: space.spaceId })} className="text-xs px-2 py-1 rounded border border-primary/60 text-primary hover:bg-primary/10">
                  Tout le processus ({space.process.nodeCount})
                </button>
                {space.process.lanes.map((l) => (
                  <button key={l.id} type="button" onClick={() => onAddProcess({ kind: 'process', spaceId: space.spaceId, laneId: l.id })} className="text-xs px-2 py-1 rounded border border-border hover:bg-accent truncate max-w-[16rem]">
                    {l.title}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <HelpHint text={pageHint('article', 'browserSearch')} className="block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={scope === 'all' ? 'Chercher dans tous les espaces…' : 'Chercher dans cet espace…'}
                    className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </HelpHint>
              {!term && typeChoices.length > 1 && (
                <HelpHint text={pageHint('article', 'browserTypes')} className="inline-flex">
                  <div className="flex flex-wrap gap-1.5">
                    {typeChoices.map((t) => (
                      <button key={t} type="button" onClick={() => toggleType(t)} aria-pressed={types.has(t)}
                        className={`text-xs px-2 py-0.5 rounded-full border ${types.has(t) ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}>
                        {TYPE_LABELS[t] || t}
                      </button>
                    ))}
                  </div>
                </HelpHint>
              )}
              {!term && itemsQuery.data?.truncated && <p className="text-xs text-muted-foreground">{pageHint('article', 'browserTruncated')}</p>}
              <div className="flex-1 min-h-0 overflow-y-auto border rounded-md divide-y">
                {term ? (
                  (searchQuery.data?.items ?? []).length === 0 && !searchQuery.isFetching
                    ? <div className="p-4 text-center text-sm text-muted-foreground">{pageHint('article', 'pickerEmpty')}</div>
                    : (searchQuery.data?.items ?? []).map((c) => row(c.id, c.type, (
                      <span className="block min-w-0">
                        <span className="block truncate" aria-label={c.title}><Highlighted text={c.title} term={term} /></span>
                        {c.snippet && <span className="block text-xs text-muted-foreground line-clamp-2"><Highlighted text={c.snippet} term={term} /></span>}
                        <span className="block text-xs text-muted-foreground">{c.communityName ? `${c.communityName} › ` : ''}{c.spaceName}</span>
                      </span>
                    )))
                ) : rows.length === 0 && !itemsQuery.isFetching ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">{pageHint('article', 'browserEmptySpace')}</div>
                ) : (
                  rows.map((r) => {
                    const expander = r.hasChildren ? (
                      <button type="button" onClick={() => toggleExpand(r.item.id)} aria-label={expanded.has(r.item.id) ? 'Replier' : 'Déplier'} className="text-muted-foreground hover:text-foreground">
                        {expanded.has(r.item.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    ) : undefined;
                    return (
                      <div key={r.item.id} className="relative">
                        {row(r.item.id, r.item.type, r.item.title, r.depth, expander)}
                        {(r.parentTitle || r.item.statusLabel) && (
                          <div className="px-2 pb-1 -mt-1 text-xs text-muted-foreground" style={{ paddingLeft: `${3.25 + r.depth * 1.25}rem` }}>
                            {[r.item.statusLabel, r.parentTitle ? `dans ${r.parentTitle}` : null].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-border">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <HelpHint text={pageHint('article', 'pickChildren')} className="inline-flex">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={children} onChange={(e) => setChildren(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              Avec leurs enfants
            </label>
          </HelpHint>
          <HelpHint text={pageHint('article', 'pickChain')} className="inline-flex">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={chain} onChange={(e) => setChain(e.target.checked)} className="w-3.5 h-3.5 rounded" />
              Avec les éléments qui en découlent
            </label>
          </HelpHint>
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" onClick={onClose}>Annuler</Button>
          <HelpHint text={pageHint('article', 'browserAdd')}>
            <Button onClick={add} disabled={count === 0}>{`Ajouter (${count})`}</Button>
          </HelpHint>
        </div>
      </div>
    </Modal>
  );
}
