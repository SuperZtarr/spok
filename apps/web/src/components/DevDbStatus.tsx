import { useEffect, useState } from 'react';
import { healthApi, ApiError } from '../lib/api';
import { Bug, AlertCircle } from 'lucide-react';

type DbStatus = 'checking' | 'connected' | 'disconnected' | 'api_error' | 'wrong_server' | 'network_error';

interface StatusInfo {
  status: DbStatus;
  message?: string;
  details?: string;
}

const DEV_MODE_KEY = 'spok-dev-mode';

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

  // Only show toggle if VITE_DEV_MODE is set (dev environment)
  if (import.meta.env.VITE_DEV_MODE !== 'true') return null;

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

  // Listen for localStorage changes
  useEffect(() => {
    const handleStorage = () => {
      setDevModeEnabled(localStorage.getItem(DEV_MODE_KEY) === 'true');
    };
    window.addEventListener('storage', handleStorage);

    // Also check periodically for same-tab updates
    const interval = setInterval(() => {
      const current = localStorage.getItem(DEV_MODE_KEY) === 'true';
      if (current !== devModeEnabled) {
        setDevModeEnabled(current);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [devModeEnabled]);

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
