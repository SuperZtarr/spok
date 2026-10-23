/* Nettoyage du HTML enregistré (description, contributions) avant rendu par dangerouslySetInnerHTML.
 * L'API ne filtre pas le HTML (un client API ou MCP peut écrire n'importe quoi) : tout affichage HTML brut doit
 * passer par ici. Liste blanche des balises produites par l'éditeur (TipTap) et par l'import du forum ; tout le
 * reste est déballé (contenu texte conservé) ou supprimé avec son contenu (script, style, object…). Attributs :
 * liste blanche, URL limitées à http(s), mailto, tel, chemins relatifs et data:image ; styles filtrés propriété
 * par propriété. Exceptions calées sur l'inventaire prod du 2026-10-23 (import du forum, à ne pas casser) :
 * - <iframe> gardée seulement vers youtube(-nocookie).com/embed (2 189 vidéos en prod, toutes youtube-nocookie) ;
 * - onerror gardé seulement s'il vaut EXACTEMENT this.style.display='none' (masque les images mortes ; code figé,
 *   non détournable) — tout autre on* est retiré.
 * Classes : seules celles de l'éditeur et de l'import du forum sont gardées (ALLOWED_CLASSES), les autres retirées —
 * sinon un contenu pourrait prendre fixed / inset-0 / z-50 de Tailwind et recouvrir l'interface (faux bouton,
 * revue sécurité 2026-10-23). Une nouvelle classe produite par l'éditeur doit être ajoutée ici.
 * Utilisé par tous les rendus HTML de contenu (vues Texte / Discussions, modale item, vue lecture, séance live,
 * e-mails de communauté, impression, copie de fiche). safeHref : liens vers item.url ; htmlToText : texte brut.
 * Règle businessRules « user-html-sanitized ». Pas de dépendance (DOMParser du navigateur / jsdom). */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike', 'mark', 'sub', 'sup', 'code', 'pre',
  'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 'label', 'input', 'details', 'summary', 'time',
  'iframe',
]);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'object', 'embed', 'noscript', 'template', 'link', 'meta', 'form', 'svg', 'math', 'frame', 'frameset']);
const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'target', 'rel', 'class', 'colspan', 'rowspan', 'width', 'height', 'start',
  'type', 'checked', 'disabled', 'data-type', 'data-id', 'data-label', 'data-checked', 'data-mention', 'style',
  'loading', 'datetime', 'open',
]);
// Classes produites par RichTextEditor (liens, mentions) et par l'import du forum (scripts import-forum-v3 /
// transform-forum-raw) — mise en forme seulement, aucune classe de position, de calque ni de taille d'écran
const ALLOWED_CLASSES = new Set([
  'text-primary', 'underline', 'hover:underline', 'hover:no-underline', 'break-all', 'mention-user', 'mention-item',
  'text-center', 'text-xs', 'text-sm', 'text-muted-foreground', 'font-medium', 'font-mono',
  'my-2', 'my-3', 'mb-1', 'mt-2', 'p-2', 'p-3', 'pl-4', 'pl-5', 'py-2',
  'border-border', 'border-l-4', 'border-primary/50', 'bg-muted', 'bg-muted/50', 'rounded', 'rounded-r',
  'max-w-full', 'h-auto', 'w-full', 'h-full', 'aspect-video', 'overflow-x-auto', 'list-disc', 'list-decimal', 'cursor-pointer',
  'spoiler',
]);
const IFRAME_ATTRS = new Set(['src', 'class', 'width', 'height', 'loading', 'frameborder', 'allowfullscreen', 'title']);
const SAFE_URL = /^(https?:|mailto:|tel:|\/|#|\.{0,2}\/|data:image\/(png|jpe?g|gif|webp);)/i;
const VIDEO_EMBED = /^https:\/\/(www\.)?(youtube-nocookie\.com|youtube\.com)\/embed\/[\w-]+([?#][^"'<>\s]*)?$/i;
const HIDE_ON_ERROR = "this.style.display='none'";
const STYLE_PROPS = new Set([
  'color', 'background-color', 'text-align', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration',
  'width', 'min-width', 'max-width', 'height', 'margin-left', 'border-color', 'border-width',
]);
const STYLE_VALUE = /^[#\w\s.,%()'"-]+$/;

/** Ne garde que les déclarations CSS de la liste blanche, valeurs sans url(), expression() ni caractères exotiques. */
function cleanStyle(style: string): string {
  return style.split(';').map((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return '';
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim();
    return STYLE_PROPS.has(prop) && STYLE_VALUE.test(value) && !/url\(|expression\(/i.test(value) ? `${prop}: ${value}` : '';
  }).filter(Boolean).join('; ');
}

function cleanNode(node: Element): void {
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag) || (tag === 'iframe' && !VIDEO_EMBED.test(child.getAttribute('src')?.trim() ?? ''))) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      cleanNode(child);
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim();
      if (tag === 'img' && name === 'onerror' && value === HIDE_ON_ERROR) continue;
      if (name === 'style') {
        const cleaned = cleanStyle(value);
        if (cleaned) child.setAttribute('style', cleaned); else child.removeAttribute(attr.name);
        continue;
      }
      if (name === 'class') {
        const kept = value.split(/\s+/).filter((c) => ALLOWED_CLASSES.has(c)).join(' ');
        if (kept) child.setAttribute('class', kept); else child.removeAttribute(attr.name);
        continue;
      }
      const ok = (tag === 'iframe' ? IFRAME_ATTRS.has(name) : ALLOWED_ATTRS.has(name))
        && !((name === 'href' || name === 'src') && !SAFE_URL.test(value))
        && !(tag === 'input' && name === 'type' && value.toLowerCase() !== 'checkbox');
      if (!ok) child.removeAttribute(attr.name);
    }
    if (tag === 'a' && child.getAttribute('target') === '_blank') child.setAttribute('rel', 'noopener noreferrer');
    if (tag === 'input') child.setAttribute('disabled', '');
    if (tag === 'iframe') { child.replaceChildren(); continue; }
    cleanNode(child);
  }
}

/** URL utilisable telle quelle dans un href / src (même liste blanche que le HTML) — sinon ne pas la rendre cliquable. */
export function isSafeUrl(url: string | null | undefined): boolean {
  return !!url && SAFE_URL.test(url.trim());
}

/** href d'un lien vers item.url : l'URL si elle est sûre, sinon undefined (lien inerte). */
export function safeHref(url: string | null | undefined): string | undefined {
  return url && isSafeUrl(url) ? url : undefined;
}

/** Texte brut d'un HTML sans l'exécuter ni charger d'image (DOMParser, jamais innerHTML sur un élément de la page). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  cleanNode(doc.body);
  return doc.body.innerHTML;
}
