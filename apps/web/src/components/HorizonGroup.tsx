/*
 * Section repliable pour un groupe d'items classés par horizon temporel (Maintenant,
 * Aujourd'hui, Semaine, Mois, Plus tard, À trier) — utilisé par GlobalTasksPage.
 * Affiche au plus `initialLimit` items, avec un bouton « Voir tout (N) » pour étendre
 * (plafond purement client, pas de pagination serveur par groupe — cf. plan chantier 1).
 * `renderItem` reste la responsabilité du consommateur : ce composant ne connaît rien
 * du rendu d'une ligne, seulement le pliage/dépliage et le plafond.
 * Sans `getKey`, la clé de réconciliation React est l'index — à fournir dès que la liste
 * peut se réordonner/filtrer entre deux rendus, pour éviter qu'une ligne ne se voie
 * réattribuer un item différent sans démontage.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

const DEFAULT_LIMIT = 20;

export function HorizonGroup<T>({ title, items, renderItem, getKey, initialLimit = DEFAULT_LIMIT, defaultCollapsed = false }: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  getKey?: (item: T) => string | number;
  initialLimit?: number;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, initialLimit);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-1.5 px-4 sm:px-6 py-2 text-left text-xs font-semibold text-foreground uppercase tracking-wider hover:bg-muted/30"
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
        <span>{title}</span>
        <span className="ml-auto text-muted-foreground font-normal normal-case">{items.length}</span>
      </button>
      {!collapsed && (
        <>
          {visible.map((item, i) => <div key={getKey ? getKey(item) : i}>{renderItem(item)}</div>)}
          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full px-4 sm:px-6 py-2 text-xs text-primary hover:bg-muted/30 text-left"
            >
              Voir tout ({hiddenCount} de plus)
            </button>
          )}
        </>
      )}
    </div>
  );
}
