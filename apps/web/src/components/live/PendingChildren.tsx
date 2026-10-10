/*
 * PendingChildren — section « À révéler » de la fenêtre en direct (animateur uniquement, l'API refuse les autres) :
 * sous-items de l'élément affiché pas encore montrés aux participants (titres lus à la source par l'API,
 * avec les droits du demandeur). « Révéler » copie le sous-item dans la séance et le diffuse ; « Révéler le
 * suivant » prend le premier dans l'ordre. Requête ['live-pending', sessionId, entryId], invalidée par le flux.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { liveSessionsApi } from '../../lib/api';
import type { LiveSessionHandle } from '../../hooks/useLiveSession';

export function PendingChildren({ sessionId, entryId, live }: { sessionId: string; entryId: string; live: LiveSessionHandle }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: pending = [] } = useQuery({
    queryKey: ['live-pending', sessionId, entryId],
    queryFn: () => liveSessionsApi.pendingChildren(sessionId),
  });

  if (pending.length === 0) return null;

  const reveal = async (sourceItemId: string) => {
    setBusy(true);
    setError(null);
    try {
      await live.reveal(sourceItemId);
      await queryClient.invalidateQueries({ queryKey: ['live-pending', sessionId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Révélation impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded border border-dashed border-orange-400 p-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-orange-600 flex-1">À révéler ({pending.length}) — visible par vous seul</span>
        <button disabled={busy} className="inline-flex items-center gap-1 rounded bg-orange-500 px-2 py-0.5 text-white text-xs disabled:opacity-50"
          onClick={() => reveal(pending[0].sourceItemId)}>
          <Eye className="w-3 h-3" /> Révéler le suivant
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul className="text-sm space-y-0.5">
        {pending.map((c) => (
          <li key={c.sourceItemId} className="flex items-center gap-2">
            <span className="flex-1 truncate text-muted-foreground">{c.title}</span>
            <button disabled={busy} className="text-xs hover:underline disabled:opacity-50" onClick={() => reveal(c.sourceItemId)}>Révéler</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
