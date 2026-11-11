/* Vignette d'un item : une image PNG à coller ailleurs (Teams, Slack, mail, PowerPoint), distincte de « Copier la
 * fiche » (lib/itemClipboard.ts) qui copie les valeurs. Construite depuis la même fiche (ItemSheet).
 * - buildItemThumbnail : données de la carte, pur et testable — champs vides omis, extrait de la description
 * - renderItemThumbnailPng : dessine ItemThumbnailCard hors écran puis la convertit (html-to-image), pixelRatio 2.
 *   Le média passe d'abord par imageToPngDataUrl ; s'il est illisible (CORS, réseau), la carte montre l'extrait
 * - copyItemThumbnail : presse-papier image/png ; si le navigateur refuse, téléchargement du PNG. Le PNG est passé
 *   en promesse à ClipboardItem : l'écriture démarre pendant le clic (geste utilisateur exigé par Safari)
 * Règle businessRules « item-thumbnail-copy ». Ne pas réutiliser pour un export de vue : exportUtils.ts s'en charge.
 * Format « grande » de la vignette commune (lib/itemFace.ts, 2026-11-08) : miniature et pastilles viennent de la même
 * règle (coverOf, badgesOf) à partir des contenus de l'élément ; les infos restent celles de la fiche (déjà libellées).
 * Aperçu des fichiers (2026-11-11) : la miniature peut être la 1re page d'un fichier ; sans description, l'extrait est
 * le début du premier fichier (fileExcerptOf). */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { toBlob } from 'html-to-image';
import { ItemThumbnailCard } from '../components/ItemThumbnailCard';
import { imageToPngDataUrl, type ItemSheet } from './itemClipboard';
import { htmlToText } from './sanitizeHtml';
import { sanitizeFilename } from './exportUtils';
import { badgesOf, coverOf, fileExcerptOf, hostOf, type ContentBadge, type FaceContent } from './itemFace';

export interface ItemThumbnail {
  /** Type technique de l'item (icône) */
  type: string;
  title: string;
  typeLabel: string | null;
  status: string | null;
  priority: string | null;
  /** Image ou schéma de l'item ; prioritaire sur l'extrait */
  imageUrl: string | null;
  excerpt: string | null;
  /** Domaine d'un lien ou nom d'un fichier joint */
  attachment: string | null;
  /** Espace, échéance ou dates, assigné */
  meta: string[];
  /** Nombre des autres contenus par sorte (pastilles de la vignette commune) */
  badges: ContentBadge[];
}

const EXCERPT_MAX = 320;

function excerptOf(html: string | null): string | null {
  if (!html) return null;
  // Espace après chaque fin de bloc : sinon textContent colle les paragraphes
  const text = htmlToText(html.replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, '$& ')).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX).trimEnd()}…` : text;
}

/** contents : contenus de l'élément enregistré (seule source de la miniature depuis le lot 4). */
export function buildItemThumbnail(sheet: ItemSheet, type: string, contents?: FaceContent[] | null): ItemThumbnail {
  const field = (label: string) => sheet.fields.find((f) => f.label === label)?.value ?? null;
  const media = sheet.media;
  const dates = field('Échéance')
    ? `Échéance ${field('Échéance')}`
    : [field('Début'), field('Fin')].filter(Boolean).join(' → ');
  const source = { type, contents };
  const cover = coverOf(source);
  const firstFile = contents?.find((c) => c.kind === 'FILE');
  const firstLink = contents?.find((c) => c.kind === 'LINK');
  const attachment = firstFile ? firstFile.name || firstFile.url || null
    : firstLink ? hostOf(firstLink.url) ?? firstLink.url ?? null
    : media?.kind === 'file' ? media.name : media?.kind === 'url' ? hostOf(media.url) ?? media.url : null;
  return {
    type,
    title: sheet.title,
    typeLabel: field('Type'),
    status: field('Statut'),
    priority: field('Priorité'),
    imageUrl: cover.url ?? (media?.kind === 'image' ? media.url : null),
    // Sans description : début du premier fichier (aperçu des fichiers, comme la vignette commune)
    excerpt: excerptOf(sheet.descriptionHtml) ?? excerptOf(fileExcerptOf(source) ?? null),
    attachment,
    meta: [field('Espace'), dates, field('Assigné à')].filter((v): v is string => !!v),
    badges: badgesOf(source, cover),
  };
}

/** Image convertie en data URL pour le dessin ; illisible → sans image (la carte montre l'extrait). */
export async function withEmbeddedImage(thumb: ItemThumbnail, toPng = imageToPngDataUrl): Promise<ItemThumbnail> {
  if (!thumb.imageUrl) return thumb;
  return { ...thumb, imageUrl: await toPng(new URL(thumb.imageUrl, window.location.origin).href) };
}

export async function renderItemThumbnailPng(thumb: ItemThumbnail): Promise<Blob> {
  const ready = await withEmbeddedImage(thumb);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none';
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(ItemThumbnailCard, { thumb: ready })));
    const card = host.firstElementChild as HTMLElement;
    await Promise.all(Array.from(card.querySelectorAll('img')).map((img) => img.decode().catch(() => undefined)));
    // skipFonts : pas de lecture des polices distantes ; la carte utilise la pile système
    const blob = await toBlob(card, { pixelRatio: 2, skipFonts: true, backgroundColor: '#ffffff' });
    if (!blob) throw new Error('Vignette non générée');
    return blob;
  } finally {
    root.unmount();
    host.remove();
  }
}

export type ThumbnailCopyResult = 'copied' | 'downloaded';

/** Copie la vignette ; repli téléchargement si le presse-papier refuse. Rejette seulement si le PNG n'a pu être créé. */
export async function copyItemThumbnail(thumb: ItemThumbnail, render = renderItemThumbnailPng): Promise<ThumbnailCopyResult> {
  const png = render(thumb);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      return 'copied';
    } catch {
      // Presse-papier refusé ou PNG en échec : l'attente ci-dessous tranche
    }
  }
  const url = URL.createObjectURL(await png);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(thumb.title || 'vignette')}.png`;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
