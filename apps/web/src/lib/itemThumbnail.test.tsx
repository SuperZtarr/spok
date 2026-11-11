/* TNR de itemThumbnail — données de la carte (champs vides omis, extrait, dates), repli sans image, copie et téléchargement.
 * Le dessin réel en PNG (html-to-image) n'est pas exécutable sous jsdom : la copie reçoit un rendu factice. */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildItemThumbnail, copyItemThumbnail, withEmbeddedImage } from './itemThumbnail';
import { ItemThumbnailCard } from '../components/ItemThumbnailCard';
import type { ItemSheet } from './itemClipboard';

const sheet = (over: Partial<ItemSheet> = {}): ItemSheet => ({
  title: 'Mon élément', fields: [], tags: [], descriptionHtml: null, media: null, children: [], relations: [], contributions: [],
  ...over,
});

describe('buildItemThumbnail', () => {
  it('omet ce qui n\'est pas renseigné', () => {
    const t = buildItemThumbnail(sheet(), 'NOTE');
    expect(t).toMatchObject({ title: 'Mon élément', status: null, priority: null, imageUrl: null, excerpt: null, attachment: null, meta: [] });
  });

  it('reprend les champs ; l\'échéance prime sur les dates', () => {
    const fields = [
      { label: 'Type', value: 'Tâche' }, { label: 'Statut', value: 'En cours' }, { label: 'Priorité', value: 'Haute' },
      { label: 'Espace', value: 'Projet A' }, { label: 'Assigné à', value: 'Léa' },
      { label: 'Début', value: '1 oct.' }, { label: 'Fin', value: '5 oct.' }, { label: 'Échéance', value: '9 oct.' },
    ];
    const t = buildItemThumbnail(sheet({ fields }), 'TASK');
    expect(t).toMatchObject({ typeLabel: 'Tâche', status: 'En cours', priority: 'Haute' });
    expect(t.meta).toEqual(['Projet A', 'Échéance 9 oct.', 'Léa']);
    const sansEcheance = buildItemThumbnail(sheet({ fields: fields.filter((f) => f.label !== 'Échéance') }), 'TASK');
    expect(sansEcheance.meta[1]).toBe('1 oct. → 5 oct.');
  });

  it('extrait : texte sans balises, paragraphes séparés, tronqué', () => {
    expect(buildItemThumbnail(sheet({ descriptionHtml: '<p>Un <b>mot</b></p><p>Deux</p>' }), 'NOTE').excerpt).toBe('Un mot Deux');
    const long = buildItemThumbnail(sheet({ descriptionHtml: `<p>${'a'.repeat(500)}</p>` }), 'NOTE').excerpt!;
    expect(long.length).toBe(321);
    expect(long.endsWith('…')).toBe(true);
  });

  it('média : image, nom du fichier, domaine du lien', () => {
    const media = (kind: 'image' | 'file' | 'url', url: string, name = 'n') => ({ kind, label: 'x', url, name });
    expect(buildItemThumbnail(sheet({ media: media('image', 'https://r2/a.webp') }), 'IMAGE').imageUrl).toBe('https://r2/a.webp');
    expect(buildItemThumbnail(sheet({ media: media('file', 'https://r2/a.pdf', 'a.pdf') }), 'DOCUMENT').attachment).toBe('a.pdf');
    expect(buildItemThumbnail(sheet({ media: media('url', 'https://www.site.fr/page') }), 'LINK').attachment).toBe('site.fr');
  });

  it('contenus : première image en miniature, autres contenus en pastilles écrites', () => {
    const contents = [
      { kind: 'IMAGE' as const, url: 'https://r2/a.webp' }, { kind: 'IMAGE' as const, url: 'https://r2/b.webp' },
      { kind: 'FILE' as const, url: 'https://r2/x.pdf', name: 'x.pdf' },
    ];
    const t = buildItemThumbnail(sheet(), 'UNDEFINED', contents);
    expect(t).toMatchObject({ imageUrl: 'https://r2/a.webp', attachment: 'x.pdf' });
    expect(t.badges).toEqual([{ kind: 'IMAGE', count: 1 }, { kind: 'FILE', count: 1 }]);
    render(<ItemThumbnailCard thumb={{ ...t, imageUrl: null }} />);
    expect(screen.getByText('1 image')).toBeTruthy();
    expect(screen.getByText('1 fichier')).toBeTruthy();
  });
});

describe('withEmbeddedImage', () => {
  it('image illisible : la carte retombe sur l\'extrait', async () => {
    const t = { ...buildItemThumbnail(sheet({ descriptionHtml: '<p>Texte</p>' }), 'IMAGE'), imageUrl: 'https://r2/a.webp' };
    const ready = await withEmbeddedImage(t, async () => null);
    expect(ready.imageUrl).toBeNull();
    render(<ItemThumbnailCard thumb={ready} />);
    expect(screen.getByText('Texte')).toBeTruthy();
  });

  it('image lisible : remplacée par la data URL et affichée', async () => {
    const t = { ...buildItemThumbnail(sheet(), 'IMAGE'), imageUrl: 'https://r2/a.webp' };
    const ready = await withEmbeddedImage(t, async () => 'data:image/png;base64,xx');
    const { container } = render(<ItemThumbnailCard thumb={ready} />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,xx');
  });
});

describe('copyItemThumbnail', () => {
  const thumb = buildItemThumbnail(sheet(), 'NOTE');
  const png = new Blob(['x'], { type: 'image/png' });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubDownload() {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  }

  it('écrit le PNG dans le presse-papier', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('ClipboardItem', class { constructor(public data: unknown) {} });
    vi.stubGlobal('navigator', { clipboard: { write } });
    expect(await copyItemThumbnail(thumb, async () => png)).toBe('copied');
    expect(write).toHaveBeenCalledOnce();
  });

  it('presse-papier refusé : téléchargement', async () => {
    const click = stubDownload();
    vi.stubGlobal('ClipboardItem', class { constructor(public data: unknown) {} });
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn().mockRejectedValue(new Error('refus')) } });
    expect(await copyItemThumbnail(thumb, async () => png)).toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
  });

  it('PNG impossible à créer : erreur remontée, aucun téléchargement', async () => {
    const click = stubDownload();
    vi.stubGlobal('ClipboardItem', undefined);
    await expect(copyItemThumbnail(thumb, () => Promise.reject(new Error('échec')))).rejects.toThrow('échec');
    expect(click).not.toHaveBeenCalled();
  });
});
