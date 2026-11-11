/*
 * Aperçu d'un fichier joint (2026-11-11) : savoir ce qu'il contient sans l'ouvrir. Affiche l'image de la 1re page
 * (previewUrl, calculée par l'API à l'envoi) cadrée sur le haut, avec l'extension en pastille ; à défaut, une « page »
 * qui montre le début du texte (excerpt). Rien si le fichier n'a ni l'un ni l'autre (format non couvert).
 * Props : content (contenu FILE : previewUrl, excerpt, name, url), size — 'md' bandeau encadré de carte (vue
 * Documents), 'fill' remplit son cadre sans bordure (vignette de la zone Contenus, ItemContentsSection).
 * Règles : adresse passée par safeHref ; image illisible → repli sur l'extrait. Utiliser hasFilePreview pour savoir
 * s'il y a quelque chose à montrer avant de réserver la place. Règle businessRules « item-contents-file-preview ».
 */
import { useState } from 'react';
import type { ItemContent } from '@spok/shared';
import { safeHref } from '../../lib/sanitizeHtml';
import { fileExtension } from '../../lib/itemFace';

type PreviewSource = Pick<ItemContent, 'previewUrl' | 'excerpt' | 'name' | 'url'>;
type Size = 'md' | 'fill';

/** Le fichier a-t-il un aperçu à montrer (image de la 1re page ou début du texte) ? */
export function hasFilePreview(c: PreviewSource): boolean {
  return !!safeHref(c.previewUrl) || !!c.excerpt?.trim();
}

const FRAME: Record<Size, string> = {
  md: 'h-32 w-full rounded border border-border',
  fill: 'h-full w-full',
};

const Label = ({ text }: { text: string }) => (
  <span className="pointer-events-none absolute right-1 top-1 rounded bg-foreground/75 px-1 text-[10px] font-semibold leading-4 text-background">{text}</span>
);

export function FilePreviewThumb({ content, size = 'md', className = '' }: { content: PreviewSource; size?: Size; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = failed ? null : safeHref(content.previewUrl);
  const text = content.excerpt?.trim();
  const label = fileExtension(content.name) ?? fileExtension(content.url);
  const frame = `relative overflow-hidden bg-white dark:bg-gray-900 ${FRAME[size]} ${className}`;

  if (image) {
    return (
      <div className={frame}>
        <img src={image} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top" />
        {label && <Label text={label} />}
      </div>
    );
  }
  if (!text) return null;
  return (
    <div className={`${frame} px-3 py-2`}>
      <p className="whitespace-pre-line text-[11px] leading-snug text-muted-foreground">{text}</p>
      {/* Fondu bas : la page continue */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-gray-900" />
      {label && <Label text={label} />}
    </div>
  );
}
