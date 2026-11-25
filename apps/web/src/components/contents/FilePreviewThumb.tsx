/*
 * Aperçu d'un fichier joint (2026-11-11) : l'image de la 1re page (previewUrl, calculée par l'API à l'envoi) cadrée
 * sur le haut, avec l'extension en pastille. Rien sans image : l'appelant montre alors l'icône de l'application
 * (getFileIcon) — le début du texte (excerpt) n'est plus affiché ici (décision Thomas 2026-11-25 : illisible sans mise
 * en page). Props : content (contenu FILE : previewUrl, name, url), size — 'md' bandeau encadré de carte (vue
 * Documents), 'fill' remplit son cadre sans bordure (vignette de la zone Contenus, ItemContentsSection).
 * Règles : adresse passée par safeHref ; image illisible → rien. Utiliser hasFilePreview pour savoir s'il y a une
 * image à montrer avant de réserver la place. Règle businessRules « item-contents-file-preview ».
 */
import { useState } from 'react';
import type { ItemContent } from '@spok/shared';
import { safeHref } from '../../lib/sanitizeHtml';
import { fileExtension } from '../../lib/itemFace';

type PreviewSource = Pick<ItemContent, 'previewUrl' | 'name' | 'url'>;
type Size = 'md' | 'fill';

/** Le fichier a-t-il une image de sa 1re page à montrer ? */
export function hasFilePreview(c: PreviewSource): boolean {
  return !!safeHref(c.previewUrl);
}

const FRAME: Record<Size, string> = {
  md: 'h-32 w-full rounded border border-border',
  fill: 'h-full w-full',
};

export function FilePreviewThumb({ content, size = 'md', className = '' }: { content: PreviewSource; size?: Size; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = failed ? null : safeHref(content.previewUrl);
  const label = fileExtension(content.name) ?? fileExtension(content.url);
  if (!image) return null;
  return (
    <div className={`relative overflow-hidden bg-white dark:bg-gray-900 ${FRAME[size]} ${className}`}>
      <img src={image} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)}
        className="h-full w-full object-cover object-top" />
      {label && (
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-foreground/75 px-1 text-[10px] font-semibold leading-4 text-background">{label}</span>
      )}
    </div>
  );
}
