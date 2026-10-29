/* Modale admin : détail utilisateur (infos, rôle global, accès aux communautés et espaces).
   Accès (2026-10-29) : UserAccessManager — colonnes Sans accès → Membre → Propriétaire, la gestion des membres
   inversée — partagé avec la fiche « Profil utilisateur » en mode admin (seule implémentation). */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Save, Loader2 } from 'lucide-react';
import { useCtrlS } from '../../hooks/useCtrlS';
import { adminApi } from '../../lib/api';
import { UserAccessManager } from './UserAccessManager';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import type { GlobalRole } from '@spok/shared';

interface UserDetailModalProps {
  userId: string | null; // null = création
  onClose: () => void;
}

const globalRoleOptions = [
  { value: 'USER', label: 'Utilisateur' },
  { value: 'ADMIN', label: 'Administrateur' },
];

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const queryClient = useQueryClient();
  const isCreating = !userId;

  // User info
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editGlobalRole, setEditGlobalRole] = useState<GlobalRole>('USER');

  // Fetch user (only if editing)
  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.users.get(userId!),
    enabled: !!userId,
  });

  // Initialize form when user loads
  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditGlobalRole(user.globalRole);
      setEditPassword('');
    }
  }, [user]);

  // Create user
  const createMutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string; globalRole: GlobalRole }) =>
      adminApi.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      onClose();
    },
  });

  // Update user
  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; email?: string; password?: string; globalRole?: GlobalRole }) =>
      adminApi.users.update(userId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: editName,
      email: editEmail,
      password: editPassword,
      globalRole: editGlobalRole,
    });
  };

  const handleSaveInfo = () => {
    const updates: { name?: string; email?: string; password?: string; globalRole?: GlobalRole } = {};
    if (editName !== user?.name) updates.name = editName;
    if (editEmail !== user?.email) updates.email = editEmail;
    if (editGlobalRole !== user?.globalRole) updates.globalRole = editGlobalRole;
    if (editPassword) updates.password = editPassword;
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    }
  };

  const hasInfoChanges = user && (
    editName !== user.name ||
    editEmail !== user.email ||
    editGlobalRole !== user.globalRole ||
    editPassword.length > 0
  );

  useCtrlS(!!hasInfoChanges && !updateMutation.isPending, handleSaveInfo);

  // Creation form
  if (isCreating) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Nouvel utilisateur" size="xl" devName="UserDetailModal">
        <form onSubmit={handleCreate} className="space-y-4">
          {createMutation.error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {createMutation.error.message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Nom</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nom complet"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="email@exemple.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mot de passe</label>
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="********"
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <Select
              value={editGlobalRole}
              onChange={(e) => setEditGlobalRole(e.target.value as GlobalRole)}
              options={globalRoleOptions}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="bordered" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creation...' : 'Creer'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  // Detail/edit view
  return (
    <Modal isOpen={true} onClose={onClose} title="Details de l'utilisateur" size="xl" devName="UserDetailModal">
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Chargement...</div>
      ) : user ? (
        <div className="space-y-6">
          {/* User info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5" />
              <h3 className="font-medium">Informations</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Mot de passe</label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Laisser vide pour ne pas changer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role global</label>
                  <Select
                    value={editGlobalRole}
                    onChange={(e) => setEditGlobalRole(e.target.value as GlobalRole)}
                    options={globalRoleOptions}
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSaveInfo}
                disabled={!hasInfoChanges || updateMutation.isPending}
                className={!hasInfoChanges ? 'opacity-40' : ''}
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Enregistrer
              </Button>
              {updateMutation.error && (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              )}
            </div>
          </div>

          {/* Accès : colonnes Sans accès → Membre → Propriétaire (gestion des membres inversée, 2026-10-29) */}
          <UserAccessManager userId={userId!} userName={user.name} user={user} />
        </div>
      ) : (
        <div className="py-8 text-center text-muted-foreground">Utilisateur non trouve</div>
      )}
    </Modal>
  );
}
