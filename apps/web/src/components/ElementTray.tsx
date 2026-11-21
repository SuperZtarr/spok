/*
 * ElementTray — panneau latéral d'éléments « à poser » : arborescence parent/enfant (chevrons pour replier ; un élément
 * dont le parent n'est pas dans la liste remonte à la racine), recherche (résultats à plat, sans accents ni casse),
 * compteur, repli du panneau, lignes glissables (HTML5 drag & drop : type MIME dragType = id de l'élément ; le dépôt
 * est géré par l'appelant). Partagé par la vue Process (« Non placés », ProcessUnplacedPanel) et le mode Composer
 * d'un article (« À ajouter », ArticleEditor) — demande Thomas 2026-11-21 : même modèle de sélection.
 * Props clés : items (déjà filtrés par l'appelant), canEdit (sinon rien n'est glissable ni proposé), labels (textes,
 * jamais en dur ici : ils viennent des fiches d'aide), headerExtra (actions sous la recherche, dont
 * TrayElsewhereButton « Ajouter d'un autre espace »), rowAction (bouton au survol d'une ligne), className (taille et bordure du panneau).
 * Repères d'aide (data-tour / data-help-zone) : posés en littéral par l'appelant sur un conteneur autour du panneau —
 * le test de couverture de l'aide (help/coverage.test.ts) ne reconnaît que les littéraux.
 * Règle (guider l'utilisateur) : le glisser ne doit jamais être le seul accès — l'appelant fournit une action visible
 * (rowAction ou bouton) qui fait la même chose. Ne pas y mettre de logique propre au Process ou à l'Article.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Globe, Search } from 'lucide-react';
import { getTypeIcon } from '../constants/ui';
import { HelpHint } from '../help/HelpHint';

export interface TrayItem {
  id: string;
  title: string | null;
  type: string;
  parentId?: string | null;
  position?: number | null;
}

export interface TrayRow<T extends TrayItem> {
  item: T;
  depth: number;
  hasChildren: boolean;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Lignes affichées : arbre (ordre position, branches repliées omises) ou, pendant une recherche, résultats à plat. */
export function trayRows<T extends TrayItem>(items: T[], query: string, collapsedIds: Set<string>): TrayRow<T>[] {
  const q = normalize(query.trim());
  if (q) return items.filter((i) => normalize(i.title || '').includes(q)).map((item) => ({ item, depth: 0, hasChildren: false }));
  const ids = new Set(items.map((i) => i.id));
  const children = new Map<string | null, T[]>();
  for (const i of items) {
    const parent = i.parentId && ids.has(i.parentId) ? i.parentId : null;
    const list = children.get(parent) ?? [];
    list.push(i);
    children.set(parent, list);
  }
  const out: TrayRow<T>[] = [];
  const walk = (parent: string | null, depth: number) => {
    const list = [...(children.get(parent) ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    for (const item of list) {
      const hasChildren = (children.get(item.id)?.length ?? 0) > 0;
      out.push({ item, depth, hasChildren });
      if (hasChildren && !collapsedIds.has(item.id)) walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Bouton « Ajouter d'un autre espace » des panneaux (ouvre la recherche ItemSearchPicker de l'appelant). */
export function TrayElsewhereButton({ onClick, hint }: { onClick: () => void; hint: string }) {
  return (
    <HelpHint text={hint} className="block mt-1.5">
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center gap-1 h-7 rounded border border-dashed border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Globe className="w-3.5 h-3.5" /> Ajouter d'un autre espace
      </button>
    </HelpHint>
  );
}

export interface ElementTrayLabels {
  /** Titre du panneau, suivi du nombre d'éléments (« Non placés », « À ajouter ») */
  title: string;
  /** Liste vide */
  empty: string;
  /** Infobulle de la ligne (glisser) */
  dragHint?: string;
}

interface ElementTrayProps<T extends TrayItem> {
  items: T[];
  canEdit: boolean;
  dragType: string;
  labels: ElementTrayLabels;
  /** Actions sous la recherche (affichées si canEdit) — ex. TrayElsewhereButton, avec le repère de l'appelant */
  headerExtra?: ReactNode;
  rowAction?: (item: T) => ReactNode;
  defaultCollapsed?: boolean;
  className?: string;
}

export function ElementTray<T extends TrayItem>({
  items, canEdit, dragType, labels, headerExtra, rowAction, defaultCollapsed = false,
  className = 'flex-shrink-0 w-64 border-r border-border',
}: ElementTrayProps<T>) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const rows = useMemo(() => trayRows(items, query, collapsedIds), [items, query, collapsedIds]);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="flex-shrink-0 w-8 border-r border-border flex flex-col items-center gap-2 pt-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label={`Afficher : ${labels.title}`}
      >
        <ChevronRight className="w-4 h-4" />
        <span className="text-[10px] [writing-mode:vertical-rl]">{labels.title} ({items.length})</span>
      </button>
    );
  }

  return (
    <aside className={`flex flex-col bg-background ${className}`}>
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
        <span className="flex-1 text-xs font-semibold text-muted-foreground">{labels.title} ({items.length})</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="Replier le panneau"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5 px-2 h-7 rounded border border-input">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher…"
            aria-label={`Rechercher : ${labels.title}`}
            className="flex-1 min-w-0 bg-transparent text-xs outline-none"
          />
        </div>
        {canEdit && headerExtra}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto py-1">
        {items.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">{labels.empty}</li>}
        {rows.map(({ item, depth, hasChildren }) => {
          const Icon = getTypeIcon(item.type);
          const isCollapsed = collapsedIds.has(item.id);
          return (
            <li
              key={item.id}
              draggable={canEdit}
              onDragStart={(e) => {
                e.dataTransfer.setData(dragType, item.id);
                e.dataTransfer.effectAllowed = 'copyMove';
              }}
              className={`group flex items-center gap-1 pr-2 py-1 text-xs hover:bg-accent ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              title={canEdit && labels.dragHint ? `${item.title || 'Sans titre'} — ${labels.dragHint}` : item.title ?? undefined}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="h-4 w-4 flex items-center justify-center flex-shrink-0 rounded hover:bg-background text-muted-foreground"
                  aria-label={isCollapsed ? 'Déplier' : 'Replier'}
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-4 flex-shrink-0" />
              )}
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="flex-1 min-w-0 truncate">{item.title || 'Sans titre'}</span>
              {canEdit && rowAction?.(item)}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
