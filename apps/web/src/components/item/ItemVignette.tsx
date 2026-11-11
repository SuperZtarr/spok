/*
 * Vignette d'élément commune (décision Thomas 2026-11-08) : affiche le visage calculé par lib/itemFace.ts, sans aucune
 * règle par type. Même rendu dans toutes les vues à format égal ; la vue fournit seulement son cadre autour.
 * Props :
 *   format  'ligne' | 'carte' | 'grande' (voir itemFace.ts) ; face = itemFace(item, format, libellés)
 *   title, Icon + iconClass (icône du type, montrée quand il n'y a pas de miniature)
 *   spaceName : élément d'un autre espace → pastille ambre ; tags (carte, grande)
 *   leading : avant la miniature (poignée, dépli…) ; menu : menu ⋮ ou actions de la vue, en bout de titre
 *   openHint : infobulle du bouton Ouvrir (grande) ; titleClassName : retouche du titre propre à une vue (couleur…)
 *   showMeta=false : la vue montre déjà ces infos dans ses propres colonnes (Planning, badge de statut de la Liste) —
 *   seul écart permis au visage commun, pour ne pas les répéter
 * Règles : la vignette remplit son conteneur (h-full en carte/grande) et se tronque si le cadre est fixe (Loupe) ;
 * le bouton Ouvrir et le menu arrêtent les événements (pas de clic sur la vignette). Image illisible = icône.
 * Miniature « document » (1re page d'un fichier, 2026-11-11) : cadrée sur le haut, extension en pastille (carte, grande).
 */
import { useState, type ComponentType, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import type { Tag } from '@spok/shared';
import { HelpHint } from '../../help/HelpHint';
import { TagBadge } from '../ui/TagBadge';
import { safeHref } from '../../lib/sanitizeHtml';
import { ContentBadges } from './ContentBadges';
import type { ItemFace, VignetteFormat } from '../../lib/itemFace';

interface ItemVignetteProps {
  format: VignetteFormat;
  face: ItemFace;
  title: string;
  Icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  iconClass?: string;
  /** Couleur imposée par la vue (MindMap : texte lisible sur le fond du statut) */
  color?: string;
  spaceName?: string;
  tags?: Tag[];
  leading?: ReactNode;
  menu?: ReactNode;
  openHint?: string;
  titleClassName?: string;
  showMeta?: boolean;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

function SpacePill({ name }: { name: string }) {
  return (
    <span className="max-w-[110px] flex-shrink truncate rounded bg-amber-200 px-1 text-xs font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
      {name}
    </span>
  );
}

function Menu({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto flex-shrink-0 self-start" onClick={stop} onDoubleClick={stop} onPointerDown={stop}>
      {children}
    </div>
  );
}

export function ItemVignette({ format, face, title, Icon, iconClass = '', color, spaceName, tags, leading, menu, openHint, titleClassName = '', showMeta: metaWanted = true }: ItemVignetteProps) {
  const [imageFailed, setImageFailed] = useState(false);
  // Adresses déjà filtrées par itemFace ; refiltrées ici pour qu'aucun appelant ne puisse faire passer javascript:
  const image = imageFailed ? undefined : safeHref(face.cover.url);
  // 1re page d'un fichier : cadrée sur le haut (le début du document), extension en pastille
  const isPage = face.cover.kind === 'document';
  const crop = isPage ? 'object-top' : '';
  const pageLabel = isPage && face.cover.label
    ? <span className="pointer-events-none absolute right-1 top-1 rounded bg-foreground/75 px-1 text-[10px] font-semibold leading-4 text-background">{face.cover.label}</span>
    : null;
  const openHref = safeHref(face.openHref);
  const markFailed = () => setImageFailed(true);
  const iconStyle = color ? { color } : undefined;
  const typeIcon = (size: string) => <Icon className={`flex-shrink-0 ${size} ${iconClass}`} style={iconStyle} />;

  if (format === 'ligne') {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5" data-vignette="ligne">
        {leading}
        {image
          ? <img src={image} alt="" loading="lazy" draggable={false} onError={markFailed} className={`h-6 w-6 flex-shrink-0 rounded border border-border object-cover ${crop}`} />
          : typeIcon('h-4 w-4')}
        <span className={`min-w-[3rem] flex-1 truncate text-sm ${titleClassName}`} style={iconStyle} title={title}>{title || '—'}</span>
        {spaceName && <SpacePill name={spaceName} />}
        {metaWanted && face.meta[0] && <span className="max-w-[40%] flex-shrink truncate text-xs text-muted-foreground" style={iconStyle}>{face.meta[0]}</span>}
        <ContentBadges badges={face.badges} compact color={color} />
        {menu && <Menu>{menu}</Menu>}
      </div>
    );
  }

  const big = format === 'grande';
  const meta = metaWanted ? face.meta : [];
  const showMeta = !!spaceName || meta.length > 0;
  return (
    <div className="flex h-full min-w-0 flex-col" data-vignette={format}>
      {image && !big && (
        <div className="relative mb-1.5 flex-shrink-0">
          <img src={image} alt="" loading="lazy" draggable={false} onError={markFailed} className={`max-h-32 w-full rounded border border-border bg-muted object-cover ${crop}`} />
          {pageLabel}
        </div>
      )}
      <div className="flex min-w-0 flex-shrink-0 items-start gap-1.5">
        {leading}
        {!image && <span className="mt-0.5">{typeIcon('h-4 w-4')}</span>}
        <span className={`min-w-0 whitespace-normal break-words line-clamp-2 ${big ? 'text-base font-semibold' : 'text-sm font-medium'} ${titleClassName}`} title={title}>
          {title || '—'}
        </span>
        {menu && <Menu>{menu}</Menu>}
      </div>

      {showMeta && (
        <div className="mt-0.5 flex min-w-0 flex-shrink-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {spaceName && <SpacePill name={spaceName} />}
          {meta.map((part) => <span key={part} className="truncate">{part}</span>)}
        </div>
      )}

      {image && big && (
        <div className="relative mt-1 flex min-h-0 flex-1">
          <img src={image} alt="" loading="lazy" draggable={false} onError={markFailed} className={`min-h-0 w-full flex-1 rounded bg-muted object-contain ${crop}`} />
          {pageLabel}
        </div>
      )}

      {face.address && <p className="mt-1 flex-shrink-0 truncate text-xs text-muted-foreground">{face.address}</p>}

      {face.text && (
        <p className={`mt-1 min-h-0 flex-shrink-0 text-xs leading-relaxed text-muted-foreground ${face.textLines === 4 ? 'line-clamp-4' : 'line-clamp-2'}`}>
          {face.text}
        </p>
      )}

      {tags && tags.length > 0 && (
        <div className="mt-1.5 flex flex-shrink-0 flex-wrap gap-1">
          {tags.map((tag) => <TagBadge key={tag.id} tag={tag} size="sm" />)}
        </div>
      )}

      {(face.badges.length > 0 || openHref) && (
        <div className={`flex flex-shrink-0 items-center gap-2 pt-1 ${big ? 'mt-auto' : 'mt-0.5'}`}>
          <ContentBadges badges={face.badges} />
          {openHref && (
            <HelpHint text={openHint} className="ml-auto inline-flex">
              <a
                href={openHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={stop}
                onDoubleClick={stop}
                onPointerDown={stop}
                className="inline-flex h-6 items-center gap-1 rounded border border-input px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3 w-3" />
                Ouvrir
              </a>
            </HelpHint>
          )}
        </div>
      )}
    </div>
  );
}
