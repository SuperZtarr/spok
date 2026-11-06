/* Tests de la grille des vignettes de la Loupe : contenu progressif selon le type et la taille, adresses dangereuses
   ignorées, informations absentes omises. */
import { describe, it, expect } from 'vitest';
import { fileExtension, hasImage, vignetteContent, type VignetteSource } from './loupe-vignette';

const labels = { type: 'Tâches', status: 'En cours' };
const content = (item: VignetteSource, level: 'small' | 'mid' | 'big') => vignetteContent(item, level, labels);
const description = '<p>Premier</p><p>Second</p>';

describe('grille des vignettes', () => {
  it.each(['TASK', 'NOTE', 'LINK', 'DOCUMENT', 'ARTICLE'])('%s : la vignette minimale n\'ajoute rien', (type) => {
    expect(content({ type, url: 'https://exemple.fr/a.pdf', description }, 'small')).toEqual({ meta: [] });
  });

  it.each(['IMAGE', 'DIAGRAM'])('%s : la vignette minimale porte son image, sans autre ajout', (type) => {
    const url = 'https://exemple.fr/a.webp';
    expect(content({ type, url, description }, 'small')).toEqual({ meta: [], imageUrl: url });
    expect(content({ type, url: 'javascript:alert(1)' }, 'small')).toEqual({ meta: [] });
  });

  it('tâche : statut et échéance, puis priorité, assigné et description', () => {
    const item = { type: 'TASK', dueDate: '2026-03-02T12:00:00Z', priority: 4, assigneeName: 'Camille', description };
    const mid = content(item, 'mid');
    expect(mid.meta).toHaveLength(2);
    expect(mid.meta[1]).toMatch(/^Échéance .*2026$/);
    expect(mid.text).toBeUndefined();
    const big = content(item, 'big');
    expect(big.meta).toContain('Camille');
    expect(big.meta).toHaveLength(4);
    expect(big.text).toBe('Premier Second');
  });

  it('projet : les enfants n\'apparaissent qu\'en zoomée', () => {
    const item = { type: 'PROJECT', childCount: 3 };
    expect(content(item, 'mid').meta).toEqual(['En cours']);
    expect(content(item, 'big').meta).toEqual(['En cours', '3 enfants']);
  });

  it('période : la durée compte le premier et le dernier jour', () => {
    const item = { type: 'PERIOD', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-04T00:00:00Z' };
    expect(content(item, 'mid').meta).toHaveLength(1);
    expect(content(item, 'big').meta[1]).toBe('3 jours');
  });

  it('note : une ligne de texte, puis un texte plus long', () => {
    const item = { type: 'NOTE', description: `<p>${'mot '.repeat(200)}</p>` };
    const mid = content(item, 'mid');
    const big = content(item, 'big');
    expect(mid.textLines).toBe(1);
    expect(big.textLines).toBe(4);
    expect(big.text!.length).toBeGreaterThan(mid.text!.length);
  });

  it('document : pièce jointe, extension puis bouton Ouvrir, description seulement si elle existe', () => {
    const item = { type: 'DOCUMENT', url: 'https://exemple.fr/fichiers/plan.pdf?v=2' };
    expect(content(item, 'mid')).toMatchObject({ meta: ['PDF'], openHref: undefined });
    const big = content(item, 'big');
    expect(big.openHref).toBe(item.url);
    expect(big.text).toBeUndefined();
  });

  it('lien : nom du site, puis adresse complète, description et bouton Ouvrir', () => {
    const item = { type: 'LINK', url: 'https://www.exemple.fr/page', description };
    expect(content(item, 'mid').meta).toEqual(['exemple.fr']);
    expect(content(item, 'big')).toMatchObject({ address: item.url, openHref: item.url, text: 'Premier Second' });
  });

  it('adresse dangereuse : ni bouton, ni adresse, ni image', () => {
    const url = 'javascript:alert(1)';
    expect(content({ type: 'LINK', url }, 'big')).toMatchObject({ meta: [], address: undefined, openHref: undefined });
    expect(content({ type: 'DOCUMENT', url }, 'big').openHref).toBeUndefined();
    expect(content({ type: 'IMAGE', url }, 'big').imageUrl).toBeUndefined();
    expect(hasImage('IMAGE', url)).toBe(false);
  });

  it('image et diagramme : miniature aux deux tailles, sans description', () => {
    const item = { type: 'DIAGRAM', url: 'https://exemple.fr/schema.webp', description };
    expect(content(item, 'mid').imageUrl).toBe(item.url);
    expect(content(item, 'big')).toEqual({ meta: [], imageUrl: item.url });
    expect(hasImage('DIAGRAM', item.url)).toBe(true);
    expect(hasImage('NOTE', item.url)).toBe(false);
  });

  it('autre type : type et statut, puis description ; information absente omise', () => {
    expect(content({ type: 'ARTICLE', description }, 'mid').meta).toEqual(['Tâches', 'En cours']);
    expect(content({ type: 'ARTICLE', description }, 'big').text).toBe('Premier Second');
    expect(vignetteContent({ type: 'CONFIG' }, 'mid', { type: 'Configuration', status: null }).meta).toEqual(['Configuration']);
  });
});

describe('extension d\'un fichier', () => {
  it.each([
    ['https://exemple.fr/a/plan.final.PDF', 'PDF'],
    ['/uploads/123-note.docx?x=1', 'DOCX'],
    ['https://exemple.fr/sans-extension', null],
    ['https://exemple.fr/a.pas une extension', null],
    [null, null],
  ])('%s → %s', (url, expected) => {
    expect(fileExtension(url)).toBe(expected);
  });
});
