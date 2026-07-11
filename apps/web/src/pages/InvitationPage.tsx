/* Acceptation d'invitation (/invitation?token=...) : rejoint la communauté/l'espace, crée le compte si besoin. */
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invitationsApi } from '../lib/api';
import type { Invitation } from '@spok/shared';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Loader2, CheckCircle, XCircle, Mail, Clock, Users } from 'lucide-react';

const PENDING_TOKEN_KEY = 'spok_pending_invitation_token';

export function InvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionDone, setActionDone] = useState<'accepted' | 'declined' | null>(null);

  // Load invitation by token
  useEffect(() => {
    if (!token) {
      setLoadStatus('error');
      setErrorMessage('Lien d\'invitation invalide (token manquant).');
      return;
    }

    invitationsApi.getByToken(token)
      .then((inv) => {
        setInvitation(inv);
        setLoadStatus('loaded');
      })
      .catch((err) => {
        setLoadStatus('error');
        setErrorMessage(err.message || 'Invitation introuvable.');
      });
  }, [token]);

  // If not authenticated, store token and redirect to login
  useEffect(() => {
    if (loadStatus === 'loaded' && !isAuthenticated && invitation?.status === 'PENDING') {
      localStorage.setItem(PENDING_TOKEN_KEY, token!);
      navigate('/login', { replace: true });
    }
  }, [loadStatus, isAuthenticated, invitation, token, navigate]);

  const acceptMutation = useMutation({
    mutationFn: () => invitationsApi.accept(token!),
    onSuccess: () => {
      setActionDone('accepted');
      localStorage.removeItem(PENDING_TOKEN_KEY);
      queryClient.invalidateQueries({ queryKey: ['sidebar-spaces'] });
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erreur lors de l\'acceptation.');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => invitationsApi.decline(token!),
    onSuccess: () => {
      setActionDone('declined');
      localStorage.removeItem(PENDING_TOKEN_KEY);
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Erreur lors du refus.');
    },
  });

  // Loading state
  if (loadStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Chargement...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (loadStatus === 'error' || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <XCircle className="w-12 h-12 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Invitation introuvable</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button className="w-full">Retour à l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Action done (accepted/declined)
  if (actionDone) {
    const isAccepted = actionDone === 'accepted';
    const targetName = invitation.community?.name || invitation.space?.name || '';
    const targetType = invitation.communityId ? 'la communauté' : "l'espace";
    const redirectPath = invitation.communityId
      ? `/communities/${invitation.communityId}`
      : `/spaces/${invitation.spaceId}`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              {isAccepted
                ? <CheckCircle className="w-12 h-12 text-green-500" />
                : <XCircle className="w-12 h-12 text-muted-foreground" />
              }
            </div>
            <CardTitle className="text-2xl">
              {isAccepted ? 'Invitation acceptee !' : 'Invitation refusee'}
            </CardTitle>
            <CardDescription>
              {isAccepted
                ? `Vous avez rejoint ${targetType} « ${targetName} ».`
                : `Vous avez refuse l'invitation pour ${targetType} « ${targetName} ».`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={isAccepted ? redirectPath : '/'}>
              <Button className="w-full">
                {isAccepted ? `Aller dans ${targetType}` : "Retour a l'accueil"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already handled (not PENDING)
  if (invitation.status !== 'PENDING') {
    const statusLabels: Record<string, string> = {
      ACCEPTED: 'deja acceptee',
      DECLINED: 'refusee',
      CANCELLED: 'annulee',
    };
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Clock className="w-12 h-12 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Invitation {statusLabels[invitation.status] || invitation.status}</CardTitle>
            <CardDescription>
              Cette invitation a deja ete traitee.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button className="w-full">Retour a l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Expired
  if (new Date(invitation.expiresAt) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Clock className="w-12 h-12 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Invitation expiree</CardTitle>
            <CardDescription>
              Cette invitation a expire. Demandez a l'expediteur de vous en envoyer une nouvelle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/">
              <Button className="w-full">Retour a l'accueil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for auth redirect (should be brief)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Connexion requise</CardTitle>
            <CardDescription>Redirection vers la page de connexion...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main: show invitation details + accept/decline
  const targetName = invitation.community?.name || invitation.space?.name || '';
  const targetType = invitation.communityId ? 'la communaute' : "l'espace";
  const roleLabel = invitation.role === 'OWNER' ? 'Proprietaire' : invitation.role === 'MEMBER' ? 'Membre' : invitation.role;
  const isLoading = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Mail className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invitation</CardTitle>
          <CardDescription>
            Vous etes invite(e) a rejoindre {targetType}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target info */}
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="font-semibold text-lg">{targetName}</p>
                <p className="text-sm text-muted-foreground">
                  {invitation.communityId ? 'Communaute' : 'Espace'}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              <span>Invite par </span>
              <span className="font-medium text-foreground">{invitation.invitedBy?.name || 'un membre'}</span>
              <span> en tant que </span>
              <span className="font-medium text-foreground">{roleLabel}</span>
            </div>
            {invitation.message && (
              <div className="border-l-2 border-primary pl-3 py-1">
                <p className="text-sm italic text-muted-foreground">"{invitation.message}"</p>
              </div>
            )}
          </div>

          {/* Error display */}
          {errorMessage && (
            <p className="text-sm text-destructive text-center">{errorMessage}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="bordered"
              className="flex-1"
              onClick={() => declineMutation.mutate()}
              disabled={isLoading}
            >
              Refuser
            </Button>
            <Button
              className="flex-1"
              onClick={() => acceptMutation.mutate()}
              disabled={isLoading}
            >
              {acceptMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Accepter
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
