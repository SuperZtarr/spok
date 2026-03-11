import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, FolderOpen, Mail, Settings, Globe, Lock, Crown, Shield, User, Eye, ChevronRight } from 'lucide-react';
import { communitiesApi, spacesApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { SendEmailModal } from '../components/SendEmailModal';
// Types used implicitly via API responses

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string }> = {
  OWNER: { label: 'Propriétaire', icon: Crown, color: 'text-amber-500' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-blue-500' },
  MEMBER: { label: 'Membre', icon: User, color: 'text-foreground' },
  VIEWER: { label: 'Lecteur', icon: Eye, color: 'text-muted-foreground' },
};

function SpaceTreeNode({ node, level, onMove }: { node: any; level: number; onMove: (spaceId: string, newParentId: string | null) => void }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/spok-space-id', node.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/spok-space-id')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const draggedId = e.dataTransfer.getData('application/spok-space-id');
    if (draggedId && draggedId !== node.id) {
      onMove(draggedId, node.id);
    }
  };

  return (
    <>
      <Link
        to={`/spaces/${node.id}`}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${isDragOver ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border hover:bg-accent/50'}`}
        style={{ marginLeft: `${level * 24}px` }}
      >
        {level > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        {node.avatarUrl ? (
          <img src={node.avatarUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.name}</p>
          <p className="text-xs text-muted-foreground">{node.itemCount || 0} élément{(node.itemCount || 0) > 1 ? 's' : ''}</p>
        </div>
      </Link>
      {node.children?.map((child: any) => (
        <SpaceTreeNode key={child.id} node={child} level={level + 1} onMove={onMove} />
      ))}
    </>
  );
}

export function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const moveSpaceMutation = useMutation({
    mutationFn: ({ spaceId, parentId }: { spaceId: string; parentId: string | null }) =>
      spacesApi.update(spaceId, { parentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces', communityId] });
    },
  });

  const handleMoveSpace = (spaceId: string, newParentId: string | null) => {
    moveSpaceMutation.mutate({ spaceId, parentId: newParentId });
  };

  const { data: community } = useQuery({
    queryKey: ['community', communityId],
    queryFn: () => communitiesApi.get(communityId!),
    enabled: !!communityId,
  });

  const { data: members } = useQuery({
    queryKey: ['community-members', communityId],
    queryFn: () => communitiesApi.getMembers(communityId!),
    enabled: !!communityId,
  });

  const { data: spaces } = useQuery({
    queryKey: ['spaces', communityId],
    queryFn: () => spacesApi.list(communityId!),
    enabled: !!communityId,
  });

  const isAdminOrOwner = community?.role === 'OWNER' || community?.role === 'ADMIN';

  // Sort members: OWNER first, then ADMIN, then MEMBER, then VIEWER
  const roleOrder: Record<string, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2, VIEWER: 3 };
  const sortedMembers = [...(members || [])].sort((a, b) =>
    (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9)
  );

  const emailMembers = (members || []).map(m => ({
    userId: m.userId,
    name: m.name,
    email: m.email,
  }));

  // Build space tree from flat list
  const spaceTree = useMemo(() => {
    if (!spaces) return [];
    type SpaceNode = (typeof spaces)[number] & { children: SpaceNode[] };
    const map = new Map<string, SpaceNode>();
    const roots: SpaceNode[] = [];
    spaces.forEach(s => map.set(s.id, { ...s, children: [] }));
    spaces.forEach(s => {
      if (s.parentId && map.has(s.parentId)) {
        map.get(s.parentId)!.children.push(map.get(s.id)!);
      } else {
        roots.push(map.get(s.id)!);
      }
    });
    return roots;
  }, [spaces]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header with cover */}
      <div className="relative">
        {community?.coverUrl ? (
          <div className="h-32 sm:h-48 bg-cover bg-center" style={{ backgroundImage: `url(${community.coverUrl})` }} />
        ) : (
          <div className="h-32 sm:h-48 bg-gradient-to-r from-primary/20 to-primary/5" />
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent h-16" />
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 -mt-8 relative z-10">
        {/* Community info */}
        <div className="flex items-end gap-4 mb-6">
          {community?.avatarUrl ? (
            <img src={community.avatarUrl} alt="" className="w-16 h-16 rounded-xl border-4 border-background object-cover shadow" />
          ) : (
            <div className="w-16 h-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center shadow">
              <Users className="w-7 h-7 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{community?.name}</h1>
              {community?.isPublic ? (
                <span title="Communauté publique"><Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" /></span>
              ) : (
                <span title="Communauté privée"><Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" /></span>
              )}
            </div>
            {community?.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{community.description}</p>
            )}
          </div>
          <div className="flex gap-2 pb-1">
            {isAdminOrOwner && (
              <Button variant="outline" size="sm" onClick={() => setShowEmailModal(true)}>
                <Mail className="w-4 h-4 mr-1.5" />Envoyer un email
              </Button>
            )}
            {isAdminOrOwner && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/communities/${communityId}/settings`)}>
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Spaces section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Espaces ({spaces?.length || 0})
          </h2>
          {spaceTree.length > 0 ? (
            <div className="space-y-1">
              {spaceTree.map(node => (
                <SpaceTreeNode key={node.id} node={node} level={0} onMove={handleMoveSpace} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun espace dans cette communauté.</p>
          )}
        </div>

        {/* Members section */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Membres ({sortedMembers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sortedMembers.map(member => {
              const config = ROLE_CONFIG[member.role] || ROLE_CONFIG.MEMBER;
              const RoleIcon = config.icon;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {member.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.name}
                      {member.userId === user?.id && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}
                    </p>
                    <div className="flex items-center gap-1">
                      <RoleIcon className={`w-3 h-3 ${config.color}`} />
                      <span className="text-xs text-muted-foreground">{config.label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Email modal */}
      {community && (
        <SendEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          members={emailMembers}
          target={{ type: 'community', id: community.id, name: community.name }}
        />
      )}
    </div>
  );
}
