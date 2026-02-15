import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ItemAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ItemActionGroup {
  label?: string;
  actions: ItemAction[];
}

interface ItemActionMenuProps {
  groups: ItemActionGroup[];
  triggerClassName?: string;
  side?: 'left' | 'right';
}

export function ItemActionMenu({ groups, triggerClassName, side = 'left' }: ItemActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const filteredGroups = groups.filter(g => g.actions.length > 0);
  if (filteredGroups.length === 0) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={triggerClassName || 'p-1 rounded hover:bg-accent transition-colors'}
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-1 ${
            side === 'right' ? 'left-0' : 'right-0'
          } bg-popover border rounded-md shadow-lg py-1 z-50 min-w-[200px]`}
        >
          {filteredGroups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {groupIndex > 0 && <div className="border-t my-1" />}
              {group.label && (
                <div className="px-3 py-1 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  {group.label}
                </div>
              )}
              {group.actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                      setIsOpen(false);
                    }}
                    disabled={action.disabled}
                    className={`w-full px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                      action.variant === 'danger'
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'text-foreground hover:bg-accent'
                    } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
