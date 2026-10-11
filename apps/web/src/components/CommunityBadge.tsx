/*
 * Indicateurs compacts d'une communauté dans la sidebar : visibilité (globe = ouverte,
 * œil = lecture seule, cadenas = privée) + statut de l'utilisateur quand il n'est pas membre
 * (« Invitation » si invitation en attente, bouclier si visible uniquement via le mode admin).
 * Props : visibility (source de vérité, jamais isPublic qui est déprécié), role tel que renvoyé par
 * GET /communities (OWNER/MEMBER/… | 'INVITED' | 'ADMIN_VIEW' | null = publique non rejointe).
 * Usage : en ligne après le nom de la communauté ; purement visuel, aucune logique d'accès ici.
 */
import { Globe, Eye, Lock, ShieldCheck } from 'lucide-react';

const VISIBILITY_META = {
  OPEN: { Icon: Globe, label: 'Communauté ouverte' },
  READONLY: { Icon: Eye, label: 'Communauté en lecture seule' },
  PRIVATE: { Icon: Lock, label: 'Communauté privée' },
} as const;

type Visibility = keyof typeof VISIBILITY_META;

/** Vrai quand l'utilisateur voit la communauté sans en être membre (publique, invitation, vue admin). */
export function isNonMemberRole(role: string | null | undefined): boolean {
  return role == null || role === 'INVITED' || role === 'ADMIN_VIEW';
}

export function CommunityBadge({ visibility, role }: { visibility?: string | null; role?: string | null }) {
  const meta = VISIBILITY_META[(visibility as Visibility) ?? 'PRIVATE'] ?? VISIBILITY_META.PRIVATE;
  const status = role === 'INVITED' ? ' — invitation en attente'
    : role === 'ADMIN_VIEW' ? ' — visible en mode admin'
    : role == null ? ' — non membre'
    : '';
  const { Icon } = meta;
  return (
    <span className="flex items-center gap-1 flex-shrink-0" title={meta.label + status}>
      <Icon className="w-3 h-3 text-muted-foreground/60" aria-label={meta.label} />
      {role === 'ADMIN_VIEW' && <ShieldCheck className="w-3 h-3 text-amber-600" aria-label="Visible en mode admin" />}
      {role === 'INVITED' && (
        <span className="text-[10px] leading-none px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">Invitation</span>
      )}
    </span>
  );
}
