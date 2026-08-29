/* Point d'entrée React : Sentry (si VITE_SENTRY_DSN au build), providers (Router, QueryClient, thème) + montage de <App/>. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Sentry : actif uniquement si VITE_SENTRY_DSN est défini au moment du build (no-op sinon).
// Erreurs seulement (pas de tracing) pour rester dans le tier gratuit.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes — keep cache alive longer
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Register service worker for PWA installability (prod only).
// Le SW fait skipWaiting()/clients.claim() dès qu'une nouvelle version est activée,
// ce qui déclenche 'controllerchange' ici : on recharge la page pour qu'un onglet
// resté ouvert (PWA, onglet épinglé) ne tourne pas indéfiniment sur un vieux bundle
// (bug constaté 2026-08-24 : utilisateurs sur une interface vieille de plusieurs mois).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
