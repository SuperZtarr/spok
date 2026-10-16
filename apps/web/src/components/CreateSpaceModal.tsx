/*
 * Création d'un espace ou d'un sous-espace — formulaire UNIQUE (2026-10-16), ouvert depuis la page communauté,
 * les paramètres de la communauté (onglet Espaces), l'aperçu d'un espace (section Sous-espaces) et la barre latérale.
 * Props :
 *  - communityId : communauté de l'espace créé (null = espace indépendant, hors communauté). Fixée par le contexte,
 *    pas modifiable ici (pour changer de communauté : « Déplacer… », MoveSpaceModal).
 *  - defaultParentId : parent pré-sélectionné (« Nouveau sous-espace » d'un espace) ; vide = premier niveau.
 *  - openAfterCreate (défaut true) : ouvre l'espace créé ; false = reste sur la page (paramètres de la communauté).
 * Toujours un espace de groupe (GROUP). Droits contrôlés par l'API (membre de la communauté, écriture dans le
 * parent) : l'erreur renvoyée est affichée sous le formulaire. Aide du champ parent : fiche « community ».
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { FieldHelp } from '../help/FieldHelp';
import { spacesApi } from '../lib/api';
import { buildParentOptions } from '../lib/spaceParentOptions';

interface CreateSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string | null;
  defaultParentId?: string;
  openAfterCreate?: boolean;
}

export function CreateSpaceModal({ isOpen, onClose, communityId, defaultParentId = '', openAfterCreate = true }: CreateSpaceModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState(defaultParentId);

  // Réinitialisation à chaque ouverture (la modale de la barre latérale est réutilisée d'un espace à l'autre)
  useEffect(() => {
    if (isOpen) { setName(''); setParentId(defaultParentId); }
  }, [isOpen, defaultParentId]);

  const { data: allSpaces } = useQuery({
    queryKey: ['spaces', 'all'],
    queryFn: () => spacesApi.list(),
    enabled: isOpen,
  });
  const parentOptions = useMemo(() => buildParentOptions(allSpaces ?? [], communityId), [allSpaces, communityId]);

  const createMutation = useMutation({
    mutationFn: () => spacesApi.create({
      name: name.trim(),
      type: 'GROUP',
      communityId: communityId ?? undefined,
      parentId: parentId || undefined,
    }),
    onSuccess: (space) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      if (communityId) queryClient.invalidateQueries({ queryKey: ['community', communityId] });
      if (parentId) queryClient.invalidateQueries({ queryKey: ['space', parentId] });
      onClose();
      if (openAfterCreate) navigate(`/spaces/${space.id}`);
    },
  });
  useEffect(() => { if (isOpen) createMutation.reset(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    if (name.trim() && !createMutation.isPending) createMutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={parentId ? 'Nouveau sous-espace' : 'Nouvel espace'} size="small" devName="CreateSpaceModal">
      <div className="space-y-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom de l'espace"
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          autoFocus
        />
        {parentOptions.length > 1 && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Espace parent</label>
            <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
            <FieldHelp page="community" field="newSpaceParent" className="text-xs text-muted-foreground" />
          </div>
        )}
        {createMutation.isError && (
          <p className="text-xs text-destructive">{(createMutation.error as Error)?.message || 'La création a échoué. Réessaie.'}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="bordered" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={submit} disabled={!name.trim() || createMutation.isPending}>
            {createMutation.isPending ? 'Création...' : 'Créer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
