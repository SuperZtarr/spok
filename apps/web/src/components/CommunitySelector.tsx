import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Globe, Settings, UserPlus, Eye, LogOut, Plus, Loader2 } from 'lucide-react';
import { useCommunityStore } from '../stores/community';
import { communitiesApi, spacesApi } from '../lib/api';
import { useState, useRef, useEffect } from 'react';
import type { CommunityWithRole } from '@spok/shared';
import { ConfirmModal } from './ConfirmModal';

export function CommunitySelector() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCommunity, setCurrentCommunity } = useCommunityStore();
  const [isOpen, setIsOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<CommunityWithRole | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
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

  const createMutation = useMutation({
    mutationFn: (name: string) => communitiesApi.create({ name }),
    onSuccess: (community) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      setNewCommunityName('');
      setShowCreateForm(false);
      setCurrentCommunity(community);
      setIsOpen(false);
      navigate(`/communities/${community.id}/settings`);
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

  const handleSelect = async (community: CommunityWithRole | null) => {
    setCurrentCommunity(community);
    setIsOpen(false);
    if (community) {
      try {
        const spaces = await spacesApi.list(community.id);
        if (spaces.length > 0) {
          navigate(`/spaces/${spaces[0].id}`);
        }
      } catch {
        // Silently fail — user stays on current page
      }
    }
  };

  // Always show the selector — users can create communities even when none exist

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md hover:bg-accent transition-colors text-sm"
        title="Sélectionner une communauté"
      >
        {currentCommunity ? (
          <>
            {currentCommunity.avatarUrl ? (
              <img src={currentCommunity.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
            ) : (
              <Building2 className="w-4 h-4 flex-shrink-0" />
            )}
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
                    {community.avatarUrl ? (
                      <img src={community.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <Building2 className="w-4 h-4" />
                    )}
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
                        setLeaveTarget(community);
                        setIsOpen(false);
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

          <div className="border-t border-border my-1" />

          {showCreateForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newCommunityName.trim()) {
                  createMutation.mutate(newCommunityName.trim());
                }
              }}
              className="px-3 py-2 space-y-2"
            >
              <input
                type="text"
                value={newCommunityName}
                onChange={(e) => setNewCommunityName(e.target.value)}
                placeholder="Nom de la communauté"
                className="w-full px-2 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowCreateForm(false);
                    setNewCommunityName('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!newCommunityName.trim() || createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewCommunityName('');
                  }}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
                >
                  Annuler
                </button>
              </div>
              {createMutation.isError && (
                <p className="text-xs text-destructive">Erreur lors de la création.</p>
              )}
            </form>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 w-full px-3 py-2 hover:bg-accent transition-colors text-sm text-primary"
            >
              <Plus className="w-4 h-4" />
              Créer une communauté
            </button>
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
      <ConfirmModal
        isOpen={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={() => {
          if (leaveTarget) {
            if (currentCommunity?.id === leaveTarget.id) {
              setCurrentCommunity(null);
            }
            leaveMutation.mutate(leaveTarget.id);
            setLeaveTarget(null);
          }
        }}
        title="Quitter la communauté"
        message={`Vous êtes sur le point de quitter la communauté « ${leaveTarget?.name} ».`}
        warning="Vous serez aussi retiré de tous les espaces de cette communauté."
        confirmLabel="Quitter"
        isPending={leaveMutation.isPending}
        icon="leave"
      />
    </div>
  );
}
