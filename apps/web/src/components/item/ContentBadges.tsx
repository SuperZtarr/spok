/*
 * Pastilles de contenus d'une vignette d'élément : nombre par sorte (ordre et icônes du registre — constants/itemContentIcons.ts), calculé
 * par lib/itemFace.ts (badgesOf), la miniature n'étant pas comptée. Lecture seule : aucune action au clic.
 * Props : badges (itemFace), compact (format ligne : chiffres serrés), color (couleur imposée par la vue, MindMap). Infobulle : hint `badges` de la fiche d'aide
 * « item-contents ». Rien n'est rendu sans contenu à compter.
 */
import { ITEM_CONTENT_ICONS } from '../../constants/itemContentIcons';
import { HelpHint } from '../../help/HelpHint';
import { PAGE_HELP } from '../../help/pageHelp';
import type { ContentBadge } from '../../lib/itemFace';


export function ContentBadges({ badges, compact = false, color }: { badges: ContentBadge[]; compact?: boolean; color?: string }) {
  if (badges.length === 0) return null;
  return (
    <HelpHint text={PAGE_HELP['item-contents']?.hints?.badges} className="inline-flex flex-shrink-0">
      <span className={`inline-flex items-center ${color ? '' : 'text-muted-foreground'} ${compact ? 'gap-1' : 'gap-1.5'}`} style={color ? { color } : undefined} data-content-badges="">
        {badges.map(({ kind, count }) => {
          const Icon = ITEM_CONTENT_ICONS[kind];
          return (
            <span key={kind} className={`inline-flex items-center gap-0.5 rounded leading-none ${color ? 'bg-black/10' : 'bg-muted'} ${compact ? 'px-0.5 text-[10px]' : 'px-1 py-0.5 text-[11px]'}`}>
              <Icon className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
              {count}
            </span>
          );
        })}
      </span>
    </HelpHint>
  );
}
