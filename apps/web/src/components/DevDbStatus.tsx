/*
 * Indicateur d'environnement (dev/DB) + toggle du mode admin (useAdminMode) — le mode admin
 * conditionne l'accès aux items de menu et vues access:'admin'.
 */
import { useEffect, useState } from 'react';
import { healthApi, ApiError } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { Bug, AlertCircle, Shield, Eye } from 'lucide-react';

type DbStatus = 'checking' | 'connected' | 'disconnected' | 'api_error' | 'wrong_server' | 'network_error';

interface StatusInfo {
  status: DbStatus;
  message?: string;
  details?: string;
}

const DEV_MODE_KEY = 'spok-dev-mode';
const ADMIN_MODE_KEY = 'spok-admin-mode';
const VISITOR_MODE_KEY = 'spok-visitor-mode';

export function AdminModeToggle() {
  const [adminModeEnabled, setAdminModeEnabled] = useState(() => {
    return localStorage.getItem(ADMIN_MODE_KEY) === 'true';
  });

  const toggleAdminMode = () => {
    const newValue = !adminModeEnabled;
    setAdminModeEnabled(newValue);
    localStorage.setItem(ADMIN_MODE_KEY, String(newValue));
    window.dispatchEvent(new CustomEvent('spok:adminmode', { detail: newValue }));
    window.location.reload();
  };

  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.globalRole === 'ADMIN';

  if (!isAdmin) return null;

  return (
    <button
      onClick={toggleAdminMode}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs w-full transition-colors ${
        adminModeEnabled
          ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/50'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
    >
      <Shield className="w-4 h-4" />
      <span>Mode admin {adminModeEnabled ? 'activé' : 'désactivé'}</span>
    </button>
  );
}

export function useAdminMode(): boolean {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(ADMIN_MODE_KEY) === 'true');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail);
    window.addEventListener('spok:adminmode', handler);
    return () => window.removeEventListener('spok:adminmode', handler);
  }, []);

  return enabled && user?.globalRole === 'ADMIN';
}

export function VisitorModeToggle() {
  const [visitorMode, setVisitorMode] = useState(() => {
    return localStorage.getItem(VISITOR_MODE_KEY) === 'true';
  });

  const toggleVisitorMode = () => {
    const newValue = !visitorMode;
    setVisitorMode(newValue);
    localStorage.setItem(VISITOR_MODE_KEY, String(newValue));
    window.dispatchEvent(new CustomEvent('spok:visitormode', { detail: newValue }));
  };

  const user = useAuthStore((state) => state.user);
  if (!user) return null;

  return (
    <button
      onClick={toggleVisitorMode}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs w-full transition-colors ${
        visitorMode
          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
      }`}
    >
      <Eye className="w-4 h-4" />
      <span>Mode visiteur {visitorMode ? 'activé' : 'désactivé'}</span>
    </button>
  );
}

export function useVisitorMode(): boolean {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(VISITOR_MODE_KEY) === 'true');
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    const handler = (e: Event) => setEnabled((e as CustomEvent).detail);
    window.addEventListener('spok:visitormode', handler);
    return () => window.removeEventListener('spok:visitormode', handler);
  }, []);

  return enabled && !!user;
}

export function DevModeToggle() {
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    return localStorage.getItem(DEV_MODE_KEY) === 'true';
  });

  const toggleDevMode = () => {
    const newValue = !devModeEnabled;
    setDevModeEnabled(newValue);
    localStorage.setItem(DEV_MODE_KEY, String(newValue));
    window.dispatchEvent(new CustomEvent('spok:devmode', { detail: newValue }));
  };

  const adminMode = useAdminMode();

  if (!adminMode) return null;

  return (
    <button
      onClick={toggleDevMode}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs w-full transition-colors ${
        devModeEnabled
          ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      <Bug className="w-4 h-4" />
      <span>Mode dev {devModeEnabled ? 'activé' : 'désactivé'}</span>
    </button>
  );
}

export function DevDbStatus() {
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({ status: 'checking' });
  const [showDetails, setShowDetails] = useState(false);
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    return localStorage.getItem(DEV_MODE_KEY) === 'true';
  });

  useEffect(() => {
    const handler = (e: Event) => setDevModeEnabled((e as CustomEvent).detail);
    window.addEventListener('spok:devmode', handler);
    return () => window.removeEventListener('spok:devmode', handler);
  }, []);

  const canShowDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  useEffect(() => {
    if (!canShowDevMode || !devModeEnabled) return;

    const checkHealth = async () => {
      try {
        const health = await healthApi.check();
        if (health.database === 'connected') {
          setStatusInfo({ status: 'connected' });
        } else {
          setStatusInfo({
            status: 'disconnected',
            message: 'Base de données déconnectée',
            details: health.databaseError || 'Vérifiez que PostgreSQL est démarré',
          });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'WRONG_SERVER') {
            setStatusInfo({
              status: 'wrong_server',
              message: 'Mauvais serveur',
              details: 'Le port 3001 sert le frontend au lieu de l\'API. Lancez: pnpm dev:api',
            });
          } else if (err.code === 'NETWORK_ERROR') {
            setStatusInfo({
              status: 'network_error',
              message: 'API inaccessible',
              details: 'Le serveur API n\'est pas démarré. Lancez: pnpm dev:api',
            });
          } else {
            setStatusInfo({
              status: 'api_error',
              message: err.message,
              details: JSON.stringify(err.details, null, 2),
            });
          }
        } else {
          setStatusInfo({
            status: 'api_error',
            message: 'Erreur inconnue',
            details: String(err),
          });
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [canShowDevMode, devModeEnabled]);

  if (!canShowDevMode || !devModeEnabled) return null;

  const statusConfig: Record<DbStatus, { color: string; bgColor: string; text: string }> = {
    checking: { color: 'bg-yellow-500', bgColor: 'bg-yellow-100 text-yellow-800', text: 'Vérification...' },
    connected: { color: 'bg-green-500', bgColor: 'bg-green-100 text-green-800', text: 'API + DB OK' },
    disconnected: { color: 'bg-orange-500', bgColor: 'bg-orange-100 text-orange-800', text: 'DB déconnectée' },
    api_error: { color: 'bg-red-500', bgColor: 'bg-red-100 text-red-800', text: 'Erreur API' },
    wrong_server: { color: 'bg-purple-500', bgColor: 'bg-purple-100 text-purple-800', text: 'Mauvais serveur!' },
    network_error: { color: 'bg-red-500', bgColor: 'bg-red-100 text-red-800', text: 'API non démarrée' },
  };

  const config = statusConfig[statusInfo.status];
  const hasError = statusInfo.status !== 'connected' && statusInfo.status !== 'checking';

  return (
    <div className="relative">
      <button
        onClick={() => hasError && setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs w-full ${config.bgColor} ${hasError ? 'cursor-pointer hover:opacity-80' : ''}`}
      >
        <span className={`w-2 h-2 rounded-full ${config.color} ${statusInfo.status === 'checking' ? 'animate-pulse' : ''}`} />
        <span className="truncate flex-1 text-left">{config.text}</span>
        {hasError && <AlertCircle className="w-3 h-3" />}
      </button>

      {showDetails && statusInfo.details && (
        <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded-md shadow-lg z-50 max-w-sm">
          <div className="font-semibold mb-1">{statusInfo.message}</div>
          <pre className="whitespace-pre-wrap break-words text-gray-300 text-[10px]">
            {statusInfo.details}
          </pre>
          <div className="mt-2 pt-2 border-t border-gray-700 text-gray-400">
            Cliquez pour fermer
          </div>
        </div>
      )}
    </div>
  );
}
