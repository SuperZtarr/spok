/*
 * Favoris de vues par mode d'interface et rangement par catégorie, pour le sélecteur de vues d'un espace
 * (SpaceViewSelector). Réorganisation 2026-11-13 (décision Thomas) : un mode ne fait plus qu'une chose, donner sa
 * liste ordonnée de favoris, affichés en boutons directs. Plus de familles ni d'ajustements par mode.
 * - favoriteViews(views, mode) : favoris accessibles du mode, dans l'ordre de la liste (vue inaccessible ignorée).
 * - viewsByCategory(views) : toutes les vues accessibles, par catégorie (SPACE_VIEW_SECTIONS), favoris compris —
 *   contenu du panneau « Toutes les vues ». Aucune vue n'est jamais masquée par un mode.
 * - matchesViewQuery(label, short, query) : recherche du panneau (sans accents ni casse).
 * Ne pas recopier ces listes dans un composant : SpaceViewSelector et les tests lisent celles-ci.
 */
import { SPACE_VIEW_SECTIONS, VIEW_REGISTRY, type ViewCategoryId } from '@spok/shared';
import type { InterfaceMode } from '../stores/interfaceMode';

/** Favoris de chaque mode, dans l'ordre d'affichage. Documentation et Exploration : 2026-11-13. */
export const MODE_FAVORITE_VIEWS: Record<InterfaceMode, string[]> = {
  forum:       ['thread', 'text', 'recent', 'images', 'calendar', 'loupe'],
  projet:      ['tree', 'todo', 'kanban', 'timeline', 'pert', 'calendar', 'planning', 'priority', 'process', 'mindmap', 'loupe'],
  loisirs:     ['thread', 'mindmap', 'images', 'documents', 'recent', 'loupe'],
  documentation: ['tree', 'text', 'articles', 'documents', 'links', 'tags', 'mindmap', 'loupe'],
  exploration: ['links', 'recent', 'tags', 'graph', 'loupe', 'mindmap', 'images'],
  tous:        ['list', 'tree', 'thread', 'kanban', 'timeline', 'calendar', 'mindmap'],
};

const CATEGORY_OF = new Map(VIEW_REGISTRY.map((v) => [v.id, v.category]));
const ORDER_OF = new Map(VIEW_REGISTRY.map((v) => [v.id, v.order]));

/** Favoris accessibles d'un mode, dans l'ordre de MODE_FAVORITE_VIEWS. */
export function favoriteViews<T extends { viewMode?: string | null }>(views: T[], mode: string): T[] {
  const ids = MODE_FAVORITE_VIEWS[mode as InterfaceMode] ?? MODE_FAVORITE_VIEWS.tous;
  return ids.map((id) => views.find((v) => v.viewMode === id)).filter((v): v is T => !!v);
}

/** Toutes les vues accessibles, rangées par catégorie dans l'ordre de SPACE_VIEW_SECTIONS ; catégorie vide omise. */
export function viewsByCategory<T extends { viewMode?: string | null }>(views: T[]): { id: ViewCategoryId; label: string; views: T[] }[] {
  return SPACE_VIEW_SECTIONS
    .map((s) => ({
      id: s.id,
      label: s.label,
      views: views
        .filter((v) => v.viewMode && CATEGORY_OF.get(v.viewMode) === s.id)
        .sort((a, b) => (ORDER_OF.get(a.viewMode!) ?? 0) - (ORDER_OF.get(b.viewMode!) ?? 0)),
    }))
    .filter((c) => c.views.length > 0);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Vrai si le nom ou la description de la vue contient le texte cherché (sans accents ni casse) ; texte vide = tout. */
export function matchesViewQuery(label: string, short: string | undefined, query: string): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(label).includes(q) || fold(short ?? '').includes(q);
}
