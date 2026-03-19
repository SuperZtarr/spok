import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

export function PublicFooter() {
  const user = useAuthStore((s) => s.user);

  return (
    <footer className="border-t py-8 mt-auto">
      <div className="mx-auto max-w-5xl px-4 text-center text-sm text-muted-foreground">
        <p>
          SPOK
          {!user && (
            <>
              {' '}&mdash;{' '}
              <Link to="/login" className="underline hover:text-foreground">Connexion</Link>
              {' '}&middot;{' '}
              <Link to="/register" className="underline hover:text-foreground">Inscription</Link>
            </>
          )}
          {' '}&middot;{' '}
          <Link to="/sitemap" className="underline hover:text-foreground">Plan du site</Link>
        </p>
      </div>
    </footer>
  );
}
