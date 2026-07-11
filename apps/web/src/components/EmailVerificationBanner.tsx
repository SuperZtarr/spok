/* Bandeau « email non vérifié » avec renvoi du mail de vérification. */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, X, Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../stores/auth';

export function EmailVerificationBanner() {
  const user = useAuthStore((state) => state.user);
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);

  const resendMutation = useMutation({
    mutationFn: () => authApi.resendVerification(),
    onSuccess: () => setSent(true),
  });

  // Don't show if verified, dismissed, no user, or in dev mode
  if (!user || user.emailVerified || dismissed || import.meta.env.DEV) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span className="text-amber-800 dark:text-amber-200">
          Votre adresse email n'est pas encore vérifiée.
        </span>
        {sent ? (
          <span className="text-green-600 dark:text-green-400 font-medium">
            Email envoyé ! Pensez à vérifier vos courriers indésirables.
          </span>
        ) : (
          <button
            onClick={() => resendMutation.mutate()}
            disabled={resendMutation.isPending}
            className="text-amber-700 dark:text-amber-300 underline hover:no-underline font-medium flex items-center gap-1"
          >
            {resendMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Renvoyer l'email
          </button>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 flex-shrink-0"
        title="Masquer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
