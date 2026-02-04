import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Globe, Settings } from 'lucide-react';
import { useCommunityStore } from '../stores/community';
import { communitiesApi } from '../lib/api';
import { useState, useRef, useEffect } from 'react';
import type { CommunityWithRole } from '@spok/shared';

export function CommunitySelector() {
  const navigate = useNavigate();
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1">
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
            <div
              key={community.id}
              className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm ${
                currentCommunity?.id === community.id ? 'bg-accent' : ''
              }`}
            >
              <button
                onClick={() => handleSelect(community)}
                className="flex items-center gap-2 flex-1 text-left"
              >
                <Building2 className="w-4 h-4" />
                <span className="truncate">{community.name}</span>
              </button>
              <span className="text-xs text-muted-foreground">
                {community.role === 'OWNER' ? 'Proprio' : community.role === 'ADMIN' ? 'Admin' : 'Membre'}
              </span>
              {['OWNER', 'ADMIN'].includes(community.role) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    navigate(`/communities/${community.id}/settings`);
                  }}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Paramètres de la communauté"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
