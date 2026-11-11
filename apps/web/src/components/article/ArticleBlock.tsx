/*
 * Rendu d'un bloc d'article (ArticleBlockView) en lecture, selon les CONTENUS de l'élément référencé (contenus
 * multiples, lot 3a, décision Thomas 2026-11-08, règle article-block-display-by-contents ; remplace le rendu par type
 * du 2026-10-24) — contenu d'abord, jamais de champ vide ni de bloc vide. Disposition (blockLayout) :
 * - 'figure' (que des images / schémas avec aperçu) → images pleine largeur + légende (titre en gras + description) ;
 * - 'links' (que des liens) → une carte par lien (icône du site + titre + adresse), description dessous ;
 * - 'section' (le reste) → intertitre + ligne d'infos selon le type (blockMetaLine : Réunion, Tâche, Projet, Période)
 *   + texte, puis les contenus regroupés dans l'ordre Images, Fichiers (« 📎 nom »), Liens (cartes), Schémas (aperçu).
 * Jamais : tags, assigné, contributions, relations, enfants.
 * Bloc indisponible → encart « contenu indisponible ».
 * Hiérarchie (block.depth, 0-3, décision Thomas 2026-10-30) : sous-niveau = décalage vers la droite avec filet à gauche
 * et intertitre plus petit (depthIndentClasses / depthTitleClasses de articleLayout.ts).
 * HTML toujours nettoyé (sanitizeHtml, règle user-html-sanitized) : un lecteur anonyme peut lire ici le contenu
 * d'un espace privé. Lien vers la fiche d'origine (intertitre) seulement si item.canOpen.
 * inRow : bloc dans une rangée de colonnes (ArticleFlow) — ni largeur, ni position, ni décalage : la colonne décide.
 * Props : block ; children (optionnel) = contenu de remplacement du texte, fourni par l'éditeur (note modifiable sur
 * place) — l'intertitre reste affiché au-dessus. L'impression (printArticle) copie ce rendu tel quel.
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Lock } from 'lucide-react';
import type { ArticleBlockContent, ArticleBlockView } from '@spok/shared';
import { sanitizeHtml, safeHref } from '../../lib/sanitizeHtml';
import { fileNameFromUrl } from '../../lib/itemClipboard';
import { pageHint } from '../../help/pageHint';
import { blockClasses, depthIndentClasses, depthTitleClasses } from './articleLayout';
import { blockContents, blockLayout, blockMetaLine, siteIconUrl } from './articleBlockContent';

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

export function ArticleBlock({ block, children, inRow = false }: { block: ArticleBlockView; children?: ReactNode; inRow?: boolean }) {
  const item = block.item;
  if (!block.available || !item) {
    return (
      <div className={inRow ? 'min-w-0' : `w-full my-4 ${depthIndentClasses(block.depth)}`} data-tour="article-block" data-help-zone="article:bloc">
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 flex-shrink-0" />
          {pageHint('article', 'unavailable')}
        </div>
      </div>
    );
  }
  return (
    <div className={inRow ? 'min-w-0' : `${blockClasses(block, blockLayout(item) === 'figure')} ${depthIndentClasses(block.depth)} my-4`} data-tour="article-block" data-help-zone="article:bloc">
      {renderBody(item, block.depth, children)}
    </div>
  );
}

/** Carte d'un lien : icône du site, titre, adresse */
function LinkCard({ url, label }: { url: string; label: string }) {
  return (
    <a href={safeHref(url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-md border border-border px-4 py-3 hover:bg-accent/50 transition-colors">
      <SiteIcon url={url} />
      <span className="min-w-0">
        <span className="block font-medium truncate">{label}</span>
        <span className="block text-xs text-muted-foreground truncate">{url}</span>
      </span>
    </a>
  );
}

const contentName = (c: ArticleBlockContent) => c.name?.trim() || fileNameFromUrl(c.url!);

/** Contenus d'un bloc « section », déjà dans l'ordre Images, Fichiers, Liens, Schémas (API) */
function ContentList({ contents, title }: { contents: ArticleBlockContent[]; title: string }) {
  if (contents.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {contents.map((c) => {
        if (c.kind === 'IMAGE' || c.kind === 'DIAGRAM') {
          return <img key={c.id} src={safeHref(c.url)} alt={c.name || title} className="w-full h-auto rounded-md border border-border" />;
        }
        if (c.kind === 'LINK') return <LinkCard key={c.id} url={c.url!} label={c.name?.trim() || title} />;
        return (
          <p key={c.id} className="text-sm">
            📎 <a href={safeHref(c.url)} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">{contentName(c)}</a>
          </p>
        );
      })}
    </div>
  );
}

function renderBody(item: BlockItem, depth: number, children?: ReactNode): ReactNode {
  const fiche = item.canOpen && item.spaceId ? `/spaces/${item.spaceId}?item=${item.id}` : null;
  const title = fiche ? <Link to={fiche} className="hover:underline">{item.title}</Link> : item.title;
  const text = children ?? (hasContent(item.description) ? <div className={PROSE} dangerouslySetInnerHTML={html(item.description)} /> : null);
  const contents = blockContents(item);
  const layout = blockLayout(item);

  if (layout === 'figure') {
    return (
      <figure>
        <div className="space-y-2">
          {contents.map((c) => (
            <img key={c.id} src={safeHref(c.url)} alt={c.name || item.title} className="w-full h-auto rounded-md border border-border" />
          ))}
        </div>
        <figcaption className="mt-1 text-xs text-muted-foreground text-center">
          <strong className="font-semibold">{title}</strong>
          {hasContent(item.description) && <>{' '}<span className="[&_p]:inline" dangerouslySetInnerHTML={html(item.description)} /></>}
        </figcaption>
      </figure>
    );
  }

  if (layout === 'links') {
    return (
      <>
        <div className="space-y-2">
          {contents.map((c) => (
            <LinkCard key={c.id} url={c.url!} label={contents.length > 1 ? (c.name?.trim() || item.title) : item.title} />
          ))}
        </div>
        {text && <div className="mt-2">{text}</div>}
      </>
    );
  }

  const meta = blockMetaLine(item);
  return (
    <section>
      <h3 className={`font-semibold mb-1 ${depthTitleClasses(depth)}`}>{title}</h3>
      {meta && <p className="text-xs text-muted-foreground mb-2">{meta}</p>}
      {text}
      <ContentList contents={contents} title={item.title} />
    </section>
  );
}
