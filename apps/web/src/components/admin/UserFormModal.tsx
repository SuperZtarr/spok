import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import type { AdminUser, CreateUserInput, UpdateUserInput, GlobalRole } from '@spok/shared';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserInput | UpdateUserInput) => void;
  user: AdminUser | null;
  isLoading: boolean;
  error?: string;
}

const roleOptions = [
  { value: 'USER', label: 'Utilisateur' },
  { value: 'ADMIN', label: 'Administrateur' },
];

export function UserFormModal({
  open,
  onClose,
  onSubmit,
  user,
  isLoading,
  error,
}: UserFormModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [globalRole, setGlobalRole] = useState<GlobalRole>('USER');

  const isEditing = !!user;

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setGlobalRole(user.globalRole);
      setPassword('');
    } else {
      setName('');
      setEmail('');
      setPassword('');
      setGlobalRole('USER');
    }
  }, [user, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const data: UpdateUserInput = {};
      if (name !== user.name) data.name = name;
      if (email !== user.email) data.email = email;
      if (globalRole !== user.globalRole) data.globalRole = globalRole;
      if (password) data.password = password;
      onSubmit(data);
    } else {
      onSubmit({
        name,
        email,
        password,
        globalRole,
      });
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Nom
          </label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom complet"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@exemple.com"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Mot de passe {isEditing && '(laisser vide pour ne pas changer)'}
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
            required={!isEditing}
            minLength={8}
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium mb-1">
            Role
          </label>
          <Select
            id="role"
            value={globalRole}
            onChange={(e) => setGlobalRole(e.target.value as GlobalRole)}
            options={roleOptions}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : isEditing ? 'Modifier' : 'Creer'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
