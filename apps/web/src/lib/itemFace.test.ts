/* Tests du visage d'un élément (lib/itemFace.ts) : miniature tirée des contenus, pastilles, contenu progressif selon le
   format (ligne, carte, grande : tout ce qui est renseigné, quel que soit le type, depuis le 2026-11-20), adresses
   dangereuses ignorées, informations absentes omises, aucun repli sur l'ancien champ url (lot 4).
   Reprend les cas de l'ancienne grille de la Loupe (loupe-vignette.test.ts). */
import { describe, it, expect } from 'vitest';
import { badgesOf, coverOf, fileExtension, itemFace, type FaceContent, type FaceSource, type VignetteFormat } from './itemFace';

const labels = { type: 'Tâches', status: 'En cours' };
const face = (item: FaceSource, format: VignetteFormat) => itemFace(item, format, labels);
/** Élément sans statut : seules ses autres infos apparaissent */
const bare = (item: FaceSource, format: VignetteFormat) => itemFace(item, format, { type: 'Éléments', status: null });
const description = '<p>Premier</p><p>Second</p>';
const img = (url: string): FaceContent => ({ kind: 'IMAGE', url });

describe('miniature et pastilles', () => {
  it('première image, sinon premier schéma, sinon icône', () => {
    const schema: FaceContent = { kind: 'DIAGRAM', url: 'https://r2/s.png' };
    expect(coverOf({ type: 'UNDEFINED', contents: [schema, img('https://r2/a.webp'), img('https://r2/b.webp')] })).toEqual({ kind: 'image', url: 'https://r2/a.webp' });
    expect(coverOf({ type: 'UNDEFINED', contents: [schema] })).toEqual({ kind: 'schema', url: 'https://r2/s.png' });
    expect(coverOf({ type: 'UNDEFINED', contents: [{ kind: 'DIAGRAM', url: null }] })).toEqual({ kind: 'icon' });
    expect(coverOf({ type: 'TASK' })).toEqual({ kind: 'icon' });
  });

  it('adresse dangereuse : pas de miniature', () => {
    expect(coverOf({ type: 'UNDEFINED', contents: [img('javascript:alert(1)')] })).toEqual({ kind: 'icon' });
  });

  it('pastilles dans l\'ordre fixe, miniature non comptée', () => {
    const contents: FaceContent[] = [
      { kind: 'LINK', url: 'https://a.fr' }, img('https://r2/a.webp'), img('https://r2/b.webp'),
      { kind: 'FILE', url: 'https://r2/x.pdf' }, { kind: 'FILE', url: 'https://r2/y.pdf' },
    ];
    expect(badgesOf({ type: 'UNDEFINED', contents })).toEqual([
      { kind: 'IMAGE', count: 1 }, { kind: 'FILE', count: 2 }, { kind: 'LINK', count: 1 },
    ]);
    expect(badgesOf({ type: 'UNDEFINED', contents: [img('https://r2/a.webp')] })).toEqual([]);
  });

  it('sans contenus : icône du type, aucune pastille (plus de repli sur l\'ancien champ url)', () => {
    expect(coverOf({ type: 'UNDEFINED', contents: [] })).toEqual({ kind: 'icon' });
    expect(badgesOf({ type: 'UNDEFINED' })).toEqual([]);
  });

  it('un fichier déposé seul (Élément) a sa miniature', () => {
    expect(coverOf({ type: 'UNDEFINED', contents: [img('https://r2/photo.jpg')] }).kind).toBe('image');
  });

  it('aperçu d\'un fichier : 1re page après image et schéma, extension en pastille, fichier non compté', () => {
    const pdf: FaceContent = { kind: 'FILE', url: 'https://r2/x.pdf', name: 'Rapport.pdf', previewUrl: 'https://r2/p.webp' };
    const bare: FaceContent = { kind: 'FILE', url: 'https://r2/y.zip' };
    expect(coverOf({ type: 'UNDEFINED', contents: [bare, pdf] })).toEqual({ kind: 'document', url: 'https://r2/p.webp', label: 'PDF' });
    expect(coverOf({ type: 'UNDEFINED', contents: [pdf, img('https://r2/a.webp')] }).kind).toBe('image');
    expect(badgesOf({ type: 'UNDEFINED', contents: [bare, pdf] })).toEqual([{ kind: 'FILE', count: 1 }]);
    expect(coverOf({ type: 'UNDEFINED', contents: [{ ...pdf, previewUrl: 'javascript:alert(1)' }] })).toEqual({ kind: 'icon' });
  });

  it('sans description : début du premier fichier en extrait (carte, grande), rien en ligne', () => {
    const contents: FaceContent[] = [{ kind: 'FILE', url: 'https://r2/x.pdf', excerpt: 'Ordre du jour du comité' }];
    expect(face({ type: 'UNDEFINED', contents }, 'carte').text).toBe('Ordre du jour du comité');
    expect(face({ type: 'UNDEFINED', contents }, 'ligne').text).toBeUndefined();
    expect(face({ type: 'UNDEFINED', contents, description }, 'carte').text).toBe('Premier Second');
  });
});

describe('contenu progressif selon le format', () => {
  it('tâche : statut en ligne ; statut, échéance, assigné en carte ; type en plus en grande', () => {
    const item = { type: 'TASK', dueDate: '2026-03-02T12:00:00Z', priority: 4, assigneeName: 'Camille', description };
    expect(face(item, 'ligne').meta).toEqual(['En cours']);
    const carte = face(item, 'carte');
    expect(carte.meta).toHaveLength(3);
    expect(carte.meta[1]).toMatch(/^Échéance .*2026$/);
    expect(carte.meta[2]).toBe('Camille');
    expect(carte).toMatchObject({ text: 'Premier Second', textLines: 2 });
    const grande = face(item, 'grande');
    expect(grande.meta[0]).toBe('Tâches');
    expect(grande.meta).toHaveLength(4);
    expect(grande).toMatchObject({ text: 'Premier Second', textLines: 4 });
  });

  it('élément (type par défaut) : statut, dates, assigné en carte ; durée, enfants, relations en grande', () => {
    const item = {
      type: 'UNDEFINED', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-04T00:00:00Z',
      assignedTo: { name: 'Lou' }, childCount: 1, relationCount: 2,
    };
    const carte = face(item, 'carte').meta;
    expect(carte[0]).toBe('En cours');
    expect(carte[1]).toContain('→');
    expect(carte[2]).toBe('Lou');
    expect(carte).toHaveLength(3);
    expect(face(item, 'grande').meta).toEqual(['Tâches', ...carte, '3 jours', '1 enfant', '2 relations']);
  });

  it('priorité à part, dans les trois formats et pour tout type, jamais dans meta', () => {
    for (const format of ['ligne', 'carte', 'grande'] as const) {
      for (const type of ['TASK', 'PROJECT', 'UNDEFINED', 'MEETING']) {
        const f = face({ type, priority: 4 }, format);
        expect(f.priority?.label).toBe('Urgente');
        expect(f.meta).not.toContain('Urgente');
      }
    }
    expect(face({ type: 'TASK' }, 'carte').priority).toBeUndefined();
  });

  it('la ligne n\'a jamais de texte', () => {
    expect(face({ type: 'UNDEFINED', description }, 'ligne').text).toBeUndefined();
  });

  it('projet : les enfants n\'apparaissent qu\'en grande', () => {
    const item = { type: 'PROJECT', childCount: 3 };
    expect(face(item, 'carte').meta).toEqual(['En cours']);
    expect(face(item, 'grande').meta).toEqual(['Tâches', 'En cours', '3 enfants']);
  });

  it('période : la durée compte le premier et le dernier jour', () => {
    const item = { type: 'PERIOD', startDate: '2026-03-02T00:00:00Z', endDate: '2026-03-04T00:00:00Z' };
    expect(face(item, 'ligne').meta).toHaveLength(1);
    expect(bare(item, 'carte').meta).toHaveLength(1);
    expect(face(item, 'grande').meta).toContain('3 jours');
  });

  it('note : extrait en carte, plus long en grande', () => {
    const item = { type: 'UNDEFINED', description: `<p>${'mot '.repeat(200)}</p>` };
    expect(face(item, 'carte').text!.length).toBeLessThan(face(item, 'grande').text!.length);
    expect(bare(item, 'carte').meta).toEqual([]);
  });

  it('élément à fichier : extension, puis bouton Ouvrir en grande', () => {
    const item = { type: 'UNDEFINED', contents: [{ kind: 'FILE' as const, url: 'https://exemple.fr/fichiers/plan.pdf?v=2', name: 'plan.pdf' }] };
    expect(bare(item, 'carte').meta).toEqual(['PDF']);
    expect(face(item, 'carte').openHref).toBeUndefined();
    expect(face(item, 'grande').openHref).toBe('https://exemple.fr/fichiers/plan.pdf?v=2');
    expect(face(item, 'grande').address).toBeUndefined();
  });

  it('lien : nom du site, puis adresse complète et bouton Ouvrir', () => {
    const url = 'https://www.exemple.fr/page';
    const item = { type: 'UNDEFINED', contents: [{ kind: 'LINK' as const, url }], description };
    expect(bare(item, 'carte').meta).toEqual(['exemple.fr']);
    expect(face(item, 'grande')).toMatchObject({ address: url, openHref: url, text: 'Premier Second' });
  });

  it('adresse dangereuse : ni bouton, ni adresse', () => {
    const url = 'javascript:alert(1)';
    const lien = bare({ type: 'UNDEFINED', contents: [{ kind: 'LINK' as const, url }] }, 'grande');
    expect(lien.meta).toEqual(['Éléments']);
    expect(lien.address).toBeUndefined();
    expect(lien.openHref).toBeUndefined();
    expect(face({ type: 'UNDEFINED', contents: [{ kind: 'FILE' as const, url }] }, 'grande').openHref).toBeUndefined();
  });

  it('autre type : statut en carte et en ligne, type en plus en grande ; information absente omise', () => {
    expect(face({ type: 'ARTICLE', description }, 'carte').meta).toEqual(['En cours']);
    expect(face({ type: 'ARTICLE' }, 'ligne').meta).toEqual(['En cours']);
    expect(face({ type: 'ARTICLE' }, 'grande').meta).toEqual(['Tâches', 'En cours']);
    expect(itemFace({ type: 'QUESTION' }, 'carte', { type: 'Question', status: null }).meta).toEqual([]);
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
