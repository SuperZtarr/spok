import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { User, Mail, Shield, Hash, Building2, Sun, Moon, Monitor, Camera, Trash2, Loader2 } from 'lucide-react';
import { communitiesApi, userApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { AuthUser, ThemePreference } from '@spok/shared';
import { useThemeStore } from '../stores/theme';

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
  const { theme, setTheme } = useThemeStore();
  const { updateUser } = useAuthStore();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
    enabled: isOpen,
  });

  if (!user) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const result = await userApi.uploadAvatar(file);
      updateUser({ avatarUrl: result.avatarUrl });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setError(null);
    setUploading(true);
    try {
      await userApi.deleteAvatar();
      updateUser({ avatarUrl: undefined });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  const themeOptions: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
    { value: 'system', label: 'Système', icon: Monitor },
  ];

  const avatarSrc = user.avatarUrl || null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil utilisateur">
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="relative group">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {avatarSrc ? (
                <img src={avatarSrc} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
              title="Changer l'avatar"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
          <div className="flex-1">
            <p className="font-medium text-lg">{user.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.globalRole] || user.globalRole}</p>
            {user.avatarUrl && (
              <button
                onClick={handleDelete}
                disabled={uploading}
                className="text-xs text-destructive hover:underline mt-1 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Supprimer l'avatar
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</div>
        )}

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

        {/* Préférences */}
        <div className="pt-4 border-t border-border">
          <span className="text-sm font-medium">Thème</span>
          <div className="flex gap-2 mt-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  theme === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
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
