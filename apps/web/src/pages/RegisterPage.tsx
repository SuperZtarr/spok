import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader } from '../components/ui/Card';

export function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<unknown>(null);
  const [devMode, setDevMode] = useState(() => localStorage.getItem('devMode') === 'true');

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      const pendingToken = localStorage.getItem('spok_pending_invitation_token');
      if (pendingToken) {
        localStorage.removeItem('spok_pending_invitation_token');
        navigate(`/invitation?token=${pendingToken}`);
      } else {
        navigate('/');
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

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    registerMutation.mutate({ email, password, name });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/logo.png" alt="SPOK" className="h-12 w-auto mx-auto mb-2" />
          <CardDescription>
            {localStorage.getItem('spok_pending_invitation_token')
              ? 'Créez votre compte pour accepter votre invitation'
              : 'Créez votre compte'
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
              <label htmlFor="name" className="text-sm font-medium">
                Nom
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
              />
            </div>

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
              <label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 caractères
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Création...' : 'Créer mon compte'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Se connecter
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
