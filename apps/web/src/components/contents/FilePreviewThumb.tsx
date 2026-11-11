/*
 * Aperçu d'un fichier joint (2026-11-11) : savoir ce qu'il contient sans l'ouvrir. Affiche l'image de la 1re page
 * (previewUrl, calculée par l'API à l'envoi) cadrée sur le haut, avec l'extension en pastille ; à défaut, une « page »
 * qui montre le début du texte (excerpt). Rien si le fichier n'a ni l'un ni l'autre (format non couvert).
 * Props : content (contenu FILE : previewUrl, excerpt, name, url), size — 'sm' miniature 40×56 (ligne de la fiche en
 * mode Modifier, image seulement), 'md' bandeau de carte (vue Documents), 'lg' grand aperçu (fiche en mode Afficher).
 * Règles : adresse passée par safeHref ; image illisible → repli sur l'extrait. Utiliser hasFilePreview pour savoir
 * s'il y a quelque chose à montrer avant de réserver la place. Règle businessRules « item-contents-file-preview ».
 */
import { useState } from 'react';
import type { ItemContent } from '@spok/shared';
import { safeHref } from '../../lib/sanitizeHtml';
import { fileExtension } from '../../lib/itemFace';

type PreviewSource = Pick<ItemContent, 'previewUrl' | 'excerpt' | 'name' | 'url'>;
type Size = 'sm' | 'md' | 'lg';

/** Le fichier a-t-il un aperçu à montrer à cette taille ? ('sm' : image seulement) */
export function hasFilePreview(c: PreviewSource, size: Size = 'md'): boolean {
  return !!safeHref(c.previewUrl) || (size !== 'sm' && !!c.excerpt?.trim());
}

const FRAME: Record<Size, string> = {
  sm: 'h-14 w-10 flex-shrink-0',
  md: 'h-32 w-full',
  lg: 'h-64 w-full max-w-md',
};

export function FilePreviewThumb({ content, size = 'md', className = '' }: { content: PreviewSource; size?: Size; className?: string }) {
  const [failed, setFailed] = useState(false);
  const image = failed ? null : safeHref(content.previewUrl);
  const text = content.excerpt?.trim();
  const label = fileExtension(content.name) ?? fileExtension(content.url);
  const frame = `relative overflow-hidden rounded border border-border bg-white dark:bg-gray-900 ${FRAME[size]} ${className}`;

  if (image) {
    return (
      <div className={frame}>
        <img src={image} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top" />
        {label && size !== 'sm' && (
          <span className="pointer-events-none absolute right-1 top-1 rounded bg-foreground/75 px-1 text-[10px] font-semibold leading-4 text-background">{label}</span>
        )}
      </div>
    );
  }
  if (!text || size === 'sm') return null;
  return (
    <div className={`${frame} px-3 py-2`}>
      <p className={`whitespace-pre-line text-muted-foreground ${size === 'lg' ? 'text-sm leading-relaxed' : 'text-[11px] leading-snug'}`}>{text}</p>
      {/* Fondu bas : la page continue */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-gray-900" />
      {label && (
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-foreground/75 px-1 text-[10px] font-semibold leading-4 text-background">{label}</span>
      )}
    </div>
  );
}
