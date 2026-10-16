/*
 * « Déplacer… » un espace (2026-10-16) : choisir sa communauté et son espace parent, depuis le menu ⋯ de la barre
 * latérale. Mêmes règles que les paramètres de l'espace et la carte globale (PATCH /spaces/:id) :
 *  - communautés proposées : celles dont on est membre (OWNER/MEMBER) + « Aucune (espace indépendant) » ;
 *  - parents proposés : espaces de groupe de la communauté choisie, hors l'espace lui-même et ses descendants ;
 *  - changer de communauté embarque les sous-espaces (côté API).
 * Props : space (id, nom, communauté et parent actuels). Un espace personnel ne se déplace pas : ne pas ouvrir
 * cette modale pour lui. L'erreur de l'API (droits) est affichée sous le formulaire.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { communitiesApi, spacesApi } from '../lib/api';
import { buildParentOptions } from '../lib/spaceParentOptions';
import { FieldHelp } from '../help/FieldHelp';

export interface MovableSpace {
  id: string;
  name: string;
  communityId?: string | null;
  parentId?: string | null;
}

interface MoveSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  space: MovableSpace | null;
}

const NO_COMMUNITY = '';

export function MoveSpaceModal({ isOpen, onClose, space }: MoveSpaceModalProps) {
  const queryClient = useQueryClient();
  const [communityId, setCommunityId] = useState(NO_COMMUNITY);
  const [parentId, setParentId] = useState('');

  useEffect(() => {
    if (isOpen && space) { setCommunityId(space.communityId ?? NO_COMMUNITY); setParentId(space.parentId ?? ''); }
  }, [isOpen, space]);

  const { data: communities } = useQuery({ queryKey: ['communities'], queryFn: () => communitiesApi.list(), enabled: isOpen });
  const { data: allSpaces } = useQuery({ queryKey: ['spaces', 'all'], queryFn: () => spacesApi.list(), enabled: isOpen });

  const communityOptions = useMemo(() => {
    const mine = (communities ?? []).filter((c) => c.role === 'OWNER' || c.role === 'MEMBER' || c.id === space?.communityId);
    return [{ value: NO_COMMUNITY, label: 'Aucune (espace indépendant)' }, ...mine.map((c) => ({ value: c.id, label: c.name }))];
  }, [communities, space?.communityId]);

  const parentOptions = useMemo(
    () => buildParentOptions(allSpaces ?? [], communityId || null, space?.id),
    [allSpaces, communityId, space?.id],
  );

  const changeCommunity = (value: string) => { setCommunityId(value); setParentId(''); };

  const unchanged = !!space && (communityId || null) === (space.communityId ?? null) && (parentId || null) === (space.parentId ?? null);

  const moveMutation = useMutation({
    mutationFn: () => spacesApi.update(space!.id, { communityId: communityId || null, parentId: parentId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      // Ciblé (pas tout ['space'] : un refetch de chaque espace en cache déclenche le limiteur de débit)
      for (const id of [space!.id, space!.parentId, parentId]) if (id) queryClient.invalidateQueries({ queryKey: ['space', id] });
      for (const id of [space!.communityId, communityId]) if (id) queryClient.invalidateQueries({ queryKey: ['community', id] });
      onClose();
    },
  });
  useEffect(() => { if (isOpen) moveMutation.reset(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!space) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Déplacer « ${space.name} »`} size="small" devName="MoveSpaceModal">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Communauté</label>
          <Select value={communityId} onChange={(e) => changeCommunity(e.target.value)} options={communityOptions} autoFocus />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Espace parent</label>
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)} options={parentOptions} />
          <FieldHelp page="community" field="moveSpace" className="text-xs text-muted-foreground" />
        </div>
        {moveMutation.isError && (
          <p className="text-xs text-destructive">{(moveMutation.error as Error)?.message || 'Le déplacement a échoué.'}</p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="bordered" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={() => moveMutation.mutate()} disabled={unchanged || moveMutation.isPending}>
            {moveMutation.isPending ? 'Déplacement...' : 'Déplacer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
