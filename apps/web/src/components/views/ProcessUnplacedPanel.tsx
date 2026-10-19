/*
 * ProcessUnplacedPanel — panneau gauche de la vue Process : items de l'espace pas encore posés sur le canevas,
 * avec recherche (filterUnplaced) et compteur. Chaque ligne se glisse vers le canevas (HTML5 drag & drop,
 * type MIME PROCESS_DRAG_TYPE = id de l'item ; le dépôt est géré par ProcessView). Non glissable si !canEdit.
 * Repliable pour libérer de la place au canevas.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Item } from '@spok/shared';
import { getTypeIcon } from '../../constants/ui';
import { filterUnplaced } from './process-utils';

export const PROCESS_DRAG_TYPE = 'application/spok-item-id';

interface ProcessUnplacedPanelProps {
  items: Item[];
  canEdit: boolean;
}

export function ProcessUnplacedPanel({ items, canEdit }: ProcessUnplacedPanelProps) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const visible = filterUnplaced(items, query);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex-shrink-0 w-8 border-r border-border flex flex-col items-center gap-2 pt-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Afficher les items non placés"
      >
        <ChevronRight className="w-4 h-4" />
        <span className="text-[10px] [writing-mode:vertical-rl]">Non placés ({items.length})</span>
      </button>
    );
  }

  return (
    <aside
      className="flex-shrink-0 w-64 border-r border-border flex flex-col bg-background"
      data-tour="process-unplaced"
      data-help-zone="process:panneau"
    >
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border">
        <span className="flex-1 text-xs font-semibold text-muted-foreground">Non placés ({items.length})</span>
        <button
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
            className="flex-1 min-w-0 bg-transparent text-xs outline-none"
          />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto py-1">
        {items.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">Tous les items sont placés</li>
        )}
        {visible.map((item) => {
          const Icon = getTypeIcon(item.type, item.url);
          return (
            <li
              key={item.id}
              draggable={canEdit}
              onDragStart={(e) => {
                e.dataTransfer.setData(PROCESS_DRAG_TYPE, item.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs hover:bg-accent ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
              title={item.title}
            >
              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{item.title || 'Sans titre'}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
