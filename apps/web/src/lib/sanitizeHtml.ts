/* Nettoyage du HTML enregistré (description, contributions) avant rendu par dangerouslySetInnerHTML.
 * L'API ne filtre pas le HTML (un client API ou MCP peut écrire n'importe quoi) : tout affichage HTML brut doit
 * passer par ici. Liste blanche des balises produites par l'éditeur (TipTap) et par l'import du forum ; tout le
 * reste est déballé (contenu texte conservé) ou supprimé avec son contenu (script, style, object…). Attributs :
 * liste blanche, URL limitées à http(s), mailto, tel, chemins relatifs et data:image ; styles filtrés propriété
 * par propriété. Exceptions calées sur l'inventaire prod du 2026-10-23 (import du forum, à ne pas casser) :
 * - <iframe> gardée seulement vers youtube(-nocookie).com/embed (2 189 vidéos en prod, toutes youtube-nocookie) ;
 * - onerror gardé seulement s'il vaut EXACTEMENT this.style.display='none' (masque les images mortes ; code figé,
 *   non détournable) — tout autre on* est retiré.
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
