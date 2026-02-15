import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Globe, Settings, UserPlus, Eye, LogOut } from 'lucide-react';
import { useCommunityStore } from '../stores/community';
import { communitiesApi } from '../lib/api';
import { useState, useRef, useEffect } from 'react';
import type { CommunityWithRole } from '@spok/shared';

export function CommunitySelector() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCommunity, setCurrentCommunity } = useCommunityStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
  });

  const { data: publicCommunities } = useQuery({
    queryKey: ['communities-public'],
    queryFn: communitiesApi.listPublic,
  });

  const joinMutation = useMutation({
    mutationFn: (communityId: string) => communitiesApi.join(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: (communityId: string) => communitiesApi.leave(communityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities-public'] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    },
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

  const hasContent = (communities && communities.length > 0) || (publicCommunities && publicCommunities.length > 0);

  if (!hasContent) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
        title="Sélectionner une communauté"
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg py-1 max-h-80 overflow-y-auto">
          <button
            onClick={() => handleSelect(null)}
            className={`flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm text-left ${
              !currentCommunity ? 'bg-accent' : ''
            }`}
          >
            <Globe className="w-4 h-4" />
            Tous les espaces
          </button>

          {communities && communities.length > 0 && (
            <>
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
                    {community.isPublic && (
                      <span title="Publique"><Eye className="w-3 h-3 text-muted-foreground" /></span>
                    )}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {community.role === 'OWNER' ? 'Proprio' : community.role === 'ADMIN' ? 'Admin' : 'Membre'}
                  </span>
                  {community.role && ['OWNER', 'ADMIN'].includes(community.role) && (
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
                  {community.role === 'MEMBER' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Quitter la communauté "${community.name}" ? Vous serez aussi retiré de ses espaces.`)) {
                          if (currentCommunity?.id === community.id) {
                            setCurrentCommunity(null);
                          }
                          leaveMutation.mutate(community.id);
                          setIsOpen(false);
                        }
                      }}
                      disabled={leaveMutation.isPending}
                      className="p-1 hover:bg-destructive/10 rounded transition-colors text-destructive"
                      title="Quitter la communauté"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {publicCommunities && publicCommunities.length > 0 && (
            <>
              <div className="border-t border-border my-1" />
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Communautés publiques
              </div>

              {publicCommunities.map((community) => (
                <div
                  key={community.id}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm"
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate flex-1 text-left">{community.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {community.memberCount} membre{community.memberCount !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      joinMutation.mutate(community.id);
                    }}
                    disabled={joinMutation.isPending}
                    className="flex items-center gap-1 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    title="Rejoindre cette communauté"
                  >
                    <UserPlus className="w-3 h-3" />
                    Rejoindre
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
