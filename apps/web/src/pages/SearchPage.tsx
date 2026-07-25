/* Recherche globale (/search?q=...) : items et contributions, pagination — anonyme = vide. */
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Building2, FolderKanban, FileText, Users, MessageSquare, Globe, Shield, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { searchApi, communitiesApi, spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';

const ENTITY_TYPES = [
  { key: 'communities', label: 'Communautes', icon: Building2 },
  { key: 'spaces', label: 'Espaces', icon: FolderKanban },
  { key: 'items', label: 'Items', icon: FileText },
  { key: 'users', label: 'Utilisateurs', icon: Users },
  { key: 'contributions', label: 'Contributions', icon: MessageSquare },
] as const;

type EntityType = typeof ENTITY_TYPES[number]['key'];

const ITEM_TYPES = ['UNDEFINED', 'NOTE', 'PROJECT', 'TASK', 'MEETING', 'PERIOD', 'LINK', 'CONFIG', 'DOCUMENT', 'IMAGE', 'BUG'];

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
  return date.toLocaleDateString('fr-FR');
}

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!text || !query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore(s => s.user);

  // All state lives in URL params — local search input synced via debounce
  const qParam = searchParams.get('q') || '';
  const typesParam = searchParams.get('types') || 'communities,spaces,items,users,contributions';
  const communityIdParam = searchParams.get('communityId') || '';
  const spaceIdParam = searchParams.get('spaceId') || '';
  const itemTypeParam = searchParams.get('itemType') || '';
  const itemStatusParam = searchParams.get('itemStatus') || '';
  const tagIdsParam = searchParams.get('tagIds') || '';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  const [search, setSearch] = useState(qParam);
  const searchRef = useRef(search);
  searchRef.current = search;

  // Debounce: update URL q param after 300ms of typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const current = searchRef.current;
      if (current !== qParam) {
        setSearchParams(prev => {
          const params = new URLSearchParams(prev);
          if (current) params.set('q', current);
          else params.delete('q');
          params.set('page', '1');
          return params;
        }, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local input in sync if URL changes externally
  useEffect(() => {
    if (qParam !== searchRef.current) {
      setSearch(qParam);
    }
  }, [qParam]);

  const enabledTypes = useMemo(() => new Set(typesParam.split(',').filter(Boolean)), [typesParam]);

  const toggleType = (type: EntityType) => {
    const next = new Set(enabledTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    if (next.size === 0) return;
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('types', Array.from(next).join(','));
      params.set('page', '1');
      return params;
    }, { replace: true });
  };

  const updateParam = (key: string, value: string) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      if (value) params.set(key, value);
      else params.delete(key);
      params.set('page', '1');
      return params;
    }, { replace: true });
  };

  const setPage = (p: number) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      params.set('page', p.toString());
      return params;
    }, { replace: true });
  };

  // Fetch communities/spaces for scope selectors
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
    enabled: !!user,
  });
  const { data: allSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
    enabled: !!user,
  });

  const scopeSpaces = useMemo(() => {
    if (!allSpaces) return [];
    if (communityIdParam) return allSpaces.filter(s => s.communityId === communityIdParam);
    return allSpaces.filter(s => s.type === 'GROUP');
  }, [allSpaces, communityIdParam]);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['advanced-search', qParam, typesParam, communityIdParam, spaceIdParam, itemTypeParam, itemStatusParam, tagIdsParam, pageParam],
    queryFn: () => searchApi.advanced({
      q: qParam,
      types: typesParam,
      communityId: communityIdParam || undefined,
      spaceId: spaceIdParam || undefined,
      itemType: itemTypeParam || undefined,
      itemStatus: itemStatusParam || undefined,
      tagIds: tagIdsParam || undefined,
      page: pageParam,
      pageSize: 20,
    }),
    enabled: qParam.length >= 2,
  });

  const totalResults = data ? Object.values(data.totals).reduce((a, b) => a + b, 0) : 0;
  const totalPages = data ? Math.ceil(Math.max(...Object.values(data.totals)) / 20) : 1;

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <h1 className="text-2xl font-bold mb-1">Recherche avancee</h1>
        <p className="text-sm text-muted-foreground mb-4">Recherchez dans les communautes, espaces, items, utilisateurs et contributions</p>

        {/* Search input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-11 pr-10 py-3 text-lg border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Entity type toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ENTITY_TYPES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => toggleType(key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                enabledTypes.has(key)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {data && data.totals[key as keyof typeof data.totals] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  enabledTypes.has(key) ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
                }`}>
                  {data.totals[key as keyof typeof data.totals]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Scope filters */}
        <div className="flex flex-wrap gap-3">
          {user && communities && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Communaute :</label>
              <Select
                value={communityIdParam}
                onChange={e => { updateParam('communityId', e.target.value); updateParam('spaceId', ''); }}
                options={[{ value: '', label: 'Toutes' }, ...communities.map(c => ({ value: c.id, label: c.name }))]}
                className="w-48 h-8 text-sm"
              />
            </div>
          )}
          {user && scopeSpaces.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Espace :</label>
              <Select
                value={spaceIdParam}
                onChange={e => updateParam('spaceId', e.target.value)}
                options={[{ value: '', label: 'Tous' }, ...scopeSpaces.map(s => ({ value: s.id, label: s.name }))]}
                className="w-48 h-8 text-sm"
              />
            </div>
          )}
          {enabledTypes.has('items') && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Type item :</label>
              <Select
                value={itemTypeParam}
                onChange={e => updateParam('itemType', e.target.value)}
                options={[{ value: '', label: 'Tous' }, ...ITEM_TYPES.map(t => ({ value: t, label: t }))]}
                className="w-36 h-8 text-sm"
              />
            </div>
          )}
          {enabledTypes.has('items') && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Tags :</label>
              <input
                value={tagIdsParam}
                onChange={e => updateParam('tagIds', e.target.value)}
                placeholder="tag1,tag2..."
                className="w-44 h-8 px-2 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {qParam.length < 2 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Entrez au moins 2 caracteres pour lancer la recherche</p>
        </div>
      ) : isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Recherche en cours...</div>
      ) : !data || totalResults === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucun resultat pour "{qParam}"</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Total */}
          <p className="text-sm text-muted-foreground">{totalResults} resultat{totalResults > 1 ? 's' : ''}</p>

          {/* Communities */}
          {enabledTypes.has('communities') && data.communities.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Communautes ({data.totals.communities})
              </h2>
              <div className="space-y-2">
                {data.communities.map(c => (
                  <Link key={c.id} to={`/communities/${c.id}`} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    {c.avatarUrl ? (
                      <img src={c.avatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm"><Highlight text={c.name} query={qParam} /></span>
                        {c.isPublic && <Globe className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground line-clamp-1"><Highlight text={c.description} query={qParam} /></p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      <span>{c.memberCount} membres</span>
                      <span>{c.spaceCount} espaces</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Spaces */}
          {enabledTypes.has('spaces') && data.spaces.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FolderKanban className="w-4 h-4" /> Espaces ({data.totals.spaces})
              </h2>
              <div className="space-y-2">
                {data.spaces.map(s => (
                  <Link key={s.id} to={`/spaces/${s.id}`} className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    <FolderKanban className={`w-5 h-5 flex-shrink-0 ${s.type === 'GROUP' ? 'text-green-500' : 'text-blue-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm"><Highlight text={s.name} query={qParam} /></span>
                      {s.communityName && <span className="text-xs text-muted-foreground ml-2">{s.communityName}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      <span>{s.memberCount} membres</span>
                      <span>{s.itemCount} items</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Items */}
          {enabledTypes.has('items') && data.items.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Items ({data.totals.items})
              </h2>
              <div className="space-y-2">
                {data.items.map(item => (
                  <Link key={item.id} to={`/spaces/${item.spaceId}`} state={{ openItemId: item.id }} className="block p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.type}</Badge>
                      <span className="font-medium text-sm"><Highlight text={item.title} query={qParam} /></span>
                      {item.status && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.status}</Badge>}
                      {item.priority != null && item.priority > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">P{item.priority}</Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1"><Highlight text={item.description} query={qParam} /></p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>{item.spaceName}</span>
                      {item.communityName && <span>{item.communityName}</span>}
                      <span>{formatRelativeDate(item.createdAt)}</span>
                      {item.tags.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {item.tags.map(t => t.name).join(', ')}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Users */}
          {enabledTypes.has('users') && data.users.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Utilisateurs ({data.totals.users})
              </h2>
              <div className="space-y-2">
                {data.users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 p-3 border border-border rounded-lg overflow-hidden">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-medium text-primary">
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm"><Highlight text={u.name} query={qParam} /></span>
                        {u.globalRole === 'ADMIN' && (
                          <Badge variant="default" className="text-[10px] px-1.5 py-0"><Shield className="w-3 h-3 mr-0.5" />Admin</Badge>
                        )}
                      </div>
                      {u.email && <p className="text-xs text-muted-foreground"><Highlight text={u.email} query={qParam} /></p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
                      <span>{u.communityCount} comm.</span>
                      <span>{u.spaceCount} esp.</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contributions */}
          {enabledTypes.has('contributions') && data.contributions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Contributions ({data.totals.contributions})
              </h2>
              <div className="space-y-2">
                {data.contributions.map(c => (
                  <Link key={c.id} to={`/spaces/${c.spaceId}`} state={{ openItemId: c.itemId }} className="block p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    {c.content && (
                      <p className="text-sm line-clamp-2 mb-1"><Highlight text={c.content} query={qParam} /></p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-medium">{c.authorName}</span>
                      <span>sur {c.itemTitle}</span>
                      <span>{c.spaceName}</span>
                      <span>{formatRelativeDate(c.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">Page {pageParam} sur {totalPages}</p>
              <div className="flex items-center gap-1">
                <Button variant="bordered" size="sm" onClick={() => setPage(Math.max(1, pageParam - 1))} disabled={pageParam === 1} className="h-8 w-8 p-0">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm px-3">{pageParam} / {totalPages}</span>
                <Button variant="bordered" size="sm" onClick={() => setPage(Math.min(totalPages, pageParam + 1))} disabled={pageParam >= totalPages} className="h-8 w-8 p-0">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
