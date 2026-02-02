import { useEffect, useState } from 'react';
import { healthApi } from '../lib/api';

type DbStatus = 'checking' | 'connected' | 'disconnected' | 'error';

export function DevDbStatus() {
  const [status, setStatus] = useState<DbStatus>('checking');
  // Only show if VITE_DEV_MODE is explicitly set to 'true' (for local dev)
  const isDev = import.meta.env.VITE_DEV_MODE === 'true';

  useEffect(() => {
    if (!isDev) return;

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
  }, [isDev]);

  if (!isDev) return null;

  const statusConfig = {
    checking: { color: 'bg-yellow-500', text: 'Vérification...' },
    connected: { color: 'bg-green-500', text: 'Base de données connectée' },
    disconnected: { color: 'bg-red-500', text: 'Base de données déconnectée - Lancez: docker start spok-postgres-dev' },
    error: { color: 'bg-red-500', text: 'API non accessible' },
  };

  const config = statusConfig[status];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm ${status === 'connected' ? 'bg-green-600' : 'bg-red-600'}`}>
        <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'checking' ? 'animate-pulse' : ''}`} />
        <span>{config.text}</span>
      </div>
    </div>
  );
}
