import { useEffect, useState } from 'react';
import { healthApi } from '../lib/api';
import { Bug } from 'lucide-react';

type DbStatus = 'checking' | 'connected' | 'disconnected' | 'error';

const DEV_MODE_KEY = 'spok-dev-mode';

export function DevModeToggle() {
  const [devModeEnabled, setDevModeEnabled] = useState(() => {
    return localStorage.getItem(DEV_MODE_KEY) === 'true';
  });

  const toggleDevMode = () => {
    const newValue = !devModeEnabled;
    setDevModeEnabled(newValue);
    localStorage.setItem(DEV_MODE_KEY, String(newValue));
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
  const [status, setStatus] = useState<DbStatus>('checking');
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
        setStatus(health.database === 'connected' ? 'connected' : 'disconnected');
      } catch {
        setStatus('error');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [canShowDevMode, devModeEnabled]);

  if (!canShowDevMode || !devModeEnabled) return null;

  const statusConfig = {
    checking: { color: 'bg-yellow-500', text: 'Vérification...' },
    connected: { color: 'bg-green-500', text: 'DB connectée' },
    disconnected: { color: 'bg-red-500', text: 'DB déconnectée' },
    error: { color: 'bg-red-500', text: 'API inaccessible' },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
      <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <span className="truncate">{config.text}</span>
    </div>
  );
}
