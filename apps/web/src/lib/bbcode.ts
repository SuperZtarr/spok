/**
 * Text utilities for handling markup content
 * Supports both BBCode (legacy) and HTML (current)
 */

/**
 * Strip HTML tags to get plain text (useful for previews/excerpts)
 */
export function stripHtml(html: string): string {
  if (!html) return '';

  let text = html;

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Strip BBCode tags to get plain text (legacy support)
 */
export function stripBbcode(bbcode: string): string {
  if (!bbcode) return '';

  let text = bbcode;

  // Remove BBCode tags
  text = text.replace(/\[\/?\w+(?:=[^\]]+)?\]/gi, '');

  // Convert <br> to spaces
  text = text.replace(/<br\s*\/?>/gi, ' ');

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/**
 * Strip all markup (both HTML and BBCode) to get plain text
 * Use this for content that might be in either format
 */
export function stripMarkup(content: string): string {
  if (!content) return '';

  // First strip HTML, then BBCode (handles mixed content)
  return stripBbcode(stripHtml(content));
}
