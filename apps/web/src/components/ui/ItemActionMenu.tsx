import { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical } from 'lucide-react';
import { createPortal } from 'react-dom';

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Calculate dropdown position from trigger, flipping up if near bottom
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 200;
    const estimatedHeight = 250; // conservative estimate for menu height
    const margin = 8;

    let top = rect.bottom + 4;
    // Flip upward if dropdown would overflow viewport bottom
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = rect.top - estimatedHeight - 4;
      // If flipping up would go above viewport, clamp to top
      if (top < margin) top = margin;
    }

    let left = side === 'right' ? rect.left : rect.right - dropdownWidth;
    // Clamp horizontal
    if (left + dropdownWidth > window.innerWidth - margin) {
      left = window.innerWidth - dropdownWidth - margin;
    }
    if (left < margin) left = margin;

    setPosition({ top, left });
  }, [side]);

  const openMenu = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  }, [updatePosition]);

  const scheduleClose = useCallback(() => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

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

  // Close on scroll (parent containers)
  useEffect(() => {
    if (!isOpen) return;
    function handleScroll() {
      setIsOpen(false);
    }
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const filteredGroups = groups.filter(g => g.actions.length > 0);
  if (filteredGroups.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={(e) => e.stopPropagation()}
        className={triggerClassName || 'p-1 rounded hover:bg-accent transition-colors'}
        title="Actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 99999 }}
          className="bg-white dark:bg-gray-900 border rounded-md shadow-lg py-1 min-w-[200px]"
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
        </div>,
        document.body
      )}
    </>
  );
}
