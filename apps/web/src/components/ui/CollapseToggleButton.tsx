import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

interface CollapseToggleButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function CollapseToggleButton({ isCollapsed, onToggle, className }: CollapseToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      title={isCollapsed ? 'Tout étendre' : 'Tout réduire'}
      className={`inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex-shrink-0 ${className ?? ''}`}
    >
      {isCollapsed ? (
        <>
          <ChevronsUpDown className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Étendre</span>
        </>
      ) : (
        <>
          <ChevronsDownUp className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Réduire</span>
        </>
      )}
    </button>
  );
}
