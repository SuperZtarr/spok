import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { PublicPageLayout } from '../components/PublicPageLayout';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Token manquant');
      return;
    }

    authApi.verifyEmail(token)
      .then(() => {
        setStatus('success');
        // Update store if user is logged in
        if (user) {
          updateUser({ emailVerified: true });
        }
      })
      .catch((err) => {
        setStatus('error');
        setErrorMessage(err.message || 'Une erreur est survenue');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Vérification en cours...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Email vérifié !</CardTitle>
            <CardDescription>
              Votre adresse email a été vérifiée avec succès.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to={isAuthenticated ? '/' : '/login'}>
              <Button className="w-full">
                {isAuthenticated ? 'Retour au dashboard' : 'Se connecter'}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PublicPageLayout centered>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <XCircle className="w-12 h-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Vérification échouée</CardTitle>
          <CardDescription>
            {errorMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link to={isAuthenticated ? '/' : '/login'}>
            <Button className="w-full">
              {isAuthenticated ? 'Retour au dashboard' : 'Se connecter'}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </PublicPageLayout>
  );
}
