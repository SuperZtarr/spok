/*
 * Lien court d'un élément (/items/:itemId, règle item-share-link, 2026-11-18) : c'est l'adresse que copie « Copier le
 * lien » dans le pied de la fiche. On ne connaît que l'élément : on demande son espace à l'API
 * (itemsApi.location → GET /items/:id/location), puis on redirige vers l'élément dans son espace (itemUrl) ; la
 * communauté se retrouve depuis l'espace, comme partout ailleurs. Le lien reste donc valable si l'élément change
 * d'espace. Le mode d'ouverture (lecture / modification) est celui par défaut selon les droits du lecteur.
 * Élément absent ou illisible : l'API répond le même 404 → message « introuvable ou inaccessible », avec « Se
 * connecter » pour un visiteur anonyme (l'élément est peut-être dans un espace privé). Le lien ne donne aucun accès.
 * Page de passage sans contenu propre : pas de fiche d'aide.
 */
import { Navigate, Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi } from '../lib/api';
import { itemUrl } from '../lib/itemOpenMode';
import { useAuthStore } from '../stores/auth';

export function ItemLinkPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data, isError } = useQuery({
    queryKey: ['item-location', itemId],
    queryFn: () => itemsApi.location(itemId!),
    enabled: !!itemId,
    retry: false,
  });

  if (data) return <Navigate to={itemUrl(data.spaceId, itemId!)} replace />;
  if (!isError) return <div className="p-6 text-sm text-muted-foreground">Ouverture de l'élément…</div>;
  return (
    <div className="p-6 text-sm text-muted-foreground space-y-2">
      <p>Élément introuvable ou inaccessible.</p>
      <Link to={isAuthenticated ? '/' : '/login'} className="text-primary hover:underline">
        {isAuthenticated ? 'Retour à l\'accueil' : 'Se connecter'}
      </Link>
    </div>
  );
}
