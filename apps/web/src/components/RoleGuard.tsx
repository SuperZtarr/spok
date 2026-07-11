/* Garde d'affichage par rôle global (ADMIN) — enveloppe des éléments réservés. */
import { useState, useEffect, type ReactNode } from 'react';

type RoleLevel = 'MEMBER' | 'OWNER' | 'ADMIN';

const ROLE_COLORS: Record<RoleLevel, { border: string; bg: string; label: string }> = {
  MEMBER: { border: 'border-blue-400', bg: 'bg-blue-50', label: 'MEMBER' },
  OWNER: { border: 'border-green-400', bg: 'bg-green-50', label: 'OWNER' },
  ADMIN: { border: 'border-red-400', bg: 'bg-red-50', label: 'ADMIN' },
};

const DEV_MODE_KEY = 'spok-dev-mode';

// Reactive dev mode hook using custom event
function useDevMode(): boolean {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(DEV_MODE_KEY) === 'true'; }
    catch { return false; }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      setEnabled((e as CustomEvent).detail);
    };
    window.addEventListener('spok:devmode', handler);
    return () => window.removeEventListener('spok:devmode', handler);
  }, []);

  return enabled;
}

interface RoleGuardProps {
  role: RoleLevel;
  children: ReactNode;
}

export function RoleGuard({ role, children }: RoleGuardProps) {
  const devMode = useDevMode();

  if (!devMode) return <>{children}</>;

  const colors = ROLE_COLORS[role];
  return (
    <div className={`relative border-2 ${colors.border} ${colors.bg} rounded-sm`}>
      <span className={`absolute -top-2.5 left-1 px-1 text-[9px] font-bold ${colors.border.replace('border-', 'text-')} bg-white rounded leading-tight z-10`}>
        {colors.label}
      </span>
      {children}
    </div>
  );
}
