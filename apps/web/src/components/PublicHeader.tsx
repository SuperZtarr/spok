import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

interface PublicHeaderProps {
  maxWidth?: string;
  showBack?: boolean;
  rightSlot?: React.ReactNode;
}

export function PublicHeader({ maxWidth = 'max-w-5xl', showBack = false, rightSlot }: PublicHeaderProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  return (
    <header className="sticky top-0 z-50 border-b bg-gradient-to-b from-primary/8 via-primary/3 to-transparent backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`mx-auto px-4 ${maxWidth}`}>
        <nav className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 flex-nowrap">
            <span className="text-xl font-bold tracking-tight whitespace-nowrap">SPOK</span>
            <img src="/logo.png" alt="SPOK" className="h-20 w-auto flex-shrink-0" />
          </Link>
          <div className="flex items-center gap-3">
            {showBack && (
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Retour
              </button>
            )}
            {rightSlot ?? (
              user ? (
                <Link to="/" className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Connexion</Link>
                  <Link to="/register" className="text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors">S'inscrire</Link>
                </>
              )
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
