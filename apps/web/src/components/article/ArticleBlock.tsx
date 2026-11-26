/*
 * Rendu d'un bloc d'article (ArticleBlockView) en lecture, selon les CONTENUS de l'élément référencé (contenus
 * multiples, lot 3a, décision Thomas 2026-11-08, règle article-block-display-by-contents ; remplace le rendu par type
 * du 2026-10-24) — contenu d'abord, jamais de champ vide ni de bloc vide. Disposition (blockLayout) :
 * Le titre de l'élément est toujours le même intertitre, au-dessus du contenu (décision Thomas 2026-11-26) :
 * - 'figure' (que des images / schémas, texte court) → intertitre, images, texte en légende dessous ;
 * - 'links' (que des liens) → intertitre, une carte par lien (icône du site + nom du lien ou adresse), description dessous ;
 * - 'section' (le reste, dont un élément d'images avec un vrai texte) → intertitre + ligne d'infos selon le type
 *   (blockMetaLine : Réunion, Tâche, Projet, Période) + texte mis en page, puis Fichiers (« 📎 nom »), Liens (cartes).
 * Images (BlockImages, imageArrangement — 2026-11-18) : hauteur toujours limitée, jamais coupées (object-contain),
 * chacune avec le nom du contenu en légende dessous s'il en a un (2026-11-26) ;
 * une image à côté du texte (40 %, à droite ; au-dessus sous 640 px ou dans une colonne), deux et plus en galerie
 * (2 ou 3 par rangée). Clic → image en grand (Lightbox de ItemContentsSection).
 * Jamais : tags, assigné, contributions, relations, enfants.
 * Bloc indisponible → encart « contenu indisponible ».
 * Hiérarchie (block.depth, 0-3, décision Thomas 2026-10-30) : sous-niveau = décalage vers la droite avec filet à gauche
 * et intertitre plus petit (depthIndentClasses / depthTitleClasses de articleLayout.ts).
 * HTML toujours nettoyé (sanitizeHtml, règle user-html-sanitized) : un lecteur anonyme peut lire ici le contenu
 * d'un espace privé. Lien vers la fiche d'origine (intertitre) seulement si item.canOpen.
 * Largeur, ligne et décalage de hiérarchie : décidés par ArticleFlow (2026-11-26), le bloc ne rend que son contenu.
 * inRow : bloc dans une ligne de plusieurs — l'image d'un élément illustré passe au-dessus du texte (colonne étroite).
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
import { Lightbox } from '../contents/ItemContentsSection';
import { depthTitleClasses } from './articleLayout';
import { blockContents, blockLayout, blockMetaLine, imageArrangement, isPicture, siteIconUrl } from './articleBlockContent';

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
      <div className="min-w-0" data-tour="article-block" data-help-zone="article:bloc">
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <Lock className="w-4 h-4 flex-shrink-0" />
          {pageHint('article', 'unavailable')}
        </div>
      </div>
    );
  }
  return (
    <div className="min-w-0" data-tour="article-block" data-help-zone="article:bloc">
      {renderBody(item, block.depth, children, inRow)}
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

/** Images d'un bloc : une seule (hauteur limitée), à côté du texte (flottant à droite, 40 %), ou en galerie. */
function BlockImages({ images, title, beside }: { images: ArticleBlockContent[]; title: string; beside: boolean }) {
  const [open, setOpen] = useState<ArticleBlockContent | null>(null);
  const arrangement = imageArrangement(images.length, beside);
  if (arrangement === 'none') return null;
  // Le nom du contenu (s'il en a un) s'affiche sous l'image, en légende (décision Thomas 2026-11-26)
  const picture = (c: ArticleBlockContent, cls: string) => (
    <div key={c.id} className="min-w-0">
      <button type="button" onClick={() => setOpen(c)} aria-label={`Agrandir ${c.name || title}`}
        className="block w-full rounded-md border border-border bg-muted/30 overflow-hidden cursor-zoom-in">
        <img src={safeHref(c.url)} alt={c.name || title} className={`mx-auto object-contain ${cls}`} />
      </button>
      {c.name?.trim() && <span className="block mt-1 text-xs text-muted-foreground text-center break-words">{c.name.trim()}</span>}
    </div>
  );
  return (
    <>
      {arrangement === 'gallery' && (
        <div className={`grid gap-2 ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {images.map((c) => picture(c, 'h-40 sm:h-52 w-full'))}
        </div>
      )}
      {arrangement === 'single' && picture(images[0], 'max-h-[28rem] w-auto max-w-full')}
      {arrangement === 'beside' && (
        <div className="mb-3 sm:float-right sm:w-2/5 sm:ml-5">
          {picture(images[0], 'max-h-[24rem] w-auto max-w-full')}
        </div>
      )}
      {open && safeHref(open.url) && <Lightbox url={safeHref(open.url)!} alt={open.name || title} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Contenus non-images d'un bloc « section », déjà dans l'ordre Fichiers, Liens (API) */
function ContentList({ contents, title }: { contents: ArticleBlockContent[]; title: string }) {
  if (contents.length === 0) return null;
  return (
    <div className="mt-2 space-y-2">
      {contents.map((c) => {
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

function renderBody(item: BlockItem, depth: number, children: ReactNode | undefined, inRow: boolean): ReactNode {
  const fiche = item.canOpen && item.spaceId ? `/spaces/${item.spaceId}?item=${item.id}` : null;
  const title = fiche ? <Link to={fiche} className="hover:underline">{item.title}</Link> : item.title;
  const text = children ?? (hasContent(item.description) ? <div className={PROSE} dangerouslySetInnerHTML={html(item.description)} /> : null);
  const contents = blockContents(item);
  const images = contents.filter(isPicture);
  const layout = blockLayout(item);
  // Titre de l'élément : toujours le même intertitre, au-dessus du contenu, quelle que soit la disposition (2026-11-26)
  const heading = <h3 className={`font-semibold mb-1 ${depthTitleClasses(depth)}`}>{title}</h3>;

  if (layout === 'figure') {
    return (
      <figure>
        {heading}
        <BlockImages images={images} title={item.title} beside={false} />
        {hasContent(item.description) && (
          <figcaption className="mt-1 text-sm text-muted-foreground text-center [&_p]:my-0" dangerouslySetInnerHTML={html(item.description)} />
        )}
      </figure>
    );
  }

  if (layout === 'links') {
    return (
      <>
        {heading}
        <div className="space-y-2">
          {contents.map((c) => (
            <LinkCard key={c.id} url={c.url!} label={c.name?.trim() || c.url!} />
          ))}
        </div>
        {text && <div className="mt-2">{text}</div>}
      </>
    );
  }

  const meta = blockMetaLine(item);
  // Une image + un texte : à côté du texte (flottant, posé avant lui) ; sinon images sous le texte (galerie ou seule)
  const beside = !!text && !inRow && imageArrangement(images.length, true) === 'beside';
  return (
    <section className="flow-root">
      {heading}
      {meta && <p className="text-xs text-muted-foreground mb-2">{meta}</p>}
      {beside && <BlockImages images={images} title={item.title} beside />}
      {text}
      {!beside && images.length > 0 && <div className={text ? 'mt-3' : ''}><BlockImages images={images} title={item.title} beside={false} /></div>}
      <ContentList contents={contents.filter((c) => !isPicture(c))} title={item.title} />
    </section>
  );
}
