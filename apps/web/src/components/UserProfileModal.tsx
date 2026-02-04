import { useQuery } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { User, Mail, Shield, Hash, Building2 } from 'lucide-react';
import { communitiesApi } from '../lib/api';
import type { AuthUser } from '@spok/shared';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
}

const ROLE_LABELS: Record<string, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Administrateur',
};

const COMMUNITY_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MEMBER: 'Membre',
};

export function UserProfileModal({ isOpen, onClose, user }: UserProfileModalProps) {
  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
    enabled: isOpen,
  });

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil utilisateur">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="font-medium text-lg">{user.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.globalRole] || user.globalRole}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email :</span>
            <span className="font-medium">{user.email}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Rôle :</span>
            <span className="font-medium">{ROLE_LABELS[user.globalRole] || user.globalRole}</span>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">ID :</span>
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{user.id}</span>
          </div>
        </div>

        {/* Communautés */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Communautés</span>
          </div>
          {communities && communities.length > 0 ? (
            <div className="space-y-2">
              {communities.map((community) => (
                <div
                  key={community.id}
                  className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                >
                  <span>{community.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {COMMUNITY_ROLE_LABELS[community.role] || community.role}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune communauté</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
