/*
 * Impression d'un article (papier ou PDF) : copie le rendu de l'article (déjà nettoyé par sanitizeHtml) dans une
 * fenêtre dédiée, avec les feuilles de style de la page, puis lance l'impression. Même principe que printItem
 * (lib/itemExport.ts) : imprimer la page elle-même couperait le contenu (mise en page de l'appli en pleine hauteur,
 * overflow-hidden) et inclurait la barre latérale et le bandeau.
 */
export function printArticle(element: HTMLElement, title: string) {
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => n.outerHTML).join('');
  const win = window.open('', '_blank');
  if (!win) return;
  const safeTitle = title.replace(/[<>&"]/g, '');
  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${safeTitle}</title><base href="${location.origin}/">${styles}</head><body class="bg-white text-black"><main style="max-width:48rem;margin:0 auto;padding:2rem">${element.innerHTML}</main></body></html>`);
  win.document.close();
  win.onload = () => win.print();
}
