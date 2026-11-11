/*
 * Aperçu d'un fichier joint (2026-11-11) : savoir ce qu'il contient sans l'ouvrir. Calculé à l'envoi d'un contenu
 * FILE (routes/item-contents.ts) et par le script de rattrapage (scripts/backfill-file-previews.ts).
 * buildFilePreview(buffer, mimeType, fileName) → { image, excerpt } :
 * - PDF : page 1 dessinée (pdfjs-dist + @napi-rs/canvas) et texte de la page 1 ;
 * - docx / xlsx / pptx : miniature intégrée au fichier (docProps/thumbnail.jpeg|png, présente si le logiciel l'a
 *   enregistrée) ; docx : début du texte (mammoth) ;
 * - texte brut (txt, md, csv, tsv, log) : premières lignes ;
 * - autres formats : rien.
 * storeFilePreview(…, itemId) : idem, image rangée sous items/<itemId>/ (stockage de l'élément) → { previewUrl, excerpt }.
 * image = webp large de PREVIEW_WIDTH au plus ; excerpt = au plus EXCERPT_MAX caractères, espaces resserrés.
 * Règle : ne jamais faire échouer l'envoi — toute erreur, format inconnu ou dépassement de PREVIEW_TIMEOUT_MS donne
 * { image: null, excerpt: null }. Règle businessRules « item-contents-file-preview ».
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';
import { uploadImageToR2 } from './r2.js';

export interface FilePreview {
  image: Buffer | null;
  excerpt: string | null;
}

export const PREVIEW_WIDTH = 600;
export const EXCERPT_MAX = 500;
export const PREVIEW_TIMEOUT_MS = 10_000;

const NONE: FilePreview = { image: null, excerpt: null };
const OOXML_EXT = new Set(['docx', 'xlsx', 'pptx', 'docm', 'xlsm', 'pptm']);
const TEXT_EXT = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'log']);

const extOf = (fileName: string | null | undefined) => (fileName?.split('.').pop() ?? '').toLowerCase();

/** Texte resserré, coupé à EXCERPT_MAX ; vide → null */
export function toExcerpt(text: string | null | undefined): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > EXCERPT_MAX ? `${clean.slice(0, EXCERPT_MAX - 1).trimEnd()}…` : clean;
}

/** Image quelconque → webp de PREVIEW_WIDTH au plus, fond blanc (pages transparentes) */
async function toWebp(image: Buffer): Promise<Buffer> {
  return sharp(image)
    .resize(PREVIEW_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 80 })
    .toBuffer();
}

// Polices standard et tables de caractères livrées avec pdfjs-dist (lecture locale, jamais de réseau)
const require = createRequire(import.meta.url);
let pdfAssets: { standardFontDataUrl: string; cMapUrl: string } | null = null;
function pdfAssetDirs() {
  if (!pdfAssets) {
    // pdfjs exige une barre « / » finale, y compris sous Windows (fs lit aussi les chemins en « / »)
    const root = path.dirname(require.resolve('pdfjs-dist/package.json')).replace(/\\/g, '/');
    pdfAssets = { standardFontDataUrl: `${root}/standard_fonts/`, cMapUrl: `${root}/cmaps/` };
  }
  return pdfAssets;
}

async function pdfPreview(buffer: Buffer): Promise<FilePreview> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    ...pdfAssetDirs(),
    cMapPacked: true,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: PREVIEW_WIDTH / base.width });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
    const image = await toWebp(canvas.toBuffer('image/png'));
    const text = await page.getTextContent();
    const words = text.items.map((i) => ('str' in i ? `${i.str}${i.hasEOL ? '\n' : ''}` : '')).join(' ');
    return { image, excerpt: toExcerpt(words) };
  } finally {
    await doc.destroy();
  }
}

async function officePreview(buffer: Buffer, ext: string): Promise<FilePreview> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const thumb = zip.file(/^docProps\/thumbnail\.(jpe?g|png)$/i)[0];
  const image = thumb ? await toWebp(await thumb.async('nodebuffer')).catch(() => null) : null;
  let excerpt: string | null = null;
  if (ext === 'docx' || ext === 'docm') {
    const mammoth = await import('mammoth');
    excerpt = toExcerpt((await mammoth.extractRawText({ buffer })).value);
  }
  return { image, excerpt };
}

async function compute(buffer: Buffer, mimeType: string | null | undefined, fileName: string | null | undefined): Promise<FilePreview> {
  const ext = extOf(fileName);
  const mime = (mimeType ?? '').toLowerCase();
  if (ext === 'pdf' || mime === 'application/pdf') return pdfPreview(buffer);
  if (OOXML_EXT.has(ext) || mime.startsWith('application/vnd.openxmlformats-officedocument.')) return officePreview(buffer, ext);
  if (TEXT_EXT.has(ext) || mime === 'text/plain' || mime === 'text/markdown' || mime === 'text/csv') {
    // Assez d'octets pour EXCERPT_MAX caractères même en UTF-8 multioctet
    return { image: null, excerpt: toExcerpt(buffer.subarray(0, EXCERPT_MAX * 4).toString('utf8').replace(/�+$/, '')) };
  }
  return NONE;
}

/** Calcule l'aperçu et range l'image sous items/<itemId>/ ; ne lève jamais (stockage en échec → sans image) */
export async function storeFilePreview(
  buffer: Buffer, mimeType: string | null | undefined, fileName: string | null | undefined, itemId: string,
): Promise<{ previewUrl: string | null; excerpt: string | null }> {
  const { image, excerpt } = await buildFilePreview(buffer, mimeType, fileName);
  const previewUrl = image ? await uploadImageToR2(image, itemId).catch(() => null) : null;
  return { previewUrl, excerpt };
}

/** Aperçu d'un fichier ; ne lève jamais : format non couvert, fichier illisible ou trop lent → rien */
export async function buildFilePreview(
  buffer: Buffer,
  mimeType: string | null | undefined,
  fileName: string | null | undefined,
  timeoutMs = PREVIEW_TIMEOUT_MS,
): Promise<FilePreview> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<FilePreview>((resolve) => { timer = setTimeout(() => resolve(NONE), timeoutMs); });
  try {
    return await Promise.race([compute(buffer, mimeType, fileName).catch(() => NONE), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
