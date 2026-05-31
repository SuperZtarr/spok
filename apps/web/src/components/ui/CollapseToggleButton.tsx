import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from './Button';

interface CollapseToggleButtonProps {
  isCollapsed: boolean;
  onToggle: () => void;
  className?: string;
}

export function CollapseToggleButton({ isCollapsed, onToggle, className }: CollapseToggleButtonProps) {
  return (
    <Button
      variant="bordered"
      size="sm"
      onClick={onToggle}
      title={isCollapsed ? 'Tout étendre' : 'Tout réduire'}
      className={className}
    >
      {isCollapsed ? (
        <>
          <ChevronsUpDown className="w-4 h-4 mr-1" />
          Étendre
        </>
      ) : (
        <>
          <ChevronsDownUp className="w-4 h-4 mr-1" />
          Réduire
        </>
      )}
    </Button>
  );
}
