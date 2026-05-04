import { useState, useRef, useEffect, useCallback } from 'react';
import { MoreVertical, ChevronRight, Check } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface ItemAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'danger';
  disabled?: boolean;
  checked?: boolean;
  submenu?: ItemAction[];
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

  const [openSubmenuId, setOpenSubmenuId] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const submenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownWidth = 200;
    const estimatedHeight = 250;
    const margin = 8;

    let top = rect.bottom + 4;
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = rect.top - estimatedHeight - 4;
      if (top < margin) top = margin;
    }

    let left = side === 'right' ? rect.left : rect.right - dropdownWidth;
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

  const openSubmenu = useCallback((id: string, rect: DOMRect) => {
    if (submenuCloseTimerRef.current) {
      clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
    const menuWidth = 200;
    const margin = 8;
    let left = rect.right + 4;
    if (left + menuWidth > window.innerWidth - margin) {
      left = rect.left - menuWidth - 4;
    }
    setOpenSubmenuId(id);
    setSubmenuPosition({ top: rect.top, left });
  }, []);

  const scheduleCloseSubmenu = useCallback(() => {
    submenuCloseTimerRef.current = setTimeout(() => {
      setOpenSubmenuId(null);
    }, 150);
  }, []);

  const cancelCloseSubmenu = useCallback(() => {
    if (submenuCloseTimerRef.current) {
      clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (submenuCloseTimerRef.current) clearTimeout(submenuCloseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) setOpenSubmenuId(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleScroll() { setIsOpen(false); }
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  const filteredGroups = groups.filter(g => g.actions.length > 0);
  if (filteredGroups.length === 0) return null;

  const activeSubmenu = openSubmenuId
    ? filteredGroups.flatMap(g => g.actions).find(a => a.id === openSubmenuId)?.submenu
    : null;

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
                const hasSubmenu = !!action.submenu?.length;
                return (
                  <button
                    key={action.id}
                    onMouseEnter={(e) => {
                      if (hasSubmenu) {
                        openSubmenu(action.id, (e.currentTarget as HTMLElement).getBoundingClientRect());
                      } else {
                        scheduleCloseSubmenu();
                      }
                    }}
                    onMouseLeave={() => {
                      if (hasSubmenu) scheduleCloseSubmenu();
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasSubmenu) {
                        action.onClick();
                        setIsOpen(false);
                      }
                    }}
                    disabled={action.disabled}
                    className={`w-full px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                      action.variant === 'danger'
                        ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-950'
                        : 'text-foreground hover:bg-accent'
                    } ${action.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{action.label}</span>
                    {hasSubmenu && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}

      {isOpen && openSubmenuId && activeSubmenu && createPortal(
        <div
          onMouseEnter={cancelCloseSubmenu}
          onMouseLeave={scheduleCloseSubmenu}
          style={{ position: 'fixed', top: submenuPosition.top, left: submenuPosition.left, zIndex: 100000 }}
          className="bg-white dark:bg-gray-900 border rounded-md shadow-lg py-1 min-w-[200px]"
        >
          {activeSubmenu.map((action) => {
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
                <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span className="flex-1 text-left">{action.label}</span>
                {action.checked && <Check className="w-3 h-3 text-primary" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
