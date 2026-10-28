/* Copie de la fiche d'un item dans le presse-papier — bouton « Copier la fiche » de la modale item.
 * Une seule copie, deux formats : text/html (collage mis en forme dans Word, mail, Notion) et
 * text/plain en Markdown (éditeur texte, Claude, champ simple). Seuls les champs renseignés apparaissent.
 * Média de l'item (url) : IMAGE et DIAGRAM sont intégrés comme image — à la copie, l'image est téléchargée et
 * convertie en PNG dans le HTML (data URL : les fichiers stockés sont en WebP, mal lus par Word / Outlook) ;
 * si c'est impossible (CORS, réseau), <img> pointe sur l'adresse rendue absolue (les uploads locaux du dev sont
 * relatifs, Word ne les trouverait pas) — withAbsoluteMediaUrl, imageToPngDataUrl, itemSheetToClipboardHtml ;
 * DOCUMENT devient un lien nommé d'après le fichier (un fichier ne s'intègre pas dans un collage) ;
 * LINK reste un lien. Le Markdown ne contient que l'adresse (![titre](url) pour une image).
 * - buildItemSheet : extrait les données de la fiche (labels résolus par l'appelant, référentiels de l'espace)
 * - itemSheetToMarkdown / itemSheetToHtml : rendus purs, testables sans DOM
 * - htmlToMarkdown : convertisseur volontairement limité au HTML produit par l'éditeur (p, br, gras,
 *   italique, listes, titres, liens, images, code, citations) — pas un convertisseur générique
 * - copyItemSheet : écriture presse-papier (ClipboardItem, repli writeText en Markdown)
 * Sécurité : média seulement si son URL est sûre (isSafeUrl), HTML copié passé par sanitizeHtml (user-html-sanitized).
 * La même fiche (ItemSheet) est affichée par la vue lecture (ItemReadView) : ce qu'on lit = ce qu'on copie.
 * Doublon média : une <img> de la description pointant sur l'URL du média (items IMAGE importés de Confluence,
 * scripts fix-confluence-split-images / fix-drawio-attachments) est retirée — l'image n'apparaît qu'une fois.
 * Impression et PDF restent dans itemExport.ts. */
import type { Item, ItemRelation, ContributionWithAuthor } from '@spok/shared';
import { sanitizeHtml, isSafeUrl } from './sanitizeHtml';

export interface ItemSheetLabels {
  typeLabel: (type: string) => string | undefined;
  statusLabel: (status: string) => string | undefined;
  priorityLabel: (priority: number) => string | undefined;
  formatDate: (iso: string) => string;
}

type RelatedRef = { id: string; title: string; type?: string };

export interface ItemSheetSource extends Item {
  parent?: { title: string } | null;
  assignedTo?: { name?: string | null } | null;
  relationsFrom?: (ItemRelation & { toItem?: RelatedRef })[];
  relationsTo?: (ItemRelation & { fromItem?: RelatedRef })[];
  contributions?: ContributionWithAuthor[];
}

export interface ItemSheet {
  title: string;
  fields: { label: string; value: string }[];
  tags: string[];
  descriptionHtml: string | null;
  /** image : affichée dans la fiche ; file : lien nommé d'après le fichier ; url : lien brut */
  media: { kind: 'image' | 'file' | 'url'; label: string; url: string; name: string } | null;
  children: { id: string; title: string; status: string | null }[];
  relations: { label: string; title: string; comment: string | null }[];
  contributions: { author: string; date: string; contentHtml: string }[];
}

export interface BuildItemSheetInput {
  item: ItemSheetSource;
  children?: Item[];
  spaceName?: string;
  /** Titre du parent si item.parent n'est pas chargé */
  parentTitle?: string | null;
  labels: ItemSheetLabels;
  /** Libellé d'un type de relation, vu depuis la source (« Bloque ») ou la cible (« Bloqué par ») */
  relationLabel: (type: string, direction: 'from' | 'to') => string;
}

const LINK_LABELS: Partial<Record<string, string>> = { LINK: 'Lien', IMAGE: 'Image', DIAGRAM: 'Diagramme', DOCUMENT: 'Fichier' };

/** Nom lisible d'un fichier stocké : dernier segment de l'URL, sans le préfixe horodaté `<ms>-` posé à l'upload. */
export function fileNameFromUrl(url: string): string {
  const last = url.split(/[?#]/)[0].split('/').pop() || url;
  let name = last;
  try { name = decodeURIComponent(last); } catch { /* segment mal encodé : gardé tel quel */ }
  return name.replace(/^\d{10,}-/, '') || last;
}

function buildMedia(item: Item): ItemSheet['media'] {
  if (!item.url || !isSafeUrl(item.url)) return null; // javascript:… jamais copié ni affiché
  const label = LINK_LABELS[item.type] ?? 'URL';
  const kind = item.type === 'IMAGE' || item.type === 'DIAGRAM' ? 'image' : item.type === 'DOCUMENT' ? 'file' : 'url';
  return { kind, label, url: item.url, name: kind === 'file' ? fileNameFromUrl(item.url) : item.title };
}

/** Description sans les <img> qui répètent le média de l'item ; null si plus rien de lisible ne reste. */
function descriptionWithoutMedia(description: string | null | undefined, media: ItemSheet['media']): string | null {
  if (!description) return null;
  let html = description;
  if (media?.kind === 'image') {
    html = html
      .replace(/<img\s[^>]*>/gi, tag => (/\ssrc\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] === media.url ? '' : tag))
      .replace(/<p>\s*<\/p>/gi, '');
  }
  return htmlToMarkdown(html).trim() ? html : null;
}

export function buildItemSheet({ item, children = [], spaceName, parentTitle, labels, relationLabel }: BuildItemSheetInput): ItemSheet {
  const fields: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => { if (value && value.trim()) fields.push({ label, value }); };

  if (item.type && item.type !== 'UNDEFINED') add('Type', labels.typeLabel(item.type) ?? item.type);
  if (item.status && item.status !== 'undefined') add('Statut', labels.statusLabel(item.status) ?? item.status);
  if (item.priority != null) add('Priorité', labels.priorityLabel(item.priority) ?? `P${item.priority}`);
  add('Espace', spaceName);
  add('Parent', item.parent?.title ?? parentTitle);
  add('Assigné à', item.assignedTo?.name);
  if (item.startDate) add('Début', labels.formatDate(item.startDate));
  if (item.endDate) add('Fin', labels.formatDate(item.endDate));
  if (item.dueDate) add('Échéance', labels.formatDate(item.dueDate));

  const relations = [
    ...(item.relationsFrom ?? []).map(r => ({ label: relationLabel(r.type, 'from'), title: r.toItem?.title ?? '?', comment: r.label || null })),
    ...(item.relationsTo ?? []).map(r => ({ label: relationLabel(r.type, 'to'), title: r.fromItem?.title ?? '?', comment: r.label || null })),
  ];

  const media = buildMedia(item);
  return {
    title: item.title,
    fields,
    tags: (item.tags ?? []).map(t => t.name),
    descriptionHtml: descriptionWithoutMedia(item.description, media),
    media,
    children: children.map(c => ({ id: c.id, title: c.title, status: c.status && c.status !== 'undefined' ? (labels.statusLabel(c.status) ?? c.status) : null })),
    relations,
    contributions: (item.contributions ?? []).map(c => ({
      author: c.author?.name || 'Anonyme',
      date: labels.formatDate(c.createdAt),
      contentHtml: c.content,
    })),
  };
}

// ---------------------------------------------------------------------------
// HTML → Markdown (sous-ensemble produit par l'éditeur)
// ---------------------------------------------------------------------------

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return m ? decodeEntities(m[2] ?? m[3] ?? '') : null;
}

function convertLists(html: string): string {
  // Traite les listes les plus internes d'abord pour gérer l'imbrication
  const listRe = /<(ul|ol)[^>]*>((?:(?!<\/?(?:ul|ol)[\s>])[\s\S])*)<\/\1>/i;
  let prev: string;
  do {
    prev = html;
    html = html.replace(listRe, (_, kind: string, inner: string) => {
      const items = [...inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => m[1]);
      const lines = items.map((content, i) => {
        const bullet = kind.toLowerCase() === 'ol' ? `${i + 1}. ` : '- ';
        const text = content.replace(/<\/?p[^>]*>/gi, '').trim();
        // Sous-listes déjà converties : indentation des lignes suivantes
        return bullet + text.split('\n').filter(l => l.trim()).join('\n  ');
      });
      return `\n\n${lines.join('\n')}\n\n`;
    });
  } while (html !== prev);
  return html;
}

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let s = html.replace(/\r\n?/g, '\n');
  // Texte brut sans balise : conservé tel quel
  if (!/<[a-z][\s\S]*>/i.test(s)) return decodeEntities(s).trim();

  s = s.replace(/\n/g, ' ');
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => `\n\n\`\`\`\n${c.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')}\n\`\`\`\n\n`);
  s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, c) => `\n\n${'#'.repeat(Math.min(Number(n) + 1, 6))} ${c.trim()}\n\n`);
  s = s.replace(/<(strong|b)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _t, _a, c) => (c.trim() ? `**${c.trim()}**` : ''));
  s = s.replace(/<(em|i)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _t, _a, c) => (c.trim() ? `*${c.trim()}*` : ''));
  s = s.replace(/<(s|del|strike)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (_, _t, _a, c) => `~~${c}~~`);
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${c}\``);
  s = s.replace(/<a\s[^>]*>([\s\S]*?)<\/a>/gi, (m, c) => {
    const href = attr(m, 'href');
    const text = c.replace(/<[^>]+>/g, '').trim();
    if (!href) return text;
    return !text || text === href ? href : `[${text}](${href})`;
  });
  s = s.replace(/<img\s[^>]*>/gi, m => {
    const src = attr(m, 'src');
    return src && !src.startsWith('data:') ? `![${attr(m, 'alt') ?? ''}](${src})` : '';
  });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = convertLists(s);
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => {
    const inner = c.replace(/<\/(p|div)>/gi, '\n').replace(/<[^>]+>/g, '').trim();
    return `\n\n${inner.split('\n').map((l: string) => `> ${l.trim()}`).join('\n')}\n\n`;
  });
  s = s.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');
  s = s.replace(/<\/(p|div|h[1-6]|tr|table)>/gi, '\n\n');
  s = s.replace(/<\/t[dh]>/gi, ' | ');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map(l => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+(?![ \t-]|\d)/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Rendus
// ---------------------------------------------------------------------------

export function itemSheetToMarkdown(sheet: ItemSheet): string {
  const out: string[] = [`# ${sheet.title}`];
  if (sheet.fields.length) out.push(sheet.fields.map(f => `- **${f.label}** : ${f.value}`).join('\n'));
  if (sheet.tags.length) out.push(`**Tags** : ${sheet.tags.join(', ')}`);
  const m = sheet.media;
  if (m?.kind === 'image') out.push(`![${m.name}](${m.url})`);
  else if (m?.kind === 'file') out.push(`**${m.label}** : [${m.name}](${m.url})`);
  else if (m) out.push(`**${m.label}** : ${m.url}`);
  if (sheet.descriptionHtml) out.push(`## Description\n\n${htmlToMarkdown(sheet.descriptionHtml)}`);
  if (sheet.children.length) {
    out.push(`## Éléments enfants (${sheet.children.length})\n\n${sheet.children.map(c => `- ${c.title}${c.status ? ` — ${c.status}` : ''}`).join('\n')}`);
  }
  if (sheet.relations.length) {
    out.push(`## Relations\n\n${sheet.relations.map(r => `- ${r.label} : ${r.title}${r.comment ? ` (${r.comment})` : ''}`).join('\n')}`);
  }
  if (sheet.contributions.length) {
    const blocks = sheet.contributions.map(c => `**${c.author}** — ${c.date}\n\n${htmlToMarkdown(c.contentHtml)}`);
    out.push(`## Contributions (${sheet.contributions.length})\n\n${blocks.join('\n\n')}`);
  }
  return out.join('\n\n') + '\n';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function itemSheetToHtml(sheet: ItemSheet): string {
  const parts: string[] = [`<h1>${esc(sheet.title)}</h1>`];
  if (sheet.fields.length) parts.push(`<ul>${sheet.fields.map(f => `<li><strong>${esc(f.label)}</strong> : ${esc(f.value)}</li>`).join('')}</ul>`);
  if (sheet.tags.length) parts.push(`<p><strong>Tags</strong> : ${esc(sheet.tags.join(', '))}</p>`);
  const m = sheet.media;
  if (m?.kind === 'image') {
    // width/style : taille plafonnée dans Word et les mails, qui ignorent souvent l'un ou l'autre
    parts.push(`<p><img src="${esc(m.url)}" alt="${esc(m.name)}" width="640" style="max-width:100%;height:auto"></p>`);
  } else if (m?.kind === 'file') {
    parts.push(`<p><strong>${esc(m.label)}</strong> : 📎 <a href="${esc(m.url)}">${esc(m.name)}</a></p>`);
  } else if (m) {
    parts.push(`<p><strong>${esc(m.label)}</strong> : <a href="${esc(m.url)}">${esc(m.url)}</a></p>`);
  }
  if (sheet.descriptionHtml) parts.push(`<h2>Description</h2>${sanitizeHtml(sheet.descriptionHtml)}`);
  if (sheet.children.length) {
    parts.push(`<h2>Éléments enfants (${sheet.children.length})</h2><ul>${sheet.children.map(c => `<li>${esc(c.title)}${c.status ? ` — ${esc(c.status)}` : ''}</li>`).join('')}</ul>`);
  }
  if (sheet.relations.length) {
    parts.push(`<h2>Relations</h2><ul>${sheet.relations.map(r => `<li>${esc(r.label)} : ${esc(r.title)}${r.comment ? ` (${esc(r.comment)})` : ''}</li>`).join('')}</ul>`);
  }
  if (sheet.contributions.length) {
    parts.push(`<h2>Contributions (${sheet.contributions.length})</h2>${sheet.contributions.map(c => `<p><strong>${esc(c.author)}</strong> — ${esc(c.date)}</p>${sanitizeHtml(c.contentHtml)}`).join('')}`);
  }
  return parts.join('\n');
}

/** Adresse absolue du média : en dev les uploads locaux sont relatifs (/api/local-uploads/…), illisibles hors de l'appli. */
export function withAbsoluteMediaUrl(sheet: ItemSheet, origin: string): ItemSheet {
  if (!sheet.media) return sheet;
  try {
    return { ...sheet, media: { ...sheet.media, url: new URL(sheet.media.url, origin).href } };
  } catch {
    return sheet;
  }
}

/** Largeur max du PNG intégré : 2× l'affichage (640 px), net sans alourdir le collage. */
const EMBED_MAX_WIDTH = 1280;

/** Image → PNG en data URL : les images stockées sont en WebP, que Word / Outlook ne lisent pas toujours.
 * null si l'image est illisible (CORS du stockage, réseau, format) — l'appelant garde alors l'adresse. */
export async function imageToPngDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());
    const scale = Math.min(1, EMBED_MAX_WIDTH / bitmap.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/** HTML copié : image intégrée en PNG si possible, sinon <img> sur l'adresse (absolue) du média. */
export async function itemSheetToClipboardHtml(sheet: ItemSheet, toPng = imageToPngDataUrl): Promise<string> {
  const m = sheet.media;
  if (m?.kind !== 'image') return itemSheetToHtml(sheet);
  const png = await toPng(m.url);
  return itemSheetToHtml(png ? { ...sheet, media: { ...m, url: png } } : sheet);
}

/** Copie la fiche (HTML + Markdown). Repli Markdown seul si ClipboardItem est indisponible. */
export async function copyItemSheet(sheet: ItemSheet): Promise<void> {
  const abs = withAbsoluteMediaUrl(sheet, window.location.origin);
  const markdown = itemSheetToMarkdown(abs);
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      // HTML passé en promesse : l'écriture démarre pendant le clic (geste utilisateur exigé par Safari)
      const html = itemSheetToClipboardHtml(abs).then(h => new Blob([h], { type: 'text/html' }));
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': html,
        'text/plain': new Blob([markdown], { type: 'text/plain' }),
      })]);
      return;
    } catch {
      // Certains navigateurs refusent text/html : repli texte ci-dessous
    }
  }
  await navigator.clipboard.writeText(markdown);
}
