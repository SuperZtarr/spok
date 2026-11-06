/*
 * Contenu d'une vignette de la Loupe : affiche ce que décide la grille (loupe-vignette.ts), sans aucune règle par type.
 * Props : level (niveau de détail), title, Icon et iconClass (icône du type), spaceName (item d'un autre espace, affiché dès
 * la taille intermédiaire), content (grille), openHint (infobulle du bouton Ouvrir), menu (menu ⋮, vignette zoomée seulement).
 * Règle : le bouton Ouvrir ne fige pas le zoom (événements arrêtés) ; le cadre et les gestes restent dans LoupeView.
 * Élément à image : l'image remplace l'icône (petite en minimale, miniature au-dessus) ; image illisible = icône.
 */
import { useState, type ComponentType, type ReactNode, type SyntheticEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { HelpHint } from '../../help/HelpHint';
import type { VignetteContent, VignetteLevel } from './loupe-vignette';

interface LoupeVignetteProps {
  level: VignetteLevel;
  title: string;
  Icon: ComponentType<{ className?: string }>;
  iconClass: string;
  spaceName?: string;
  content: VignetteContent;
  openHint?: string;
  menu?: ReactNode;
}

const stop = (event: SyntheticEvent) => event.stopPropagation();

export function LoupeVignette({ level, title, Icon, iconClass, spaceName, content, openHint, menu }: LoupeVignetteProps) {
  const titleClass = level === 'big' ? 'text-base font-semibold whitespace-normal line-clamp-2' : level === 'mid' ? 'truncate text-sm font-medium' : 'truncate text-xs';
  const showMeta = level !== 'small' && (!!spaceName || content.meta.length > 0);
  const [imageFailed, setImageFailed] = useState(false);
  const image = imageFailed ? undefined : content.imageUrl;
  const markFailed = () => setImageFailed(true);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex min-w-0 flex-shrink-0 items-center gap-1.5">
        {!image && <Icon className={`flex-shrink-0 ${level === 'small' ? 'h-3 w-3' : 'h-4 w-4'} ${iconClass}`} />}
        {image && level === 'small' && (
          <img src={image} alt="" loading="lazy" draggable={false} onError={markFailed} className="h-4 w-4 flex-shrink-0 rounded-sm object-cover" />
        )}
        <span className={`min-w-0 ${titleClass}`}>{title || '—'}</span>
        {menu && (
          <div className="ml-auto flex-shrink-0 self-start" onClick={stop} onDoubleClick={stop} onPointerDown={stop}>
            {menu}
          </div>
        )}
      </div>

      {showMeta && (
        <div className="mt-0.5 flex min-w-0 flex-shrink-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          {spaceName && (
            <span className="max-w-[110px] truncate rounded bg-amber-200 px-1 font-medium text-amber-900 dark:bg-amber-800 dark:text-amber-100">
              {spaceName}
            </span>
          )}
          {content.meta.map((part) => <span key={part} className="truncate">{part}</span>)}
        </div>
      )}

      {image && level !== 'small' && (
        <img src={image} alt="" loading="lazy" draggable={false} onError={markFailed} className="mt-1 min-h-0 w-full flex-1 rounded bg-muted object-contain" />
      )}

      {content.address && <p className="mt-1 flex-shrink-0 truncate text-xs text-muted-foreground">{content.address}</p>}

      {content.text && (
        <p className={`mt-1 min-h-0 text-xs leading-relaxed text-muted-foreground ${content.textLines === 1 ? 'truncate' : 'line-clamp-3'}`}>
          {content.text}
        </p>
      )}

      {content.openHref && (
        <div className="mt-auto flex-shrink-0 pt-1">
          <HelpHint text={openHint} className="inline-flex">
            <a
              href={content.openHref}
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
        </div>
      )}
    </div>
  );
}
