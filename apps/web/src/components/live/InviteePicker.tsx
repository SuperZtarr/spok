/*
 * InviteePicker — liste filtrable à cocher de membres de la communauté invitables à une séance
 * (déjà filtrés côté API : aucun accès à l'espace parent). Composant contrôlé : selected / onChange(ids).
 * Utilisé par NewSessionDialog (création) et InviteesPanel (bandeau). Ne fait aucun appel réseau.
 * emptyState : affiché quand aucun candidat (les appelants passent NoInviteCandidates, qui explique pourquoi).
 */
import { useState, type ReactNode } from 'react';
import type { LiveInviteCandidate } from '@spok/shared';

export function InviteePicker({ candidates, selected, onChange, emptyState }: {
  candidates: LiveInviteCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyState?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  if (candidates.length === 0) {
    return <>{emptyState ?? <p className="text-xs text-muted-foreground">Aucun membre de la communauté à inviter.</p>}</>;
  }
  const q = query.trim().toLowerCase();
  const shown = q ? candidates.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)) : candidates;
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div>
      <input
        className="w-full mb-2 h-8 px-2 rounded border border-input bg-background text-sm"
        placeholder="Rechercher un membre de la communauté"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul className="max-h-40 overflow-auto divide-y divide-border border border-border rounded-md">
        {shown.map((c) => (
          <li key={c.userId} className="px-3 py-1.5 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" aria-label={c.name} checked={selected.includes(c.userId)} onChange={() => toggle(c.userId)} />
              <span className="truncate">{c.name}</span>
              <span className="ml-auto text-xs text-muted-foreground truncate">{c.email}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
