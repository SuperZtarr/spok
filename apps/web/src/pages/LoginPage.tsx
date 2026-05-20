import { useState } from 'react';
import logoUrl from '../assets/logo.png';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/Card';


export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<unknown>(null);
  const [devMode, setDevMode] = useState(() => localStorage.getItem('devMode') === 'true');

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      queryClient.clear();
      // Redirect to pending invitation if any
      const pendingToken = localStorage.getItem('spok_pending_invitation_token');
      if (pendingToken) {
        localStorage.removeItem('spok_pending_invitation_token');
        navigate(`/invitation?token=${pendingToken}`);
      } else {
        const returnTo = sessionStorage.getItem('spok_returnTo');
        if (returnTo) {
          sessionStorage.removeItem('spok_returnTo');
          navigate(returnTo);
        } else {
          navigate('/');
        }
      }
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorDetails({ statusCode: err.statusCode, details: err.details });
      } else {
        setError('Une erreur est survenue');
        setErrorDetails(err);
      }
    },
  });

  const toggleDevMode = () => {
    const newValue = !devMode;
    setDevMode(newValue);
    localStorage.setItem('devMode', String(newValue));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorDetails(null);
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logoUrl} alt="SPOK" className="h-12 w-auto mx-auto mb-2" />
          <CardDescription>
            {localStorage.getItem('spok_pending_invitation_token')
              ? 'Connectez-vous pour accepter votre invitation'
              : 'Connectez-vous à votre compte'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <p>{error}</p>
                {devMode && !!errorDetails && (
                  <pre className="mt-2 text-xs overflow-auto max-h-32 bg-black/10 p-2 rounded">
                    {JSON.stringify(errorDetails, null, 2)}
                  </pre>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password', { state: { email } })}
                  className="text-xs text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? 'Connexion...' : 'Se connecter'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Pas encore de compte ?{' '}
              <Link to="/register" className="text-primary hover:underline">
                S'inscrire
              </Link>
            </p>

            <button
              type="button"
              onClick={toggleDevMode}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {devMode ? '🔧 Mode dev activé' : '🔧 Activer mode dev'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
