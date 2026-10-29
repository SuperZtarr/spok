/*
 * AccessColumnManager — accès d'UN utilisateur à des communautés ou des espaces, en 3 colonnes
 * Sans accès → Membre → Propriétaire : la gestion des membres (MembersColumnManager) « inversée », où chaque carte
 * est une communauté / un espace et non une personne (fiche utilisateur de l'administration, 2026-10-29).
 * Flèches : Sans accès → Membre (onAdd), Membre → Sans accès (onRemove, confirmé par l'appelant), Membre ↔
 * Propriétaire (onSetRole). Une colonne par rôle, recherche par colonne, sous-titre facultatif (communauté d'un espace).
 * Props : title, icon, entries (id, name, group?, role), callbacks, busy, hints (textes des flèches — fiche
 * pages/help/admin-users.help.ts), error (message de l'API, ex. dernier propriétaire).
 * hrefOf (facultatif) : le nom devient un lien vers les PARAMÈTRES de la communauté / de l'espace (pas sa vue).
 * Ne pas l'utiliser pour les membres d'une communauté / d'un espace : c'est MembersColumnManager (logique « soi-même »).
 */
import { useMemo, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Crown, Search, User, Ban } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';

export type AccessRole = 'NONE' | 'MEMBER' | 'OWNER';

export interface AccessEntry {
  id: string;
  name: string;
  /** Sous-titre (ex. communauté d'un espace) */
  group?: string | null;
  role: AccessRole;
}

interface Props {
  title: string;
  icon: ComponentType<{ className?: string }>;
  entries: AccessEntry[];
  onAdd: (id: string) => void;
  onRemove: (entry: AccessEntry) => void;
  onSetRole: (id: string, role: 'OWNER' | 'MEMBER') => void;
  busy?: boolean;
  error?: string | null;
  hints: { add?: string; remove?: string; promote?: string; demote?: string };
  /** Lien du nom : les PARAMÈTRES de la communauté / de l'espace (pas sa vue — demande Thomas 2026-10-29) */
  hrefOf?: (id: string) => string;
}

const ARROW = 'p-1 text-muted-foreground opacity-50 group-hover:opacity-100 transition-all disabled:opacity-25 disabled:cursor-not-allowed';

const COLUMNS: { role: AccessRole; label: string; icon: ComponentType<{ className?: string }>; iconClass: string }[] = [
  { role: 'NONE', label: 'Sans accès', icon: Ban, iconClass: 'text-muted-foreground' },
  { role: 'MEMBER', label: 'Membre', icon: User, iconClass: 'text-foreground' },
  { role: 'OWNER', label: 'Propriétaire', icon: Crown, iconClass: 'text-amber-500' },
];

export function AccessColumnManager({ title, icon: Icon, entries, onAdd, onRemove, onSetRole, busy, error, hints, hrefOf }: Props) {
  const [search, setSearch] = useState<Record<AccessRole, string>>({ NONE: '', MEMBER: '', OWNER: '' });

  const byRole = useMemo(() => {
    const out: Record<AccessRole, AccessEntry[]> = { NONE: [], MEMBER: [], OWNER: [] };
    for (const e of entries) out[e.role].push(e);
    for (const r of Object.keys(out) as AccessRole[]) {
      out[r].sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.name.localeCompare(b.name));
    }
    return out;
  }, [entries]);

  const filtered = (role: AccessRole) => {
    const q = search[role].trim().toLowerCase();
    return q ? byRole[role].filter((e) => e.name.toLowerCase().includes(q) || (e.group ?? '').toLowerCase().includes(q)) : byRole[role];
  };

  const arrow = (text: string | undefined, onClick: () => void, dir: 'left' | 'right', hover: string, label: string) => (
    <HelpHint text={text} className="inline-flex">
      <button type="button" onClick={onClick} disabled={busy} aria-label={label} className={`${ARROW} ${hover}`}>
        {dir === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
    </HelpHint>
  );

  return (
    <div className="space-y-2">
      <h3 className="font-medium flex items-center gap-2">
        <Icon className="w-4 h-4" />
        {title}
      </h3>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const list = filtered(col.role);
          return (
            <div key={col.role} className="border rounded-lg flex flex-col min-h-0" data-access-column={col.role}>
              <div className="p-2 border-b bg-muted/30">
                <div className="flex items-center gap-2 mb-1.5">
                  <ColIcon className={`w-4 h-4 ${col.iconClass}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{byRole[col.role].length}</span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Rechercher..."
                    value={search[col.role]}
                    onChange={(e) => setSearch((s) => ({ ...s, [col.role]: e.target.value }))}
                    className="w-full pl-7 pr-2 py-1 text-xs border border-border rounded bg-background"
                  />
                </div>
              </div>
              {/* Hauteur généreuse : la fiche utilisateur montrait trop peu de lignes (demande Thomas 2026-10-29) */}
              <div className="max-h-[45vh] overflow-y-auto p-1">
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">{search[col.role] ? 'Aucun résultat' : 'Aucun'}</p>
                ) : list.map((e) => (
                  <div key={e.id} className="flex items-center gap-1 p-1.5 rounded hover:bg-accent/50 group">
                    {col.role === 'MEMBER' && arrow(hints.remove, () => onRemove(e), 'left', 'hover:text-destructive', `Retirer l'accès à ${e.name}`)}
                    {col.role === 'OWNER' && arrow(hints.demote, () => onSetRole(e.id, 'MEMBER'), 'left', 'hover:text-primary', `Rétrograder en membre de ${e.name}`)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {hrefOf ? <Link to={hrefOf(e.id)} className="hover:underline" aria-label={`Paramètres de ${e.name}`}>{e.name}</Link> : e.name}
                      </p>
                      {e.group && <p className="text-[11px] text-muted-foreground truncate">{e.group}</p>}
                    </div>
                    {col.role === 'NONE' && arrow(hints.add, () => onAdd(e.id), 'right', 'hover:text-primary', `Donner l'accès membre à ${e.name}`)}
                    {col.role === 'MEMBER' && arrow(hints.promote, () => onSetRole(e.id, 'OWNER'), 'right', 'hover:text-amber-500', `Rendre propriétaire de ${e.name}`)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
