import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, FileText, MessageSquare, X } from 'lucide-react';
import { searchApi } from '../lib/api';
import { TYPE_LABELS, getTypeColor } from '../constants/ui';

export function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search query
  const { data, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchApi.search(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  // Open dropdown when we have results or are loading
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (!query) setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [query]);

  // Close on Escape
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsExpanded(false);
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

  return (
    <div ref={containerRef} className="relative">
      {/* Mobile: icon button that expands to input */}
      {!isExpanded && (
        <button
          className="sm:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground"
          onClick={() => {
            setIsExpanded(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          title="Rechercher"
        >
          <Search className="w-4 h-4" />
        </button>
      )}
      {/* Input: always visible on sm+, toggled on mobile */}
      <div className={`relative ${isExpanded ? 'block' : 'hidden sm:block'}`}>
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setIsOpen(true);
          }}
          placeholder="Rechercher..."
          className="w-36 sm:w-36 md:w-48 lg:w-64 h-8 pl-8 pr-8 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setDebouncedQuery('');
              setIsOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            title="Effacer la recherche"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 sm:w-96 max-h-96 overflow-y-auto rounded-md border border-border bg-card shadow-lg z-50">
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
              {/* Items */}
              {data.items.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border">
                    Items ({data.totalItems})
                  </div>
                  {data.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleResultClick(item.spaceId, item.id)}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
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

              {/* Contributions */}
              {data.contributions.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider bg-muted/50 border-b border-border">
                    Contributions ({data.totalContributions})
                  </div>
                  {data.contributions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleResultClick(c.spaceId, c.itemId)}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors border-b border-border/50 last:border-0"
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
      )}
    </div>
  );
}
