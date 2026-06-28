/**
 * Barre de recherche globale dans le header.
 * Le panel de résultats est rendu via createPortal dans document.body pour échapper
 * au stacking context du header (z-30), évitant tout problème de z-index avec
 * la GlobalNavBar ou d'autres éléments du header.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, FileText, MessageSquare, X, ArrowRight } from 'lucide-react';
import { searchApi } from '../lib/api';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: rawData, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchApi.advanced({ q: debouncedQuery, pageSize: 10 }),
    enabled: debouncedQuery.length >= 2,
  });

  const data = rawData ? {
    items: rawData.items,
    contributions: rawData.contributions,
    totalItems: rawData.totals.items,
    totalContributions: rawData.totals.contributions,
  } : undefined;

  // Recompute dropdown position whenever it opens or on scroll/resize
  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      width: Math.max(rect.width, 384),
      maxHeight: 'calc(100vh - 4rem)',
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsOpen(true);
      updatePosition();
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is inside the portal dropdown
        const portal = document.getElementById('global-search-portal');
        if (portal && portal.contains(e.target as Node)) return;
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      setDebouncedQuery('');
      inputRef.current?.blur();
    }
  }, []);

  const handleResultClick = (spaceId: string, itemId?: string) => {
    setIsOpen(false);
    setQuery('');
    setDebouncedQuery('');
    if (itemId) {
      navigate(`/spaces/${spaceId}?item=${itemId}`);
    } else {
      navigate(`/spaces/${spaceId}`);
    }
  };

  const hasResults = data && (data.items.length > 0 || data.contributions.length > 0);
  const noResults = data && data.items.length === 0 && data.contributions.length === 0;

  const dropdown = isOpen ? (
    <div id="global-search-portal" style={dropdownStyle} className="flex flex-col rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden">
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Recherche...
          </div>
        )}

        {noResults && !isLoading && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Aucun résultat pour "{debouncedQuery}"
          </div>
        )}

        {hasResults && !isLoading && (
          <>
            {data.items.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border/50">
                  Items ({data.totalItems})
                </div>
                {data.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleResultClick(item.spaceId, item.id)}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{item.spaceName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(item.type).bgHover}`}>{TYPE_LABELS[item.type] || item.type}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {data.contributions.length > 0 && (
              <div>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border/50">
                  Contributions ({data.totalContributions})
                </div>
                {data.contributions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleResultClick(c.spaceId, c.itemId)}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/30 last:border-0"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate">{c.itemTitle}</div>
                        {c.content && (
                          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {c.content}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{c.spaceName}</span>
                          <span className="text-xs text-muted-foreground">par {c.authorName}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {debouncedQuery.length >= 2 && (
        <Link
          to={`/search?q=${encodeURIComponent(debouncedQuery)}`}
          onClick={() => { setIsOpen(false); setQuery(''); setDebouncedQuery(''); }}
          className="flex items-center justify-between px-4 py-3 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors border-t border-border/50"
        >
          <span>Recherche avancée</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.length >= 2) { setIsOpen(true); updatePosition(); }
          }}
          placeholder="Rechercher..."
          className="w-20 sm:w-28 md:w-40 lg:w-56 h-8 pl-8 pr-8 text-sm rounded-full bg-muted/40 border-0 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/50 focus:bg-muted/60 transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="Effacer la recherche"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {createPortal(dropdown, document.body)}
    </div>
  );
}
