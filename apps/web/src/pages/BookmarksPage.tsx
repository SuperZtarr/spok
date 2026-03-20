import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, Bookmark, Clock, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { spacesApi, bookmarksApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { TYPE_LABELS, getTypeIcon } from '../constants/ui';
import type { SpaceWithRole } from '@spok/shared';

function SpaceCard({ space, isFavorite, onToggleFavorite }: {
  space: SpaceWithRole;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  return (
    <div className="group relative flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-accent/50 transition-colors">
      <Link
        to={`/spaces/${space.id}/content`}
        className="flex-1 min-w-0 flex items-center gap-3"
      >
        <FolderOpen className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="min-w-0">
          <div className="font-medium truncate">{space.name}</div>
        </div>
      </Link>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(space.id); }}
        className="p-1 rounded hover:bg-accent transition-colors"
        title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
      </button>
    </div>
  );
}

function BookmarkedItemCard({ item, onRemove }: {
  item: any;
  onRemove: (id: string) => void;
}) {
  const TypeIcon = getTypeIcon(item.type);
  const typeLabel = TYPE_LABELS[item.type] || item.type;

  return (
    <div className="group flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-accent/50 transition-colors">
      <Link
        to={`/spaces/${item.spaceId || item.space?.id}/content`}
        className="flex-1 min-w-0 flex items-center gap-3"
      >
        <TypeIcon className="w-5 h-5 text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{item.title}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] uppercase font-medium">{typeLabel}</span>
            {item.space?.name && <span>{item.space.name}</span>}
            {item.status && <span>· {item.status}</span>}
          </div>
        </div>
      </Link>
      <button
        onClick={() => onRemove(item.id)}
        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
        title="Retirer des épingles"
      >
        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
      </button>
    </div>
  );
}

export function BookmarksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Spaces
  const { data: allSpaces } = useQuery({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
    enabled: !!user,
  });
  const { data: favoriteIds = [] } = useQuery({
    queryKey: ['space-favorites'],
    queryFn: () => spacesApi.getFavorites(),
    enabled: !!user,
  });

  // Bookmarked items
  const { data: bookmarkedItems = [], isLoading: bookmarksLoading } = useQuery({
    queryKey: ['bookmarks'],
    queryFn: () => bookmarksApi.list(),
    enabled: !!user,
  });

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const favoriteSpaces = useMemo(() => {
    if (!allSpaces) return [];
    return allSpaces.filter(s => favoriteSet.has(s.id));
  }, [allSpaces, favoriteSet]);

  const recentSpaces = useMemo(() => {
    if (!allSpaces) return [];
    try {
      const stored = JSON.parse(localStorage.getItem('spok_recent_spaces') || '[]') as string[];
      return stored
        .filter(id => !favoriteSet.has(id))
        .map(id => allSpaces.find(s => s.id === id))
        .filter((s): s is SpaceWithRole => !!s)
        .slice(0, 8);
    } catch { return []; }
  }, [allSpaces, favoriteSet]);

  const handleToggleFavorite = useCallback(async (spaceId: string) => {
    try {
      if (favoriteSet.has(spaceId)) {
        await spacesApi.removeFavorite(spaceId);
      } else {
        await spacesApi.addFavorite(spaceId);
      }
      queryClient.invalidateQueries({ queryKey: ['space-favorites'] });
    } catch { /* ignore */ }
  }, [favoriteSet, queryClient]);

  const handleRemoveBookmark = useCallback(async (itemId: string) => {
    await bookmarksApi.remove(itemId);
    queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    queryClient.invalidateQueries({ queryKey: ['bookmark-ids'] });
  }, [queryClient]);

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Connectez-vous pour acceder a vos favoris et epingles.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Favoris & Epingles</h1>

      {/* Espaces favoris */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Star className="w-5 h-5 text-yellow-500" />
          Espaces favoris
        </h2>
        {favoriteSpaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun espace en favori. Cliquez sur l'etoile dans la sidebar pour en ajouter.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {favoriteSpaces.map(space => (
              <SpaceCard
                key={space.id}
                space={space}
                isFavorite={true}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </section>

      {/* Espaces recents */}
      {recentSpaces.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            Espaces recents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentSpaces.map(space => (
              <SpaceCard
                key={space.id}
                space={space}
                isFavorite={false}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {/* Items epingles */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Bookmark className="w-5 h-5 text-blue-500" />
          Items epingles
        </h2>
        {bookmarksLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
          </div>
        ) : bookmarkedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun item epingle. Ouvrez un item et cliquez sur l'icone epingle pour l'ajouter ici.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {bookmarkedItems.map(item => (
              <BookmarkedItemCard
                key={item.id}
                item={item}
                onRemove={handleRemoveBookmark}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
