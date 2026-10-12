/* Gestion des membres en 3 colonnes (Non-membres → Membres → Propriétaires), partagée espaces/communautés.
   Flèches toujours visibles (atténuées, nettes au survol). onLeave fourni (espaces) = actions sur SA propre ligne :
   « Me rétrograder en membre » (seulement s'il reste un autre propriétaire) et « Quitter » (depuis Membres).
   Sans onLeave (communautés), aucune action sur sa propre ligne. */
import { useState, useMemo } from 'react';
import { Users, Crown, User, ChevronRight, ChevronLeft, Loader2, Search } from 'lucide-react';
import { RoleGuard } from '../RoleGuard';

interface MemberInfo {
  id: string; // membership id (for existing members) or user id (for available)
  userId: string;
  email: string;
  name: string;
  role?: string;
}

interface AvailableUser {
  id: string;
  email: string;
  name: string;
}

interface MembersColumnManagerProps {
  members: MemberInfo[];
  availableUsers: AvailableUser[];
  isLoading: boolean;
  isOwner: boolean;
  currentUserId: string;
  onAddMember: (userId: string, role: string) => void;
  onRemoveMember: (memberId: string) => void;
  onUpdateRole: (memberId: string, role: string) => void;
  /** Quitter (espaces) : active les actions sur sa propre ligne (se rétrograder, quitter). */
  onLeave?: () => void;
  isUpdating?: boolean;
}

// Flèche d'action : toujours visible (atténuée), nette au survol de la ligne
const ARROW = 'p-1 text-muted-foreground opacity-50 group-hover:opacity-100 transition-all disabled:opacity-25 disabled:cursor-not-allowed';

function UserCard({ name, email, isSelf }: { name: string; email: string; isSelf?: boolean }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
        {name?.charAt(0)?.toUpperCase() || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {name || email}
          {isSelf && <span className="text-xs text-muted-foreground ml-1">(vous)</span>}
        </p>
        {name && <p className="text-[11px] text-muted-foreground truncate">{email}</p>}
      </div>
    </div>
  );
}

export function MembersColumnManager({
  members,
  availableUsers,
  isLoading,
  isOwner,
  currentUserId,
  onAddMember,
  onRemoveMember,
  onUpdateRole,
  onLeave,
  isUpdating,
}: MembersColumnManagerProps) {
  const [searchAvailable, setSearchAvailable] = useState('');
  const [searchMembers, setSearchMembers] = useState('');
  const [searchOwners, setSearchOwners] = useState('');

  const owners = useMemo(() => members.filter(m => m.role === 'OWNER'), [members]);
  const regularMembers = useMemo(() => members.filter(m => m.role === 'MEMBER'), [members]);

  const filteredAvailable = useMemo(() => {
    if (!searchAvailable) return availableUsers;
    const q = searchAvailable.toLowerCase();
    return availableUsers.filter(u =>
      u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [availableUsers, searchAvailable]);

  const filteredMembers = useMemo(() => {
    if (!searchMembers) return regularMembers;
    const q = searchMembers.toLowerCase();
    return regularMembers.filter(m =>
      m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [regularMembers, searchMembers]);

  const filteredOwners = useMemo(() => {
    if (!searchOwners) return owners;
    const q = searchOwners.toLowerCase();
    return owners.filter(m =>
      m.name?.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [owners, searchOwners]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
      {/* Column 1: Available users (non-members) */}
      <div className="border rounded-lg flex flex-col min-h-0 flex-1">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Non-membres</h3>
            <span className="text-xs text-muted-foreground ml-auto">{availableUsers.length}</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchAvailable}
              onChange={(e) => setSearchAvailable(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {filteredAvailable.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchAvailable ? 'Aucun résultat' : 'Aucun utilisateur disponible'}
            </p>
          ) : (
            filteredAvailable.map(user => (
              <div
                key={user.id}
                className="flex items-center gap-1 p-2 rounded hover:bg-accent/50 group"
              >
                <div className="flex-1 min-w-0">
                  <UserCard name={user.name} email={user.email} />
                </div>
                {isOwner && (
                  <RoleGuard role="OWNER">
                    <button
                      onClick={() => onAddMember(user.id, 'MEMBER')}
                      disabled={isUpdating}
                      className={`${ARROW} hover:text-primary`}
                      title="Ajouter comme membre"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </RoleGuard>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Members */}
      <div className="border rounded-lg flex flex-col min-h-0 flex-1">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-foreground" />
            <h3 className="text-sm font-semibold">Membres</h3>
            <span className="text-xs text-muted-foreground ml-auto">{regularMembers.length}</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchMembers}
              onChange={(e) => setSearchMembers(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {filteredMembers.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchMembers ? 'Aucun résultat' : 'Aucun membre'}
            </p>
          ) : (
            filteredMembers.map(member => {
              const isSelf = member.userId === currentUserId;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-1 p-2 rounded hover:bg-accent/50 group"
                >
                  {isOwner && !isSelf && (
                    <RoleGuard role="OWNER">
                      <button
                        onClick={() => onRemoveMember(member.id)}
                        disabled={isUpdating}
                        className={`${ARROW} hover:text-destructive`}
                        title="Retirer du groupe"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </RoleGuard>
                  )}
                  {isSelf && onLeave && (
                    <button
                      onClick={onLeave}
                      disabled={isUpdating}
                      className={`${ARROW} hover:text-destructive`}
                      title="Quitter l'espace"
                      aria-label="Quitter l'espace"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <UserCard name={member.name} email={member.email} isSelf={isSelf} />
                  </div>
                  {isOwner && !isSelf && (
                    <RoleGuard role="OWNER">
                      <button
                        onClick={() => onUpdateRole(member.id, 'OWNER')}
                        disabled={isUpdating}
                        className={`${ARROW} hover:text-amber-500`}
                        title="Promouvoir propriétaire"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </RoleGuard>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Column 3: Owners */}
      <div className="border rounded-lg flex flex-col min-h-0 flex-1">
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold">Propriétaires</h3>
            <span className="text-xs text-muted-foreground ml-auto">{owners.length}</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchOwners}
              onChange={(e) => setSearchOwners(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {filteredOwners.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {searchOwners ? 'Aucun résultat' : 'Aucun propriétaire'}
            </p>
          ) : (
            filteredOwners.map(member => {
              const isSelf = member.userId === currentUserId;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-1 p-2 rounded hover:bg-accent/50 group"
                >
                  {isOwner && !isSelf && (
                    <RoleGuard role="OWNER">
                      <button
                        onClick={() => onUpdateRole(member.id, 'MEMBER')}
                        disabled={isUpdating}
                        className={`${ARROW} hover:text-primary`}
                        title="Rétrograder en membre"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </RoleGuard>
                  )}
                  {/* Se rétrograder soi-même : jamais le dernier propriétaire (l'API refuse aussi) */}
                  {isSelf && onLeave && (
                    <button
                      onClick={() => onUpdateRole(member.id, 'MEMBER')}
                      disabled={isUpdating || owners.length <= 1}
                      className={`${ARROW} hover:text-primary`}
                      title={owners.length <= 1 ? 'Nommez d\'abord un autre propriétaire' : 'Me rétrograder en membre'}
                      aria-label="Me rétrograder en membre"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <UserCard name={member.name} email={member.email} isSelf={isSelf} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
