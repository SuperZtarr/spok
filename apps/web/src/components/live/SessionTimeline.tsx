/*
 * SessionTimeline — fil chronologique d'une séance (journal LiveSessionEntry) : heure, présentateur,
 * élément affiché (cliquable → ouvre la copie), arrivées des participants. Indépendant de l'organisation
 * de l'espace : ne jamais le dériver des positions d'items. Copie supprimée → titre figé, non cliquable.
 */
import type { LiveSessionEntry } from '@spok/shared';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export function SessionTimeline({ entries, onOpenItem }: { entries: LiveSessionEntry[]; onOpenItem: (id: string) => void }) {
  if (entries.length === 0) return <p className="text-sm text-muted-foreground p-3">Rien n'a encore été présenté.</p>;
  return (
    <ol className="max-h-96 overflow-auto divide-y divide-border text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3 px-3 py-2">
          <span className="text-muted-foreground tabular-nums">{time(e.createdAt)}</span>
          {e.kind === 'JOIN' ? (
            <span className="text-muted-foreground">{e.user.name} a rejoint</span>
          ) : (
            <span className="flex-1 min-w-0">
              {e.itemId ? (
                <button className="font-medium hover:underline text-left" onClick={() => onOpenItem(e.itemId!)}>{e.itemTitle || 'Sans titre'}</button>
              ) : (
                <span className="font-medium text-muted-foreground">{e.itemTitle || 'Sans titre'} (retiré)</span>
              )}
              <span className="text-muted-foreground"> — {e.user.name}</span>
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
