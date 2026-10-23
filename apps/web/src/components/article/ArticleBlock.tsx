/*
 * Rendu d'un bloc d'article (ArticleBlockView) en lecture, selon le type de l'élément référencé :
 * NOTE → sa description (sans titre : le texte s'enchaîne) ; IMAGE / DIAGRAM → image + légende = titre ;
 * LINK → carte titre + adresse ; autre type → titre + description. Bloc indisponible → encart « contenu indisponible ».
 * HTML toujours nettoyé (sanitizeHtml, règle user-html-sanitized) : un lecteur anonyme peut lire ici le contenu
 * d'un espace privé. Lien vers la fiche d'origine seulement si item.canOpen (le lecteur y a accès par ailleurs).
 * Props : block ; children (optionnel) = contenu de remplacement fourni par l'éditeur (note modifiable sur place).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Lock } from 'lucide-react';
import type { ArticleBlockView } from '@spok/shared';
import { sanitizeHtml, safeHref } from '../../lib/sanitizeHtml';
import { pageHint } from '../../help/pageHint';
import { blockClasses } from './articleLayout';

const html = (s: string | null) => ({ __html: sanitizeHtml(s) });

export function ArticleBlock({ block, children }: { block: ArticleBlockView; children?: ReactNode }) {
  const item = block.item;
  if (!block.available || !item) {
    return (
      <div className="w-full my-4 flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground" data-tour="article-block">
        <Lock className="w-4 h-4 flex-shrink-0" />
        {pageHint('article', 'unavailable')}
      </div>
    );
  }

  const fiche = item.canOpen && item.spaceId ? `/spaces/${item.spaceId}?item=${item.id}` : null;
  const title = fiche ? <Link to={fiche} className="hover:underline">{item.title}</Link> : item.title;

  let body: ReactNode;
  if (children) {
    body = children;
  } else if (item.type === 'NOTE') {
    body = <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none" dangerouslySetInnerHTML={html(item.description)} />;
  } else if ((item.type === 'IMAGE' || item.type === 'DIAGRAM') && item.url) {
    body = (
      <figure>
        <img src={safeHref(item.url)} alt={item.title} className="w-full h-auto rounded-md border border-border" />
        <figcaption className="mt-1 text-xs text-muted-foreground text-center">{title}</figcaption>
      </figure>
    );
  } else if (item.type === 'LINK' && item.url) {
    body = (
      <a href={safeHref(item.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:bg-accent/50 transition-colors">
        <ExternalLink className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block font-medium truncate">{item.title}</span>
          <span className="block text-xs text-muted-foreground truncate">{item.url}</span>
        </span>
      </a>
    );
  } else {
    body = (
      <section>
        <h3 className="font-semibold text-base mb-1">{title}</h3>
        <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none" dangerouslySetInnerHTML={html(item.description)} />
      </section>
    );
  }

  return <div className={`${blockClasses(block, item.type)} my-4`} data-tour="article-block">{body}</div>;
}
