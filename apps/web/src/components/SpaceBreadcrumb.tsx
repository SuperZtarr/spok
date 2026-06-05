import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface BreadcrumbSpace {
  id: string;
  name: string;
}

interface SpaceBreadcrumbProps {
  space: {
    id: string;
    name: string;
    communityId?: string | null;
    community?: { id: string; name: string } | null;
    parentId?: string | null;
    parent?: { id: string; name: string } | null;
  };
  siblings?: BreadcrumbSpace[]; // espaces frères (même parent, même communauté)
}

export function SpaceBreadcrumb({ space, siblings = [] }: SpaceBreadcrumbProps) {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dropdownOpen]);

  const otherSiblings = siblings.filter(s => s.id !== space.id);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-2 flex-shrink-0 min-w-0">

      {/* Communauté */}
      {space.community && (
        <>
          <Link
            to={`/communities/${space.community.id}`}
            className="hover:text-foreground transition-colors truncate max-w-[140px]"
            title={space.community.name}
          >
            {space.community.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
        </>
      )}

      {/* Espace parent */}
      {space.parent && (
        <>
          <Link
            to={`/spaces/${space.parent.id}`}
            className="hover:text-foreground transition-colors truncate max-w-[140px]"
            title={space.parent.name}
          >
            {space.parent.name}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground/50" />
        </>
      )}

      {/* Espace courant — avec dropdown des frères si disponibles */}
      <div ref={dropdownRef} className="relative flex-shrink-0">
        <button
          onClick={() => otherSiblings.length > 0 && setDropdownOpen(o => !o)}
          className={`flex items-center gap-1 font-medium text-foreground transition-colors ${
            otherSiblings.length > 0 ? 'hover:text-primary cursor-pointer' : 'cursor-default'
          }`}
          title={space.name}
        >
          <span className="truncate max-w-[180px]">{space.name}</span>
          {otherSiblings.length > 0 && (
            <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {dropdownOpen && otherSiblings.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-md py-1 min-w-[180px] max-w-[260px] max-h-[280px] overflow-y-auto">
            {/* Espace courant (inactif, marqué) */}
            <div className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent/50 text-foreground font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
              <span className="truncate">{space.name}</span>
            </div>
            <div className="border-t border-border my-1" />
            {otherSiblings.map(s => (
              <button
                key={s.id}
                onClick={() => { navigate(`/spaces/${s.id}`); setDropdownOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/80 hover:bg-accent hover:text-foreground transition-colors text-left"
              >
                <span className="truncate">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
