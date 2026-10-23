/* TNR de sanitizeHtml — scripts, gestionnaires on*, URL javascript: retirés ; mise en forme de l'éditeur conservée. */
import { describe, it, expect } from 'vitest';
import { sanitizeHtml, isSafeUrl, safeHref, htmlToText } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('garde la mise en forme de l\'éditeur', () => {
    const html = '<h2>Titre</h2><p>Un <strong>mot</strong> <a href="https://x.fr" target="_blank">lien</a></p><ul><li>a</li></ul><img src="https://r2/i.webp" alt="i">';
    const out = sanitizeHtml(html);
    expect(out).toContain('<h2>Titre</h2>');
    expect(out).toContain('<strong>mot</strong>');
    expect(out).toContain('href="https://x.fr"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('<img src="https://r2/i.webp" alt="i">');
  });

  it('retire scripts, iframes, gestionnaires et URL javascript:', () => {
    const out = sanitizeHtml('<p onclick="x()">a<script>alert(1)</script></p><iframe src="https://e"></iframe><a href="javascript:alert(1)">b</a><img src="x" onerror="alert(1)">');
    expect(out).not.toMatch(/script|iframe|onclick|onerror|javascript:/i);
    expect(out).toContain('<p>a</p>');
    expect(out).toContain('<a>b</a>');
  });

  it('import du forum : vidéo YouTube, image masquée si morte, styles et repliables conservés', () => {
    const video = '<div class="aspect-video my-2"><iframe src="https://www.youtube-nocookie.com/embed/QaVr04ua?start=3" class="w-full h-full" frameborder="0" loading="lazy" allowfullscreen></iframe></div>';
    expect(sanitizeHtml(video)).toContain('<iframe src="https://www.youtube-nocookie.com/embed/QaVr04ua?start=3"');
    const img = `<img src="http://h.fr/a.jpg" alt="" class="max-w-full" loading="lazy" onerror="this.style.display='none'">`;
    expect(sanitizeHtml(img)).toContain(`onerror="this.style.display='none'"`);
    expect(sanitizeHtml('<span style="color: red; font-size: 120%; position: fixed">x</span>')).toBe('<span style="color: red; font-size: 120%">x</span>');
    expect(sanitizeHtml('<details class="spoiler"><summary>Voir</summary>caché</details>')).toBe('<details class="spoiler"><summary>Voir</summary>caché</details>');
  });

  it('iframe hors YouTube, onerror modifié et style url() toujours retirés', () => {
    expect(sanitizeHtml('<iframe src="https://evil.fr/embed/x"></iframe>')).toBe('');
    expect(sanitizeHtml('<iframe src="https://www.youtube.com/embed/x" onload="alert(1)"></iframe>')).not.toContain('onload');
    expect(sanitizeHtml(`<img src="x" onerror="this.style.display='none';alert(1)">`)).not.toContain('onerror');
    expect(sanitizeHtml('<p style="background-color: url(javascript:alert(1))">a</p>')).toBe('<p>a</p>');
  });

  it('déballe une balise inconnue en gardant son texte', () => {
    expect(sanitizeHtml('<p><font color="red">rouge</font></p>')).toBe('<p>rouge</p>');
  });

  it('isSafeUrl : http(s) et chemins oui, javascript: non', () => {
    expect(isSafeUrl('https://r2/a.pdf')).toBe(true);
    expect(isSafeUrl('/uploads/a.png')).toBe(true);
    expect(isSafeUrl(' javascript:alert(1)')).toBe(false);
    expect(isSafeUrl(null)).toBe(false);
  });

  it('safeHref : lien inerte (undefined) pour un schéma non sûr', () => {
    expect(safeHref('https://x.fr')).toBe('https://x.fr');
    expect(safeHref('javascript:alert(1)')).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
  });

  it('htmlToText : texte extrait sans déclencher les gestionnaires d\'image', async () => {
    (window as unknown as { __xss?: boolean }).__xss = false;
    expect(htmlToText('<p>Bonjour <b>toi</b></p><img src="x" onerror="window.__xss = true">')).toBe('Bonjour toi');
    await new Promise((r) => setTimeout(r, 50));
    expect((window as unknown as { __xss?: boolean }).__xss).toBe(false);
  });

  it('vide pour null', () => {
    expect(sanitizeHtml(null)).toBe('');
  });
});
