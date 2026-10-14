/* Bouton replier/déplier tout (arborescences des vues) — seul bouton de ce rôle : ne pas le recopier dans une vue,
   il porte le repère data-tour="collapse-toggle" (tours Arborescence, Carte mentale) et son infobulle HelpHint
   (SPACE_TOOLBAR_HINTS.collapseAll / expandAll).
   Props : isCollapsed (tout est replié → le bouton propose « Étendre »), onToggle, className (mise en page). */
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import { SPACE_TOOLBAR_HINTS } from '../../help/spaceToolbar.hints';

interface CollapseToggleButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function CollapseToggleButton({ isCollapsed, onToggle, className }: CollapseToggleButtonProps) {
  const label = isCollapsed ? 'Étendre' : 'Réduire';
  return (
    <HelpHint text={isCollapsed ? SPACE_TOOLBAR_HINTS.expandAll : SPACE_TOOLBAR_HINTS.collapseAll} className="inline-flex flex-shrink-0">
      <button
        type="button"
        onClick={onToggle}
        data-tour="collapse-toggle"
        aria-label={label}
        className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex-shrink-0 ${className ?? ''}`}
      >
        {isCollapsed ? <ChevronsUpDown className="w-3.5 h-3.5" /> : <ChevronsDownUp className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{label}</span>
      </button>
    </HelpHint>
  );
}
