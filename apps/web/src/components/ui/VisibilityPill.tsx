/*
 * Pastille de visibilité (icône + libellé coloré) posée sur la cover des vignettes de communauté
 * (/communities) et d'espace (page communauté) : privé (ambre), ouvert (vert), lecture seule (bleu).
 * Props : visibility — source de vérité (jamais isPublic, déprécié) ; entity — accorde libellé et
 * infobulle ; inheritedFrom — visibilité héritée (« · hérité » dans le libellé, bordure pointillée, atténuée,
 * infobulle « héritée de … »).
 * Usage : en absolute dans un conteneur relative (cover). Pour la sidebar, utiliser CommunityBadge (compact).
 */
import { Globe, Eye, Lock } from 'lucide-react';

const PILL_META = {
  PRIVATE: { Icon: Lock, community: 'Privée', space: 'Privé', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200' },
  OPEN: { Icon: Globe, community: 'Ouverte', space: 'Ouvert', className: 'bg-green-100 text-green-800 dark:bg-green-900/70 dark:text-green-200' },
  READONLY: { Icon: Eye, community: 'Lecture seule', space: 'Lecture seule', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-200' },
} as const;

const INHERITED_LABEL = { parent: "de l'espace parent", community: 'de la communauté' } as const;

interface VisibilityPillProps {
  visibility?: string | null;
  entity?: 'community' | 'space';
  inheritedFrom?: 'parent' | 'community' | null;
  className?: string;
}

export function VisibilityPill({ visibility, entity = 'community', inheritedFrom, className = '' }: VisibilityPillProps) {
  const meta = PILL_META[(visibility as keyof typeof PILL_META) ?? 'PRIVATE'] ?? PILL_META.PRIVATE;
  const { Icon } = meta;
  const label = meta[entity];
  const title = `${entity === 'community' ? 'Communauté' : 'Espace'} ${label.toLowerCase()}`
    + (inheritedFrom ? ` — visibilité héritée ${INHERITED_LABEL[inheritedFrom]}` : '');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium shadow-sm ${meta.className} ${inheritedFrom ? 'border-dashed border-current opacity-75' : 'border-transparent'} ${className}`}
      title={title}
    >
      <Icon className="w-3 h-3" />
      {label}
      {inheritedFrom && <span className="font-normal">· hérité</span>}
    </span>
  );
}
