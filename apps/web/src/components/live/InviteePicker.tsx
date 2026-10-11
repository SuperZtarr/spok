/*
 * InviteePicker — liste filtrable à cocher de membres de la communauté invitables à une séance
 * (déjà filtrés côté API : aucun accès à l'espace parent). Composant contrôlé : selected / onChange(ids).
 * Utilisé par NewSessionDialog (création) et InviteesPanel (bandeau). Ne fait aucun appel réseau.
 */
import { useState } from 'react';
import type { LiveInviteCandidate } from '@spok/shared';

export function InviteePicker({ candidates, selected, onChange }: {
  candidates: LiveInviteCandidate[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  if (candidates.length === 0) {
    return <p className="text-xs text-muted-foreground">Tous les membres de la communauté ont déjà accès à l'espace : ils peuvent rejoindre la séance sans invitation.</p>;
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
