/* Vignette d'un item : une image PNG à coller ailleurs (Teams, Slack, mail, PowerPoint), distincte de « Copier la
 * fiche » (lib/itemClipboard.ts) qui copie les valeurs. Construite depuis la même fiche (ItemSheet).
 * - buildItemThumbnail : données de la carte, pur et testable — champs vides omis, extrait de la description
 * - renderItemThumbnailPng : dessine ItemThumbnailCard hors écran puis la convertit (html-to-image), pixelRatio 2.
 *   Le média passe d'abord par imageToPngDataUrl ; s'il est illisible (CORS, réseau), la carte montre l'extrait
 * - copyItemThumbnail : presse-papier image/png ; si le navigateur refuse, téléchargement du PNG. Le PNG est passé
 *   en promesse à ClipboardItem : l'écriture démarre pendant le clic (geste utilisateur exigé par Safari)
 * Règle businessRules « item-thumbnail-copy ». Ne pas réutiliser pour un export de vue : exportUtils.ts s'en charge. */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { toBlob } from 'html-to-image';
import { ItemThumbnailCard } from '../components/ItemThumbnailCard';
import { imageToPngDataUrl, type ItemSheet } from './itemClipboard';
import { htmlToText } from './sanitizeHtml';
import { sanitizeFilename } from './exportUtils';

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
}

const EXCERPT_MAX = 320;

function excerptOf(html: string | null): string | null {
  if (!html) return null;
  // Espace après chaque fin de bloc : sinon textContent colle les paragraphes
  const text = htmlToText(html.replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, '$& ')).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX).trimEnd()}…` : text;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function buildItemThumbnail(sheet: ItemSheet, type: string): ItemThumbnail {
  const field = (label: string) => sheet.fields.find((f) => f.label === label)?.value ?? null;
  const media = sheet.media;
  const dates = field('Échéance')
    ? `Échéance ${field('Échéance')}`
    : [field('Début'), field('Fin')].filter(Boolean).join(' → ');
  return {
    type,
    title: sheet.title,
    typeLabel: field('Type'),
    status: field('Statut'),
    priority: field('Priorité'),
    imageUrl: media?.kind === 'image' ? media.url : null,
    excerpt: excerptOf(sheet.descriptionHtml),
    attachment: media?.kind === 'file' ? media.name : media?.kind === 'url' ? hostOf(media.url) : null,
    meta: [field('Espace'), dates, field('Assigné à')].filter((v): v is string => !!v),
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
