/*
 * Modale de gestion des abonnements ICS (page Ma journée) : liste, ajout, activation,
 * suppression. L'URL ICS est un secret utilisateur — ne l'afficher qu'à la saisie.
 * Props : open/onClose. Les mutations invalident ['calendar-feeds'] et ['agenda'].
 */
import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useCalendarFeeds, useCalendarFeedMutations } from '@/hooks/useAgenda';

export function CalendarFeedsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: feeds = [] } = useCalendarFeeds();
  const { createFeed, updateFeed, deleteFeed } = useCalendarFeedMutations();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg border border-border bg-background p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Calendriers externes (ICS)</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Fermer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {feeds.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.enabled} onChange={(e) => updateFeed.mutate({ id: f.id, enabled: e.target.checked })} />
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
              <span className="truncate">{f.name}</span>
              {f.lastError && <span className="text-xs text-amber-600 truncate" title={f.lastError}>erreur</span>}
              <button onClick={() => deleteFeed.mutate(f.id)} className="ml-auto text-muted-foreground hover:text-red-600" aria-label="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {feeds.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun calendrier. Publie ton calendrier (Outlook : Paramètres → Calendrier → Calendriers partagés) et colle le lien ICS ici.
            </p>
          )}
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !url.trim()) return;
            createFeed.mutate({ name: name.trim(), url: url.trim() }, { onSuccess: () => { setName(''); setUrl(''); } });
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Client)" className="h-8 rounded border border-input bg-background px-2 text-sm" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL du calendrier .ics" className="h-8 rounded border border-input bg-background px-2 text-sm" />
          <button type="submit" disabled={createFeed.isPending} className="h-8 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm font-medium">
            Ajouter
          </button>
          {createFeed.isError && <p className="text-xs text-red-600">Ajout impossible — vérifie l'URL.</p>}
        </form>
      </div>
    </div>
  );
}
