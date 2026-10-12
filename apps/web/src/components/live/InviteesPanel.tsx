/*
 * InviteesPanel — panneau « Invités » du bandeau de séance (LiveSessionBar), réservé à l'animateur.
 * Liste les invités de la séance (« Retirer » révoque l'accès, possible même séance terminée) et,
 * tant que la séance n'est pas terminée, propose d'en ajouter via InviteePicker (membres de la communauté
 * sans accès à l'espace parent, déjà invités exclus ; s'ils sont tous invités, un message le dit ; aucun candidat →
 * NoInviteCandidates explique pourquoi et renvoie vers les membres de la communauté). Les invités voient la séance, jamais l'espace parent.
 * Props : sessionId (séance), parentSpaceId (espace parent, pour les candidats), ended (séance terminée → pas d'ajout).
 * Caches : ['live-invitees', sessionId] mis à jour avec la réponse de l'API ; candidats invalidés après chaque action.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveInvitee } from '@spok/shared';
import { liveSessionsApi } from '../../lib/api';
import { InviteePicker } from './InviteePicker';
import { NoInviteCandidates } from './NoInviteCandidates';

export function InviteesPanel({ sessionId, parentSpaceId, ended }: {
  sessionId: string;
  parentSpaceId: string;
  ended: boolean;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: invitees = [] } = useQuery({
    queryKey: ['live-invitees', sessionId],
    queryFn: () => liveSessionsApi.invitees(sessionId),
  });
  const { data: candidates = [] } = useQuery({
    queryKey: ['live-invite-candidates', parentSpaceId],
    queryFn: () => liveSessionsApi.inviteCandidates(parentSpaceId),
    enabled: !ended,
  });
  const invitedIds = new Set(invitees.map((i) => i.userId));
  const available = candidates.filter((c) => !invitedIds.has(c.userId));

  const run = async (fn: () => Promise<LiveInvitee[]>) => {
    setBusy(true);
    setError(null);
    try {
      queryClient.setQueryData(['live-invitees', sessionId], await fn());
      queryClient.invalidateQueries({ queryKey: ['live-invite-candidates', parentSpaceId] });
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3 text-sm">
      <h3 className="font-medium mb-2">Invités</h3>
      {invitees.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-2">Aucun invité.</p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-md mb-3">
          {invitees.map((i) => (
            <li key={i.userId} className="flex items-center gap-2 px-3 py-1.5">
              <span className="flex-1 truncate">{i.user.name}</span>
              <button className="text-xs hover:underline text-red-600" disabled={busy} onClick={() => run(() => liveSessionsApi.uninvite(sessionId, i.userId))}>
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      {!ended && (
        <>
          <p className="text-xs text-muted-foreground mb-2">Ajouter des membres de la communauté : ils verront la séance, pas l'espace.</p>
          {candidates.length > 0 && available.length === 0 ? (
            <p className="text-xs text-muted-foreground">Tous les membres invitables sont déjà invités.</p>
          ) : (
            <InviteePicker candidates={available} selected={selected} onChange={setSelected}
              emptyState={<NoInviteCandidates spaceId={parentSpaceId} />} />
          )}
          <div className="flex justify-end mt-2">
            <button
              className="rounded bg-orange-500 px-2 py-1 text-xs text-white disabled:opacity-50"
              disabled={busy || selected.length === 0}
              onClick={() => run(() => liveSessionsApi.invite(sessionId, selected))}
            >
              Inviter ({selected.length})
            </button>
          </div>
        </>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
