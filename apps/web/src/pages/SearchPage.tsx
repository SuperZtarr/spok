/*
 * Recherche avancée (/search?q=...) : communautés, espaces, items, utilisateurs, contributions.
 * Portée par défaut = espace/communauté d'où la recherche est lancée (?spaceId= / ?communityId=,
 * posés par lib/searchScope) ; l'utilisateur élargit explicitement (« Toute la communauté », « Partout »).
 * Tout l'état vit dans l'URL ; modifier plusieurs paramètres → updateParams (un seul setSearchParams).
 * Spec SPOK « Recherche [SearchPage] » : dès 1 caractère, 10 résultats par page. Pagination PAR SECTION :
 * plusieurs sections → les 10 premiers de chacune + « Voir les N résultats » (bascule sur cette section) ;
 * une seule section → chevrons. Filtres d'items (type, statut, tags) : l'API ne renvoie plus que Items et
 * Contributions (itemFiltersActive). Tags = ceux de l'espace choisi (les tags sont propres à un espace).
 * Items et contributions regroupés sous des en-têtes « Communauté › Espace » (groupBySpace) : l'API les trie
 * dans cet ordre, les groupes sont donc consécutifs — ne pas retrier côté client.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Building2, FolderKanban, FileText, Users, MessageSquare, Globe, Shield, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { ITEM_TYPES, DEFAULT_TYPE_LABELS, DEFAULT_STATUSES } from '@spok/shared';
import { searchApi, communitiesApi, spacesApi, tagsApi } from '../lib/api';
import { PageHelpButton } from '../help/PageHelpButton';
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

const PAGE_SIZE = 10;
/** Sections que les filtres d'items laissent affichées (les autres sont omises par l'API). */
const ITEM_FILTER_SECTIONS = new Set<string>(['items', 'contributions']);

/** Regroupe des résultats déjà triés communauté › espace (API) en groupes consécutifs « Communauté › Espace ». */
function groupBySpace<T extends { spaceId: string; spaceName: string; communityName: string | null }>(rows: T[]) {
  const groups: { spaceId: string; spaceName: string; communityName: string; rows: T[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.spaceId === row.spaceId) last.rows.push(row);
    else groups.push({ spaceId: row.spaceId, spaceName: row.spaceName, communityName: row.communityName ?? 'Espaces personnels', rows: [row] });
  }
  return groups;
}

/** En-tête d'un groupe de résultats : communauté › espace (lien vers l'espace). */
function GroupHeader({ communityName, spaceName, spaceId }: { communityName: string; spaceName: string; spaceId: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 mb-1.5 first:mt-0">
      <Building2 className="w-3.5 h-3.5" />
      <span>{communityName}</span>
      <ChevronRight className="w-3 h-3" />
      <Link to={`/spaces/${spaceId}`} className="font-medium text-foreground hover:underline">{spaceName}</Link>
    </div>
  );
}

const typeLabel = (t: string) => DEFAULT_TYPE_LABELS[t]?.labelShort ?? t;
const statusLabel = (s: string) => DEFAULT_STATUSES.find((st) => st.id === s)?.label ?? s;

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

  // Plusieurs clés en UN SEUL setSearchParams : deux appels successifs ne se composent pas
  // en react-router v6 (le second repart de l'URL d'avant le premier et l'écrase).
  const updateParams = (changes: Record<string, string>) => {
    setSearchParams(prev => {
      const params = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.set('page', '1');
      return params;
    }, { replace: true });
  };
  const updateParam = (key: string, value: string) => updateParams({ [key]: value });

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

  // Espace de portée et sa communauté : arriver avec ?spaceId= seul (depuis un espace)
  // suffit, la communauté est déduite de l'espace.
  const scopeSpace = useMemo(
    () => (spaceIdParam ? allSpaces?.find(s => s.id === spaceIdParam) ?? null : null),
    [allSpaces, spaceIdParam],
  );
  const effectiveCommunityId = communityIdParam || scopeSpace?.communityId || '';
  const scopeCommunity = effectiveCommunityId ? communities?.find(c => c.id === effectiveCommunityId) ?? null : null;

  const scopeSpaces = useMemo(() => {
    if (!allSpaces) return [];
    if (effectiveCommunityId) return allSpaces.filter(s => s.communityId === effectiveCommunityId);
    return allSpaces;
  }, [allSpaces, effectiveCommunityId]);

  // Tags de l'espace choisi (sélecteur) — sans espace, pas de tags à proposer
  const { data: scopeTags } = useQuery({
    queryKey: ['tags', spaceIdParam],
    queryFn: () => tagsApi.list(spaceIdParam),
    enabled: !!user && !!spaceIdParam,
  });

  // Sections réellement affichées : les filtres d'items ne laissent que Items et Contributions
  const itemFiltersActive = !!(itemTypeParam || itemStatusParam || tagIdsParam);
  const shownTypes = useMemo(
    () => [...enabledTypes].filter((t) => !itemFiltersActive || ITEM_FILTER_SECTIONS.has(t)),
    [enabledTypes, itemFiltersActive],
  );
  // Pagination par section : une seule section → page de l'URL ; plusieurs → 10 premiers de chacune
  const singleSection = shownTypes.length === 1;
  const effectivePage = singleSection ? pageParam : 1;

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['advanced-search', qParam, typesParam, effectiveCommunityId, spaceIdParam, itemTypeParam, itemStatusParam, tagIdsParam, effectivePage],
    queryFn: () => searchApi.advanced({
      q: qParam,
      types: typesParam,
      communityId: effectiveCommunityId || undefined,
      spaceId: spaceIdParam || undefined,
      itemType: itemTypeParam || undefined,
      itemStatus: itemStatusParam || undefined,
      tagIds: tagIdsParam || undefined,
      page: effectivePage,
      pageSize: PAGE_SIZE,
    }),
    enabled: qParam.length >= 1,
  });

  const totalResults = data ? Object.values(data.totals).reduce((a, b) => a + b, 0) : 0;
  const totalPages = data && singleSection
    ? Math.max(1, Math.ceil((data.totals[shownTypes[0] as keyof typeof data.totals] ?? 0) / PAGE_SIZE))
    : 1;

  /** Lien « Voir les N résultats » sous une section tronquée (plusieurs sections affichées). */
  const SeeAll = ({ type, total }: { type: EntityType; total: number }) =>
    !singleSection && total > PAGE_SIZE ? (
      <button type="button" onClick={() => updateParam('types', type)} className="mt-2 text-xs text-primary hover:underline">
        Voir les {total} résultats
      </button>
    ) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background pb-4 -mx-6 px-6 -mt-6 pt-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Recherche avancée</h1>
          <div className="ml-auto"><PageHelpButton pageKey="search" /></div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">Recherchez dans les communautes, espaces, items, utilisateurs et contributions</p>

        {/* Search input */}
        <div className="relative mb-4" data-tour="search-input">
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

        {/* Portée : par défaut l'espace / la communauté d'où la recherche a été lancée,
            élargissement explicite par l'utilisateur */}
        {user && (spaceIdParam || effectiveCommunityId) && (
          <div className="flex flex-wrap items-center gap-2 mb-4 text-sm" data-tour="search-scope">
            <span className="text-muted-foreground">Recherche dans :</span>
            {spaceIdParam ? (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <FolderKanban className="w-4 h-4 text-blue-500" />
                {scopeSpace?.name ?? 'Espace'}
                <span className="font-normal text-muted-foreground">(et ses sous-espaces)</span>
                {scopeCommunity && <span className="font-normal text-muted-foreground">· {scopeCommunity.name}</span>}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Building2 className="w-4 h-4 text-primary" />
                {scopeCommunity?.name ?? 'Communauté'}
              </span>
            )}
            <span className="flex items-center gap-1 ml-auto">
              {spaceIdParam && effectiveCommunityId && (
                <Button variant="bordered" size="sm" className="h-7 text-xs"
                  onClick={() => updateParams({ communityId: effectiveCommunityId, spaceId: '' })}>
                  Toute la communauté
                </Button>
              )}
              <Button variant="bordered" size="sm" className="h-7 text-xs"
                onClick={() => updateParams({ communityId: '', spaceId: '' })}>
                Partout
              </Button>
            </span>
          </div>
        )}

        {/* Entity type toggles */}
        <div className="flex flex-wrap gap-2 mb-4" data-tour="search-types">
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
        <div className="flex flex-wrap gap-3" data-tour="search-filters">
          {user && communities && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Communaute :</label>
              <Select
                value={effectiveCommunityId}
                onChange={e => updateParams({ communityId: e.target.value, spaceId: '' })}
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
                options={[{ value: '', label: 'Tous' }, ...ITEM_TYPES.map(t => ({ value: t, label: typeLabel(t) }))]}
                className="w-36 h-8 text-sm"
              />
            </div>
          )}
          {enabledTypes.has('items') && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Statut :</label>
              <Select
                value={itemStatusParam}
                onChange={e => updateParam('itemStatus', e.target.value)}
                options={[{ value: '', label: 'Tous' }, ...DEFAULT_STATUSES.map(s => ({ value: s.id, label: s.label }))]}
                className="w-36 h-8 text-sm"
              />
            </div>
          )}
          {enabledTypes.has('items') && user && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Tag :</label>
              <Select
                value={tagIdsParam}
                onChange={e => updateParam('tagIds', e.target.value)}
                disabled={!spaceIdParam}
                title={spaceIdParam ? undefined : 'Choisissez un espace : les tags sont propres à chaque espace'}
                options={spaceIdParam
                  ? [{ value: '', label: 'Tous' }, ...(scopeTags ?? []).map(t => ({ value: t.id, label: t.name }))]
                  : [{ value: '', label: 'Choisir un espace' }]}
                className="w-40 h-8 text-sm"
              />
            </div>
          )}
        </div>
        {itemFiltersActive && shownTypes.length < enabledTypes.size && (
          <p className="mt-2 text-xs text-muted-foreground">
            Filtres d'items actifs : seuls les items et les contributions sont recherchés.
          </p>
        )}
      </div>

      {/* Results */}
      {qParam.length < 1 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Saisissez un terme pour lancer la recherche</p>
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
              <SeeAll type="communities" total={data.totals.communities} />
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
              <SeeAll type="spaces" total={data.totals.spaces} />
            </section>
          )}

          {/* Items */}
          {enabledTypes.has('items') && data.items.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Items ({data.totals.items})
              </h2>
              {groupBySpace(data.items).map(group => (
              <div key={group.spaceId} className="mb-2">
              <GroupHeader communityName={group.communityName} spaceName={group.spaceName} spaceId={group.spaceId} />
              <div className="space-y-2">
                {group.rows.map(item => (
                  <Link key={item.id} to={`/spaces/${item.spaceId}?item=${item.id}`} className="block p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{typeLabel(item.type)}</Badge>
                      <span className="font-medium text-sm"><Highlight text={item.title} query={qParam} /></span>
                      {item.status && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{statusLabel(item.status)}</Badge>}
                      {item.priority != null && item.priority > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">P{item.priority}</Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1"><Highlight text={item.description} query={qParam} /></p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
              </div>
              ))}
              <SeeAll type="items" total={data.totals.items} />
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
              <SeeAll type="users" total={data.totals.users} />
            </section>
          )}

          {/* Contributions */}
          {enabledTypes.has('contributions') && data.contributions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Contributions ({data.totals.contributions})
              </h2>
              {groupBySpace(data.contributions).map(group => (
              <div key={group.spaceId} className="mb-2">
              <GroupHeader communityName={group.communityName} spaceName={group.spaceName} spaceId={group.spaceId} />
              <div className="space-y-2">
                {group.rows.map(c => (
                  <Link key={c.id} to={`/spaces/${c.spaceId}?item=${c.itemId}`} className="block p-3 border border-border rounded-lg hover:bg-accent/50 transition-colors overflow-hidden">
                    {c.content && (
                      <p className="text-sm line-clamp-2 mb-1"><Highlight text={c.content} query={qParam} /></p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-medium">{c.authorName}</span>
                      <span>sur {c.itemTitle}</span>
                      <span>{formatRelativeDate(c.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
              </div>
              ))}
              <SeeAll type="contributions" total={data.totals.contributions} />
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
