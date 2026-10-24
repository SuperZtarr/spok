/*
 * Rendu d'un bloc d'article (ArticleBlockView) en lecture, selon le type de l'élément référencé (décision Thomas
 * 2026-10-24, règle article-block-display-by-type) — contenu d'abord, jamais de champ vide ni de bloc vide :
 * NOTE → petit intertitre + texte (vide : intertitre seul) ; DOCUMENT → intertitre + texte + « 📎 fichier » ;
 * IMAGE / DIAGRAM avec adresse → image + légende (titre en gras + description) ; LINK → carte icône du site + titre +
 * adresse, description dessous ; MEETING / TASK / BUG / PROJECT / PERIOD → intertitre + ligne d'infos
 * (blockMetaLine) + texte ; autres → intertitre + texte. Jamais : tags, assigné, contributions, relations, enfants.
 * Bloc indisponible → encart « contenu indisponible ».
 * HTML toujours nettoyé (sanitizeHtml, règle user-html-sanitized) : un lecteur anonyme peut lire ici le contenu
 * d'un espace privé. Lien vers la fiche d'origine (intertitre) seulement si item.canOpen.
 * Props : block ; children (optionnel) = contenu de remplacement du texte, fourni par l'éditeur (note modifiable sur
 * place) — l'intertitre reste affiché au-dessus. L'impression (printArticle) copie ce rendu tel quel.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Lock } from 'lucide-react';
import type { ArticleBlockView } from '@spok/shared';
import { sanitizeHtml, safeHref } from '../../lib/sanitizeHtml';
import { fileNameFromUrl } from '../../lib/itemClipboard';
import { pageHint } from '../../help/pageHint';
import { blockClasses } from './articleLayout';
import { blockMetaLine, siteIconUrl } from './articleBlockContent';

type BlockItem = NonNullable<ArticleBlockView['item']>;

const html = (s: string | null) => ({ __html: sanitizeHtml(s) });
const hasContent = (s: string | null) => !!s && (/<(img|iframe)\b/i.test(s) || s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '');
const PROSE = 'prose prose-sm sm:prose-base dark:prose-invert max-w-none';

function SiteIcon({ url }: { url: string | null }) {
  const src = siteIconUrl(url);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <ExternalLink data-fallback-icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />;
  return <img src={src} alt="" className="w-4 h-4 flex-shrink-0" onError={() => setFailed(true)} />;
}

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
  return <div className={`${blockClasses(block, item.type)} my-4`} data-tour="article-block">{renderBody(item, children)}</div>;
}

function renderBody(item: BlockItem, children?: ReactNode): ReactNode {
  const fiche = item.canOpen && item.spaceId ? `/spaces/${item.spaceId}?item=${item.id}` : null;
  const title = fiche ? <Link to={fiche} className="hover:underline">{item.title}</Link> : item.title;
  const text = children ?? (hasContent(item.description) ? <div className={PROSE} dangerouslySetInnerHTML={html(item.description)} /> : null);

  if ((item.type === 'IMAGE' || item.type === 'DIAGRAM') && item.url) {
    return (
      <figure>
        <img src={safeHref(item.url)} alt={item.title} className="w-full h-auto rounded-md border border-border" />
        <figcaption className="mt-1 text-xs text-muted-foreground text-center">
          <strong className="font-semibold">{title}</strong>
          {hasContent(item.description) && <>{' '}<span className="[&_p]:inline" dangerouslySetInnerHTML={html(item.description)} /></>}
        </figcaption>
      </figure>
    );
  }

  if (item.type === 'LINK' && item.url) {
    return (
      <>
        <a href={safeHref(item.url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:bg-accent/50 transition-colors">
          <SiteIcon url={item.url} />
          <span className="min-w-0">
            <span className="block font-medium truncate">{item.title}</span>
            <span className="block text-xs text-muted-foreground truncate">{item.url}</span>
          </span>
        </a>
        {text && <div className="mt-2">{text}</div>}
      </>
    );
  }

  const meta = blockMetaLine(item);
  return (
    <section>
      <h3 className="font-semibold text-base mb-1">{title}</h3>
      {meta && <p className="text-xs text-muted-foreground mb-2">{meta}</p>}
      {text}
      {item.type === 'DOCUMENT' && item.url && (
        <p className="mt-2 text-sm">
          📎 <a href={safeHref(item.url)} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{fileNameFromUrl(item.url)}</a>
        </p>
      )}
    </section>
  );
}
