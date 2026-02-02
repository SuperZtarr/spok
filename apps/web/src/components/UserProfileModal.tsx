import { Modal } from './ui/Modal';
import { User, Mail, Shield, Hash } from 'lucide-react';
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

export function UserProfileModal({ isOpen, onClose, user }: UserProfileModalProps) {
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
      </div>
    </Modal>
  );
}
