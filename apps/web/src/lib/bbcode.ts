/**
 * BBCode to HTML converter for SMF forum content
 * Handles common BBCode tags and emoticons
 */

// Emoticon mappings (SMF style)
const EMOTICONS: Record<string, string> = {
  ':)': '🙂',
  ':-)': '🙂',
  ':(': '😞',
  ':-(': '😞',
  ';)': '😉',
  ';-)': '😉',
  ':D': '😃',
  ':-D': '😃',
  ';D': '😆',
  ':o': '😮',
  ':O': '😮',
  ':-o': '😮',
  '8)': '😎',
  '8-)': '😎',
  ':P': '😛',
  ':-P': '😛',
  '::)': '🙄',
  ':-\\': '😕',
  ':-/': '😕',
  ':-[': '😳',
  'O0': '👍',
  ':\'(': '😢',
  '>:(': '😠',
  ':x': '😡',
  ':-x': '😡',
  ':*': '😘',
  ':-*': '😘',
  '<3': '❤️',
};

// Escape HTML to prevent XSS
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// Convert emoticons to emojis
function convertEmoticons(text: string): string {
  let result = text;
  // Sort by length descending to match longer patterns first
  const sortedEmoticons = Object.entries(EMOTICONS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [emoticon, emoji] of sortedEmoticons) {
    // Escape special regex characters
    const escaped = emoticon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), emoji);
  }
  return result;
}

// Extract YouTube video ID from various URL formats
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Parse BBCode and convert to HTML
export function bbcodeToHtml(bbcode: string): string {
  if (!bbcode) return '';

  let html = bbcode;

  // Handle various forms of <br /> tags BEFORE escaping
  // Match: <br>, <br/>, <br />, <BR>, <BR/>, <BR />, and with extra spaces
  html = html.replace(/<\s*br\s*\/?\s*>/gi, '\n');

  // Also handle HTML entity encoded versions: &lt;br /&gt;, &lt;br&gt;, etc.
  html = html.replace(/&lt;\s*br\s*\/?\s*&gt;/gi, '\n');

  // Escape HTML entities (but preserve our newlines)
  html = escapeHtml(html);

  // Restore newlines as <br> tags later, after BBCode processing

  // Simple formatting tags
  html = html.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong>$1</strong>');
  html = html.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em>$1</em>');
  html = html.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>');
  html = html.replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<del>$1</del>');
  html = html.replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>');
  html = html.replace(/\[hr\]/gi, '<hr class="my-2 border-border">');

  // Color and size tags
  html = html.replace(
    /\[color=([^\]]+)\]([\s\S]*?)\[\/color\]/gi,
    '<span style="color: $1">$2</span>'
  );
  html = html.replace(
    /\[size=([^\]]+)\]([\s\S]*?)\[\/size\]/gi,
    (_, size, content) => {
      // SMF uses sizes like 10pt, 12pt, etc. or small numbers 1-7
      const sizeNum = parseInt(size);
      let fontSize = size;
      if (!isNaN(sizeNum) && sizeNum <= 7) {
        // SMF size scale: 1=8pt, 2=10pt, 3=12pt, 4=14pt, 5=18pt, 6=24pt, 7=36pt
        const sizes = ['0.5rem', '0.625rem', '0.75rem', '0.875rem', '1.125rem', '1.5rem', '2.25rem'];
        fontSize = sizes[sizeNum - 1] || '1rem';
      }
      return `<span style="font-size: ${fontSize}">${content}</span>`;
    }
  );

  // URLs
  html = html.replace(
    /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline">$2</a>'
  );
  html = html.replace(
    /\[url\]([\s\S]*?)\[\/url\]/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:no-underline break-all">$1</a>'
  );

  // Images
  html = html.replace(
    /\[img\]([\s\S]*?)\[\/img\]/gi,
    '<img src="$1" alt="Image" class="max-w-full h-auto rounded my-2" loading="lazy" onerror="this.style.display=\'none\'">'
  );
  html = html.replace(
    /\[img=([^\]]+)\]([\s\S]*?)\[\/img\]/gi,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded my-2" loading="lazy" onerror="this.style.display=\'none\'">'
  );

  // YouTube videos
  html = html.replace(
    /\[youtube\]([\s\S]*?)\[\/youtube\]/gi,
    (_, url) => {
      const videoId = extractYoutubeId(url.trim());
      if (videoId) {
        return `<div class="aspect-video my-2"><iframe src="https://www.youtube-nocookie.com/embed/${videoId}" class="w-full h-full rounded" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>`;
      }
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary underline">[YouTube] ${url}</a>`;
    }
  );

  // Quotes with author
  html = html.replace(
    /\[quote\s+author=([^\]]+?)(?:\s+link=[^\]]+)?(?:\s+date=\d+)?\s*\]([\s\S]*?)\[\/quote\]/gi,
    '<blockquote class="border-l-4 border-primary/50 pl-4 my-3 py-2 bg-muted/50 rounded-r"><div class="text-xs text-muted-foreground mb-1 font-medium">$1 a écrit :</div><div class="text-sm">$2</div></blockquote>'
  );
  // Simple quotes
  html = html.replace(
    /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    '<blockquote class="border-l-4 border-primary/50 pl-4 my-3 py-2 bg-muted/50 rounded-r"><div class="text-sm">$1</div></blockquote>'
  );

  // Code blocks
  html = html.replace(
    /\[code\]([\s\S]*?)\[\/code\]/gi,
    '<pre class="bg-muted p-3 rounded my-2 overflow-x-auto text-sm font-mono"><code>$1</code></pre>'
  );

  // Lists
  html = html.replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul class="list-disc pl-5 my-2">$1</ul>');
  html = html.replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, '<ol class="list-decimal pl-5 my-2">$1</ol>');
  html = html.replace(/\[\*\]/gi, '</li><li>');
  // Clean up empty li tags
  html = html.replace(/<ul([^>]*)><\/li>/gi, '<ul$1>');
  html = html.replace(/<ol([^>]*)><\/li>/gi, '<ol$1>');
  html = html.replace(/<li>\s*<\/ul>/gi, '</ul>');
  html = html.replace(/<li>\s*<\/ol>/gi, '</ol>');

  // Spoiler
  html = html.replace(
    /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    '<details class="my-2"><summary class="cursor-pointer text-primary hover:underline">Spoiler (cliquer pour révéler)</summary><div class="mt-2 p-2 bg-muted rounded">$1</div></details>'
  );
  html = html.replace(
    /\[spoiler=([^\]]+)\]([\s\S]*?)\[\/spoiler\]/gi,
    '<details class="my-2"><summary class="cursor-pointer text-primary hover:underline">$1</summary><div class="mt-2 p-2 bg-muted rounded">$2</div></details>'
  );

  // Convert emoticons to emojis
  html = convertEmoticons(html);

  // Convert newlines to <br> tags
  html = html.replace(/\n/g, '<br>');

  // Clean up excessive <br> tags
  html = html.replace(/(<br>\s*){3,}/g, '<br><br>');

  // Decode common HTML entities that were in the original text
  html = html.replace(/&amp;nbsp;/g, ' ');
  html = html.replace(/&amp;quot;/g, '"');
  html = html.replace(/&amp;amp;/g, '&');
  html = html.replace(/&amp;lt;/g, '<');
  html = html.replace(/&amp;gt;/g, '>');

  return html;
}

// Strip BBCode tags to get plain text (useful for previews/excerpts)
export function stripBbcode(bbcode: string): string {
  if (!bbcode) return '';

  let text = bbcode;

  // Remove all BBCode tags
  text = text.replace(/\[\/?\w+(?:=[^\]]+)?\]/gi, '');

  // Convert <br> to spaces
  text = text.replace(/<br\s*\/?>/gi, ' ');

  // Convert emoticons
  text = convertEmoticons(text);

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}
