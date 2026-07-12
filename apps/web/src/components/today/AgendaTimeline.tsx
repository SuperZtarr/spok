/*
 * Colonne réunions de la page Ma journée : liste chronologique des événements du jour
 * (feeds ICS + MEETING SPOK), événements journée entière en tête, pastille couleur par source.
 * Props : events (déjà triés par le serveur), feedErrors (badge discret).
 * Lecture seule — aucune édition d'événement ici.
 */
import { AlertTriangle, CalendarDays } from 'lucide-react';
import type { AgendaEvent } from '@/lib/api';

function hm(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function AgendaTimeline({ events, feedErrors }: {
  events: AgendaEvent[];
  feedErrors: { feedId: string; name: string }[];
}) {
  const allDay = events.filter((e) => e.allDay);
  const timed = events.filter((e) => !e.allDay);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CalendarDays className="w-4 h-4" /> Réunions
        {feedErrors.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={`Calendrier(s) injoignable(s) : ${feedErrors.map((f) => f.name).join(', ')}`}>
            <AlertTriangle className="w-3.5 h-3.5" /> {feedErrors.length}
          </span>
        )}
      </div>
      {allDay.map((e) => (
        <div key={e.id} className="flex items-center gap-2 rounded border border-border bg-accent/40 px-2 py-1 text-sm">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
          <span className="truncate">{e.title}</span>
          <span className="ml-auto text-xs text-muted-foreground">journée</span>
        </div>
      ))}
      {timed.length === 0 && allDay.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune réunion.</p>
      )}
      {timed.map((e) => (
        <div key={e.id} className="flex items-start gap-2 rounded border border-border px-2 py-1.5 text-sm">
          <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.source.color ?? 'var(--muted-foreground)' }} />
          <div className="min-w-0">
            <div className="truncate font-medium">{e.title}</div>
            <div className="text-xs text-muted-foreground">
              {hm(e.start)}{e.end ? ` – ${hm(e.end)}` : ''}
              {e.location ? ` · ${e.location}` : ''}
              {e.source.kind === 'spok' ? ` · ${e.source.spaceName}` : ` · ${e.source.name}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
