import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, Globe } from 'lucide-react';
import { useCommunityStore } from '../stores/community';
import { communitiesApi } from '../lib/api';
import { useState, useRef, useEffect } from 'react';
import type { CommunityWithRole } from '@spok/shared';

export function CommunitySelector() {
  const { currentCommunity, setCurrentCommunity } = useCommunityStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Validate that current community still exists in the list
  useEffect(() => {
    if (currentCommunity && communities) {
      const exists = communities.some(c => c.id === currentCommunity.id);
      if (!exists) {
        setCurrentCommunity(null);
      }
    }
  }, [communities, currentCommunity, setCurrentCommunity]);

  const handleSelect = (community: CommunityWithRole | null) => {
    setCurrentCommunity(community);
    setIsOpen(false);
  };

  if (!communities || communities.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
      >
        {currentCommunity ? (
          <>
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1 text-left">{currentCommunity.name}</span>
          </>
        ) : (
          <>
            <Globe className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1 text-left">Tous les espaces</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg py-1">
          <button
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm text-left ${
              !currentCommunity ? 'bg-accent' : ''
            }`}
          >
            <Globe className="w-4 h-4" />
            Tous les espaces
          </button>

          <div className="border-t border-border my-1" />

          {communities.map((community) => (
            <button
              key={community.id}
              onClick={() => handleSelect(community)}
              className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm text-left ${
                currentCommunity?.id === community.id ? 'bg-accent' : ''
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span className="truncate">{community.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {community.role === 'OWNER' ? 'Propriétaire' : community.role === 'ADMIN' ? 'Admin' : 'Membre'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
