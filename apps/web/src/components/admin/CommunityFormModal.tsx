import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { CreateCommunityInput, UpdateCommunityInput } from '@spok/shared';

interface AdminCommunity {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  spaceCount: number;
}

interface CommunityFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: (CreateCommunityInput & { ownerEmail?: string }) | UpdateCommunityInput) => void;
  community: AdminCommunity | null;
  isLoading: boolean;
  error?: string;
}

export function CommunityFormModal({
  open,
  onClose,
  onSubmit,
  community,
  isLoading,
  error,
}: CommunityFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

  const isEditing = !!community;

  useEffect(() => {
    if (community) {
      setName(community.name);
      setDescription(community.description || '');
      setOwnerEmail('');
    } else {
      setName('');
      setDescription('');
      setOwnerEmail('');
    }
  }, [community, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const data: UpdateCommunityInput = {};
      if (name !== community.name) data.name = name;
      if (description !== (community.description || '')) data.description = description;
      onSubmit(data);
    } else {
      onSubmit({
        name,
        description: description || undefined,
        ownerEmail: ownerEmail || undefined,
      });
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Modifier la communaute' : 'Nouvelle communaute'}
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
            placeholder="Nom de la communaute"
            required
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
          />
        </div>

        {!isEditing && (
          <div>
            <label htmlFor="ownerEmail" className="block text-sm font-medium mb-1">
              Proprietaire (email)
            </label>
            <Input
              id="ownerEmail"
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="Laisser vide pour vous designer comme proprietaire"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si vide, vous serez le proprietaire de la communaute.
            </p>
          </div>
        )}

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
