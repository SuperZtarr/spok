/*
 * NoInviteCandidates — état vide de la liste d'invitation d'une séance (InviteePicker emptyState).
 * Un invité = membre de la communauté SANS accès à l'espace parent : si la liste est vide, soit la communauté
 * n'a pas d'autre membre (cas le plus fréquent : ajouter d'abord les joueurs à la communauté), soit tous y ont
 * déjà accès (ils rejoignent sans invitation). Lien vers les paramètres de la communauté (gestion des membres).
 * Props : spaceId (espace parent de la séance) — lit ['space', spaceId] pour la communauté (nom + lien).
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { spacesApi } from '../../lib/api';

export function NoInviteCandidates({ spaceId }: { spaceId: string }) {
  const { data: space } = useQuery({ queryKey: ['space', spaceId], queryFn: () => spacesApi.get(spaceId) });
  const community = space?.community as { id: string; name: string } | null | undefined;
  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <p>
        Aucun membre de la communauté à inviter. Un invité doit être membre de
        {community ? <> « {community.name} »</> : ' la communauté'} sans avoir accès à cet espace :
        ajoutez d'abord vos participants à la communauté.
      </p>
      <p>Les membres qui ont déjà accès à l'espace rejoignent la séance sans invitation.</p>
      {community && (
        <Link to={`/communities/${community.id}/settings`} className="inline-block font-medium text-foreground underline hover:no-underline">
          Gérer les membres de la communauté
        </Link>
      )}
    </div>
  );
}
