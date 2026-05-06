import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Modal } from './ui/Modal';
import { User, Mail, Shield, Hash, Building2, FolderKanban, Sun, Moon, Camera, Trash2, Loader2, Check, Lock, CheckCircle, Bell, RotateCcw, LogOut, Plus, Save } from 'lucide-react';
import { authApi, communitiesApi, userApi, adminApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { usePasteUpload } from '../hooks/usePasteUpload';
import { groupSpacesByCommunity } from '../lib/spaceGrouping';
import type { AuthUser, NotificationType, NotificationChannel, GlobalRole, CommunityRole, Role } from '@spok/shared';
import { useThemeStore } from '../stores/theme';
import { AdminModeToggle, DevModeToggle, DevDbStatus } from './DevDbStatus';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  targetUserId?: string;
}

const ROLE_LABELS: Record<string, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Administrateur',
};

const COMMUNITY_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propriétaire',
  MEMBER: 'Membre',
};

// =============================================================================
// Mode admin — édition d'un utilisateur quelconque
// =============================================================================

function AdminUserProfileModal({ isOpen, onClose, userId }: { isOpen: boolean; onClose: () => void; userId: string }) {
  const queryClient = useQueryClient();

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editGlobalRole, setEditGlobalRole] = useState<GlobalRole>('USER');

  const [showAddCommunity, setShowAddCommunity] = useState(false);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [selectedCommunityRole, setSelectedCommunityRole] = useState<CommunityRole>('MEMBER');

  const [showAddSpace, setShowAddSpace] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedSpaceRole, setSelectedSpaceRole] = useState<Role>('MEMBER');

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.users.get(userId),
    enabled: isOpen,
  });

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditGlobalRole(user.globalRole);
      setEditPassword('');
    }
  }, [user]);

  const { data: communitiesData } = useQuery({
    queryKey: ['admin', 'communities'],
    queryFn: () => adminApi.communities.list({ pageSize: 100 }),
    enabled: isOpen,
  });

  const { data: spacesData } = useQuery({
    queryKey: ['admin', 'spaces'],
    queryFn: () => adminApi.spaces.list({ pageSize: 100 }),
    enabled: isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; password?: string; globalRole?: GlobalRole }) =>
      adminApi.users.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const addToCommunityMutation = useMutation({
    mutationFn: (data: { communityId: string; role: CommunityRole }) =>
      adminApi.users.addToCommunity(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      setShowAddCommunity(false);
      setSelectedCommunityId('');
    },
  });

  const removeFromCommunityMutation = useMutation({
    mutationFn: (communityId: string) => adminApi.users.removeFromCommunity(userId, communityId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] }),
  });

  const addToSpaceMutation = useMutation({
    mutationFn: (data: { spaceId: string; role: Role }) =>
      adminApi.users.addToSpace(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      setShowAddSpace(false);
      setSelectedSpaceId('');
    },
  });

  const removeFromSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => adminApi.users.removeFromSpace(userId, spaceId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] }),
  });

  const hasInfoChanges = user && (
    editName !== user.name ||
    editEmail !== user.email ||
    editGlobalRole !== user.globalRole ||
    editPassword.length > 0
  );

  const handleSaveInfo = () => {
    const updates: { name?: string; email?: string; password?: string; globalRole?: GlobalRole } = {};
    if (editName !== user?.name) updates.name = editName;
    if (editEmail !== user?.email) updates.email = editEmail;
    if (editGlobalRole !== user?.globalRole) updates.globalRole = editGlobalRole;
    if (editPassword) updates.password = editPassword;
    if (Object.keys(updates).length > 0) updateMutation.mutate(updates);
  };

  const existingCommunityIds = user?.communityMemberships?.map((m) => m.community.id) || [];
  const availableCommunities = communitiesData?.data.filter((c) => !existingCommunityIds.includes(c.id)) || [];

  const existingSpaceIds = user?.memberships?.map((m) => m.space.id) || [];
  const availableSpaces = spacesData?.data.filter(
    (s) => !existingSpaceIds.includes(s.id) && s.type !== 'PERSONAL'
  ) || [];

  const communityOptions = [
    { value: '', label: 'Sélectionner une communauté' },
    ...availableCommunities.map((c) => ({ value: c.id, label: c.name })),
  ];

  const spaceBaseOptions = [{ value: '', label: 'Sélectionner un espace' }];
  const spaceGroups = useMemo(() => {
    return groupSpacesByCommunity(availableSpaces).map(g => ({
      label: g.label,
      options: g.spaces.map(s => ({ value: s.id, label: s.name })),
    }));
  }, [availableSpaces]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profil utilisateur" size="xl">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : user ? (
        <div className="space-y-6">

          {/* Header avatar + infos */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{ROLE_LABELS[user.globalRole] || user.globalRole}</p>
            </div>
          </div>

          {/* Informations éditables */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nom</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Nouveau mot de passe</label>
                <Input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Laisser vide pour ne pas changer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rôle global</label>
                <Select
                  value={editGlobalRole}
                  onChange={(e) => setEditGlobalRole(e.target.value as GlobalRole)}
                  options={[{ value: 'USER', label: 'Utilisateur' }, { value: 'ADMIN', label: 'Administrateur' }]}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleSaveInfo}
                disabled={!hasInfoChanges || updateMutation.isPending}
                className={!hasInfoChanges ? 'opacity-40' : ''}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
              {updateMutation.isError && (
                <p className="text-sm text-destructive">{(updateMutation.error as any)?.message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash className="w-3.5 h-3.5" />
              <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{user.id}</span>
            </div>
          </div>

          {/* Communautés */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Communautés ({user.communityMemberships?.length || 0})
              </h3>
              {availableCommunities.length > 0 && (
                <Button size="sm" variant="bordered" onClick={() => setShowAddCommunity(!showAddCommunity)}>
                  <Plus className="w-4 h-4 mr-1" />Ajouter
                </Button>
              )}
            </div>

            {showAddCommunity && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Select value={selectedCommunityId} onChange={(e) => setSelectedCommunityId(e.target.value)} options={communityOptions} className="flex-1" />
                  <Select
                    value={selectedCommunityRole}
                    onChange={(e) => setSelectedCommunityRole(e.target.value as CommunityRole)}
                    options={[{ value: 'OWNER', label: 'Propriétaire' }, { value: 'MEMBER', label: 'Membre' }]}
                    className="w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => selectedCommunityId && addToCommunityMutation.mutate({ communityId: selectedCommunityId, role: selectedCommunityRole })} disabled={!selectedCommunityId || addToCommunityMutation.isPending}>Ajouter</Button>
                  <Button size="sm" variant="bordered" onClick={() => { setShowAddCommunity(false); setSelectedCommunityId(''); }}>Annuler</Button>
                </div>
              </div>
            )}

            {user.communityMemberships && user.communityMemberships.length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
                {user.communityMemberships.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{m.community.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{COMMUNITY_ROLE_LABELS[m.role] || m.role}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeFromCommunityMutation.mutate(m.community.id)} disabled={removeFromCommunityMutation.isPending}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted rounded-lg">Aucune communauté</p>
            )}
          </div>

          {/* Espaces */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FolderKanban className="w-4 h-4" />
                Espaces ({user.memberships?.filter(m => m.space.type !== 'PERSONAL').length || 0})
              </h3>
              {availableSpaces.length > 0 && (
                <Button size="sm" variant="bordered" onClick={() => setShowAddSpace(!showAddSpace)}>
                  <Plus className="w-4 h-4 mr-1" />Ajouter
                </Button>
              )}
            </div>

            {showAddSpace && (
              <div className="p-3 bg-muted rounded-lg space-y-3">
                <div className="flex gap-2">
                  <Select value={selectedSpaceId} onChange={(e) => setSelectedSpaceId(e.target.value)} options={spaceBaseOptions} groups={spaceGroups} className="flex-1" />
                  <Select
                    value={selectedSpaceRole}
                    onChange={(e) => setSelectedSpaceRole(e.target.value as Role)}
                    options={[{ value: 'OWNER', label: 'Propriétaire' }, { value: 'MEMBER', label: 'Membre' }]}
                    className="w-36"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => selectedSpaceId && addToSpaceMutation.mutate({ spaceId: selectedSpaceId, role: selectedSpaceRole })} disabled={!selectedSpaceId || addToSpaceMutation.isPending}>Ajouter</Button>
                  <Button size="sm" variant="bordered" onClick={() => { setShowAddSpace(false); setSelectedSpaceId(''); }}>Annuler</Button>
                </div>
              </div>
            )}

            {user.memberships && user.memberships.filter(m => m.space.type !== 'PERSONAL').length > 0 ? (
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-auto">
                {user.memberships.filter(m => m.space.type !== 'PERSONAL').map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium text-sm">{m.space.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{COMMUNITY_ROLE_LABELS[m.role] || m.role}</span>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeFromSpaceMutation.mutate(m.space.id)} disabled={removeFromSpaceMutation.isPending}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted rounded-lg">Aucun espace de groupe</p>
            )}
          </div>

        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Utilisateur non trouvé</div>
      )}
    </Modal>
  );
}

// =============================================================================
// Mode self — profil de l'utilisateur courant
// =============================================================================

export function UserProfileModal({ isOpen, onClose, user, targetUserId }: UserProfileModalProps) {
  if (targetUserId) {
    return <AdminUserProfileModal isOpen={isOpen} onClose={onClose} userId={targetUserId} />;
  }

  return <SelfUserProfileModal isOpen={isOpen} onClose={onClose} user={user} />;
}

function SelfUserProfileModal({ isOpen, onClose, user }: { isOpen: boolean; onClose: () => void; user: AuthUser | null }) {
  const { theme, setTheme } = useThemeStore();
  const { updateUser, updateTokens, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    logout();
    onClose();
    navigate('/');
  };

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [emailValue, setEmailValue] = useState(user?.email || '');
  const [savingEmail, setSavingEmail] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setNameValue(user.name);
      setEmailValue(user.email);
    }
  }, [user?.name, user?.email]);

  const { data: communities } = useQuery({
    queryKey: ['communities'],
    queryFn: communitiesApi.list,
    enabled: isOpen,
  });

  const uploadFile = useCallback(async (file: File) => {
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
  }, [updateUser]);

  usePasteUpload(isOpen, uploadFile);

  if (!user) return null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  const handleSaveName = async () => {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === user.name) { setNameValue(user.name); return; }
    setError(null);
    setSavingName(true);
    try {
      const result = await userApi.updateProfile({ name: trimmed });
      updateUser({ name: result.name });
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification du nom');
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveEmail = async () => {
    const trimmed = emailValue.trim();
    if (!trimmed || trimmed === user.email) { setEmailValue(user.email); return; }
    setError(null);
    setSavingEmail(true);
    try {
      const result = await userApi.updateProfile({ email: trimmed });
      updateUser({
        email: result.email,
        ...(result.emailVerified !== undefined && { emailVerified: result.emailVerified }),
      });
      if (result.tokens) updateTokens(result.tokens.accessToken, result.tokens.refreshToken);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification de l\'email');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return;
    setError(null);
    setPasswordSuccess(false);
    setSavingPassword(true);
    try {
      await userApi.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => { setEditingPassword(false); setPasswordSuccess(false); }, 1500);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du changement de mot de passe');
    } finally {
      setSavingPassword(false);
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

  const themeOptions: { value: 'light' | 'dark'; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Clair', icon: Sun },
    { value: 'dark', label: 'Sombre', icon: Moon },
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
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleUpload} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') { setNameValue(user.name); (e.target as HTMLInputElement).blur(); }
                }}
                onBlur={handleSaveName}
                disabled={savingName}
                className="flex-1 min-w-0 px-2 py-1 text-lg font-medium border border-transparent rounded-md bg-transparent hover:border-border focus:border-border focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
              {savingName && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.globalRole] || user.globalRole}</p>
            {user.avatarUrl && (
              <button onClick={handleDelete} disabled={uploading} className="text-xs text-destructive hover:underline mt-1 flex items-center gap-1">
                <Trash2 className="w-3 h-3" />Supprimer l'avatar
              </button>
            )}
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors">
          <LogOut className="w-4 h-4" />Déconnexion
        </button>

        {error && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-md">{error}</div>}

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEmail();
                  if (e.key === 'Escape') { setEmailValue(user.email); (e.target as HTMLInputElement).blur(); }
                }}
                onBlur={handleSaveEmail}
                disabled={savingEmail}
                className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-transparent rounded-md bg-transparent hover:border-border focus:border-border focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
              />
              {savingEmail && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />}
              {user.emailVerified ? (
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5 flex-shrink-0" title="Email vérifié"><CheckCircle className="w-3 h-3" /></span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0" title="Email non vérifié">Non vérifié</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {editingPassword ? (
              <div className="flex-1 space-y-2">
                <input type="password" placeholder="Mot de passe actuel" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={savingPassword} className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                <input
                  type="password"
                  placeholder="Nouveau mot de passe (min. 8 car.)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleChangePassword();
                    if (e.key === 'Escape') { setEditingPassword(false); setCurrentPassword(''); setNewPassword(''); }
                  }}
                  disabled={savingPassword}
                  className="w-full px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex items-center gap-2">
                  <button onClick={handleChangePassword} disabled={savingPassword || !currentPassword || newPassword.length < 8} className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
                    {savingPassword ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}Valider
                  </button>
                  <button onClick={() => { setEditingPassword(false); setCurrentPassword(''); setNewPassword(''); }} disabled={savingPassword} className="px-3 py-1 text-xs text-muted-foreground hover:bg-accent rounded-md">Annuler</button>
                  {passwordSuccess && <span className="text-xs text-green-600">Mot de passe modifié</span>}
                </div>
              </div>
            ) : (
              <button onClick={() => setEditingPassword(true)} className="text-sm text-primary hover:underline">Changer le mot de passe</button>
            )}
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

        <div className="pt-4 border-t border-border">
          <span className="text-sm font-medium">Thème</span>
          <div className="flex gap-2 mt-2">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button key={value} onClick={() => setTheme(value)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${theme === value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}>
                <Icon className="w-4 h-4" />{label}
              </button>
            ))}
          </div>
        </div>

        <NotificationPreferencesSection />

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Tutoriels</span>
            </div>
            <button
              onClick={() => {
                const keys = Object.keys(localStorage).filter(k => k.startsWith('spok-onboarding') || k.startsWith('spok-view-tour') || k.startsWith('spok-dashboard-tour'));
                keys.forEach(k => localStorage.removeItem(k));
                alert(`${keys.length} tutoriel(s) réinitialisé(s). Ils se relanceront à la prochaine visite.`);
              }}
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-accent transition-colors"
            >
              Réinitialiser tous les tutoriels
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-border space-y-2">
          <AdminModeToggle />
          <DevModeToggle />
          <DevDbStatus />
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Communautés</span>
          </div>
          {communities && communities.length > 0 ? (
            <div className="space-y-2">
              {communities.map((community) => (
                <div key={community.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                  <span>{community.name}</span>
                  <span className="text-xs text-muted-foreground">{community.role ? (COMMUNITY_ROLE_LABELS[community.role] || community.role) : ''}</span>
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

// =============================================================================
// Préférences de notifications
// =============================================================================

const NOTIF_TYPE_LABELS: Record<NotificationType, string> = {
  INVITATION: 'Invitations',
  ASSIGNMENT: 'Assignations',
  CONTRIBUTION: 'Contributions',
  MENTION: 'Mentions',
  EMAIL_VERIFICATION: 'Vérification email',
  NEW_USER: 'Nouveaux utilisateurs',
};

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'all', label: 'App + Email' },
  { value: 'in_app', label: 'App seule' },
  { value: 'none', label: 'Désactivé' },
];

function NotificationPreferencesSection() {
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: userApi.getNotificationPreferences,
  });

  const mutation = useMutation({
    mutationFn: userApi.updateNotificationPreferences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  });

  if (!prefs) return null;

  return (
    <div className="pt-4 border-t border-border">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Notifications</span>
      </div>
      <div className="space-y-2">
        {(Object.keys(NOTIF_TYPE_LABELS) as NotificationType[]).map((type) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{NOTIF_TYPE_LABELS[type]}</span>
            <div className="flex gap-1">
              {CHANNEL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => mutation.mutate({ [type]: opt.value })}
                  className={`px-2 py-0.5 rounded text-xs transition-colors ${(prefs as any)[type] === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-accent'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
